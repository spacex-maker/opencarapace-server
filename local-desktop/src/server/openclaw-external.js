/**
 * ClawHeart「外置」OpenClaw：随客户端安装的 npm 全局包，固定在用户目录下
 * `~/.opencarapace/external-openclaw`（Windows 为 %APPDATA%\\.opencarapace\\external-openclaw），
 * 与安装包内自带二进制、以及用户系统 PATH 中的 openclaw 区分开。
 */
const path = require("path");
const fs = require("fs");

function getOpenCarapaceBaseDir() {
  const userDataPath = process.env.APPDATA || process.env.HOME || process.cwd();
  return path.join(userDataPath, ".opencarapace");
}

function getExternalOpenClawNpmPrefix() {
  return path.join(getOpenCarapaceBaseDir(), "external-openclaw");
}

/** 与 openclaw-workspace getExternalOpenClawRuntimeEnv 中 stateDir 一致 */
function getExternalOpenClawRuntimeStateDir() {
  return path.join(getOpenCarapaceBaseDir(), "external-openclaw-runtime");
}

/**
 * 删除 ClawHeart 外置 OpenClaw 的 npm 目录与独立运行时目录（不删 ~/.openclaw）。
 * @param {(line: string) => void} [onLog]
 */
function purgeClawHeartExternalOpenClawArtefacts(onLog) {
  const log = typeof onLog === "function" ? onLog : () => {};
  const base = path.resolve(getOpenCarapaceBaseDir());
  const paths = [
    { p: path.resolve(getExternalOpenClawNpmPrefix()), label: "外置 npm 目录 (external-openclaw)" },
    { p: path.resolve(getExternalOpenClawRuntimeStateDir()), label: "外置运行时目录 (external-openclaw-runtime)" },
  ];
  for (const { p, label } of paths) {
    if (!p || p.length < 8) continue;
    if (!p.startsWith(base + path.sep) && p !== base) {
      log(`[跳过] 路径不在 .opencarapace 下: ${p}\n`);
      continue;
    }
    const bn = path.basename(p);
    if (bn !== "external-openclaw" && bn !== "external-openclaw-runtime") {
      log(`[跳过] 非预期目录名: ${p}\n`);
      continue;
    }
    try {
      if (!fs.existsSync(p)) {
        log(`[无需删除] 不存在: ${label}\n`);
        continue;
      }
      fs.rmSync(p, { recursive: true, force: true });
      log(`[已删除] ${label}\n  ${p}\n`);
    } catch (e) {
      log(`[删除失败] ${label}: ${e?.message || String(e)}\n`);
    }
  }
}

function resolveExternalOpenClawBinPath() {
  const binDir = path.join(getExternalOpenClawNpmPrefix(), "bin");
  if (process.platform === "win32") {
    const cands = [
      path.join(binDir, "openclaw.cmd"),
      path.join(binDir, "openclaw.exe"),
      path.join(binDir, "openclaw.ps1"),
      path.join(binDir, "openclaw"),
    ];
    for (const p of cands) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }
  const p = path.join(binDir, "openclaw");
  return fs.existsSync(p) ? p : null;
}

function hasExternalManagedOpenClaw() {
  return resolveExternalOpenClawBinPath() != null;
}

/**
 * 在清单中找到「非 ClawHeart 外置 prefix」下的 openclaw（PATH / 全局 npm / Homebrew 等）。
 * 无前缀安装时，外置 Gateway 可回退使用该二进制；仍与上方清单顺序一致取第一个命中项。
 */
function getUserEnvironmentOpenClawFromInventory(installations, extPrefix) {
  const root = path.resolve(String(extPrefix || ""));
  const underPrefix = (abs) => {
    const a = path.resolve(String(abs || ""));
    return a === root || a.startsWith(root + path.sep);
  };
  if (!Array.isArray(installations)) return null;
  for (const row of installations) {
    if (!row || row.productId !== "openclaw") continue;
    const exec = row.executable;
    if (!exec || typeof exec !== "string") continue;
    if (underPrefix(exec)) continue;
    return {
      binPath: exec,
      version: row.version == null ? null : String(row.version),
      source: row.source == null ? null : String(row.source),
    };
  }
  return null;
}

/** Gateway 使用安装包内二进制，或外置 prefix 下的 CLI */
function normalizeGatewayOpenclawBinary(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "external") return "external";
  return "bundled";
}

/** DB 列 external_openclaw_install_source：面板安装 | 用户声明/自行安装 */
function normalizeExternalOpenClawInstallSource(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "clawheart" || s === "client") return "clawheart";
  if (s === "user" || s === "manual") return "user";
  return null;
}

/** prefix 根目录下标记文件：兼容无 DB 字段时的旧库推断「客户端安装」 */
const EXTERNAL_OPENCLAW_CLIENT_MARKER = ".clawheart-client-openclaw";

function getExternalOpenClawClientMarkerPath() {
  return path.join(getExternalOpenClawNpmPrefix(), EXTERNAL_OPENCLAW_CLIENT_MARKER);
}

function hasExternalOpenClawClientMarker() {
  try {
    return fs.existsSync(getExternalOpenClawClientMarkerPath());
  } catch {
    return false;
  }
}

function writeExternalOpenClawClientMarker() {
  try {
    const dir = getExternalOpenClawNpmPrefix();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      getExternalOpenClawClientMarkerPath(),
      JSON.stringify({ by: "clawheart", at: new Date().toISOString() }),
      "utf8"
    );
  } catch {
    /* ignore */
  }
}

function removeExternalOpenClawClientMarker() {
  try {
    const p = getExternalOpenClawClientMarkerPath();
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {
    /* ignore */
  }
}

/**
 * @param {boolean} hasManaged
 * @param {string | null} dbSource clawheart | user | null
 * @param {boolean} markerExists
 * @returns {"client"|"user"|"unknown"|null}
 */
function resolveExternalOpenClawInstallTag(hasManaged, dbSource, markerExists) {
  if (!hasManaged) return null;
  if (dbSource === "clawheart" || markerExists) return "client";
  if (dbSource === "user") return "user";
  return "unknown";
}

module.exports = {
  getOpenCarapaceBaseDir,
  getExternalOpenClawNpmPrefix,
  getExternalOpenClawRuntimeStateDir,
  purgeClawHeartExternalOpenClawArtefacts,
  resolveExternalOpenClawBinPath,
  hasExternalManagedOpenClaw,
  getUserEnvironmentOpenClawFromInventory,
  normalizeGatewayOpenclawBinary,
  normalizeExternalOpenClawInstallSource,
  getExternalOpenClawClientMarkerPath,
  hasExternalOpenClawClientMarker,
  writeExternalOpenClawClientMarker,
  removeExternalOpenClawClientMarker,
  resolveExternalOpenClawInstallTag,
};
