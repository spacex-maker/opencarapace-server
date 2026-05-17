# CC-Switch 深度分析报告

> **GitHub**: https://github.com/farion1231/cc-switch
> **产品简介**: CC-Switch 是一个基于 Tauri 2 + Rust + React 的专业级桌面应用，统一管理 5 个 AI CLI 工具（Claude Code/Codex/Gemini CLI/OpenCode/OpenClaw）。提供供应商一键切换、本地 HTTP 代理（Axum）含熔断器自动故障转移、MCP/Skills/Prompts 跨工具同步、Claude-OpenAI-Gemini 格式互转、精细到模型的用量追踪与成本计算、会话浏览器与终端恢复、Deep Link 一键导入等能力。代码量 ~2.3M 行，是与 ClawHeart v2 最直接的架构参考。

> 项目路径: `/Users/mac/001.code/cc-switch`
> 分析日期: 2026-05-15

---

## 1. 项目概览

**CC-Switch v3.14.1** 是一个基于 **Tauri 2 + React 18** 的专业级桌面应用，统一管理 5 个 AI CLI 工具: Claude Code、Codex、Gemini CLI、OpenCode、OpenClaw。

| 维度 | 数据 |
|------|------|
| 框架 | Tauri 2.8.2 + Rust 1.85+ |
| 前端 | React 18 + TypeScript + Vite + TailwindCSS 3.4 |
| 数据库 | SQLite (bundled) @ `~/.cc-switch/cc-switch.db` |
| UI 库 | shadcn/ui + Lucide icons |
| 代码量 | ~2.3M 行（Rust + TypeScript） |
| Rust 后端 | 112 文件，~450K 行 |
| 代理模块 | 34 文件，~800K 行 |
| i18n | 3 语言（中/英/日） |

**这是与 ClawHeart v2 最直接的对标项目** -- 同样使用 Tauri 2 + Rust + React 技术栈。

---

## 2. Tauri 2 架构详解

### 2.1 Rust 后端结构

```
src-tauri/src/
├── main.rs                    # 入口（Linux WebKit workarounds）
├── lib.rs                     # 模块聚合 + deep link 处理
├── app_config.rs              # 多应用配置结构
├── provider.rs                # 供应商数据模型（SSOT 原则）
├── tray.rs                    # 系统托盘菜单
├── commands/                  # IPC 命令层（32 文件）
├── services/                  # 业务逻辑层（29 文件）
│   ├── proxy.rs              # 本地代理服务（3,059 行）
│   ├── skill.rs              # 技能管理（3,042 行）
│   └── ...
├── database/                  # SQLite DAO 层（10+ 表）
├── proxy/                     # HTTP 代理模块（34 文件）
│   ├── server.rs             # Axum HTTP 服务器
│   ├── forwarder.rs          # 请求转发（2,751 行）
│   ├── circuit_breaker.rs    # 熔断器
│   ├── providers/            # API 适配器（20 子目录）
│   └── usage/                # 请求成本追踪
├── session_manager/           # 会话浏览器
├── mcp/                       # MCP 服务器同步
└── deeplink/                  # ccswitch:// 处理
```

### 2.2 核心设计模式

**1. 单一事实来源 (SSOT)**
```
SQLite 数据库 = 所有配置的权威来源
       |
  切换操作时 → 写入各应用的实时配置文件
       |
  ~/.config/Claude/claude.json
  ~/.codex/config.json
  ~/.config/Gemini/config.json
  ~/.openclaw.json
```

**2. 分层架构**
```
Commands (IPC 层)           32 文件
    ↓
Services (业务逻辑)          29 文件
    ↓
DAO/Database (数据访问)      10+ 表
    ↓
SQLite / 实时配置文件
```

**3. 并发安全**
```rust
Arc<Mutex<Connection>>  // Mutex 保护的共享连接
// 命令获取锁 → 执行 → 释放
// rusqlite 同步 API + Tauri tokio 运行时
```

---

## 3. 代理与故障转移系统 [核心组件]

### 3.1 代理架构

```
客户端请求 (Claude/Codex/Gemini)
    ↓
本地代理服务器 (127.0.0.1:15721, Axum)
    ↓
ProviderRouter (选择活跃供应商)
    ↓
RequestForwarder (格式转换 + 发送)
    ├── Claude ↔ OpenAI 格式互转
    ├── Gemini 格式处理
    ├── 熔断器（健康监控）
    ├── 自动故障转移（超时/错误时重试）
    └── 响应处理（Token 计数 + 成本计算）
    ↓
上游供应商 (Anthropic/OpenAI/Google/社区中继)
```

### 3.2 格式转换

| 转换方向 | 处理 |
|---------|------|
| **Claude → OpenAI** | messages 映射、max_tokens 转换、system 消息提取、tool_choice/tools 映射 |
| **OpenAI → Claude** | 反向转换、stop_reason 映射 |
| **Gemini** | 原生 API 支持、Schema 验证 |

