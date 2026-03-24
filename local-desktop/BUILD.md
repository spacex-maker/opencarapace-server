# ClawHeart Desktop 打包指南

## 前置条件

1. 确保已安装 Node.js（推荐 v18 或更高版本）
2. 确保已安装所有依赖：
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

### 3. 打包为安装包

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

### 4. 打包为 macOS 安装包（在 macOS 机器执行）

#### 方式 A：生成 DMG + ZIP（推荐）

```bash
npm run build:mac
```

#### 方式 B：生成免安装 .app 目录（用于快速测试）

```bash
npm run build:mac:dir
```

### 5. 测试打包结果

- **安装程序版本**：运行 `dist/ClawHeart Desktop Setup 0.1.0.exe`
- **免安装版本**：运行 `dist/win-unpacked/ClawHeart Desktop.exe`
- **macOS 安装包**：运行 `dist/ClawHeart Desktop-0.1.0-universal.dmg`
- **macOS 免安装**：运行 `dist/mac-universal/ClawHeart Desktop.app`

## 打包配置说明

打包配置在 `package.json` 的 `build` 字段中：

- **appId**: `com.clawheart.desktop`
- **productName**: `ClawHeart Desktop`
- **输出目录**: `dist/`
- **目标平台**: Windows x64、macOS Universal（x64 + arm64）
- **安装程序类型**: Windows NSIS、macOS DMG + ZIP

## 注意事项

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
