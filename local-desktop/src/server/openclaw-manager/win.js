/**
 * openclaw-manager Windows 平台实现。
 */

const { spawn, execSync } = require("child_process");
const path = require("path");
const { execWithOutput, getWindowsCmdPath, wherePathsSync } = require("../utils.js");

const isWin = true;

function platformBinName(baseName = "openclaw") {
  return `${baseName}.cmd`;
}

function localBinPath(binDir, baseName = "openclaw") {
  return path.join(binDir, platformBinName(baseName));
}

/**
 * 在 PATH / 全局 npm 中查找 openclaw 可执行文件（.exe / .cmd 变体）。
 * @returns {string|null}
 */
function findGlobalOpenClawBin() {
  if (wherePathsSync("openclaw.exe").length) return "openclaw.exe";
  if (wherePathsSync("openclaw.cmd").length) return "openclaw.cmd";
  return null;
}

/** spawn：通过 cmd.exe /c 包装 */
function spawnOpenClawBin(bin, args, opts = {}) {
  return spawn(getWindowsCmdPath(), ["/c", bin, ...args], opts);
}

/** execWithOutput：通过 cmd.exe /c 包装 */
function execOpenClawBin(bin, args, opts = {}) {
  return execWithOutput("cmd.exe", ["/c", bin, ...args], { ...opts, shell: false });
}

function formatSpawnCommand(bin, args) {
  return `cmd.exe /c "${bin}" ${args.join(" ")}`;
}

/** 终止进程树：taskkill /F /T */
function killProcessTree(pid) {
  if (pid == null) return;
  const p = Number(pid);
  if (!Number.isFinite(p) || p <= 0) return;
  try {
    execSync(`taskkill /F /T /PID ${p}`, { stdio: "ignore", timeout: 15000 });
  } catch {
    /* ignore */
  }
}

function getNodeMissingDiagnostics(bundledGatewayPort) {
  return {
    missing:
      "错误: 未找到安装包自带的 node.exe（resources/node.exe），也未找到客户端「下载运行时 Node」保存的 node。",
    explain:
      `说明: 不能使用本程序 ClawHeart Desktop.exe 代替 Node；否则会启动第二个桌面主进程（日志里会出现 19111 本地代理，而非 OpenClaw ${bundledGatewayPort}）。`,
    fix:
      "解决: ① 请使用最新安装包（构建时已打入 resources/node.exe）；或 ② 在 OpenClaw 面板黄色区域点「下载运行时 Node」后再启动 Gateway。",
  };
}

function getNodeMissingStopError() {
  return "未找到 node.exe，无法执行 gateway stop";
}

function getLaunchctlHint() {
  return null;
}

module.exports = {
  isWin,
  platformBinName,
  localBinPath,
  findGlobalOpenClawBin,
  spawnOpenClawBin,
  execOpenClawBin,
  formatSpawnCommand,
  killProcessTree,
  getNodeMissingDiagnostics,
  getNodeMissingStopError,
  getLaunchctlHint,
};
