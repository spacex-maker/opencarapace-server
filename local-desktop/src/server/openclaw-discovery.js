const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync, execSync } = require("child_process");
const {
  getManagedOpenClawEnv,
  getElectronUserDataPath,
  getExternalOpenClawRuntimeEnv,
} = require("./openclaw-workspace.js");
const { execWithOutput } = require("./utils.js");

function safeStatSync(p) {
  try {
    return fs.statSync(p);
  } catch {
    return null;
  }
}

/** spawn ENOTDIR 多见于把目录当成可执行文件；仅接受常规文件或指向文件的 symlink */
function isRunnableBinary(p) {
  if (!p || typeof p !== "string") return false;
  const st = safeStatSync(p);
  if (!st) return false;
  if (st.isDirectory()) return false;
  return st.isFile() || st.isSymbolicLink();
}

function tryOpenClawVersion(binPath) {
  if (!isRunnableBinary(binPath)) return null;
  try {
    const out = execFileSync(binPath, ["--version"], {
      encoding: "utf8",
      timeout: 8000,
      maxBuffer: 512 * 1024,
      cwd: os.tmpdir(),
    });
    const line = String(out || "")
      .trim()
      .split(/\r?\n/)[0];
    return line ? line.slice(0, 256) : null;
  } catch {
    return null;
  }
}

function pushUniqueBin(list, p) {
  if (!p || typeof p !== "string") return;
  const norm = path.normalize(p);
  if (!isRunnableBinary(norm)) return;
  if (!list.some((x) => path.resolve(x) === path.resolve(norm))) {
    list.push(norm);
  }
}

function collectStaticBinaryCandidates() {
  const home = os.homedir();
  const c = [];
  if (process.platform === "darwin") {
    pushUniqueBin(c, "/opt/homebrew/bin/openclaw");
    pushUniqueBin(c, "/usr/local/bin/openclaw");
    pushUniqueBin(c, path.join(home, ".npm-global", "bin", "openclaw"));
    pushUniqueBin(c, path.join(home, "Library", "Application Support", "OpenClaw", "bin", "openclaw"));
  } else if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA || "";
    pushUniqueBin(c, path.join(local, "Programs", "OpenClaw", "openclaw.exe"));
    for (const seg of ["npm", "yarn"]) {
      pushUniqueBin(c, path.join(local, seg, "openclaw.cmd"));
      pushUniqueBin(c, path.join(local, seg, "openclaw.exe"));
    }
  } else {
    pushUniqueBin(c, "/usr/local/bin/openclaw");
    pushUniqueBin(c, path.join(home, ".npm-global", "bin", "openclaw"));
    pushUniqueBin(c, path.join(home, ".local", "bin", "openclaw"));
  }
  return c;
}

function tryWhichOpenClaw() {
  if (process.platform === "win32") {
    try {
      const out = execSync("where openclaw", { encoding: "utf8", timeout: 5000, cwd: os.tmpdir() });
      return out
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
    } catch {
      try {
        const out = execSync("where openclaw.cmd", { encoding: "utf8", timeout: 5000, cwd: os.tmpdir() });
        return out
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);
      } catch {
        return [];
      }
    }
  }
  try {
    const out = execSync("command -v openclaw", {
      encoding: "utf8",
      shell: "/bin/bash",
      timeout: 5000,
      cwd: os.tmpdir(),
    });
    const line = String(out || "")
      .trim()
      .split(/\r?\n/)[0];
    return line ? [line] : [];
  } catch {
    return [];
  }
}

/**
 * 可扩展：各厂商 CLI 名与可选 npm 包名（未知包名则仅探测路径，卸载需用户自行处理）
 */
const CLAW_PRODUCTS = [
  { id: "openclaw", label: "OpenClaw", npmPackage: "openclaw", binaryNames: ["openclaw"] },
  { id: "tencent-claw", label: "腾讯 Claw", npmPackage: null, binaryNames: ["tencent-claw", "txclaw", "qqclaw"] },
];

