const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const brand = require("./brand-icon-paths");

/** Windows 上 electron-builder 从 bundled 直拷 node.exe 时易出现 EBUSY；先拷到 %TEMP% 再作为 extraResources 来源 */
let stagedBundledNodePath = null;
/** 程序化传入的 config 会与 package.json 的 build 做 deepAssign，数组会 concat，导致 win.extraResources 仍含 bundled/node.exe；Windows 下改为写入临时 JSON 并以路径交给 build()，避免合并 */
let generatedEbConfigPath = null;
/** 勿对 NSIS 的 Setup*.exe 使用 rcedit/set-icon：会重写 PE 并丢掉尾部 overlay，安装包只剩几百 KB 且无法安装 */

function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* spin */
  }
}

function copyFileWithRetry(src, dest, label, retries = 8) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      fs.copyFileSync(src, dest);
      return;
    } catch (e) {
      lastErr = e;
      const code = e && e.code;
      if ((code === "EBUSY" || code === "EPERM" || code === "EACCES") && i < retries - 1) {
        sleepSync(250 + i * 200);
        continue;
      }
      throw e;
    }
  }
  throw lastErr || new Error(`copy failed: ${label}`);
}

const argv = process.argv.slice(2);
const noOpenclaw = argv.includes("no-openclaw");
const buildType = argv.includes("dir") ? "dir" : "installer";

console.log("=== ClawHeart Desktop 打包流程 ===\n");
if (noOpenclaw) {
  console.log("变体：Core（不内置 OpenClaw：安装包不含 resources/openclaw，且排除 node_modules/openclaw）\n");
}

// 1. 检查前端依赖
console.log("1. 检查前端依赖...");
const frontendDir = path.join(rootDir, "frontend");
if (!fs.existsSync(path.join(frontendDir, "node_modules"))) {
  console.log("   前端依赖未安装，正在安装...");
  execSync("npm install", { cwd: frontendDir, stdio: "inherit" });
} else {
  console.log("   ✓ 前端依赖已安装");
}

// 2. 构建前端
console.log("\n2. 构建前端...");
execSync("npm run build", { cwd: frontendDir, stdio: "inherit" });
console.log("   ✓ 前端构建完成");

// 3. 检查前端构建产物
const frontendDistDir = path.join(frontendDir, "dist");
if (!fs.existsSync(frontendDistDir)) {
  console.error("   ✗ 前端构建失败：dist 目录不存在");
  process.exit(1);
}
console.log("   ✓ 前端构建产物已生成");

// 4. 检查主进程依赖
console.log("\n3. 检查主进程依赖...");
if (!fs.existsSync(path.join(rootDir, "node_modules"))) {
  console.log("   主进程依赖未安装，正在安装...");
  execSync("npm install", { cwd: rootDir, stdio: "inherit" });
} else {
  console.log("   ✓ 主进程依赖已安装");
}

// 5. 检查 OpenClaw（完整版需要；Core 版不打包 openclaw，但开发依赖里仍可保留）
if (!noOpenclaw) {
  console.log("\n4. 检查 OpenClaw...");
  const openclawPath = path.join(rootDir, "node_modules", "openclaw");
  if (!fs.existsSync(openclawPath)) {
    console.error("   ✗ OpenClaw 未安装，请运行 npm install");
    process.exit(1);
  }
  console.log("   ✓ OpenClaw 已安装");
} else {
  console.log("\n4. Core 版：跳过 OpenClaw 完整性检查（打包产物中不包含 openclaw 包）");
}

// 4c. 原生模块（如 sqlite3）须与当前 Electron 版本 ABI 一致
console.log("\n4c. 为 Electron 重新编译原生模块（sqlite3）...");
try {
  execSync("npx --yes electron-builder install-app-deps", { cwd: rootDir, stdio: "inherit" });
  console.log("   ✓ install-app-deps 完成");
} catch (e) {
  console.error("   ✗ install-app-deps 失败：请确保已安装 Python/VS Build Tools（Windows）或 Xcode CLI（macOS），然后重试。");
  process.exit(1);
}

