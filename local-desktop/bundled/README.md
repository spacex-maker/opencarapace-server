# 内置 Node 运行时（随安装包分发）

- **Windows**：执行 `npm run build` / `build.js` 时会自动运行 `scripts/ensure-bundled-node.js`，从 nodejs.org 下载官方 **Node 22.x win-x64**（版本与 `node-manager.js` 一致，且满足当前 `openclaw` 的 Node 下限，例如 **>=22.16.0**）的 `node.exe` 到 `bundled/win-x64/node.exe`，再由 `electron-builder` 打进安装包的 `resources/node.exe`。
- 该目录下的二进制文件由 `.gitignore` 忽略，**无需提交到 Git**；CI/本机打包前会自动拉取。

OpenClaw Gateway 仅使用此内置 `node.exe`（以及可选的「客户端内置 Node」下载目录），**不要求用户本机安装 Node.js**。

**本地开发（Windows）**：若要在未打包状态下测试 OpenClaw 启动，请先执行一次：

`npm run ensure-node`
