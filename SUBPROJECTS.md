# 根项目子项目说明（Monorepo）

本仓库是一个包含 **服务端（Spring Boot）+ Web 前端（Vite/React）+ 桌面端（Electron）+ 本地代理（Node CLI）+ 文档** 的 Monorepo。

## 目录一览

- `src/`：**Java 服务端核心代码**（Spring Boot 3 / Java 17）
- `frontend/`：**Web 前端站点**（Vite + React + Tailwind）
- `local-desktop/`：**Windows/macOS 桌面客户端**（Electron + 本地 Express + SQLite + 内置前端）
- `local-proxy/`：**本地代理/CLI 工具**（Node.js / TypeScript / Express / SQLite）
- `docs/`：项目文档与测试资料（如 Postman 集合、A/B 测试说明）
- `target/`：Maven 构建产物输出目录（自动生成）

## 1) 服务端：`src/` + 根目录 `pom.xml`

### 职责
- 提供 OpenCarapace 的核心后端能力（鉴权、用户体系、API、监管/安全相关能力等）
- 对外提供 HTTP API（默认端口见配置）

### 技术栈
- Java 17、Spring Boot 3.x、Spring Security、JPA
- 数据库：MySQL（生产/默认配置）

### 开发运行
- 在仓库根目录运行：

```bash
mvn spring-boot:run
```

### 主要配置
- `src/main/resources/application.yml`：本地/默认配置入口  
  - 说明：生产环境建议使用 **环境变量/外部配置** 覆盖敏感项（如数据库与 JWT secret），不要把真实密钥写进仓库。

## 2) Web 前端：`frontend/`

### 职责
- OpenCarapace 的 Web 站点（官网 Landing / 管理后台 / 页面功能等）
- 通过 HTTP 调用服务端 API

### 技术栈
- Vite + React + TypeScript + Tailwind

### 开发运行

```bash
cd frontend
npm install
npm run dev
```

### 构建

```bash
cd frontend
npm run build
```

## 3) 桌面客户端：`local-desktop/`

### 职责
- 提供本地可视化客户端（侧边栏面板、拦截日志、skills 管理、设置、登录等）
- 通过本地端口启动一个本地服务（Express），并使用 SQLite 存储本地数据
- 内置一个前端渲染进程（`local-desktop/frontend/`），由 Vite 构建后打包进 Electron

### 结构
- `local-desktop/src/`：Electron 主进程与本地服务端（Express/SQLite 等）
- `local-desktop/frontend/`：桌面端渲染进程（React）
- `local-desktop/scripts/`：打包/构建脚本
- `local-desktop/BUILD.md`：打包说明

### 开发运行（推荐）

```bash
cd local-desktop
npm install
cd frontend && npm install && cd ..
npm run dev
```

### 打包
- 参考 `local-desktop/BUILD.md`（NSIS 安装包/免安装目录等）。

## 4) 本地代理 / CLI：`local-proxy/`

### 职责
- 一个可独立分发的本地代理服务/命令行工具（bin：`clawheart-proxy`）
- 典型用途：在本机提供轻量的 HTTP 代理/本地数据库能力，用于配合其它客户端或自动化场景

### 技术栈
- Node.js + TypeScript
- Express + SQLite + Axios

### 开发运行

```bash
cd local-proxy
npm install
npm run dev
```

### 构建

```bash
cd local-proxy
npm run build
```

## 5) 文档：`docs/`

### 职责
- 产品/研发文档、调试材料与工具集合

### 现有内容
- `docs/ab-test-openclaw-gateway.md`：OpenClaw 网关 A/B 测试指南
- `docs/postman/`：Postman 请求集合/环境（如有）

## 常见组合：本地联调推荐启动顺序

1. 启动服务端：`mvn spring-boot:run`
2. 启动 Web 前端：`cd frontend && npm run dev`
3. 启动桌面端（可选）：`cd local-desktop && npm run dev`

