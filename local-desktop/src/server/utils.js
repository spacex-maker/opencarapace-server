const { spawn } = require("child_process");
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
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
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
        stderr: `${String(e?.message || e)} (spawn: ${cmd} cwd=${safeOpts.cwd ?? "(default)"})`,
      })
    );
  });
}

/**
 * 与 execWithOutput 相同，但将 stdout/stderr 增量回调（用于安装日志实时写入）
 */
function execWithOutputStream(cmd, args, opts = {}, onChunk) {
  const safeOpts = sanitizeSpawnOpts(opts);
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
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
      const hint = ` (spawn: ${cmd} cwd=${safeOpts.cwd ?? "(default)"})`;
      push(`${msg}${hint}\n`, "error");
      resolve({ code: 1, stdout, stderr: stderr + msg + hint });
    });
  });
}

async function hasCommand(cmd) {
  const platform = detectPlatform();
  const tmpCwd = { cwd: os.tmpdir() };
  if (platform === "windows") {
    const r = await execWithOutput("cmd.exe", ["/c", "where", cmd], tmpCwd);
    return r.code === 0 && !!r.stdout.trim();
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
  sanitizeSpawnOpts,
  sanitizeInstallEnv,
  execWithOutput,
  execWithOutputStream,
  hasCommand,
  checkUrlReachable,
};
