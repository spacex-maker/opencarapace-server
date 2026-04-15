const { spawn, execFileSync } = require("child_process");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");

/**
 * 未传 cwd 时必须落到真实目录（默认 tmp）；否则 spawn 会继承 process.cwd()，
 * 在 Electron/IDE 下 cwd 偶发非目录 → spawn ENOTDIR。
 * app.asar 内路径也不能作 cwd。
 */
function sanitizeSpawnOpts(opts = {}) {
  const merged = { ...opts };
  if (merged.cwd == null || merged.cwd === "") {
    merged.cwd = os.tmpdir();
  }
  const raw = String(merged.cwd);
  try {
    const normalized = path.normalize(raw);
    if (/\.asar([/\\]|$)/i.test(normalized)) {
      return { ...merged, cwd: os.tmpdir() };
    }
    if (!fs.existsSync(raw) || !fs.statSync(raw).isDirectory()) {
      return { ...merged, cwd: os.tmpdir() };
    }
    return merged;
  } catch {
    return { ...merged, cwd: os.tmpdir() };
  }
}

function detectPlatform() {
  const p = process.platform;
  if (p === "win32") return "windows";
  if (p === "darwin") return "macos";
  return "linux";
}

/**
 * Electron 主进程里 PATH 常被精简，spawn("cmd.exe") 会 ENOENT。
 * 必须用 ComSpec 或 System32 绝对路径（与是否找得到 openclaw 无关）。
 */
function getWindowsCmdPath() {
  if (process.platform !== "win32") return "cmd.exe";
  const comspec = process.env.ComSpec;
  if (comspec) {
    try {
      if (fs.existsSync(comspec)) return comspec;
    } catch {
      /* ignore */
    }
  }
  const fallback = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "cmd.exe");
  return fs.existsSync(fallback) ? fallback : "cmd.exe";
}

/** 注册表 Machine+User 合并 PATH（与资源管理器 / 新开 cmd 一致）；Electron 进程 env 常缺这一段 */
let _winRegPathCache = { at: 0, value: "" };
const WIN_REG_PATH_TTL_MS = 45000;

function getWindowsMachineUserPathMergedCached() {
  if (process.platform !== "win32") return "";
  const now = Date.now();
  if (_winRegPathCache.value && now - _winRegPathCache.at < WIN_REG_PATH_TTL_MS) {
    return _winRegPathCache.value;
  }
  let value = "";
  try {
    const psExe = path.join(
      process.env.SystemRoot || "C:\\Windows",
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe"
    );
    const exe = fs.existsSync(psExe) ? psExe : "powershell.exe";
    const chunk = execFileSync(
      exe,
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')",
      ],
      { encoding: "utf8", timeout: 12000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 }
    );
    value = String(chunk || "")
      .replace(/^\uFEFF/, "")
      .replace(/\r/g, "")
      .trim();
  } catch {
    value = "";
  }
  _winRegPathCache = { at: now, value };
  return value;
}

function pushUniqueDir(dirs, raw) {
  const t = typeof raw === "string" ? raw.trim().replace(/^"+|"+$/g, "") : "";
  if (!t || /[\r\n<>|]/.test(t)) return;
  const n = path.normalize(t);
  if (!dirs.some((x) => x.toLowerCase() === n.toLowerCase())) dirs.push(n);
}

