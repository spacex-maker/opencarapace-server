const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("=== ClawHeart Desktop 打包流程 ===\n");

// 1. 检查前端依赖
console.log("1. 检查前端依赖...");
const frontendDir = path.join(__dirname, "..", "frontend");
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
const rootDir = path.join(__dirname, "..");
if (!fs.existsSync(path.join(rootDir, "node_modules"))) {
  console.log("   主进程依赖未安装，正在安装...");
  execSync("npm install", { cwd: rootDir, stdio: "inherit" });
} else {
  console.log("   ✓ 主进程依赖已安装");
}

// 5. 检查 OpenClaw
console.log("\n4. 检查 OpenClaw...");
const openclawPath = path.join(rootDir, "node_modules", "openclaw");
if (!fs.existsSync(openclawPath)) {
  console.error("   ✗ OpenClaw 未安装，请运行 npm install");
  process.exit(1);
}
console.log("   ✓ OpenClaw 已安装");

// 4c. 原生模块（如 sqlite3）须与当前 Electron 版本 ABI 一致，否则安装后双击无窗口、进程立即退出
console.log("\n4c. 为 Electron 重新编译原生模块（sqlite3）...");
try {
  execSync("npx --yes electron-builder install-app-deps", { cwd: rootDir, stdio: "inherit" });
  console.log("   ✓ install-app-deps 完成");
} catch (e) {
  console.error("   ✗ install-app-deps 失败：请确保已安装 Python/VS Build Tools（Windows）或 Xcode CLI（macOS），然后重试。");
  process.exit(1);
}

// 5b. 内置 Node（OpenClaw 子进程专用，不依赖用户本机 Node）
console.log("\n4b. 确保内置 Node runtime（resources/node.exe）...");
execSync("node scripts/ensure-bundled-node.js", { cwd: rootDir, stdio: "inherit" });
const bundledNode = path.join(rootDir, "bundled", "win-x64", "node.exe");
if (!fs.existsSync(bundledNode)) {
  console.error("   ✗ 未找到 bundled/win-x64/node.exe，请检查网络或手动运行: node scripts/ensure-bundled-node.js");
  process.exit(1);
}
console.log("   ✓ 内置 node.exe 已就绪");

// 6. 开始打包（Windows）
console.log("\n5. 开始打包 Electron 应用（Windows）...");
const buildType = process.argv[2] || "installer";
const buildStamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDirName = `build-output-${buildStamp}`;
const outputDir = path.join(rootDir, outputDirName);

console.log(`   输出目录：${outputDirName}`);

if (buildType === "dir") {
  console.log("   打包模式：免安装版本（--dir）");
  execSync(`electron-builder --win --x64 --dir --config.directories.output="${outputDirName}"`, {
    cwd: rootDir,
    stdio: "inherit",
  });
  console.log("\n=== 打包完成 ===");
  console.log(`输出目录：${outputDirName}/`);
  console.log(`可执行文件：${outputDirName}/win-unpacked/ClawHeart Desktop.exe`);
} else {
  console.log("   打包模式：安装程序（NSIS）");
  execSync(`electron-builder --win --x64 --config.directories.output="${outputDirName}"`, {
    cwd: rootDir,
    stdio: "inherit",
  });
  console.log("\n=== 打包完成 ===");
  console.log(`输出目录：${outputDirName}/`);
  console.log(`安装程序：${outputDirName}/ClawHeart Desktop Setup 0.1.0.exe`);
}
