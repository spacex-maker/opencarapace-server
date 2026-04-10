#!/usr/bin/env node

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { getWindowsCmdPath } = require("../src/server/utils.js");

console.log("=".repeat(60));
console.log("正在初始化内置 OpenClaw...");
console.log("=".repeat(60));

// 检查 openclaw 是否已安装
const openclawPath = path.join(__dirname, "../node_modules/.bin/openclaw");
const openclawCmdPath = path.join(__dirname, "../node_modules/.bin/openclaw.cmd");

const openclawBin = process.platform === "win32" ? openclawCmdPath : openclawPath;

if (!fs.existsSync(openclawBin)) {
  console.log("⚠️  OpenClaw 未找到，跳过初始化");
  process.exit(0);
}

console.log("✓ OpenClaw 已安装");
console.log("正在初始化 OpenClaw Gateway...");
console.log("（此过程可能需要几秒钟，请稍候...）");

// 运行 openclaw daemon install 来安装 Gateway 服务
const spawnOptions = {
  stdio: "inherit",
  shell: false,
};

const child = process.platform === "win32"
  ? spawn(getWindowsCmdPath(), ["/c", openclawBin, "daemon", "install"], spawnOptions)
  : spawn(openclawBin, ["daemon", "install"], spawnOptions);

// 设置超时（30秒）
const timeout = setTimeout(() => {
  console.log("\n⚠️  OpenClaw 初始化超时（30秒），继续安装...");
  console.log("OpenClaw 可能已在后台初始化，客户端启动时会自动检测");
  console.log("=".repeat(60));
  try {
    child.kill();
  } catch (e) {
    // ignore
  }
  process.exit(0);
}, 30000);

child.on("close", (code) => {
  clearTimeout(timeout);
  if (code === 0) {
    console.log("✓ OpenClaw Gateway 服务已安装！");
    console.log("客户端启动时会自动启动 Gateway");
    console.log("=".repeat(60));
  } else {
    console.log(`⚠️  OpenClaw Gateway 安装退出码: ${code}`);
    console.log("这不会影响客户端的正常使用，Gateway 会在首次使用时自动配置");
    console.log("=".repeat(60));
  }
  process.exit(0);
});

child.on("error", (err) => {
  clearTimeout(timeout);
  console.error("⚠️  OpenClaw 初始化失败:", err.message);
  console.log("这不会影响客户端的正常使用");
  console.log("=".repeat(60));
  process.exit(0);
});
