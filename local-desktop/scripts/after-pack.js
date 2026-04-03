/**
 * macOS：按当前产物架构将 bundled/darwin-${arch}/bin/node 复制到 .app/Contents/Resources/node。
 * （electron-builder 的 extraResources 对单文件按架构映射较麻烦，故在 afterPack 中处理。）
 */
const fs = require("fs");
const path = require("path");

/** app-builder-lib Arch：x64=1，arm64=3 */
function macArchFolderName(arch) {
  if (arch === 1 || arch === "x64") return "x64";
  if (arch === 3 || arch === "arm64") return "arm64";
  return null;
}

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  const archName = macArchFolderName(context.arch);
  if (!archName) {
    throw new Error(`[after-pack] 不支持的 mac 架构: ${context.arch}`);
  }

  const bundledNode = path.join(__dirname, "..", "bundled", `darwin-${archName}`, "bin", "node");
  if (!fs.existsSync(bundledNode)) {
    throw new Error(
      `[after-pack] 未找到内置 Node: ${bundledNode}。请在 local-desktop 目录执行: node scripts/ensure-bundled-node.js`
    );
  }

  // appOutDir 是「含 .app 的目录」（如 mac-arm64/），不是 .app 根目录；须与 getResourcesDir 一致
  const resourcesDir =
    typeof context.packager?.getResourcesDir === "function"
      ? context.packager.getResourcesDir(context.appOutDir)
      : path.join(
          context.appOutDir,
          `${context.packager.appInfo.productFilename}.app`,
          "Contents",
          "Resources"
        );
  const dest = path.join(resourcesDir, "node");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(bundledNode, dest);
  fs.chmodSync(dest, 0o755);
  console.log("[after-pack] 已写入内置 Node:", JSON.stringify({ arch: archName, path: dest }));
};
