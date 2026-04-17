/**
 * openclaw-manager macOS / Unix 平台实现。
 */

const { spawn } = require("child_process");
const path = require("path");
const { execWithOutput } = require("../utils.js");

const isWin = false;

function platformBinName(baseName = "openclaw") {
  return baseName;
}

function localBinPath(binDir, baseName = "openclaw") {
  return path.join(binDir, baseName);
}

function findGlobalOpenClawBin() {
  return null;
}

function spawnOpenClawBin(bin, args, opts = {}) {
  return spawn(bin, args, opts);
}

function execOpenClawBin(bin, args, opts = {}) {
  return execWithOutput(bin, args, { ...opts, shell: false });
}

function formatSpawnCommand(bin, args) {
  return `${bin} ${args.join(" ")}`;
}

function killProcessTree(pid) {
  if (!pid || !Number.isFinite(pid)) return;
  // 优先尝试进程组杀（detached:true spawn 的进程 pgid === pid）
  try { process.kill(-pid, "SIGKILL"); } catch { /* not a group leader or already dead */ }
  // 兜底：直杀 + pkill 子进程
  try { process.kill(pid, "SIGKILL"); } catch { /* already exited */ }
  const { execSync } = require("child_process");
  try { execSync(`pkill -9 -P ${pid}`, { timeout: 4000, stdio: "ignore" }); } catch { /* no children */ }
}

function getNodeMissingDiagnostics(bundledGatewayPort) {
  return {
    missing:
      "错误: 未找到安装包自带的 node（应用 Contents/Resources/node），也未找到客户端「下载运行时 Node」保存的 node。",
    explain:
      `说明: 不能用本应用主程序代替 Node 跑 openclaw.mjs；否则会再拉起桌面主进程（日志里会出现 19111 本地代理，而非 OpenClaw ${bundledGatewayPort}）。`,
    fix:
      "解决: ① 请用最新 DMG 重装（构建会把 node 写入 Resources）；或 ② 在 OpenClaw 面板黄色区域点「下载运行时 Node」后再启动 Gateway。",
  };
}

function getNodeMissingStopError() {
  return "未找到内置 node（Resources/node），无法执行 gateway stop";
}

function getLaunchctlHint() {
  return "macOS 提示: 若仍报已运行，可终端执行 launchctl bootout gui/$(id -u)/ai.openclaw.gateway（或上游文档中的服务名）";
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