### 3.3 熔断器

```rust
// 状态: Closed → Open → Half-Open → Closed
// 阈值（按应用）:
Claude:  8 次连续失败 → 打开, 3 次成功 → 关闭, 90s 超时
Codex:   4 次连续失败 → 打开, 2 次成功 → 关闭, 60s 超时
Gemini:  4 次连续失败 → 打开, 2 次成功 → 关闭, 60s 超时
```

### 3.4 流式处理器

```
AnthropicSSE  -- Anthropic SSE 格式解析
OpenAISSE     -- OpenAI 流格式解析
GeminiSSE     -- Gemini 流格式解析
ResponsesSSE  -- 通用响应解析
```

---

## 4. 数据库 Schema (v10)

| 表 | 用途 | 关键字段 |
|---|------|---------|
| `providers` | 供应商配置 | id, app_type, name, settings_config(JSON), is_current |
| `provider_endpoints` | 备选端点 | provider_id, app_type, url |
| `mcp_servers` | MCP 服务器 | name, server_config(JSON), enabled_[app] 标志 |
| `prompts` | 系统/角色提示词 | app_type, content, enabled |
| `skills` | 已安装技能 | name, directory, repo_owner, enabled_[app] 标志 |
| `proxy_config` | 代理设置 | app_type, listen_port, circuit_breaker 参数 |
| `proxy_request_logs` | API 请求历史 | request_id, model, input/output_tokens, cost_usd, latency_ms |
| `model_pricing` | 成本计算 | model_id, input/output_cost_per_million |
| `provider_health` | 健康检查 | is_healthy, consecutive_failures |
| `stream_check_logs` | 供应商延迟测试 | response_time_ms, tested_at |

---

## 5. IPC 命令体系

### 5.1 供应商管理
```
get_providers, add_provider, update_provider, delete_provider,
switch_provider, import_default_config, get_claude_desktop_status
```

### 5.2 代理管理
```
start_proxy_server, stop_proxy_with_restore, get_proxy_status,
switch_proxy_provider, get/update_proxy_config, set_proxy_takeover_for_app
```

### 5.3 MCP 管理
```
get/add/update/delete_mcp_servers, toggle_mcp_server_for_app,
sync_mcp_to_claude, sync_mcp_to_codex
```

### 5.4 技能管理
```
search_github_repos, install/uninstall_skill,
get_installed_skills, toggle_skill_for_app
```

### 5.5 会话管理
```
scan_sessions, search_sessions, get_session_detail,
copy_resume_command, restore_session_in_terminal
```

---

## 6. React 前端设计

### 6.1 组件架构

```
src/components/
├── agents/          # Agent 特定面板
├── mcp/             # MCP 服务器管理
├── providers/       # 供应商 CRUD UI（12 子目录）
├── proxy/           # 代理模式 UI
├── sessions/        # 会话管理器
├── skills/          # 技能安装器
├── settings/        # 应用设置（20 文件）
├── usage/           # 成本追踪仪表板
├── ui/              # shadcn/ui 组件（25+ 基础组件）
├── workspace/       # OpenClaw 编辑器
├── env/             # 环境变量管理
├── hermes/          # Hermes Agent 配置
├── prompts/         # 系统提示词编辑器
└── openclaw/        # OpenClaw 编辑器和配置
```

### 6.2 状态管理

- **TanStack Query v5**: 缓存、去重、失效时间 30s、窗口焦点自动刷新
- **自定义 Hooks**: `useProviderActions`, `useProxyStatus`, `useSkills`, `useSettings`
- **react-hook-form + zod**: 表单处理 + 验证
- **Tauri 事件监听**: 后端事件驱动前端更新

### 6.3 UI 组件库 (shadcn/ui)

```
数据: Table, DataTable, Pagination
表单: Input, Textarea, Select, Checkbox, Switch
反馈: Dialog, Alert, Toast, Progress, Skeleton
导航: Tabs, Accordion, Sidebar, Breadcrumb
布局: Card, Separator, ScrollArea
图标: 300+ Lucide React
主题: CSS 变量 + dark/light 模式切换
```

### 6.4 Deep Link 集成

```
ccswitch://import?resource=provider&app=claude&data={...}
ccswitch://import?resource=mcp&server={...}
ccswitch://import?resource=prompt&content={...}
ccswitch://import?resource=skill&repo=owner/repo
```

---

## 7. 用量追踪与成本计算

```rust
// 每个 API 请求记录到 proxy_request_logs
// 字段: request_id, model, input_tokens, output_tokens,
//       input_cost_usd, output_cost_usd, latency_ms, status_code

// 成本计算:
input_cost = (input_tokens / 1_000_000) * input_price_per_million
output_cost = (output_tokens / 1_000_000) * output_price_per_million
total_cost = input_cost + output_cost * cost_multiplier
```