// 5b. 内置 Node（Gateway/脚本等仍可用，不依赖用户本机 Node）
console.log("\n4b. 确保内置 Node runtime（resources/node.exe）...");
execSync("node scripts/ensure-bundled-node.js", { cwd: rootDir, stdio: "inherit" });
const bundledNode = path.join(rootDir, "bundled", "win-x64", "node.exe");
if (!fs.existsSync(bundledNode)) {
  console.error("   ✗ 未找到 bundled/win-x64/node.exe，请检查网络或手动运行: node scripts/ensure-bundled-node.js");
  process.exit(1);
}
console.log("   ✓ 内置 node.exe 已就绪");

if (process.platform === "win32") {
  stagedBundledNodePath = path.join(
    os.tmpdir(),
    `clawheart-pack-node-${process.pid}-${Date.now()}.exe`
  );
  try {
    copyFileWithRetry(bundledNode, stagedBundledNodePath, "stage bundled node.exe");
    console.log("   ✓ 已复制 node.exe 到临时路径（降低打包时 EBUSY 概率）");
  } catch (e) {
    console.error("   ✗ 无法复制 node.exe 到临时目录:", e.message || e);
    process.exit(1);
  }
}

// 删掉曾手动放置的 NSIS 专用 ico，避免覆盖「从 icon.png 生成的 icon.ico」逻辑
if (process.platform === "win32") {
  const staleNsisIcons = ["installerIcon.ico", "uninstallerIcon.ico", "installerHeaderIcon.ico"];
  const bd = path.join(rootDir, "build");
  for (const name of staleNsisIcons) {
    const p = path.join(bd, name);
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
        console.log(`   已移除过时资源: build/${name}`);
      } catch {
        // ignore
      }
    }
  }
  console.log(`\n4b-brand. 唯一品牌图 ${brand.relPng} → ${brand.relIco}（NSIS 等需 ICO）...`);
  try {
    execSync("node scripts/sync-brand-icon-from-png.js", { cwd: rootDir, stdio: "inherit" });
  } catch (e) {
    console.error("   ✗ 同步品牌 ICO 失败");
    process.exit(1);
  }
  console.log("\n4b-nsis-patch. 修补 electron-builder NSIS 模板（MUI2 后注入 Icon，去掉安装包绿盾）...");
  try {
    execSync("node scripts/patch-nsis-installer-template.js", { cwd: rootDir, stdio: "inherit" });
  } catch (e) {
    console.error("   ✗ patch-nsis-installer-template 失败");
    process.exit(1);
  }
}

// 6. 打包
console.log("\n5. 开始打包 Electron 应用（Windows）...");
const buildStamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDirName = `build-output-${buildStamp}`;

console.log(`   输出目录：${outputDirName}`);
console.log(`   模式：${buildType === "dir" ? "免安装（dir）" : "NSIS 安装程序"}`);

const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
const version = pkg.version || "0.1.0";
const productNameFull = "ClawHeart Desktop";
const productNameCore = "ClawHeart Desktop Core";

