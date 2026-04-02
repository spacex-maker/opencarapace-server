# ClawHeart Desktop 打包指南

## 前置条件

1. 确保已安装 Node.js（推荐 v18 或更高版本）
2. **Windows**：为编译 `sqlite3` 等原生模块，建议安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)（含 “使用 C++ 的桌面开发” 工作负载）。缺失时安装包能打出，但安装后双击**无窗口**、进程秒退。
3. 确保已安装所有依赖：
   ```bash
   npm install
   cd frontend && npm install && cd ..
   ```

## 打包步骤

### 1. 安装打包工具

如果还没有安装 `electron-builder`，运行：

```bash
npm install --save-dev electron-builder
```

### 2. 构建前端

```bash
npm run build:frontend
```

这会在 `frontend/dist/` 目录生成前端静态文件。

### 3. 打包为 Windows exe

#### 方式 A：生成安装程序（推荐）

```bash
npm run build
```

这会生成一个 NSIS 安装程序（`.exe`），位于 `dist/` 目录。

#### 方式 B：生成免安装版本（用于快速测试）

```bash
npm run build:dir
```

这会在 `dist/win-unpacked/` 目录生成可直接运行的文件夹，不需要安装。

### 4. 测试打包结果

- **安装程序版本**：运行 `dist/ClawHeart Desktop Setup 0.1.0.exe`
- **免安装版本**：运行 `dist/win-unpacked/ClawHeart Desktop.exe`

## 打包配置说明

打包配置在 `package.json` 的 `build` 字段中：

- **appId**: `com.clawheart.desktop`
- **productName**: `ClawHeart Desktop`
- **输出目录**: `dist/`
- **目标平台**: Windows x64
- **安装程序类型**: NSIS（支持自定义安装路径）

## 注意事项

### 原生模块（sqlite3）与 Electron ABI

桌面端启动时会立刻加载 SQLite。`sqlite3` **必须按当前 `electron` 版本重新编译**。正式打包前，`scripts/build.js` 会自动执行：

`npx electron-builder install-app-deps`

若你本地只改了依赖、未完整跑 `npm run build`，可手动执行：

```bash
npm run rebuild:native
```

若安装后仍无法启动，请到用户数据目录查看日志：`startup.log`（路径形如 `%APPDATA%/ClawHeart Desktop/logs/startup.log`，以 Electron `userData` 为准）。自新版本起启动失败会弹出错误框并写入该文件。

### 应用图标

安装包与快捷方式使用 `build/icon.png`（由 electron-builder 生成各平台图标）。请勿删除该文件；更换品牌图时替换同名 PNG 后重新打包即可。

### OpenClaw 依赖

打包时会自动包含 `node_modules/openclaw`，确保：
1. 打包前已运行 `npm install` 安装了 OpenClaw
2. OpenClaw 的所有依赖都在 `node_modules` 中

### 数据库文件

- SQLite 数据库文件会在用户首次运行时自动创建
- 位置：`%APPDATA%/clawheart-desktop/` 或应用安装目录

### 配置文件

- OpenClaw 配置文件 `openclaw.json` 会在首次启动 Gateway 时自动生成
- 位置：`%USERPROFILE%/.openclaw/` 或应用数据目录

## 常见问题

### 1. 打包失败：找不到 electron-builder

运行：
```bash
npm install --save-dev electron-builder
```

### 2. 打包后运行报错：找不到模块

确保 `package.json` 的 `files` 配置包含了所有必要的文件。

### 3. 打包体积过大

可以在 `build.files` 中排除不必要的文件，例如：
```json
"files": [
  "!**/*.map",
  "!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}",
  "!**/node_modules/.bin"
]
```

### 4. OpenClaw 在打包后无法运行

确保 `extraResources` 配置正确包含了 OpenClaw 的所有文件。

## 分发给客户

打包完成后，分发以下文件之一：

1. **安装程序**（推荐）：`dist/ClawHeart Desktop Setup 0.1.0.exe`
   - 客户双击安装即可
   - 支持自定义安装路径
   - 自动创建桌面快捷方式

2. **免安装版本**：压缩 `dist/win-unpacked/` 整个文件夹
   - 客户解压后直接运行 `ClawHeart Desktop.exe`
   - 无需安装，但需要保持文件夹结构完整

## 更新版本

修改 `package.json` 中的 `version` 字段，然后重新打包。
