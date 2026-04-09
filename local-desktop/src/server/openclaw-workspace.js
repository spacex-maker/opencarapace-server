/**
 * OpenClaw 使用官方环境变量 OPENCLAW_STATE_DIR / OPENCLAW_CONFIG_PATH（见上游文档）。
 *
 * ClawHeart 约定：
 * - Gateway 为 **bundled（内置）** 时：env 固定指向**应用内隔离目录**（Electron userData 下），与用户
 *   主目录的 ~/.openclaw 分离；Node 由安装包/面板提供。
 * - Gateway 为 **external（外置）** 时：env 固定指向**标准** ~/.openclaw；CLI 可安装在
 *   .opencarapace/external-openclaw（npm 前缀），该目录不作为第二套配置根。
 *
 * @see https://docs.clawd.bot/help/environment
 */
const path = require("path");
const fs = require("fs");
const os = require("os");
const { getOpenCarapaceBaseDir, normalizeGatewayOpenclawBinary } = require("./openclaw-external.js");

/**
 * 与 DB 同步：gateway_openclaw_binary 决定「用哪套 CLI」。
 * - bundled（内置）：配置与状态仅在应用内目录（与当前系统用户的 ~/.openclaw 隔离），由客户端/安装包提供 Node。
 * - external（外置）：等价于在用户环境按 OpenClaw 标准使用 ~/.openclaw；CLI 装在 .opencarapace/external-openclaw 只为安装前缀，不是第二套配置根。
 */
let gatewayWorkspaceState = {
  binaryMode: "bundled",
  builtinTarget: "clawheart-managed",
  externalTarget: "user-profile",
};

function normalizeGatewayWorkspaceTarget(t) {
  const s = String(t || "").trim();
  if (s === "clawheart-managed" || s === "managed" || s === "clawheart") {
    return "clawheart-managed";
  }
  if (s === "user-profile" || s === "user-default" || s === "user-profile-default") {
    return "user-profile";
  }
  return "user-profile";
}

/** 外置 Gateway 仅使用标准用户目录（~/.openclaw）；历史值 external-managed 已废弃，统一视为 user-profile */
function normalizeExternalWorkspaceTarget(_t) {
  return "user-profile";
}

/** ClawHeart 外置 OpenClaw 专用状态目录（与 npm --prefix 安装目录分离） */
function getExternalOpenClawRuntimeEnv() {
  const stateDir = path.join(getOpenCarapaceBaseDir(), "external-openclaw-runtime");
  return {
    OPENCLAW_STATE_DIR: stateDir,
    OPENCLAW_CONFIG_PATH: path.join(stateDir, "openclaw.json"),
  };
}

function getOpenClawEnvForExternalWorkspaceTarget() {
  return getUserDefaultOpenClawEnv();
}

function syncGatewayWorkspaceFromSettings(settings) {
  gatewayWorkspaceState = {
    binaryMode: normalizeGatewayOpenclawBinary(settings?.gatewayOpenclawBinary),
    builtinTarget: normalizeGatewayWorkspaceTarget(settings?.gatewayOpenclawTarget),
    externalTarget: normalizeExternalWorkspaceTarget(settings?.gatewayOpenclawTargetExternal),
  };
}

/** 当前 Gateway 子进程应使用的 OPENCLAW_*（随内置/外置二进制切换） */
function getActiveOpenClawEnv() {
  const st = gatewayWorkspaceState;
  if (st.binaryMode === "external") {
    return getUserDefaultOpenClawEnv();
  }
  return getManagedOpenClawEnv();
}

/** @deprecated 仅兼容旧调用；请使用 getActiveOpenClawEnv() 或查看 gatewayWorkspaceState */
function setGatewayWorkspaceTargetForProcess(t) {
  gatewayWorkspaceState.builtinTarget = normalizeGatewayWorkspaceTarget(t);
}

function getGatewayWorkspaceTargetSync() {
  const st = gatewayWorkspaceState;
  if (st.binaryMode === "external") {
    return "user-profile";
  }
  return "clawheart-managed";
}

function getGatewayWorkspaceStateSync() {
  return { ...gatewayWorkspaceState };
}

/** Electron 主进程的 userData；开发或测试环境回退到固定目录 */
function getElectronUserDataPath() {
  try {
    const electron = require("electron");
    const app = electron?.app;
    if (app && typeof app.getPath === "function") {
      return app.getPath("userData");
    }
  } catch {
    /* 非 Electron 或模块不可用 */
  }
  if (process.env.CLAWHEART_USER_DATA) {
    return process.env.CLAWHEART_USER_DATA;
  }
  return path.join(os.homedir(), ".clawheart-desktop-userdata");
}

/** 可选：应用内 OPENCLAW 状态目录（与 ~/.openclaw 并列的「另一份」openclaw.json，格式相同） */
function getManagedOpenClawRoot() {
  return path.join(getElectronUserDataPath(), "clawheart-openclaw-runtime");
}

function getManagedOpenClawEnv() {
  const stateDir = getManagedOpenClawRoot();
  return {
    OPENCLAW_STATE_DIR: stateDir,
    OPENCLAW_CONFIG_PATH: path.join(stateDir, "openclaw.json"),
  };
}

function getUserDefaultOpenClawEnv() {
  const stateDir = path.join(os.homedir(), ".openclaw");
  return {
    OPENCLAW_STATE_DIR: stateDir,
    OPENCLAW_CONFIG_PATH: path.join(stateDir, "openclaw.json"),
  };
}

/**
 * 解析 OpenClaw 官方环境变量取值（状态目录 + openclaw.json 路径）
 * @param {string} target normalized 或原始 UI / DB 值
 */
function getOpenClawEnvForWorkspaceTarget(target) {
  const t = normalizeGatewayWorkspaceTarget(target);
  if (t === "clawheart-managed") {
    return getManagedOpenClawEnv();
  }
  return getUserDefaultOpenClawEnv();
}

/**
 * 合并到子进程 env（启动 Gateway / CLI 子进程时使用）
 */
function applyGatewayWorkspaceOpenClawEnv(baseEnv, targetOpt) {
  let o;
  if (targetOpt != null) {
    const t = normalizeGatewayWorkspaceTarget(targetOpt);
    o = getOpenClawEnvForWorkspaceTarget(t);
  } else {
    o = getActiveOpenClawEnv();
  }
  const env = { ...(baseEnv || process.env) };
  env.OPENCLAW_STATE_DIR = o.OPENCLAW_STATE_DIR;
  env.OPENCLAW_CONFIG_PATH = o.OPENCLAW_CONFIG_PATH;
  return env;
}

function ensureManagedOpenClawRoot() {
  const root = getManagedOpenClawRoot();
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
  return root;
}

module.exports = {
  normalizeGatewayWorkspaceTarget,
  normalizeExternalWorkspaceTarget,
  setGatewayWorkspaceTargetForProcess,
  syncGatewayWorkspaceFromSettings,
  getGatewayWorkspaceTargetSync,
  getGatewayWorkspaceStateSync,
  getActiveOpenClawEnv,
  getExternalOpenClawRuntimeEnv,
  getElectronUserDataPath,
  getManagedOpenClawRoot,
  getManagedOpenClawEnv,
  getUserDefaultOpenClawEnv,
  getOpenClawEnvForWorkspaceTarget,
  getOpenClawEnvForExternalWorkspaceTarget,
  applyGatewayWorkspaceOpenClawEnv,
  ensureManagedOpenClawRoot,
};
