/**
 * openclaw-manager — 薄编排层。
 *
 * 业务逻辑已拆分到 openclaw-manager/ 子模块：
 *   platform.js      — 平台调度 (win.js / darwin.js)
 *   diag.js           — 诊断日志系统
 *   dashboard-url.js  — URL 清洗 / token / getDashboardUrl
 *   lifecycle.js      — start / stop / exec-stop-cli
 *
 * 本文件负责：常量、共享可变状态、运行态检测、对外 exports。
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const {
  isWin,
  localBinPath,
  findGlobalOpenClawBin,
} = require("./openclaw-manager/platform.js");
const {
  getPackagedOpenClawBinFromUnpacked,
  getPackagedOpenClawMjsPath,
} = require("./openclaw-paths.js");
const {
  detectOpenClawGatewayProcessRunning,
} = require("./openclaw-gateway-process.js");
const {
  listTcpListenersOnPort,
  getGatewayPortConflictsPayload,
  enrichGatewayPortConflictsWithLsof,
} = require("./openclaw-gateway-port-conflict.js");

const {
  appendGatewayDiag,
  getGatewayDiagnosticLog,
  getGatewayDiagnosticLogsPayload,
  latestClawHeartDiagGatewayUpTimestampMs,
  gatewayDiagLogShowsGatewayListening,
} = require("./openclaw-manager/diag.js");

const {
  readPidFile,
  isProcessAlive,
} = require("./openclaw-manager/pid-file.js");

const {
  sanitizeDashboardUrlCandidate,
  getDashboardUrl: _getDashboardUrlImpl,
} = require("./openclaw-manager/dashboard-url.js");

const {
  initLifecycle,
  startEmbeddedOpenClaw,
  stopEmbeddedOpenClaw,
} = require("./openclaw-manager/lifecycle.js");

// ─── 常量 ────────────────────────────────────────────────────────

const OPENCLAW_UI_URL = "http://localhost:18789";
const EXTERNAL_GATEWAY_DEFAULT_PORT = 18789;
const BUNDLED_GATEWAY_PORT = 19278;
const BUNDLED_OPENCLAW_UI_URL = `http://localhost:${BUNDLED_GATEWAY_PORT}`;
const DASHBOARD_CLI_AFTER_STOP_MS = 12000;

// ─── 共享可变状态 ────────────────────────────────────────────────

const gatewayProcesses = { bundled: null, external: null };
const lastGatewayStopEpochMs = { bundled: 0, external: 0 };
const cachedDashboardUrl = { bundled: null, external: null };

function clearCachedDashboardUrl(modeArg) {
  if (modeArg === "bundled" || modeArg === "external") {
    cachedDashboardUrl[modeArg] = null;
  } else {
    cachedDashboardUrl.bundled = null;
    cachedDashboardUrl.external = null;
  }
}

// ─── 端口 / URL 工具 ────────────────────────────────────────────

function getExternalGatewayPort() {
  try {
    const { getUserDefaultOpenClawEnv } = require("./openclaw-workspace.js");
    const configPath = getUserDefaultOpenClawEnv().OPENCLAW_CONFIG_PATH;
    if (!fs.existsSync(configPath)) return EXTERNAL_GATEWAY_DEFAULT_PORT;
    const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const p = Number(cfg?.gateway?.port);
    if (Number.isFinite(p) && p > 0 && p !== BUNDLED_GATEWAY_PORT) return p;
  } catch {
    /* ignore */
  }
  return EXTERNAL_GATEWAY_DEFAULT_PORT;
}

function getExternalGatewayBaseUrl() {
  return `http://localhost:${getExternalGatewayPort()}`;
}

function getDefaultUiUrlForMode(binaryMode) {
  return binaryMode !== "external" ? BUNDLED_OPENCLAW_UI_URL : OPENCLAW_UI_URL;
}

// ─── 二进制检测 ──────────────────────────────────────────────────

function getOpenClawBinPath() {
  const localBinDir = path.join(__dirname, "../../node_modules/.bin");
  const localBin = localBinPath(localBinDir);
  if (fs.existsSync(localBin)) return localBin;
  const globalBin = findGlobalOpenClawBin();
  if (globalBin) return globalBin;
  return "openclaw";
}

