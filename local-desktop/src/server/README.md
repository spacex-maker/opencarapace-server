# Server 模块说明

本目录包含本地桌面端服务器的模块化代码，从原来的单一 `server.js` 文件（808行）拆分而来。

## 文件结构

```
server/
├── utils.js              # 工具函数（平台检测、命令执行、URL 检测）
├── node-manager.js       # 内置 Node.js 管理（下载、安装、执行 npm）
├── sync-state.js         # 同步状态管理（危险指令、Skills 同步进度）
├── openclaw.js           # OpenClaw 相关路由（状态、配置、一键安装、内置 Node.js）
├── auth-routes.js        # 认证路由（登录、退出）
├── settings-routes.js    # 设置路由（LLM 路由模式、映射配置、同步开关）
├── danger-routes.js      # 危险指令路由（列表、同步、用户启用状态）
├── skills-routes.js      # Skills 路由（列表、详情、同步、用户启用状态）
└── llm-proxy.js          # LLM 代理转发（Skills 拦截、危险指令拦截、路由转发）
```

## 模块职责

### utils.js
- `detectPlatform()`: 检测操作系统（windows/macos/linux）
- `execWithOutput(cmd, args)`: 执行命令并捕获输出
- `hasCommand(cmd)`: 检测命令是否存在
- `checkUrlReachable(url)`: 检测 URL 是否可访问

### node-manager.js
- `getEmbeddedNodePath()`: 获取内置 Node.js 存储路径
- `hasEmbeddedNode()`: 检查内置 Node.js 是否已安装
- `downloadAndInstallNode(onProgress)`: 下载并安装内置 Node.js v20.18.1 LTS
- `runEmbeddedNpm(args, opts)`: 使用内置 Node.js 执行 npm 命令
- **功能**：在用户系统无 npm 时，自动下载官方便携版 Node.js 到 `~/.opencarapace/embedded-node/`

### sync-state.js
- 管理全局同步状态 `syncState`
- 提供同步进度更新函数（danger/skills）

### openclaw.js
- `GET /api/openclaw/node-status`: 获取 Node.js 环境状态（系统 npm、内置 Node.js）
- `POST /api/openclaw/install-node`: 下载并安装内置 Node.js（约 30MB，全自动）
- `GET /api/openclaw/check-npm`: 检查 npm 是否可用（系统或内置）
- `GET /api/openclaw/status`: 获取 OpenClaw 安装状态和配置
- `POST /api/openclaw/config`: 保存 OpenClaw 配置（UI 地址、安装命令）
- `POST /api/openclaw/install`: 一键安装 OpenClaw（优先使用内置 Node.js）

### auth-routes.js
- `POST /api/auth/login`: 用户登录（代理到云端，保存 token，触发同步）
- `POST /api/auth/logout`: 退出登录

### settings-routes.js
- `POST /api/settings`: 保存基础配置（apiBase、ocApiKey、llmKey）
- `GET/POST /api/user-settings/llm-route-mode`: LLM 路由模式管理
- `GET/POST /api/user-settings/sync-user-skills-to-cloud`: Skills 云端同步开关
- `GET/POST /api/user-settings/sync-user-dangers-to-cloud`: 危险指令云端同步开关
- `GET/POST /api/llm-mappings`: 网络映射配置管理（路径名 `llm-mappings` 为历史兼容）
- `GET/POST /api/user-settings/check-version`: 版本检查与更新

### danger-routes.js
- `GET /api/danger-commands`: 危险指令列表（支持高级筛选）
- `GET /api/danger-commands/meta`: 危险指令元数据（枚举值）
- `POST /api/danger-commands/sync`: 手动触发同步
- `PUT /api/user-danger-commands/:id`: 更新用户启用状态

### skills-routes.js
- `GET /api/skills`: Skills 列表（支持高级筛选）
- `GET /api/skills/detail/:slug`: Skill 详情（代理到云端）
- `POST /api/skills/sync`: 手动触发同步
- `POST /api/skills/clear`: 清空本地 Skills 数据
- `PUT /api/user-skills/:slug`: 更新用户启用状态

### llm-proxy.js
- `forwardChatCompletions(req, res)`: LLM 请求转发核心逻辑
  - Skills 拦截（系统禁用 + 用户禁用）
  - 危险指令拦截（本地规则匹配）
  - 路由选择（自定义映射 > DIRECT 模式 > GATEWAY 模式）

## 主入口 server.js

主文件现在只负责：
- 初始化 Express 应用
- 注册 CORS 中间件
- 注册各模块路由
- 提供 `/api/status` 和 `/api/sync-status` 端点
- 启动 HTTP 服务器（端口 19111）