/** 不依赖 `where`：直接找磁盘上的 node.exe（PATH 探测的最后保险） */
function resolveWindowsSystemNodeExeSync() {
  if (process.platform !== "win32") return null;
  const candidates = [];
  const b = process.env;
  const pf = b.ProgramFiles;
  const pf86 = b["ProgramFiles(x86)"];
  const local = b.LOCALAPPDATA;
  const home = os.homedir();
  if (pf) candidates.push(path.join(pf, "nodejs", "node.exe"));
  if (pf86) candidates.push(path.join(pf86, "nodejs", "node.exe"));
  if (local) candidates.push(path.join(local, "Programs", "nodejs", "node.exe"));
  if (home) {
    candidates.push(path.join(home, "scoop", "apps", "nodejs", "current", "node.exe"));
  }
  const nvmSym = b.NVM_SYMLINK;
  if (nvmSym) candidates.push(path.join(nvmSym, "node.exe"));
  const merged = getWindowsMachineUserPathMergedCached();
  for (const seg of merged.split(/;/)) {
    const t = seg.trim().replace(/^"+|"+$/g, "");
    if (!t) continue;
    candidates.push(path.join(t, "node.exe"));
  }
  for (const c of candidates) {
    try {
      const n = path.normalize(c);
      if (fs.existsSync(n) && fs.statSync(n).isFile()) return n;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * Electron 主进程继承的 PATH 往往不完整；探测本机 Node/npm 时叠加：
 * 常见目录、注册表 Machine+User Path、再用进程原有 tail。
 */
function envWithWindowsNodePathProbe(baseEnv = process.env) {
  const b = { ...baseEnv };
  const dirs = [];
  try {
    const pf = b.ProgramFiles || process.env.ProgramFiles;
    const pf86 = b["ProgramFiles(x86)"] || process.env["ProgramFiles(x86)"];
    const local = b.LOCALAPPDATA || process.env.LOCALAPPDATA;
    if (pf) pushUniqueDir(dirs, path.join(pf, "nodejs"));
    if (pf86) pushUniqueDir(dirs, path.join(pf86, "nodejs"));
    if (local) pushUniqueDir(dirs, path.join(local, "Programs", "nodejs"));
    const nvmSym = b.NVM_SYMLINK || process.env.NVM_SYMLINK;
    if (nvmSym) pushUniqueDir(dirs, nvmSym);
    const nvmHome = b.NVM_HOME || process.env.NVM_HOME;
    const nvmCur = String(b.NVM_CURRENT || process.env.NVM_CURRENT || "").trim();
    if (nvmHome && nvmCur) pushUniqueDir(dirs, path.join(nvmHome, nvmCur));
    const volta = b.VOLTA_HOME || process.env.VOLTA_HOME;
    if (volta) pushUniqueDir(dirs, path.join(volta, "bin"));
  } catch {
    /* ignore */
  }
  let regPath = "";
  try {
    regPath = getWindowsMachineUserPathMergedCached();
  } catch {
    /* ignore */
  }
  const tail = b.Path || b.PATH || "";
  const parts = [...dirs];
  if (regPath) parts.push(regPath);
  if (tail) parts.push(tail);
  const merged = parts.filter(Boolean).join(path.delimiter);
  b.Path = merged;
  b.PATH = merged;
  return b;
}

/**
 * Windows：同步 `where`，返回匹配到的路径行（可能多行）。未找到返回 []。
 * 必须通过 `2>nul` 吞掉 where 的 stderr；否则中文系统会往控制台刷 GBK「信息: …」，在 UTF-8 下呈乱码。
 * `execSync("where …")` 在 Electron 下有时仍会把子进程 stderr 渗到父进程控制台，因此用 execFileSync + 绝对路径 cmd。
 */
function wherePathsSync(pattern) {
  if (process.platform !== "win32") return [];
  const safe = String(pattern || "").replace(/"/g, "").trim();
  if (!safe || /[\r\n<>|&]/.test(safe)) return [];
  const cmdPath = getWindowsCmdPath();
  const script = `where "${safe}" 2>nul`;
  try {
    const out = execFileSync(cmdPath, ["/d", "/s", "/c", script], {
      encoding: "utf8",
      timeout: 5000,
      cwd: os.tmpdir(),
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    return String(out || "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  } catch (e) {
    const stdout = e && e.stdout != null ? String(e.stdout) : "";
    if (stdout.trim()) {
      return stdout
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }
}

/** 裸写的 cmd.exe / 依赖 PATH 时改为绝对路径 */
function resolveSpawnExecutable(cmd) {
  if (process.platform !== "win32") return cmd;
  const s = String(cmd);
  if (path.isAbsolute(s)) return cmd;
  const base = path.basename(s).toLowerCase();
  if (base === "cmd.exe") return getWindowsCmdPath();
  return cmd;
}

/**
 * npm / postinstall 会读 PWD、INIT_CWD；Electron 或 IDE 启动时常指向 app.asar 内或已被删除的路径，
 * 子进程若用作 cwd → spawn ENOTDIR。安装类子进程应用 tmpdir 覆盖这些变量。
 */
function sanitizeInstallEnv(extra = {}) {
  const t = os.tmpdir();
  const base = { ...process.env, ...extra };
  if (process.platform !== "win32") {
    base.PWD = t;
    base.OLDPWD = t;
    base.INIT_CWD = t;
  }
  return base;
}

function execWithOutput(cmd, args, opts = {}) {
  const safeOpts = sanitizeSpawnOpts(opts);
  const exe = resolveSpawnExecutable(cmd);
  return new Promise((resolve) => {
    const child = spawn(exe, args, {
      shell: false,
      windowsHide: true,
      ...safeOpts,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => (stdout += String(d)));
    child.stderr?.on("data", (d) => (stderr += String(d)));
    child.on("close", (code) => resolve({ code: typeof code === "number" ? code : 1, stdout, stderr }));
    child.on("error", (e) =>
      resolve({
        code: 1,
        stdout,
        stderr: `${String(e?.message || e)} (spawn: ${exe} cwd=${safeOpts.cwd ?? "(default)"})`,
      })
    );
  });
}

/**
 * 与 execWithOutput 相同，但将 stdout/stderr 增量回调（用于安装日志实时写入）
 */
function execWithOutputStream(cmd, args, opts = {}, onChunk) {
  const safeOpts = sanitizeSpawnOpts(opts);
  const exe = resolveSpawnExecutable(cmd);
  return new Promise((resolve) => {
    const child = spawn(exe, args, {
      shell: false,
      windowsHide: true,
      ...safeOpts,
    });
    let stdout = "";
    let stderr = "";
    const push = (s, stream) => {
      if (typeof onChunk === "function") {
        try {
          onChunk(s, stream);
        } catch {
          /* ignore */
        }
      }
    };
    child.stdout?.on("data", (d) => {
      const s = String(d);
      stdout += s;
      push(s, "stdout");
    });
    child.stderr?.on("data", (d) => {
      const s = String(d);
      stderr += s;
      push(s, "stderr");
    });
    child.on("close", (code) => resolve({ code: typeof code === "number" ? code : 1, stdout, stderr }));
    child.on("error", (e) => {
      const msg = String(e?.message || e);
      const hint = ` (spawn: ${exe} cwd=${safeOpts.cwd ?? "(default)"})`;
      push(`${msg}${hint}\n`, "error");
      resolve({ code: 1, stdout, stderr: stderr + msg + hint });
    });
  });
}

async function hasCommand(cmd) {
  const platform = detectPlatform();
  const tmpCwd = { cwd: os.tmpdir() };
  if (platform === "windows") {
    const base = String(cmd || "").replace(/"/g, "").trim();
    if (!base || /[\r\n]/.test(base)) return false;
    const variants = [base];
    if (!/\.(exe|cmd|bat|com)$/i.test(base)) {
      variants.push(`${base}.exe`, `${base}.cmd`);
    }
    const env = envWithWindowsNodePathProbe();
    const seen = new Set();
    for (const name of variants) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const safe = String(name).replace(/"/g, "");
      if (!safe || /[\r\n<>|&]/.test(safe)) continue;
      const r = await execWithOutput(getWindowsCmdPath(), ["/c", `where "${safe}" 2>nul`], { ...tmpCwd, env });
      if (r.code === 0 && r.stdout.trim()) return true;
    }
    return false;
  }
  const bash = "/bin/bash";
  const shell = fs.existsSync(bash) ? bash : "/bin/sh";
  const loginArg = shell === bash ? "-lc" : "-c";
  const r = await execWithOutput(shell, [loginArg, `command -v ${cmd} >/dev/null 2>&1 && echo ok`], tmpCwd);
  return r.code === 0 && r.stdout.includes("ok");
}

async function checkUrlReachable(url) {
  try {
    const res = await axios.get(url, { timeout: 1200, validateStatus: () => true });
    return res.status >= 200 && res.status < 500;
  } catch {
    return false;
  }
}

module.exports = {
  detectPlatform,
  getWindowsCmdPath,
  envWithWindowsNodePathProbe,
  resolveWindowsSystemNodeExeSync,
  wherePathsSync,
  resolveSpawnExecutable,
  sanitizeSpawnOpts,
  sanitizeInstallEnv,
  execWithOutput,
  execWithOutputStream,
  hasCommand,
  checkUrlReachable,
};
