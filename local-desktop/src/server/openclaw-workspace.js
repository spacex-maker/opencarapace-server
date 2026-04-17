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
const {
  getOpenCarapaceBaseDir,
  getExternalOpenClawRuntimeStateDir,
  normalizeGatewayOpenclawBinary,
} = require("./openclaw-external.js");

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

const MANAGED_RUNTIME_DIR = "clawheart-openclaw-runtime";
const DARWIN_PRODUCT_USERDATA_DIR = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "@clawheart",
  "local-desktop"
);
const DARWIN_LEGACY_ELECTRON_USERDATA_DIR = path.join(os.homedir(), "Library", "Application Support", "Electron");

let managedRuntimeResolutionCache = null;

function resolveRawElectronUserDataPath() {
  if (process.env.CLAWHEART_USER_DATA) {
    return { path: process.env.CLAWHEART_USER_DATA, source: "env" };
  }
  try {
    const electron = require("electron");
    const app = electron?.app;
    if (app && typeof app.getPath === "function") {
      const p = app.getPath("userData");
      if (p && String(p).trim()) return { path: String(p), source: "electron" };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function chooseCanonicalManagedUserDataRoot() {
  const raw = resolveRawElectronUserDataPath();
  if (raw) {
    if (
      process.platform === "darwin" &&
      raw.source === "electron" &&
      /\/Library\/Application Support\/Electron$/.test(raw.path)
    ) {
      return {
        root: DARWIN_PRODUCT_USERDATA_DIR,
        source: "darwin-product",
        electronReportedPath: raw.path,
      };
    }
    return { root: raw.path, source: raw.source, electronReportedPath: raw.path };
  }
  if (process.platform === "darwin") {
    return {
      root: DARWIN_PRODUCT_USERDATA_DIR,
      source: "darwin-product-fallback",
      electronReportedPath: null,
    };
  }
  return {
    root: path.join(os.homedir(), ".clawheart-desktop-userdata"),
    source: "fallback",
    electronReportedPath: null,
  };
}

function ensureManagedRuntimeResolution() {
  if (managedRuntimeResolutionCache) return managedRuntimeResolutionCache;

  const base = chooseCanonicalManagedUserDataRoot();
  const canonicalRoot = base.root;
  const canonicalRuntimeRoot = path.join(canonicalRoot, MANAGED_RUNTIME_DIR);
  const legacyRuntimeRoot =
    process.platform === "darwin" ? path.join(DARWIN_LEGACY_ELECTRON_USERDATA_DIR, MANAGED_RUNTIME_DIR) : null;
  const canonicalConfigPath = path.join(canonicalRuntimeRoot, "openclaw.json");
  const legacyConfigPath = legacyRuntimeRoot ? path.join(legacyRuntimeRoot, "openclaw.json") : null;

  let migrated = false;
  let migrationFrom = null;
  let legacyArchivedTo = null;
  const notes = [];
  try {
    if (
      process.platform === "darwin" &&
      legacyRuntimeRoot &&
      legacyRuntimeRoot !== canonicalRuntimeRoot &&
      fs.existsSync(legacyRuntimeRoot)
    ) {
      if (!fs.existsSync(canonicalRuntimeRoot)) {
        fs.mkdirSync(path.dirname(canonicalRuntimeRoot), { recursive: true });
        try {
          fs.renameSync(legacyRuntimeRoot, canonicalRuntimeRoot);
        } catch {
          fs.cpSync(legacyRuntimeRoot, canonicalRuntimeRoot, { recursive: true });
        }
        migrated = true;
        migrationFrom = legacyRuntimeRoot;
        notes.push("migrated_legacy_runtime_to_canonical");
      } else {
        // 规范化到单源：canonical 已存在时将 legacy 目录归档，避免继续分叉。
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const archivedPath = `${legacyRuntimeRoot}.legacy-archived-${ts}`;
        try {
          fs.renameSync(legacyRuntimeRoot, archivedPath);
          legacyArchivedTo = archivedPath;
          notes.push("archived_legacy_runtime_dir");
        } catch (e) {
          notes.push(`archive_legacy_failed:${e?.message || String(e)}`);
        }
      }
    }
  } catch (e) {
    notes.push(`migration_failed:${e?.message || String(e)}`);
  }
  // 单源策略下，legacy 仅迁移/归档，不再作为可写路径参与分叉判定。
  const driftDetected = false;

  managedRuntimeResolutionCache = {
    root: canonicalRoot,
    source: base.source,
    electronReportedPath: base.electronReportedPath,
    runtimeRoot: canonicalRuntimeRoot,
    managedConfigPath: canonicalConfigPath,
    legacyRuntimeRoot,
    legacyManagedConfigPath: legacyConfigPath,
    legacyArchivedTo,
    migrated,
    migrationFrom,
    driftDetected,
    notes,
  };
  return managedRuntimeResolutionCache;
}

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
  const stateDir = getExternalOpenClawRuntimeStateDir();
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
  return ensureManagedRuntimeResolution().root;
}

/** 可选：应用内 OPENCLAW 状态目录（与 ~/.openclaw 并列的「另一份」openclaw.json，格式相同） */
function getManagedOpenClawRoot() {
  return ensureManagedRuntimeResolution().runtimeRoot;
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

function getManagedRuntimeResolutionInfo() {
  const s = ensureManagedRuntimeResolution();
  return { ...s };
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
  getManagedRuntimeResolutionInfo,
};
