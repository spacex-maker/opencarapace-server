#!/usr/bin/env node
/**
 * 打包前下载官方 Node.js 二进制，供 OpenClaw 子进程使用（不依赖用户本机 Node）。
 *
 * - Windows x64：bundled/win-x64/node.exe → 安装包 resources/node.exe
 * - Windows 32 位：bundled/win-ia32/node.exe（官方包名为 win-x86；打包时传参 ia32，见 scripts/build.js）
 * - macOS：bundled/darwin-{x64,arm64}/bin/node → 由 scripts/after-pack.js 写入 .app/Contents/Resources/node
 *
 * 版本需与 node-manager.js 中 NODE_VERSION 保持一致；且须满足 openclaw（例如 Node >= 22.16.0）。
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

/**
 * 在 Intel Mac 上无法执行 arm64（反之亦然），`node -v` 会报 Bad CPU type，不能当作「版本过低」去覆盖。
 * @param {"x64" | "arm64"} archName
 */
function darwinBundledNodeUsable(nodeBin, archName) {
  if (!fs.existsSync(nodeBin)) return false;
  if (bundledNodeMeetsOpenClawRequirement(nodeBin)) return true;

  try {
    execSync(`"${nodeBin}" -v`, { encoding: "utf8", timeout: 8000 });
  } catch (e) {
    const msg = `${e.stderr || ""}${e.message || ""}`;
    if (/Bad CPU type|cannot execute binary file|Exec format error/i.test(msg)) {
      try {
        const ft = execSync(`file "${nodeBin.replace(/"/g, '\\"')}"`, {
          encoding: "utf8",
          maxBuffer: 256 * 1024,
        });
        if (archName === "arm64" && /arm64|ARM64|AArch64/i.test(ft)) return true;
        if (archName === "x64" && /x86_64|Intel 64/i.test(ft)) return true;
      } catch {
        /* ignore */
      }
    }
    return false;
  }
  return false;
}

const rootDir = path.join(__dirname, "..");

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

/**
 * @param {"x64" | "ia32"} arch  ia32 对应官方 dist 中的 win-x86 包
 */
async function ensureWinNode(arch) {
  const distTag = arch === "ia32" ? "win-x86" : "win-x64";
  const bundleFolder = arch === "ia32" ? "win-ia32" : "win-x64";
  const outDir = path.join(rootDir, "bundled", bundleFolder);
  const nodeExe = path.join(outDir, "node.exe");
  const zipName = `node-v${NODE_VERSION}-${distTag}.zip`;
  const zipPath = path.join(outDir, zipName);
  const distUrl = `https://nodejs.org/dist/v${NODE_VERSION}/${zipName}`;

  if (fs.existsSync(nodeExe)) {
    if (bundledNodeMeetsOpenClawRequirement(nodeExe)) {
      console.log("[ensure-bundled-node] 已存在且满足 OpenClaw (>=22.16):", nodeExe);
      return;
    }
    console.log("[ensure-bundled-node] 已存在的 node 版本过低，将重新下载为 v" + NODE_VERSION);
    try {
      fs.unlinkSync(nodeExe);
    } catch {
      /* ignore */
    }
  }

  fs.mkdirSync(outDir, { recursive: true });
  console.log("[ensure-bundled-node] 正在下载 Node.js", NODE_VERSION, distTag, "...");
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

  const innerExe = path.join(extractDir, `node-v${NODE_VERSION}-${distTag}`, "node.exe");
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

/**
 * @param {"x64" | "arm64"} archName
 */
async function ensureDarwinNode(archName) {
  const folder = `darwin-${archName}`;
  const binDir = path.join(rootDir, "bundled", folder, "bin");
  const nodeBin = path.join(binDir, "node");
  const tarName = `node-v${NODE_VERSION}-darwin-${archName}.tar.gz`;
  const tarPath = path.join(rootDir, "bundled", folder, tarName);
  const distUrl = `https://nodejs.org/dist/v${NODE_VERSION}/${tarName}`;

  if (fs.existsSync(nodeBin)) {
    if (darwinBundledNodeUsable(nodeBin, archName)) {
      console.log("[ensure-bundled-node] 已存在（本机可跑或异架构已就位）:", nodeBin);
      return;
    }
    console.log("[ensure-bundled-node] 已存在的 node 不可用或版本过低，将重新下载为 v" + NODE_VERSION);
    try {
      fs.unlinkSync(nodeBin);
    } catch {
      /* ignore */
    }
  }

  fs.mkdirSync(binDir, { recursive: true });
  console.log("[ensure-bundled-node] 正在下载 Node.js", NODE_VERSION, folder, "...");
  console.log("[ensure-bundled-node]", distUrl);
  await download(distUrl, tarPath);

  const extractDir = path.join(rootDir, "bundled", folder, "_extract");
  if (fs.existsSync(extractDir)) {
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
  fs.mkdirSync(extractDir, { recursive: true });

  const tarLiteral = tarPath.replace(/"/g, '\\"');
  const destLiteral = extractDir.replace(/"/g, '\\"');
  console.log("[ensure-bundled-node] 正在解压...");
  execSync(`tar -xzf "${tarLiteral}" -C "${destLiteral}"`, { stdio: "inherit" });

  const innerNode = path.join(extractDir, `node-v${NODE_VERSION}-darwin-${archName}`, "bin", "node");
  if (!fs.existsSync(innerNode)) {
    throw new Error(`解压后未找到: ${innerNode}`);
  }

  fs.copyFileSync(innerNode, nodeBin);
  fs.chmodSync(nodeBin, 0o755);
  fs.rmSync(extractDir, { recursive: true, force: true });
  try {
    fs.unlinkSync(tarPath);
  } catch {
    /* ignore */
  }

  console.log("[ensure-bundled-node] 完成:", nodeBin);
}

function resolveTarget() {
  const env = process.env.BUNDLE_NODE_TARGET;
  if (env === "win" || env === "win32") return "win32";
  if (env === "mac" || env === "darwin") return "darwin";
  if (env) {
    console.warn("[ensure-bundled-node] 未知 BUNDLE_NODE_TARGET，回退到 process.platform:", env);
  }
  return process.platform;
}

async function main() {
  /** 可选命令行参数：`ia32` 表示下载 Windows 32 位 Node 到 bundled/win-ia32（供 32 位安装包使用） */
  const winArchArg = process.argv[2];
  const winBundleArch = winArchArg === "ia32" ? "ia32" : "x64";

  const target = resolveTarget();
  if (target === "win32") {
    await ensureWinNode(winBundleArch);
  } else if (target === "darwin") {
    const raw = process.env.BUNDLE_NODE_ARCHS;
    const archList = raw
      ? raw.split(/[,\s]+/).filter(Boolean)
      : ["x64", "arm64"];
    for (const a of archList) {
      if (a !== "x64" && a !== "arm64") {
        console.warn("[ensure-bundled-node] 忽略未知架构:", a);
        continue;
      }
      await ensureDarwinNode(a);
    }
  } else {
    console.log("[ensure-bundled-node] 当前平台无需内置 Node 下载，跳过:", target);
  }
}

main().catch((e) => {
  console.error("[ensure-bundled-node] 失败:", e?.message || e);
  process.exit(1);
});
