# ClawHeart Desktop 打包指南

工作目录均为 `local-desktop/`。

## 前置条件

1. **Node.js**：本仓库依赖 **Node ≥ 22.16**（与 `openclaw`、部分依赖一致）。若版本过低，`npm install` 或运行时可能失败。
2. **Windows**：为编译 `sqlite3` 等原生模块，建议安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)（含「使用 C++ 的桌面开发」工作负载）。缺失时安装包能打出，但安装后双击**无窗口**、进程秒退。
3. **macOS**：安装 Xcode 命令行工具（含 `clang` 等），用于编译原生模块：
   ```bash
   xcode-select --install
   ```
4. 安装依赖：
   ```bash
   npm install
   cd frontend && npm install && cd ..
   ```

## 一键打包（推荐）

`scripts/build.js` 会依次：构建前端、执行 `electron-builder install-app-deps`、下载对应平台的内置 Node、再调用 `electron-builder`。

### macOS

- **默认**（`npm run build`）：只打**当前 CPU 架构**的 **DMG**（Apple Silicon → arm64，Intel → x64），省磁盘与时间。
- **双架构**（需约 **≥10GB** 空闲磁盘）：
  ```bash
  npm run build:mac:all
  ```
  等价：`node scripts/build.js mac both`（`both` / `universal` / `all` 均可）。

- **只打 Apple Silicon（arm64）**：
  ```bash
  npm run build:mac:arm64
  ```
- **只打 Intel（x64）**：
  ```bash
  npm run build:mac:intel
  ```
  与 `npm run build:mac:x64` 相同；等价命令：`node scripts/build.js mac x64`。

**为何不再打 ZIP：** `electron-builder` 用内置 **p7zip（7za）** 生成 `-mac.zip`，在磁盘紧张、应用名含空格等情况下易出现 **`E_FAIL`**；分发 **DMG** 一般已足够。若你确需 zip，可在 `package.json` 的 `build.mac.target` 里自行加回 `{ "target": "zip", "arch": [...] }` 后单独试打。

### Windows

```bash
npm run build
```

或显式：`npm run build:win`

产物位于带时间戳的目录：`build-output-<时间戳>/`（见终端末尾提示）。版本号以 `package.json` 的 `version` 为准。

### 免安装目录（快速自测）

- Windows：`npm run build:dir` → `build-output-.../win-unpacked/ClawHeart Desktop.exe`
- macOS：`npm run build:dir` → `build-output-.../mac-*/ClawHeart Desktop.app`

## 打包配置说明

配置在 `package.json` 的 `build` 字段中：

- **appId**: `com.clawheart.desktop`
- **productName**: `ClawHeart Desktop`
- **Windows**：NSIS，x64；内置 `node.exe` → `resources/node.exe`
- **macOS**：`mac.target` 为 **`dmg`**（不在此写死 `arch` 列表）。具体打 **arm64 / x64** 由命令行 `--arm64` / `--x64` 决定；若在 `target` 里写 `arch: [x64, arm64]`，即使用 `npm run build:mac:arm64` 也会被迫打两套包。内置 Node 由 `scripts/after-pack.js` 写入 `.app/Contents/Resources/node`。

## 注意事项

### 磁盘空间（`ENOSPC` / `hdiutil` / `7za E_FAIL`）

双架构 + DMG 仍会占用大量临时空间。空间不足时会出现 `no space left on device`、`hdiutil` 失败或 zip 阶段 `7za` 的 `E_FAIL`。

处理：腾出系统盘空间、删除旧 `build-output-*`；日常优先用默认**单架构 DMG**。

### 原生模块（sqlite3）与 Electron ABI

`scripts/build.js` 会自动执行 `npx electron-builder install-app-deps`。也可手动：`npm run rebuild:native`。

### 分发给客户

- **macOS**：分发对应架构的 **DMG**（`*-arm64.dmg` 或 `*-x64.dmg`，视文件名而定）。未签名时用户可能需在「隐私与安全性」中允许运行。
- **Windows**：分发 NSIS 安装包或 `win-unpacked` 绿色目录。

## 更新版本

修改 `package.json` 中的 `version` 字段，然后重新打包。
