/**
 * 全客户端唯一品牌图：只改 build/icon.png。
 * - electron-builder / 主程序窗口：用 PNG（或 builder 内部转 ICO）
 * - NSIS / 安装包：用同图生成的 build/icon.ico（见 sync-brand-icon-from-png.js）
 */
const path = require("path");

const rootDir = path.join(__dirname, "..");

module.exports = {
  /** 相对 projectDir，写入 package.json、electron 配置 */
  relPng: "build/icon.png",
  relIco: "build/icon.ico",
  absPng: path.join(rootDir, "build", "icon.png"),
  absIco: path.join(rootDir, "build", "icon.ico"),
};