function tryWhichCommand(cmd) {
  const c = String(cmd || "").trim();
  if (!c || /[\s;|&$`]/.test(c)) return [];
  if (process.platform === "win32") {
    try {
      const out = execSync(`where ${c}`, { encoding: "utf8", timeout: 5000, cwd: os.tmpdir() });
      return out
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }
  try {
    const out = execSync(`command -v ${c}`, {
      encoding: "utf8",
      shell: "/bin/bash",
      timeout: 5000,
      cwd: os.tmpdir(),
    });
    const line = String(out || "")
      .trim()
      .split(/\r?\n/)[0];
    return line ? [line] : [];
  } catch {
    return [];
  }
}

async function tryNpmGlobalBinForName(baseName) {
  const platform = process.platform;
  const name = String(baseName || "").trim();
  if (!name) return null;
  const tmpCwd = { cwd: os.tmpdir() };
  try {
    const r =
      platform === "win32"
        ? await execWithOutput("cmd.exe", ["/c", "npm", "config", "get", "prefix"], tmpCwd)
        : await execWithOutput(
            fs.existsSync("/bin/bash") ? "/bin/bash" : "/bin/sh",
            [fs.existsSync("/bin/bash") ? "-lc" : "-c", "npm config get prefix"],
            tmpCwd
          );
    if (r.code !== 0 || !r.stdout.trim()) return null;
    const prefix = r.stdout.trim().split(/\r?\n/)[0];
    if (!prefix || !path.isAbsolute(prefix)) return null;
    const winCmd = path.join(prefix, `${name}.cmd`);
    const winExe = path.join(prefix, `${name}.exe`);
    const unix = path.join(prefix, "bin", name);
    if (platform === "win32") {
      if (isRunnableBinary(winCmd)) return winCmd;
      if (isRunnableBinary(winExe)) return winExe;
      return null;
    }
    if (isRunnableBinary(unix)) return unix;
    const unixFlat = path.join(prefix, name);
    return isRunnableBinary(unixFlat) ? unixFlat : null;
  } catch {
    return null;
  }
}

async function tryNpmGlobalOpenClawBin() {
  const platform = process.platform;
  /** 禁止直接 spawn("npm")：无 cwd / PATH 边缘情况会报 spawn ENOTDIR；与安装任务并发时尤甚 */
  const tmpCwd = { cwd: os.tmpdir() };
  try {
    const r =
      platform === "win32"
        ? await execWithOutput("cmd.exe", ["/c", "npm", "config", "get", "prefix"], tmpCwd)
        : await execWithOutput(
            fs.existsSync("/bin/bash") ? "/bin/bash" : "/bin/sh",
            [
              fs.existsSync("/bin/bash") ? "-lc" : "-c",
              "npm config get prefix",
            ],
            tmpCwd
          );
    if (r.code !== 0 || !r.stdout.trim()) return null;
    const prefix = r.stdout.trim().split(/\r?\n/)[0];
    if (!prefix || !path.isAbsolute(prefix)) return null;
    const winCmd = path.join(prefix, "openclaw.cmd");
    const winExe = path.join(prefix, "openclaw.exe");
    const unix = path.join(prefix, "bin", "openclaw");
    if (platform === "win32") {
      if (isRunnableBinary(winCmd)) return winCmd;
      if (isRunnableBinary(winExe)) return winExe;
      return null;
    }
    if (isRunnableBinary(unix)) return unix;
    const unixFlat = path.join(prefix, "openclaw");
    return isRunnableBinary(unixFlat) ? unixFlat : null;
  } catch {
    return null;
  }
}

function getUserProfileOpenClawPaths() {
  const stateDir = path.join(os.homedir(), ".openclaw");
  return {
    stateDir,
    configPath: path.join(stateDir, "openclaw.json"),
  };
}

/**
 * 供 UI 展示：ClawHeart 托管目录、用户默认 ~/.openclaw、本机已发现的 openclaw 可执行文件
 */
async function discoverOpenClawInstallations() {
  const managed = getManagedOpenClawEnv();
  const user = getUserProfileOpenClawPaths();
  const extRt = getExternalOpenClawRuntimeEnv();

  const binSet = collectStaticBinaryCandidates();
  for (const p of tryWhichOpenClaw()) {
    pushUniqueBin(binSet, p);
  }
  const npmG = await tryNpmGlobalOpenClawBin();
  if (npmG) pushUniqueBin(binSet, npmG);

  const binaries = [];
  for (const binPath of binSet) {
    let source = "path";
    if (binPath.includes("/homebrew/") || binPath.includes("\\homebrew\\")) source = "homebrew";
    else if (binPath.includes(".npm-global") || binPath.includes("npm")) source = "npm";
    binaries.push({
      path: binPath,
      source,
      version: tryOpenClawVersion(binPath),
    });
  }

  const appBundle =
    process.platform === "darwin" && fs.existsSync("/Applications/OpenClaw.app")
      ? "/Applications/OpenClaw.app"
      : null;

  return {
    electronUserData: getElectronUserDataPath(),
    managed: {
      stateDir: managed.OPENCLAW_STATE_DIR,
      configPath: managed.OPENCLAW_CONFIG_PATH,
      configExists: fs.existsSync(managed.OPENCLAW_CONFIG_PATH),
    },
    userProfile: {
      stateDir: user.stateDir,
      configPath: user.configPath,
      configExists: fs.existsSync(user.configPath),
    },
    externalManaged: {
      stateDir: extRt.OPENCLAW_STATE_DIR,
      configPath: extRt.OPENCLAW_CONFIG_PATH,
      configExists: fs.existsSync(extRt.OPENCLAW_CONFIG_PATH),
    },
    binaries,
    openClawMacApp: appBundle,
  };
}

/**
 * 统一清单：本机探测到的各类 Claw CLI（含 OpenClaw 与其它注册厂商）
 */
async function discoverClawInventory() {
  const base = await discoverOpenClawInstallations();
  const installations = [];
  const seen = new Set();

  function addRow(productId, label, execPath, version, source, npmPackage) {
    if (!execPath || typeof execPath !== "string") return;
    const norm = path.normalize(execPath);
    const abs = path.resolve(norm);
    const key = `${productId}\0${abs}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (!isRunnableBinary(abs)) return;
    installations.push({
      id: `${productId}-${installations.length}`,
      productId,
      label,
      executable: abs,
      version: version || tryOpenClawVersion(abs),
      source,
      npmPackage: npmPackage != null ? String(npmPackage) : null,
      configKind: productId === "openclaw" ? "openclaw-json" : "unknown",
    });
  }

  for (const b of base.binaries) {
    addRow("openclaw", "OpenClaw", b.path, b.version, b.source || "path", "openclaw");
  }

  for (const prod of CLAW_PRODUCTS) {
    if (prod.id === "openclaw") continue;
    for (const binName of prod.binaryNames) {
      for (const p of tryWhichCommand(binName)) {
        addRow(prod.id, prod.label, p, null, "path", prod.npmPackage);
      }
      const ng = await tryNpmGlobalBinForName(binName);
      if (ng) {
        addRow(prod.id, prod.label, ng, null, "npm-global", prod.npmPackage);
      }
    }
  }

  return {
    scannedAt: new Date().toISOString(),
    installations,
    discovery: base,
  };
}

module.exports = {
  discoverOpenClawInstallations,
  discoverClawInventory,
  getUserProfileOpenClawPaths,
  isRunnableBinary,
  tryOpenClawVersion,
  tryWhichCommand,
};