function buildElectronConfig() {
  const config = JSON.parse(JSON.stringify(pkg.build));
  config.directories = { ...(config.directories || {}), output: outputDirName };

  if (noOpenclaw) {
    config.extraResources = [];
    config.productName = productNameCore;
    config.appId = "com.clawheart.desktop.core";
    config.nsis = { ...(config.nsis || {}), shortcutName: productNameCore };
    const files = [...(config.files || [])];
    const excl = "!node_modules/openclaw/**/*";
    const hasOpenclawExclude = files.some((f) => String(f).replace(/\\/g, "/") === excl);
    if (!hasOpenclawExclude) {
      files.push(excl);
    }
    config.files = files;
  }

  if (process.platform === "win32") {
    config.win = JSON.parse(JSON.stringify(config.win || {}));
    config.icon = brand.relPng;
    // 官方 Windows 链路透传多尺寸 ICO；与 PNG 同源，sync-brand 已生成
    config.win.icon = brand.relIco;
    config.win.signAndEditExecutable = true;
    const files = [...(config.files || [])];
    for (const f of ["build/icon.ico", "build/electron-brand.json"]) {
      const norm = (s) => String(s).replace(/\\/g, "/");
      if (!files.some((e) => norm(e) === f)) files.push(f);
    }
    config.files = files;
    const unpack = new Set([
      ...(config.asarUnpack || []),
      "build/icon.png",
      "build/icon.ico",
      "build/electron-brand.json",
    ]);
    config.asarUnpack = [...unpack];
    const metaPath = path.join(rootDir, "build", "electron-brand.json");
    fs.mkdirSync(path.dirname(metaPath), { recursive: true });
    fs.writeFileSync(
      metaPath,
      JSON.stringify({ appUserModelId: config.appId || pkg.build.appId }, null, 2),
      "utf8"
    );
    config.nsis = {
      ...(config.nsis || {}),
      include: "scripts/nsis/refresh-shortcut-icons.nsh",
      installerIcon: brand.relIco,
      uninstallerIcon: brand.relIco,
      installerHeaderIcon: brand.relIco,
    };
    if (stagedBundledNodePath) {
      const keep = (config.win.extraResources || []).filter(
        (r) => r && String(r.to) !== "node.exe"
      );
      config.win.extraResources = [
        ...keep,
        { from: stagedBundledNodePath, to: "node.exe" },
      ];
    }
  }

  return config;
}

async function runPack() {
  const { build, Platform, Arch } = require("electron-builder");
  const config = buildElectronConfig();
  if (process.platform === "win32") {
    const nodeEntry = (config.win?.extraResources || []).find(
      (r) => r && String(r.to) === "node.exe"
    );
    if (nodeEntry) {
      console.log(`   [pack] resources/node.exe 将从此处复制: ${nodeEntry.from}`);
    }
  }
  const winTarget = buildType === "dir" ? "dir" : "nsis";
  let configArg = config;
  if (process.platform === "win32") {
    // 避免可执行文件缓存沿用旧 rcedit 结果导致图标不更新
    process.env.ELECTRON_BUILDER_DISABLE_BUILD_CACHE = "true";
    generatedEbConfigPath = path.join(
      os.tmpdir(),
      `clawheart-electron-builder-${process.pid}-${Date.now()}.json`
    );
    fs.writeFileSync(generatedEbConfigPath, JSON.stringify(config, null, 2), "utf8");
    configArg = generatedEbConfigPath;
    console.log(`   [pack] 使用独立配置文件（避免与 package.json build 合并 extraResources）: ${generatedEbConfigPath}`);
  }
  await build({
    projectDir: rootDir,
    targets: Platform.WINDOWS.createTarget(winTarget, Arch.x64),
    config: configArg,
  });
}

(async () => {
  try {
    await runPack();
    const exeName = noOpenclaw ? productNameCore : productNameFull;
    console.log("\n=== 打包完成 ===");
    console.log(`输出目录：${outputDirName}/`);
    if (buildType === "dir") {
      console.log(`可执行文件：${outputDirName}/win-unpacked/${exeName}.exe`);
    } else {
      console.log(`安装程序：${outputDirName}/${exeName} Setup ${version}.exe`);
    }
  } catch (err) {
    console.error("\n✗ 打包失败:", err);
    process.exitCode = 1;
  } finally {
    if (stagedBundledNodePath && fs.existsSync(stagedBundledNodePath)) {
      try {
        fs.unlinkSync(stagedBundledNodePath);
      } catch {
        // ignore
      }
    }
    if (generatedEbConfigPath && fs.existsSync(generatedEbConfigPath)) {
      try {
        fs.unlinkSync(generatedEbConfigPath);
      } catch {
        // ignore
      }
    }
  }
  if (process.exitCode) {
    process.exit(process.exitCode);
  }
})();