---

## 8. 与 ClawHeart v2 的对比分析

### 8.1 关键相似点

| 维度 | CC-Switch | ClawHeart v2 设计 |
|------|-----------|-------------------|
| 桌面框架 | Tauri 2.8.2 | Tauri 2.x |
| 后端语言 | Rust | Rust |
| 前端 | React + TypeScript | React + TypeScript |
| 数据库 | SQLite (bundled) | rusqlite (bundled) |
| 代理 | Axum HTTP 服务器 | hudsucker MITM |
| 格式转换 | Claude ↔ OpenAI ↔ Gemini | 枢纽格式归一化 |
| 系统托盘 | 已实现 | 设计中 |
| 自动更新 | GitHub Releases + Minisign | tauri-plugin-updater |

### 8.2 关键差异

| 维度 | CC-Switch | ClawHeart v2 |
|------|-----------|-------------|
| **核心定位** | 多工具统一管理 | AI 安全监控 |
| **代理目的** | 供应商切换 + 故障转移 | 安全拦截 + 检测 |
| **安全功能** | 无（纯路由） | 危险指令、技能治理、MCP 扫描 |
| **代理类型** | 正向代理（SDK 配置） | MITM + 正向代理 |
| **MCP** | 配置同步 | 安全检查 |
| **会话管理** | 全面（跨工具浏览） | 对话历史记录 |
| **故障转移** | 熔断器 + 自动重试 | 可能更简单 |
| **成本追踪** | 精细到模型 + 成本乘数 | Token 用量记录 |
| **Deep Link** | ccswitch:// 协议 | 未设计 |
| **云同步** | WebDAV + Dropbox | 本地 + 可选云端 |

### 8.3 CC-Switch 的创新点（ClawHeart 可借鉴）

| 创新 | 价值 |
|------|------|
| **多 CLI 统一** | 单 UI 管理 5 个工具（vs 单应用聚焦） |
| **熔断器** | 健康监控 + 自动故障转移 |
| **热切换** | 代理运行中即时切换供应商 |
| **拖拽排序** | DnD-kit 供应商重排 |
| **TanStack Query** | 智能缓存 + 乐观更新 |
| **Deep Link** | 一键从浏览器导入配置 |
| **成本脚本** | JavaScript 引擎 (rquickjs) 执行自定义用量脚本 |

---

## 9. 对 ClawHeart v2 的借鉴价值

### 9.1 极高价值（直接参考实现）

| 借鉴点 | 说明 |
|--------|------|
| **Tauri 2 项目结构** | `src-tauri/` 目录组织、`commands/` + `services/` + `database/` 分层 |
| **Rust IPC 命令设计** | 32 个 `#[tauri::command]` 的划分方式和命名约定 |
| **SQLite DAO 层** | Schema 版本管理、迁移、备份、恢复的完整实现 |
| **系统托盘** | `tray.rs` 的实现可直接参考 |
| **Axum 代理服务器** | `proxy/server.rs` 可作为 ClawHeart 代理层的参考 |

### 9.2 高价值

| 借鉴点 | 说明 |
|--------|------|
| **格式转换模块** | `transform.rs`(58KB) 的 Claude ↔ OpenAI 转换逻辑 |
| **流式 SSE 处理** | `streaming.rs`(58KB) 的多格式流式处理 |
| **熔断器实现** | `circuit_breaker.rs` 的状态机设计 |
| **shadcn/ui 组件** | 25+ 基础组件可复用 |
| **TanStack Query** | 替代 ClawHeart v1 手动 fetch + setState |
| **能力系统** | `src-tauri/capabilities/` 的权限定义 |

### 9.3 中等价值

| 借鉴点 | 说明 |
|--------|------|
| **会话管理器** | 多应用会话浏览 + 终端恢复 |
| **Deep Link** | 一键导入模式 |
| **用量脚本** | rquickjs 自定义计费脚本 |
| **供应商预设** | 16 个配置预设文件 |

---

## 10. 总结

CC-Switch 是 ClawHeart v2 最直接的**架构参考**。两者共享相同的技术栈（Tauri 2 + Rust + React + SQLite），但定位不同: CC-Switch 专注于多工具管理和供应商路由，ClawHeart v2 专注于安全监控和威胁检测。

**最关键的借鉴**: CC-Switch 已经解决了 ClawHeart v2 设计中的许多技术问题 -- Tauri IPC 设计、SQLite DAO 层、Axum 代理服务器、格式转换、流式 SSE 处理、系统托盘、熔断器等。ClawHeart v2 可以站在 CC-Switch 的肩膀上，将精力集中在安全引擎（Armorer Guard、MCP Inspector、危险指令匹配）这些 CC-Switch 没有的部分。

---

*分析完成于 2026-05-15*