function hasEmbeddedOpenClaw() {
  const localBinDir = path.join(__dirname, "../../node_modules/.bin");
  if (fs.existsSync(localBinPath(localBinDir))) return true;
  if (getPackagedOpenClawBinFromUnpacked()) return true;
  if (getPackagedOpenClawMjsPath()) return true;
  try {
    execSync("openclaw --version", { stdio: "ignore", timeout: 3000, cwd: os.tmpdir() });
    return true;
  } catch {
    if (findGlobalOpenClawBin()) return true;
    return false;
  }
}

function getOpenClawCliSource() {
  const localBinDir = path.join(__dirname, "../../node_modules/.bin");
  if (fs.existsSync(localBinPath(localBinDir))) return "project-modules";
  if (getPackagedOpenClawBinFromUnpacked()) return "packaged";
  if (getPackagedOpenClawMjsPath()) return "packaged";
  try {
    execSync("openclaw --version", { stdio: "ignore", timeout: 3000, cwd: os.tmpdir() });
    return "global";
  } catch {
    /* ignore */
  }
  if (findGlobalOpenClawBin()) return "global";
  return "none";
}

function hasBundledOpenClawCli() {
  const src = getOpenClawCliSource();
  return src === "project-modules" || src === "packaged";
}

// ─── 运行态检测 ─────────────────────────────────────────────────

function getStateDirForMode(mode) {
  const { getManagedOpenClawEnv, getUserDefaultOpenClawEnv } = require("./openclaw-workspace.js");
  return mode === "external"
    ? getUserDefaultOpenClawEnv().OPENCLAW_STATE_DIR
    : getManagedOpenClawEnv().OPENCLAW_STATE_DIR;
}

async function checkOpenClawRunning(modeArg) {
  let mode;
  if (modeArg === "bundled" || modeArg === "external") {
    mode = modeArg;
  } else {
    const { getGatewayWorkspaceStateSync } = require("./openclaw-workspace.js");
    mode = getGatewayWorkspaceStateSync().binaryMode === "external" ? "external" : "bundled";
  }

  // ① PID 文件探活（最快最可靠）
  const pidInfo = readPidFile(getStateDirForMode(mode));
  if (pidInfo && isProcessAlive(pidInfo.pid)) return true;

  // ② 端口检测（兼容非本应用启动的 gateway）
  if (mode === "bundled") {
    if (listTcpListenersOnPort(BUNDLED_GATEWAY_PORT).length > 0) return true;
    const tUp = latestClawHeartDiagGatewayUpTimestampMs("bundled");
    return tUp > 0 && tUp > lastGatewayStopEpochMs.bundled;
  }

  const extPort = getExternalGatewayPort();
  if (listTcpListenersOnPort(extPort).length > 0) return true;
  if (extPort !== EXTERNAL_GATEWAY_DEFAULT_PORT && listTcpListenersOnPort(EXTERNAL_GATEWAY_DEFAULT_PORT).length > 0) return true;
  /**
   * 进程扫描 +「内置端口暂无监听」曾被用来推断「纯外置 gateway」；
   * 但内置 Gateway 启动瞬间：进程已存在、19278 尚未 bind，会误判外置为运行中（卡片闪一下）。
   * 若内置目录 PID 文件进程仍存活，则不应把该进程算到外置侧。
   */
  if (await detectOpenClawGatewayProcessRunning()) {
    if (listTcpListenersOnPort(BUNDLED_GATEWAY_PORT).length === 0) {
      const bundledPid = readPidFile(getStateDirForMode("bundled"));
      if (bundledPid && isProcessAlive(bundledPid.pid)) {
        return false;
      }
      return true;
    }
  }
  const tUp = latestClawHeartDiagGatewayUpTimestampMs("external");
  return tUp > 0 && tUp > lastGatewayStopEpochMs.external;
}

async function probeGatewayReadyAfterSpawn(binaryMode) {
  if (binaryMode !== "external") {
    if (listTcpListenersOnPort(BUNDLED_GATEWAY_PORT).length > 0) return true;
    if (gatewayDiagLogShowsGatewayListening("bundled")) return true;
    return false;
  }
  const extPortProbe = getExternalGatewayPort();
  if (listTcpListenersOnPort(extPortProbe).length > 0) return true;
  if (extPortProbe !== EXTERNAL_GATEWAY_DEFAULT_PORT && listTcpListenersOnPort(EXTERNAL_GATEWAY_DEFAULT_PORT).length > 0) return true;
  if (gatewayDiagLogShowsGatewayListening(binaryMode)) return true;
  if (listTcpListenersOnPort(BUNDLED_GATEWAY_PORT).length === 0) {
    if (await detectOpenClawGatewayProcessRunning()) {
      const bundledPid = readPidFile(getStateDirForMode("bundled"));
      if (bundledPid && isProcessAlive(bundledPid.pid)) {
        return false;
      }
      return true;
    }
  }
  return false;
}

