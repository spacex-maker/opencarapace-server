# 内置 Node 运行时（随安装包分发）

- **Windows**：执行 `npm run build:win`（或 Windows 上的 `npm run build`）时会自动运行 `scripts/ensure-bundled-node.js`，从 nodejs.org 下载官方 **Node 22.x win-x64**（版本与 `node-manager.js` 一致，且满足当前 `openclaw` 的 Node 下限，例如 **>=22.16.0**）的 `node.exe` 到 `bundled/win-x64/node.exe`，再由 `electron-builder` 打进安装包的 `resources/node.exe`。
- **macOS**：执行 `npm run build:mac`（或 macOS 上的 `npm run build`）时会下载 **darwin-x64** 与 **darwin-arm64** 的 `bin/node` 到 `bundled/darwin-*/bin/node`；打包时由 `scripts/after-pack.js` 按产物架构写入 `.app/Contents/Resources/node`。
- 该目录下的二进制文件由 `.gitignore` 忽略，**无需提交到 Git**；CI/本机打包前会自动拉取。

OpenClaw Gateway 仅使用此内置 Node（以及可选的「客户端内置 Node」下载目录），**不要求用户本机安装 Node.js**。

**本地开发**：若要在未打包状态下测试 OpenClaw 启动，请先执行一次：

- Windows：`npm run ensure-node`（需 Node 环境与 PowerShell 解压）
- macOS：`BUNDLE_NODE_TARGET=darwin node scripts/ensure-bundled-node.js`
