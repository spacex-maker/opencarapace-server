const path = require("path");
const fs = require("fs");

/**
 * 安装包内置的 Node（electron-builder extraResources -> resources/node.exe）。
 * 开发时：仓库内 bundled/win-x64/node.exe（由 build 前 ensure-bundled-node 下载）。
 * 不使用用户本机 PATH 中的 node。
 */
function getBundledNodeFromInstaller() {
  const rp = process.resourcesPath || "";
  try {
    const { app } = require("electron");
    if (app?.isPackaged) {
      if (process.platform === "win32") {
        const p = path.join(rp, "node.exe");
        if (fs.existsSync(p)) return p;
      } else if (process.platform === "darwin") {
        const p = path.join(rp, "node");
        if (fs.existsSync(p)) return p;
      } else {
        const p = path.join(rp, "node");
        if (fs.existsSync(p)) return p;
      }
    }
  } catch {
    // 非 Electron 主进程等
  }

  const devRoot = path.join(__dirname, "..", "..");
  if (process.platform === "win32") {
    const p = path.join(devRoot, "bundled", "win-x64", "node.exe");
    if (fs.existsSync(p)) return p;
  } else if (process.platform === "darwin") {
    const arm = path.join(devRoot, "bundled", "darwin-arm64", "bin", "node");
    if (fs.existsSync(arm)) return arm;
    const x64 = path.join(devRoot, "bundled", "darwin-x64", "bin", "node");
    if (fs.existsSync(x64)) return x64;
  }

  return null;
}

/**
 * 解析「真正的」Node 可执行文件。
 * 禁止使用本应用的 Electron exe（如 ClawHeart Desktop.exe）配合 --run-as-node 跑 openclaw：
 * 在多数打包形态下仍会启动桌面主进程，导致出现 19111 代理日志而非 OpenClaw。
 */
function resolveRealNodeExecutable() {
  const fromInstaller = getBundledNodeFromInstaller();
  if (fromInstaller) return fromInstaller;

  /** 用户曾在客户端内下载的「内置 Node」 */
  try {
    const nodeManager = require("./node-manager.js");
    if (nodeManager.hasEmbeddedNode && nodeManager.getEmbeddedNodePath) {
      if (nodeManager.hasEmbeddedNode()) {
        const p = nodeManager.getEmbeddedNodePath().node;
        if (p && fs.existsSync(p)) return p;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * 为子进程准备 PATH / NODE_PATH，确保 openclaw.cmd 能找到 node，且能 require 到 hoisted 依赖。
 */
function buildOpenClawChildEnv(appUnpackedRoot) {
  const env = { ...process.env };
  const nodeExe = resolveRealNodeExecutable();
  if (nodeExe) {
    const nodeDir = path.dirname(nodeExe);
    env.PATH = nodeDir + path.delimiter + (env.PATH || "");
  }
  if (appUnpackedRoot) {
    const nm = path.join(appUnpackedRoot, "node_modules");
    if (fs.existsSync(nm)) {
      env.NODE_PATH = nm + (env.NODE_PATH ? path.delimiter + env.NODE_PATH : "");
    }
  }
  return env;
}

/**
 * 打包后 node_modules 若在 asar 内，子进程 Node 无法 require；
 * electron-builder asarUnpack 后位于 resources/app.asar.unpacked。
 */
function getUnpackedAppRoot() {
  try {
    const p = path.join(process.resourcesPath || "", "app.asar.unpacked");
    if (fs.existsSync(p)) return p;
  } catch {
    // ignore
  }
  return null;
}

/**
 * 与开发环境一致：node_modules/.bin/openclaw（含 hoisted 依赖）
 */
function getPackagedOpenClawBinFromUnpacked() {
  const root = getUnpackedAppRoot();
  if (!root) return null;
  const binDir = path.join(root, "node_modules", ".bin");
  if (process.platform === "win32") {
    const cmd = path.join(binDir, "openclaw.cmd");
    if (fs.existsSync(cmd)) return { bin: cmd, cwd: root };
    const noExt = path.join(binDir, "openclaw");
    if (fs.existsSync(noExt)) return { bin: noExt, cwd: root };
  } else {
    const sh = path.join(binDir, "openclaw");
    if (fs.existsSync(sh)) return { bin: sh, cwd: root };
  }
  return null;
}

function getPackagedOpenClawMjsPath() {
  try {
    const unpackedRoot = getUnpackedAppRoot();
    if (unpackedRoot) {
      const p = path.join(unpackedRoot, "node_modules", "openclaw", "openclaw.mjs");
      if (fs.existsSync(p)) return p;
    }
    const p = path.join(process.resourcesPath || "", "openclaw", "openclaw.mjs");
    if (fs.existsSync(p)) return p;
  } catch {
    // ignore
  }
  return null;
}

module.exports = {
  getUnpackedAppRoot,
  getPackagedOpenClawBinFromUnpacked,
  getPackagedOpenClawMjsPath,
  resolveRealNodeExecutable,
  buildOpenClawChildEnv,
};