// ─── 注入共享状态到 lifecycle ────────────────────────────────────

initLifecycle({
  gatewayProcesses,
  lastGatewayStopEpochMs,
  clearCachedDashboardUrl,
  checkOpenClawRunning,
  probeGatewayReadyAfterSpawn,
  hasBundledOpenClawCli,
  getDefaultUiUrlForMode,
  BUNDLED_GATEWAY_PORT,
  getExternalGatewayPort,
});

// ─── getDashboardUrl 包装 ───────────────────────────────────────

async function getDashboardUrl(modeArg) {
  const { normalizeGatewayOpenclawBinary } = require("./openclaw-external.js");
  const resolvedMode =
    modeArg === "bundled" || modeArg === "external"
      ? modeArg
      : (() => {
          const { getGatewayWorkspaceStateSync } = require("./openclaw-workspace.js");
          return getGatewayWorkspaceStateSync().binaryMode === "external" ? "external" : "bundled";
        })();

  return _getDashboardUrlImpl({
    resolvedMode,
    cachedDashboardUrl,
    lastGatewayStopEpochMs,
    DASHBOARD_CLI_AFTER_STOP_MS,
    BUNDLED_OPENCLAW_UI_URL,
    OPENCLAW_UI_URL,
    getExternalGatewayBaseUrl,
    getDefaultUiUrlForMode,
    hasBundledOpenClawCli,
  });
}

// ─── getOpenClawStatus ──────────────────────────────────────────

async function getOpenClawStatus() {
  const hasEmbedded = hasEmbeddedOpenClaw();
  const { getOpenClawSettings } = require("../db.js");
  const { normalizeGatewayOpenclawBinary } = require("./openclaw-external.js");
  const settings = await getOpenClawSettings();
  const activeBinaryMode = normalizeGatewayOpenclawBinary(settings.gatewayOpenclawBinary);

  const [isRunningBundled, isRunningExternal] = await Promise.all([
    checkOpenClawRunning("bundled"),
    checkOpenClawRunning("external"),
  ]);
  const isRunning = isRunningBundled || isRunningExternal;

  const nowMs = Date.now();
  const uiUrlBundled =
    isRunningBundled && nowMs - lastGatewayStopEpochMs.bundled >= DASHBOARD_CLI_AFTER_STOP_MS
      ? await getDashboardUrl("bundled")
      : BUNDLED_OPENCLAW_UI_URL;
  const uiUrlExternal =
    isRunningExternal && nowMs - lastGatewayStopEpochMs.external >= DASHBOARD_CLI_AFTER_STOP_MS
      ? await getDashboardUrl("external")
      : getExternalGatewayBaseUrl();

  const uiUrl = activeBinaryMode === "external" ? uiUrlExternal : uiUrlBundled;

  enrichGatewayPortConflictsWithLsof();

  return {
    hasEmbedded,
    isRunning,
    isRunningBundled,
    isRunningExternal,
    uiUrl,
    uiUrlBundled,
    uiUrlExternal,
    gatewayDiagnosticLog: getGatewayDiagnosticLog(),
    ...getGatewayDiagnosticLogsPayload(),
    ...getGatewayPortConflictsPayload(),
  };
}

// ─── exports ────────────────────────────────────────────────────

module.exports = {
  hasEmbeddedOpenClaw,
  hasBundledOpenClawCli,
  getOpenClawCliSource,
  startEmbeddedOpenClaw,
  stopEmbeddedOpenClaw,
  getOpenClawStatus,
  getGatewayDiagnosticLog,
  getGatewayDiagnosticLogsPayload,
  clearCachedDashboardUrl,
  OPENCLAW_UI_URL,
  BUNDLED_OPENCLAW_UI_URL,
  BUNDLED_GATEWAY_PORT,
};
