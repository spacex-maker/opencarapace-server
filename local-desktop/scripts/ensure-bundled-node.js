#!/usr/bin/env node
/**
 * 在打包前下载官方 Node.js Windows x64 二进制，放入 bundled/win-x64/node.exe，
 * 由 electron-builder extraResources 复制到安装目录 resources/node.exe（开箱即用，不依赖用户本机 Node）。
 *
 * 版本需与 node-manager.js 中 NODE_VERSION 保持一致；且须满足 openclaw 要求（随 openclaw 升级会变，见下方 NODE_VERSION）。
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

/** 与当前 openclaw 运行时检查一致：Node >= 22.16.0 */
const NODE_VERSION = "22.16.0";

function bundledNodeMeetsOpenClawRequirement(nodePath) {
  try {
    const out = execSync(`"${nodePath}" -v`, {
      encoding: "utf8",
      windowsHide: true,
      timeout: 8000,
    }).trim();
    const m = /^v(\d+)\.(\d+)\.(\d+)/.exec(out);
    if (!m) return false;
    const major = parseInt(m[1], 10);
    const minor = parseInt(m[2], 10);
    const patch = parseInt(m[3], 10);
    if (major > 22) return true;
    if (major < 22) return false;
    if (minor > 16) return true;
    if (minor < 16) return false;
    return patch >= 0;
  } catch {
    return false;
  }
}
const rootDir = path.join(__dirname, "..");
const outDir = path.join(rootDir, "bundled", "win-x64");
const nodeExe = path.join(outDir, "node.exe");
const zipName = `node-v${NODE_VERSION}-win-x64.zip`;
const zipPath = path.join(outDir, zipName);
const distUrl = `https://nodejs.org/dist/v${NODE_VERSION}/${zipName}`;

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          try {
            fs.unlinkSync(dest);
          } catch {
            /* ignore */
          }
          return download(res.headers.location, dest).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          file.close();
          try {
            fs.unlinkSync(dest);
          } catch {
            /* ignore */
          }
          return reject(new Error(`下载失败 HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        try {
          fs.unlinkSync(dest);
        } catch {
          /* ignore */
        }
        reject(err);
      });
  });
}

async function main() {
  if (process.platform !== "win32") {
    console.log("[ensure-bundled-node] 当前非 Windows，跳过 win-x64 node 下载（仅 Windows 安装包需要）。");
    process.exit(0);
  }

  if (fs.existsSync(nodeExe)) {
    if (bundledNodeMeetsOpenClawRequirement(nodeExe)) {
      console.log("[ensure-bundled-node] 已存在且满足 OpenClaw (>=22.16):", nodeExe);
      process.exit(0);
    }
    console.log("[ensure-bundled-node] 已存在的 node 版本过低，将重新下载为 v" + NODE_VERSION);
    try {
      fs.unlinkSync(nodeExe);
    } catch {
      /* ignore */
    }
  }

  fs.mkdirSync(outDir, { recursive: true });
  console.log("[ensure-bundled-node] 正在下载 Node.js", NODE_VERSION, "win-x64 ...");
  console.log("[ensure-bundled-node]", distUrl);
  await download(distUrl, zipPath);

  const extractDir = path.join(outDir, "_extract");
  if (fs.existsSync(extractDir)) {
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
  fs.mkdirSync(extractDir, { recursive: true });

  const zipLiteral = zipPath.replace(/'/g, "''");
  const destLiteral = extractDir.replace(/'/g, "''");
  console.log("[ensure-bundled-node] 正在解压...");
  execSync(
    `powershell.exe -NoProfile -Command "Expand-Archive -LiteralPath '${zipLiteral}' -DestinationPath '${destLiteral}' -Force"`,
    { stdio: "inherit" }
  );

  const innerExe = path.join(extractDir, `node-v${NODE_VERSION}-win-x64`, "node.exe");
  if (!fs.existsSync(innerExe)) {
    throw new Error(`解压后未找到: ${innerExe}`);
  }

  fs.copyFileSync(innerExe, nodeExe);
  fs.rmSync(extractDir, { recursive: true, force: true });
  try {
    fs.unlinkSync(zipPath);
  } catch {
    /* ignore */
  }

  console.log("[ensure-bundled-node] 完成:", nodeExe);
}

main().catch((e) => {
  console.error("[ensure-bundled-node] 失败:", e?.message || e);
  process.exit(1);
});
