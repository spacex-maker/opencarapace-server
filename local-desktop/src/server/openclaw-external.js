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
 * 用于提示：本机已有 CLI，但外置 Gateway 仍依赖 prefix 安装。
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

module.exports = {
  getOpenCarapaceBaseDir,
  getExternalOpenClawNpmPrefix,
  resolveExternalOpenClawBinPath,
  hasExternalManagedOpenClaw,
  getUserEnvironmentOpenClawFromInventory,
  normalizeGatewayOpenclawBinary,
};
