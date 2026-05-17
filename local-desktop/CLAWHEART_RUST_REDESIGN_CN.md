# ClawHeart Desktop v2 -- Rust 重写产品设计文档

> 版本: 2.0 | 日期: 2026-05-15 | 状态: 草案（已整合竞品分析）

---

## 目录

1. [概述](#1-概述)
2. [现有架构分析与痛点](#2-现有架构分析与痛点)
3. [技术选型与论证](#3-技术选型与论证)
4. [新架构设计](#4-新架构设计)
5. [核心模块设计](#5-核心模块设计)
6. [UI/UX 重新设计](#6-uiux-重新设计)
7. [安全架构](#7-安全架构)
8. [数据与存储设计](#8-数据与存储设计)
9. [构建与分发](#9-构建与分发)
10. [迁移策略](#10-迁移策略)
11. [路线图与里程碑](#11-路线图与里程碑)
12. [竞品借鉴整合](#12-竞品借鉴整合)
13. [参考资料与来源](#13-参考资料与来源)

---

## 1. 概述

### 1.1 什么是 ClawHeart Desktop?

ClawHeart Desktop 是一款本地 AI 安全客户端，核心功能包括：
- **网络代理拦截** -- 捕获并分析 LLM API 流量
- **实时安全监控** -- 检测危险指令、策略违规、预算超限
- **技能治理** -- 管理 AI 工具/技能权限，支持启用/禁用/安全标签
- **安全扫描** -- 扫描本地 AI 配置和对话历史中的安全漏洞
- **Agent 识别** -- 发现并管理本机 AI Agent（Claude Code、Codex、Gemini CLI 等）
- **MCP 安全** -- 监控 Model Context Protocol 工具调用，防范提示词注入和凭据泄露

### 1.2 为什么用 Rust 重写?

| 维度 | 当前方案 (Electron + Node.js) | 目标方案 (Tauri 2 + Rust) |
|------|-------------------------------|--------------------------|
| 安装包大小 | ~200MB+（内嵌 Chromium） | ~5-15MB（系统 WebView） |
| 内存占用（空闲） | ~150-300MB | ~20-40MB |
| 启动时间 | 3-5 秒 | <1 秒 |
| 安全性 | JS 运行时，npm 供应链风险 | 内存安全，核心无 npm 依赖 |
| 代理性能 | Node.js 单线程 | 异步 Rust（tokio），零拷贝 |
| 平台支持 | Win/macOS | Win/macOS/Linux + 未来移动端 |

### 1.3 设计原则

1. **安全至上** -- 守护 AI Agent 的工具，自身在安全性上必须毫不妥协
2. **轻量化** -- 最小化资源消耗；用户不应感知到它在运行
3. **本地优先** -- 核心功能离线可用；云端同步为可选增强
4. **模块化** -- 插件架构实现可扩展性，同时不臃肿核心
5. **简约之美** -- 清晰、专注的 UI，只呈现真正重要的信息

---

## 2. 现有架构分析与痛点

### 2.1 当前技术栈

```
Electron (main.ts)
  |-- BrowserWindow (Chromium 渲染器)
  |     |-- React + Vite 前端 (frontend/)
  |     |-- 组件: OverviewPanel, SecurityScanPanel, InterceptLogsPanel,
  |     |         SkillsPanel, AgentMgmtPanel, SettingsPanel 等
  |     |-- 国际化: 10 种语言 (zh, en, de, ar, es, fr, hi, ja, pt, ru)
  |
  |-- Express HTTP 服务 @ 127.0.0.1:19111 (src/server.js)
  |     |-- LLM 代理 (llm-proxy.js) -- 拦截 /v1/chat/completions
  |     |-- 安全扫描路由（云端转发）
  |     |-- 技能、危险指令、拦截日志路由
  |     |-- 预算监控、Token 用量追踪
  |     |-- Agent 管理路由
  |     |-- OpenClaw 网关集成
  |
  |-- SQLite (sqlite3) @ ~/.clawheart/local-client.db
  |     |-- danger_commands, disabled_skills, deprecated_skills
  |     |-- local_settings, local_user_settings, local_llm_mappings
  |     |-- conversation_history, llm_usage_cost_events
  |     |-- openclaw_security_monitor_session
  |
  |-- 内嵌 Node.js 运行时 (resources/node.exe | Resources/node)
  |-- 内嵌 OpenClaw（可选，完整版 vs Core 版）
```

### 2.2 痛点分析

| # | 问题 | 影响 |
|---|------|------|
| 1 | **Electron 体积臃肿** -- 内嵌 Chromium = 200MB+，空闲 150MB+ 内存 | 低配机器体验差 |
| 2 | **Node.js 代理** -- 单线程事件循环处理 LLM 流量拦截 | 高并发下延迟增大 |
| 3 | **sqlite3 原生模块** -- 需要平台特定的 MSVC/Xcode 编译 | 跨平台构建困难 |
| 4 | **内嵌 Node 运行时** -- Windows/macOS 需要独立 node 二进制 | 构建复杂度高，40MB+ 额外开销 |
| 5 | **无流式代理** -- `axios.post()` 缓冲整个响应后才转发 | SSE/流式 LLM 响应在大负载下中断 |
| 6 | **全局内联 CSS** -- 900+ 行 App.tsx 内全部样式内联 | 维护噩梦，缺乏设计系统 |
| 7 | **无系统托盘** -- 必须保持完整窗口，无法后台运行 | 用户必须保持窗口打开 |
| 8 | **无自动更新** -- 需手动重新安装 | 更新体验差 |
| 9 | **Express CORS `*`** -- 本地服务允许所有来源 | 安全隐患 |
| 10 | **无 MCP 级别检测** -- 仅 HTTP 代理，无 MCP JSON-RPC 感知 | 遗漏 MCP 特有攻击 |

---

## 3. 技术选型与论证

### 3.1 核心框架: Tauri 2.x

**为什么选择 Tauri 而非其他方案：**

| 框架 | 渲染方式 | 安装包大小 | 内存 | 成熟度 | 结论 |
|------|---------|-----------|------|--------|------|
| **Tauri 2** | 系统 WebView | ~5-15MB | ~20-40MB | 稳定版，已审计 | **选定** |
| Dioxus | WebView（基于 Tauri） | 类似 | 类似 | v0.7，不够稳定 | 生产环境过早 |
| egui | 即时模式 GPU 渲染 | ~10MB | ~30MB | 稳定 | 不适合精美 UI |
| Slint | 自定义渲染器 | ~15MB | ~25MB | 稳定，GPLv3 | 许可证问题 |

Tauri 2 优势：
- 由 Radically Open Security 完成**安全审计**（NLNet/NGI 资助）
- **能力系统（Capabilities）** -- 细粒度 IPC 权限控制
- **插件生态** -- 自动更新、系统托盘、加密存储等
- **移动端支持** -- 同一代码库支持 iOS/Android（未来路线图）
- 保留现有 React + 国际化投资

### 3.2 网络代理: hudsucker

**为什么选择 hudsucker：**
- 纯 Rust 实现的 MITM HTTP/S 代理，基于异步运行时
- 支持 HTTP/1.1、HTTP/2、WebSocket 拦截
- 通过 `rcgen`（默认）或 OpenSSL 实现证书颁发机构
- TLS 通过 `rustls`（默认）或 native-tls
- 简洁的 Builder API，活跃维护
- 可拦截、修改、转发请求和响应

备选方案评估：
- `mitmproxy_rs` -- 功能更强大（WireGuard 模式）但依赖复杂
- `http-mitm-proxy` -- 更轻量但功能较少
- `proxelar` -- Lua 脚本支持有趣但过度设计

### 3.3 AI 安全扫描: Armorer Guard

**为什么选择 Armorer Guard：**
- **Rust 原生**扫描器，检测 AI Agent 提示词注入和凭据泄露
- **0.0247ms** 平均延迟 -- 实时内联扫描
- 扫描 MCP 工具调用、提示词、模型输出、工具调用参数
- 确定性规则 + 本地语义分类器 + 相似度检查
- **无网络调用** -- 敏感数据绝不离开本地环境
- 结构化 JSON 输出，包含脱敏、原因标签、置信度评分

### 3.4 数据库: rusqlite

- 原生 Rust SQLite 绑定（无需 C node-gyp 编译）
- 通过 `bundled` 特性内嵌 SQLite -- 零系统依赖
- 通过 `tokio-rusqlite` 实现异步非阻塞查询

### 3.5 前端: React + Tailwind CSS + Radix UI

保留 React（保护国际化投资）但进行现代化改造：
- **Tailwind CSS** -- 用工具类替代 900+ 行内联样式
- **shadcn/ui** -- 可定制的 UI 组件库（25+ 基础组件, 借鉴 CC-Switch 已验证方案）
- **TanStack Query v5** -- 替代手动 fetch+setState（借鉴 CC-Switch 智能缓存+乐观更新）
- **Vite** -- 已在使用，继续保留
- **Recharts** -- 轻量图表（借鉴 CC-Switch 已验证方案）
- **Lucide** -- 图标库（替代 react-icons, 借鉴 CC-Switch）

### 3.6 完整技术栈

```
+------------------------------------------------------------------+
|                     ClawHeart Desktop v2                          |
+------------------------------------------------------------------+
|  前端 (WebView)                                                   |
|  React 19 + TypeScript + Tailwind CSS + Radix UI                 |
|  Vite 构建 | 国际化 (10 种语言) | uPlot 图表                      |
+------------------------------------------------------------------+
|  Tauri 2.x IPC 层（基于能力系统）                                   |
|  命令: get_status, proxy_*, scan_*, skills_*, agent_*             |
+------------------------------------------------------------------+
|  Rust 核心                                                        |
|  +------------------+  +------------------+  +-----------------+ |
|  | 代理引擎         |  | 安全引擎         |  | Agent 发现      | |
|  | hudsucker        |  | armorer-guard    |  | 文件系统扫描    | |
|  | LLM 拦截         |  | MCP 扫描器       |  | 进程检测        | |
|  | 流式 SSE         |  | 危险指令         |  | 配置文件解析    | |
|  | 预算检查         |  | 技能治理         |  | MCP 服务器枚举  | |
|  +------------------+  +------------------+  +-----------------+ |
|  +------------------+  +------------------+  +-----------------+ |
|  | 存储引擎         |  | 云端同步         |  | 插件系统        | |
|  | rusqlite         |  | reqwest + tokio  |  | Tauri 插件      | |
|  | 加密存储         |  | 认证/令牌管理    |  | 自动更新器      | |
|  | 迁移管理器       |  | 增量同步         |  | 系统托盘        | |
|  +------------------+  +------------------+  +-----------------+ |
+------------------------------------------------------------------+
|  操作系统层                                                       |
|  系统 WebView | 系统托盘 | 文件系统 | 网络协议栈                   |
+------------------------------------------------------------------+
```

---

## 4. 新架构设计

### 4.1 进程模型

```
ClawHeart Desktop v2
  |
  |-- 主进程 (Rust/Tauri)
  |     |-- Tauri 应用生命周期管理
  |     |-- IPC 命令处理器
  |     |-- 系统托盘管理
  |     |-- 自动更新器
  |
  |-- 代理服务 (Rust 异步任务)
  |     |-- hudsucker MITM 代理 @ 127.0.0.1:19111
  |     |-- 真正的流式传输（SSE 透传、分块传输）
  |     |-- 逐请求处理管线:
  |     |     1. 技能治理检查
  |     |     2. 危险指令匹配
  |     |     3. 预算评估
  |     |     4. MCP 工具调用扫描（Armorer Guard）
  |     |     5. 转发至上游（或网关）
  |     |     6. 响应扫描
  |     |     7. Token 用量记录
  |     |
  |     |-- OpenAI 兼容端点: POST /v1/chat/completions
  |     |-- Anthropic 兼容: POST /v1/messages
  |     |-- MCP 感知: JSON-RPC 2.0 拦截
  |
  |-- WebView（操作系统原生）
  |     |-- React 前端通过 Tauri IPC 通信
  |     |-- 无需直接 HTTP 访问 localhost（全部通过 Tauri 命令）
  |
  |-- 后台工作者（tokio 任务）
        |-- 云端同步（定期、增量）
        |-- Agent 发现（文件系统 + 进程扫描）
        |-- 安全扫描编排器
        |-- 通知管理器
```

### 4.2 IPC 设计（Tauri 命令）

用 Tauri IPC 命令替代 HTTP API（`/api/*`）：

```rust
// 状态与设置
#[tauri::command] fn get_status() -> Result<AppStatus, Error>;
#[tauri::command] fn get_settings() -> Result<Settings, Error>;
#[tauri::command] fn save_settings(settings: Settings) -> Result<(), Error>;

// 认证
#[tauri::command] fn login(email: String, password: String) -> Result<AuthResult, Error>;
#[tauri::command] fn logout() -> Result<(), Error>;

// 代理
#[tauri::command] fn get_proxy_status() -> Result<ProxyStatus, Error>;
#[tauri::command] fn get_request_logs(filter: LogFilter) -> Result<Vec<RequestLog>, Error>;
#[tauri::command] fn get_intercept_logs(filter: InterceptFilter) -> Result<Vec<InterceptLog>, Error>;

// 安全扫描
#[tauri::command] fn get_scan_items() -> Result<Vec<ScanItem>, Error>;
#[tauri::command] fn start_scan(items: Vec<String>, locale: String) -> Result<ScanRun, Error>;
#[tauri::command] fn get_scan_progress(run_id: u64) -> Result<ScanProgress, Error>;
#[tauri::command] fn get_scan_history() -> Result<Vec<ScanRun>, Error>;

// 技能管理
#[tauri::command] fn list_skills(filter: SkillFilter) -> Result<Vec<Skill>, Error>;
#[tauri::command] fn toggle_skill(slug: String, enabled: bool) -> Result<(), Error>;
#[tauri::command] fn set_skill_safety(slug: String, label: SafetyLabel) -> Result<(), Error>;
#[tauri::command] fn sync_skills() -> Result<SyncResult, Error>;

// Agent 管理
#[tauri::command] fn list_agents() -> Result<Vec<AgentPlatform>, Error>;
#[tauri::command] fn get_agent_details(platform: String, feature: String) -> Result<Vec<AgentItem>, Error>;

// 预算
#[tauri::command] fn get_budget_rules() -> Result<Vec<BudgetRule>, Error>;
#[tauri::command] fn set_budget_rule(rule: BudgetRule) -> Result<(), Error>;
#[tauri::command] fn get_token_usage(range: TimeRange) -> Result<UsageSummary, Error>;

// 危险指令
#[tauri::command] fn list_danger_commands() -> Result<Vec<DangerCommand>, Error>;
#[tauri::command] fn toggle_danger_command(id: u64, user_enabled: Option<bool>) -> Result<(), Error>;
#[tauri::command] fn sync_danger_commands() -> Result<SyncResult, Error>;
```

### 4.3 代理管线（流式优先）

当前问题：`axios.post()` 缓冲整个响应。新设计采用真正的流式传输：

```
客户端 (SDK)                    ClawHeart 代理                     上游 LLM
    |                               |                                   |
    |-- POST /v1/chat/completions ->|                                   |
    |                               |-- [1] 技能检查                    |
    |                               |-- [2] 危险指令检查                |
    |                               |-- [3] 预算检查                    |
    |                               |-- [4] MCP 扫描（如适用）          |
    |                               |                                   |
    |                               |-- 转发（流式）------------------->|
    |                               |                                   |
    |                               |<----------- SSE 数据块 -----------|
    |                               |-- [5] 扫描每个数据块             |
    |<--- SSE 透传 ------------------|-- [6] 累计 Token 计数            |
    |                               |                                   |
    |                               |-- [7] 最终：记录用量、同步        |
```

关键改进：
- **零拷贝流式传输** -- 通过 `hyper::Body` / `axum::body::Body` 实现
- **数据块级扫描** -- Armorer Guard 检查每个 SSE 事件
- **背压感知** -- 客户端消费慢时，代理对上游施加背压
- **连接池** -- 通过 `reqwest::Client` 复用上游连接

### 4.4 能力安全模型

Tauri 2 的能力系统替代了之前的 CORS `*` 全开策略：

```json
// src-tauri/capabilities/main-window.json
{
  "identifier": "main-window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-close",
    "core:window:allow-set-size",
    "shell:allow-open",
    "store:default",
    "updater:default",
    "tray:default",
    // ClawHeart 自定义命令权限
    "clawheart:allow-get-status",
    "clawheart:allow-get-settings",
    "clawheart:allow-save-settings",
    "clawheart:allow-login",
    "clawheart:allow-logout",
    "clawheart:allow-list-skills",
    "clawheart:allow-toggle-skill",
    "clawheart:allow-start-scan"
    // ... 显式列出每个允许的命令
  ]
}
```

---

## 5. 核心模块设计

### 5.1 代理引擎 (`crate::proxy`)

> 借鉴: 9Router 枢纽格式架构 + CC-Switch Axum 代理 + Pipelock 11 层扫描管线

```
proxy/
  mod.rs              -- ProxyEngine 结构体，启动/停止生命周期
  server.rs           -- Axum HTTP 服务器 (参考 CC-Switch proxy/server.rs)
  interceptor.rs      -- hudsucker HttpHandler + WebSocketHandler 实现
  pipeline.rs         -- 多层请求/响应安全管线 (参考 Pipelock 11 层设计)
  streaming.rs        -- SSE/分块传输透传 + 流式扫描状态机
  route.rs            -- DIRECT / GATEWAY / MAPPING 路由逻辑
  tls.rs              -- CA 证书生成与管理
  circuit_breaker.rs  -- 熔断器 (参考 CC-Switch 4 级状态机)
  formats.rs          -- LLM 协议格式枚举 (借鉴 9Router formats.js)
  format_detector.rs  -- 协议自动检测 (借鉴 9Router detectFormat)
  normalizer.rs       -- 请求归一化层 (借鉴 9Router 枢纽模式)
  normalizers/
    openai.rs         -- OpenAI Chat Completions -> Normalized
    claude.rs         -- Anthropic Messages -> Normalized
    gemini.rs         -- Gemini -> Normalized
    ollama.rs         -- Ollama -> Normalized
    responses.rs      -- OpenAI Responses API -> Normalized
  stream_scanner.rs   -- 流式响应安全扫描状态机 (借鉴 9Router initState)
  usage_extractor.rs  -- 多格式 Token 用量提取 (借鉴 9Router usageTracking)
  provider_registry.rs -- 已知供应商格式映射 (~30 条, 精简版)
```

关键设计：
- `ProxyEngine` 拥有一个 `hudsucker::Proxy` 实例，运行在专用 tokio 运行时上
- `HttpHandler` 实现将每个请求路由通过安全管线
- 被拦截的请求返回 LLM 格式的响应（与当前 `replyBlockedAsLlmResponse` 相同）
- CA 证书在首次运行时自动生成，存储在 `~/.clawheart/ca/`
- **协议归一化层** (新增, 借鉴 9Router): 所有格式先归一化为 `NormalizedRequest`，安全引擎只处理一种格式

**协议归一化设计** (借鉴 9Router 枢纽模式):

```rust
/// 支持的 LLM 协议格式 (借鉴 9Router 12 种格式, 精简为核心 5 种)
pub enum LlmFormat {
    OpenAI,           // /v1/chat/completions
    OpenAIResponses,  // /v1/responses (Codex)
    Claude,           // /v1/messages (Anthropic)
    Gemini,           // Google Gemini API
    Ollama,           // Ollama 本地模型
}

/// 归一化后的请求 (安全引擎的统一输入)
pub struct NormalizedRequest {
    pub messages: Vec<NormalizedMessage>,
    pub model: String,
    pub tools: Vec<ToolDefinition>,
    pub stream: bool,
    pub original_format: LlmFormat,
    pub original_body: Value,  // 保留原始请求，转发时恢复
}

/// 格式自动检测 (借鉴 9Router detectFormat + detectFormatByEndpoint)
pub fn detect_format(path: &str, body: &Value) -> LlmFormat {
    // 1. URL 路径检测 (优先)
    if path.contains("/v1/messages")  { return LlmFormat::Claude; }
    if path.contains("/v1/responses") { return LlmFormat::OpenAIResponses; }
    if path.contains("/api/chat")     { return LlmFormat::Ollama; }
    // 2. 请求体结构检测
    if body.get("contents").is_some() { return LlmFormat::Gemini; }
    if body.get("input").is_some() && body.get("messages").is_none() {
        return LlmFormat::OpenAIResponses;
    }
    LlmFormat::OpenAI // 默认
}
```

**流式扫描状态机** (借鉴 9Router initState + Pipelock CEE):

```rust
pub struct StreamScanState {
    pub format: LlmFormat,
    pub accumulated_text: String,
    pub current_tool_call: Option<PartialToolCall>,
    pub token_usage: TokenUsage,
    pub finish_reason: Option<String>,
    pub threat_score: f64,  // 借鉴 Pipelock 自适应评分
}
```

### 5.2 安全引擎 (`crate::security`)

> 借鉴: Pipelock MCP 攻击链 + SkillGuard 规则系统 + OpenClaw Audit 80 项检查 + ClawSec 公告系统

```
security/
  mod.rs              -- SecurityEngine 门面
  danger.rs           -- DangerCommandMatcher（正则 + 子串 + 6 遍归一化）
  skills.rs           -- SkillGovernance（系统 + 用户 启用/禁用）
  skill_scanner.rs    -- 技能预发布扫描 (借鉴 SkillGuard 72 条规则)
  budget.rs           -- BudgetEvaluator（按供应商/模型，日/周/月）
  scanner.rs          -- SecurityScanner（云端转发扫描编排器）
  mcp.rs              -- McpInspector（JSON-RPC 2.0 工具调用分析）
  mcp_chains.rs       -- MCP 攻击链检测 (借鉴 Pipelock 10 个链模式)
  mcp_baseline.rs     -- MCP 工具基线冻结 (借鉴 Pipelock session binding)
  redact.rs           -- 秘密脱敏（48 模式, 借鉴 Pipelock DLP + Audit CL 模块）
  armorer.rs          -- Armorer Guard 集成封装
  injection.rs        -- 提示词注入检测（6 遍归一化, 借鉴 Pipelock）
  advisory.rs         -- 安全公告订阅 (借鉴 ClawSec Ed25519 签名 feed)
  signal.rs           -- 信号分类 (借鉴 Pipelock Threat/Protective/ConfigMismatch)
  kill_switch.rs      -- 紧急停止开关 (借鉴 Pipelock 4 源 OR 组合)
```

**MCP 深度安全** (借鉴 Pipelock MCP 模块):

```rust
pub struct McpInspector {
    guard: ArmorerGuard,
    chain_detector: ChainDetector,     // 攻击链检测 (借鉴 Pipelock)
    tool_baseline: ToolBaseline,       // 工具清单冻结 (借鉴 Pipelock)
}

impl McpInspector {
    pub fn inspect(&self, msg: &JsonRpcMessage) -> InspectionResult {
        match msg {
            JsonRpcMessage::Request { method, params, .. } => {
                // 1. 工具调用参数注入检测 (Armorer Guard)
                self.guard.scan_tool_call(method, params)?;
                // 2. 攻击链检测 (借鉴 Pipelock: 子序列匹配，可配置间隙容忍度)
                self.chain_detector.check_sequence(method)?;
                // 3. 工具基线漂移检测 (借鉴 Pipelock: 会话内工具清单固定)
                self.tool_baseline.verify_tool(method, params)?;
                Ok(InspectionResult::Pass)
            }
            JsonRpcMessage::Response { result, .. } => {
                self.guard.scan_tool_response(result)
            }
        }
    }
}

/// MCP 攻击链检测器 (借鉴 Pipelock 10 个内置链模式)
pub struct ChainDetector {
    patterns: Vec<ChainPattern>,  // 侦察→外泄→持久化 等序列
    gap_tolerance: usize,         // 间隙容忍度（插入无害调用不能绕过）
    session_history: Vec<String>, // 会话内工具调用历史
}
```

**技能预发布扫描** (借鉴 SkillGuard):

```rust
/// 技能安全扫描器 (借鉴 SkillGuard 72 条规则 + 评分系统)
pub struct SkillScanner {
    hard_triggers: Vec<Rule>,     // 22 条硬阻止规则 (借鉴 SkillGuard)
    weighted_rules: Vec<Rule>,    // 50 条加权规则
    score_threshold: u32,         // 默认 30 分以下阻止
}

impl SkillScanner {
    /// 扫描技能包，返回安全评分 0-100
    pub fn scan(&self, bundle: &SkillBundle) -> ScanResult {
        // 1. 硬触发器检查 (rm -rf /, curl|bash, eval(input) 等)
        // 2. 加权规则评分 (指数衰减: weight × (1-0.5^count)/(1-0.5))
        // 3. 上下文感知 (exec=跳过.md, mention=仅.md)
        // 4. 熵过滤 (Shannon 熵 < 3.5 = 假阳性)
    }
}
```

**提示词注入 6 遍归一化** (借鉴 Pipelock):

```rust
/// 归一化管线 -- 击败常见绕过手段
pub fn normalize_for_injection_scan(text: &str) -> String {
    let mut s = text.to_string();
    s = strip_zero_width_chars(&s);       // 1. 零宽字符剥离
    s = replace_homoglyphs(&s);           // 2. 同形字替换 (Cyrillic→Latin)
    s = decode_leetspeak(&s);             // 3. Leetspeak 还原
    s = unwrap_base64_segments(&s);       // 4. Base64 片段解码
    s = normalize_unicode(&s);            // 5. Unicode NFKC 归一化
    s = collapse_whitespace(&s);          // 6. 空白符折叠
    s
}
```

**信号分类** (借鉴 Pipelock -- 防止防护性阻止污染威胁评分):

```rust
pub enum SignalClass {
    Threat,              // 真实攻击
    Protective,          // 速率限制、预算阻止（不计入威胁评分）
    ConfigMismatch,      // 配置问题
    InfrastructureError, // DNS/网络故障
}
```

### 5.3 Agent 发现 (`crate::agents`)

```
agents/
  mod.rs            -- AgentDiscovery 编排器
  scanner.rs        -- 文件系统扫描器（Agent 配置文件）
  process.rs        -- 运行中进程检测（ps / tasklist）
  platforms/
    claude.rs       -- ~/.claude/ 配置解析
    codex.rs        -- Codex CLI 检测
    gemini.rs       -- Gemini CLI 配置
    openclaw.rs     -- OpenClaw 工作区检测
    cursor.rs       -- .cursor/ 目录扫描
    windsurf.rs     -- Windsurf 配置检测
```

相比当前版本的增强：自动发现替代手动演示数据。

### 5.4 云端同步 (`crate::sync`)

```
sync/
  mod.rs            -- SyncManager（定期后台任务）
  auth.rs           -- 令牌管理、刷新、注销清理
  skills.rs         -- 双向技能同步（增量追踪）
  danger.rs         -- 危险指令规则同步
  usage.rs          -- Token 用量上报云端
  intercept.rs      -- 拦截日志上传
```

增量同步：按实体类型追踪 `last_sync_at`，仅同步变更内容。

### 5.5 存储层 (`crate::storage`)

```
storage/
  mod.rs            -- 数据库连接池 (tokio-rusqlite)
  migrations.rs     -- Schema 版本管理与迁移执行器
  models.rs         -- 所有表的 Rust 结构体
  queries/
    settings.rs
    auth.rs
    skills.rs
    danger.rs
    budget.rs
    usage.rs
    history.rs
    agents.rs
```

---

## 6. UI/UX 重新设计

### 6.1 设计理念

**从:** 密集的仪表盘，大量面板和内联样式
**到:** 清晰、专注的界面，渐进式信息展开

设计原则：
1. **一目了然** -- 从系统托盘即可快速查看关键状态
2. **上下文感知** -- 仅在相关时展示详细信息
3. **最少装饰** -- 去除不必要的边框、阴影和装饰元素
4. **一致性** -- 通过 Tailwind 设计令牌统一样式，而非内联样式

### 6.2 布局重新设计

```
+----------------------------------------------------------------+
|  [Logo] ClawHeart                    [搜索] [托盘] [设置]       |
+--------+-------------------------------------------------------+
|        |                                                        |
| 防护   |  主内容区                                               |
|  --    |                                                        |
| 监控   |  +--------------------------------------------------+  |
|  --    |  |  上下文感知内容                                   |  |
| 技能   |  |  渐进式信息展开                                   |  |
|  --    |  |                                                  |  |
| Agent  |  |                                                  |  |
|  --    |  +--------------------------------------------------+  |
| 扫描   |                                                        |
|        |                                                        |
+--------+-------------------------------------------------------+
|  状态: 防护中 | 已检测 3 个 Agent | 127 个技能已激活             |
+----------------------------------------------------------------+
```

关键变化：
- **垂直侧边栏** 替代水平顶部导航（节省垂直空间）
- **可折叠侧边栏** -- 可最小化为仅图标模式
- **状态栏** 位于底部，显示实时防护状态
- **系统托盘** 含迷你状态弹窗（新增）

### 6.3 导航结构（简化）

| 图标 | 板块 | 说明 |
|------|------|------|
| 盾牌 | **防护** | 实时状态、最近拦截、威胁摘要 |
| 眼睛 | **监控** | 请求日志、Token 用量、预算告警 |
| 拼图 | **技能** | 技能市场、治理、安全标签 |
| 机器人 | **Agent** | 自动发现的 Agent、MCP 服务器、配置 |
| 扫描 | **扫描** | 安全扫描、历史记录、隐私设置 |
| 齿轮 | **设置** | 连接配置、代理模式、映射、账户 |

从 8 个顶级项（总览、安全扫描、拦截监控、OpenClaw、技能、Agent 管理、设置、认证）精简为 6 个聚焦板块。OpenClaw 管理移入设置的子板块。

### 6.4 系统托盘（新增）

```
+---------------------------+
|  ClawHeart  [已连接]       |
+---------------------------+
|  防护状态: 运行中          |
|  Agent: 已检测 3 个        |
|  今日: 1.2K 请求           |
|  预算: $2.14 / $10.00      |
+---------------------------+
|  [暂停防护]                |
|  [打开面板]                |
|  [退出]                    |
+---------------------------+
```

- 左键点击: 切换迷你弹窗
- 右键点击: 上下文菜单
- 托盘图标根据防护状态变色（绿色/黄色/红色）

### 6.5 组件库

用 Tailwind + Radix UI 替代内联样式：

```tsx
// 之前（当前）: 每个按钮 50+ 行内联样式对象
<button style={{ width: 34, height: 34, display: "inline-flex", ... }}>

// 之后: Tailwind 工具类 + Radix 基础组件
<Button variant="ghost" size="icon" className="rounded-xl">
  <MdSettings className="h-4 w-4" />
</Button>
```

在 `tailwind.config.ts` 中定义设计令牌：
```ts
export default {
  theme: {
    extend: {
      colors: {
        claw: {
          green: { DEFAULT: '#22c55e', dark: '#16a34a' },
          danger: { DEFAULT: '#ef4444', dark: '#dc2626' },
          warning: '#fbbf24',
          // ... 语义化令牌
        }
      }
    }
  }
}
```

### 6.6 深色/浅色主题

保留双主题支持，但通过 Tailwind `dark:` 变体实现，替代 CSS 变量：

```tsx
<div className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
```

### 6.7 响应式窗口

支持三种窗口模式：
1. **完整模式** (1024x720+): 所有面板可见，带侧边栏
2. **紧凑模式** (600x500): 侧边栏折叠为图标，单面板显示
3. **迷你模式** (320x400): 系统托盘弹窗，仅状态视图

---

## 7. 安全架构

### 7.1 威胁模型

ClawHeart 防护的威胁类型：

| 威胁 | 当前覆盖 | v2 覆盖 | 借鉴来源 |
|------|---------|---------|---------|
| LLM 提示词中的危险指令 | 子串匹配 | 正则 + 6 遍归一化 + 语义匹配 | Pipelock |
| 被禁用/恶意技能 | 系统 + 用户禁用列表 | + Armorer Guard + 72 条规则预扫描 | SkillGuard |
| 预算超限 | 按供应商/模型限制 | 相同 + 实时告警 + 信号分类 | Pipelock |
| API 密钥泄露 | 上传扫描前脱敏 | 48 种凭据模式 + 不可逆类保留脱敏 | Pipelock + Audit |
| MCP 提示词注入 | **未覆盖** | Armorer Guard 内联扫描 | -- |
| MCP 工具投毒 | **未覆盖** | 工具描述漂移检测 + 基线冻结 | Pipelock |
| MCP 攻击链 | **未覆盖** | 10 种序列模式子序列匹配 | Pipelock |
| MCP 凭据泄露 | **未覆盖** | 参数/响应扫描 | -- |
| 供应链攻击（恶意技能包） | **未覆盖** | 同形字检测 + 混淆代码 + npm audit | SkillGuard + Audit |
| 安全公告/CVE | **未覆盖** | Ed25519 签名公告 feed + 自动匹配 | ClawSec |
| 流氓 Agent 检测 | **未覆盖** | 进程 + 配置异常 + 文件漂移检测 | ClawSec |
| CORS/本地服务滥用 | CORS `*`（存在漏洞） | Tauri IPC（UI 无 HTTP 服务器） | -- |
| 跨请求分片外泄 | **未覆盖** | 分片重组 + 每域名数据预算 | Pipelock |
| 协议格式绕过 | 仅 OpenAI/Claude | 自动检测 5 种格式 + 归一化 | 9Router |

### 7.2 防御层次

> 借鉴: Pipelock 11 层管线 + SkillGuard 多层防御 + OpenClaw Audit 12 攻击面

```
第 0 层: 格式归一化（代理引擎）[借鉴 9Router]
  |-- 协议自动检测（URL 路径 + 请求体结构）
  |-- 请求归一化为统一格式（安全引擎只处理一种格式）
  |-- 支持 5 种协议: OpenAI, Claude, Gemini, Ollama, Responses
  |
第 1 层: 网络（代理引擎）
  |-- 基于逐主机证书的 TLS 拦截
  |-- 带检测的请求/响应流式传输
  |-- 连接级速率限制
  |-- DLP 扫描在 DNS 解析之前执行 [借鉴 Pipelock]
  |-- 熔断器 + 自动故障转移 [借鉴 CC-Switch]
  |
第 2 层: 内容（安全引擎）
  |-- 危险指令匹配（正则 + 子串 + 6 遍归一化）[借鉴 Pipelock]
  |-- 技能治理（系统 + 用户策略）
  |-- 预算执行（请求前检查）
  |-- Armorer Guard 内联扫描（0.024ms）
  |-- 48 种凭据模式检测 [借鉴 Pipelock DLP + Audit CL 模块]
  |-- 信号分类（Threat vs Protective）[借鉴 Pipelock]
  |
第 3 层: 协议（MCP 深度安全）[大幅增强, 借鉴 Pipelock]
  |-- JSON-RPC 2.0 消息解析
  |-- 工具调用参数验证
  |-- 工具响应数据泄露检查
  |-- OWASP MCP Top 10 覆盖
  |-- MCP 攻击链检测（10 种序列模式）[借鉴 Pipelock]
  |-- MCP 工具基线冻结（会话内清单固定）[借鉴 Pipelock]
  |-- MCP 工具描述漂移检测 [借鉴 Pipelock]
  |
第 4 层: 技能供应链 [新增, 借鉴 SkillGuard + ClawSec]
  |-- 技能预发布扫描（72 条规则, 评分 0-100）[借鉴 SkillGuard]
  |-- 同形异义字符 + 混淆代码检测 [借鉴 SkillGuard + Audit SK 模块]
  |-- 安全公告订阅（Ed25519 签名 feed）[借鉴 ClawSec]
  |-- 公告匹配告警（已安装技能 vs CVE 列表）[借鉴 ClawSec]
  |
第 5 层: 系统（Agent 发现）
  |-- 已知 Agent 配置文件监控
  |-- 进程枚举与归因
  |-- 未授权 Agent 告警
  |-- 文件漂移检测 + 自动恢复 [借鉴 ClawSec soul-guardian]
  |
第 6 层: 数据（存储）
  |-- 加密凭据存储（Tauri 安全存储）
  |-- 类保留不可逆脱敏 [借鉴 Pipelock <pl:CLASS:N>]
  |-- 对话历史需用户同意方可记录
  |-- 审计日志 MITRE ATT&CK 映射 [借鉴 Pipelock]
  |
第 7 层: 应急（Kill Switch）[新增, 借鉴 Pipelock]
  |-- 配置文件 + API + 信号 + 哨兵文件（4 源 OR 组合）
  |-- 任一激活 = 拒绝所有流量
  |-- 失败关闭（哨兵文件不可读 = 激活）
```

### 7.3 CA 证书管理

```
~/.clawheart/
  ca/
    clawheart-ca.pem    -- 根 CA（首次运行时生成）
    clawheart-ca.key    -- CA 私钥（静态加密存储）
    hosts/              -- 逐主机证书缓存
      api.openai.com.pem
      api.anthropic.com.pem
      ...
```

- CA 证书通过 `rcgen` 生成（纯 Rust，无 OpenSSL 依赖）
- 首次运行时提示用户信任 CA 证书（系统钥匙串集成）
- 逐主机证书在内存（LRU）+ 磁盘缓存
- CA 私钥通过操作系统钥匙串加密（macOS Keychain、Windows DPAPI）

### 7.4 密钥管理

当前方案：API 密钥以明文存储在 SQLite `local_settings` 表中。

新方案：使用 Tauri 的 `tauri-plugin-store` 实现加密存储：
```rust
// 加密存储敏感数据
let store = app.store("credentials.json")?;
store.set("api_key", encrypted_value);
store.set("auth_token", encrypted_value);
```

非敏感设置仍保留在 SQLite 中，便于查询。

---

## 8. 数据与存储设计

### 8.1 数据库 Schema (v2)

从当前 Schema 迁移并改进：

```sql
-- 迁移版本追踪
CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
);

-- 核心设置（非敏感）
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 危险指令规则
CREATE TABLE danger_commands (
    id INTEGER PRIMARY KEY,
    pattern TEXT NOT NULL,
    pattern_type TEXT NOT NULL DEFAULT 'substring', -- 'substring' | 'regex' | 'semantic'
    system_type TEXT NOT NULL,
    category TEXT NOT NULL,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('critical','high','medium','low')),
    system_enabled INTEGER NOT NULL DEFAULT 1,
    user_enabled INTEGER, -- NULL = 继承系统, 0 = 禁用, 1 = 启用
    cloud_id INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 技能治理
CREATE TABLE skills (
    slug TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    system_status TEXT NOT NULL DEFAULT 'normal', -- 'normal' | 'disabled' | 'deprecated'
    user_enabled INTEGER, -- NULL = 继承, 0 = 关闭, 1 = 开启
    safety_label TEXT, -- 'safe' | 'unsafe' | NULL
    cloud_id INTEGER,
    synced_at TEXT,
    updated_at TEXT NOT NULL
);

-- LLM 请求/响应日志
CREATE TABLE request_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT,
    route_mode TEXT NOT NULL, -- 'DIRECT' | 'GATEWAY' | 'MAPPING'
    request_path TEXT NOT NULL,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    cost_usd REAL,
    latency_ms INTEGER,
    status_code INTEGER,
    blocked INTEGER NOT NULL DEFAULT 0,
    block_reason TEXT,
    cloud_id INTEGER,
    created_at TEXT NOT NULL
);

-- 安全拦截事件
CREATE TABLE intercept_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'danger_command' | 'skill_disabled' | 'budget_exceeded' | 'mcp_injection' | 'credential_leak'
    severity TEXT NOT NULL, -- 'critical' | 'high' | 'medium' | 'low'
    details TEXT NOT NULL, -- JSON 数据
    prompt_snippet TEXT, -- 前 500 字符用于上下文
    cloud_id INTEGER,
    created_at TEXT NOT NULL
);

-- 预算规则
CREATE TABLE budget_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT '*',
    period TEXT NOT NULL CHECK (period IN ('day','week','month')),
    limit_usd REAL NOT NULL,
    input_price_per_mtok REAL,
    output_price_per_mtok REAL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(provider, model, period)
);

-- 已发现的 Agent
CREATE TABLE discovered_agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL, -- 'claude' | 'codex' | 'gemini' | 'cursor' | 'openclaw' | ...
    agent_name TEXT NOT NULL,
    config_path TEXT,
    process_name TEXT,
    last_seen TEXT NOT NULL,
    mcp_servers TEXT, -- JSON 数组，记录发现的 MCP 服务器配置
    status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'inactive' | 'suspicious'
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- LLM 路由映射
CREATE TABLE llm_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prefix TEXT NOT NULL UNIQUE,
    target_base TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- 对话历史（需用户同意）
CREATE TABLE conversation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT,
    provider TEXT,
    model TEXT,
    route_mode TEXT,
    user_text TEXT NOT NULL,
    assistant_text TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX idx_conv_history_created ON conversation_history(created_at);

-- 云端同步状态追踪
CREATE TABLE sync_state (
    entity_type TEXT PRIMARY KEY, -- 'skills' | 'danger' | 'usage' | 'intercepts'
    last_sync_at TEXT,
    last_cloud_version TEXT,
    status TEXT NOT NULL DEFAULT 'idle' -- 'idle' | 'syncing' | 'error'
);

-- [新增] 技能安全扫描结果 (借鉴 SkillGuard 评分系统)
CREATE TABLE skill_scan_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_slug TEXT NOT NULL,
    score INTEGER NOT NULL,           -- 0-100 安全评分
    risk_level TEXT NOT NULL,         -- 'safe'|'low'|'medium'|'high'|'critical'
    blocked INTEGER NOT NULL DEFAULT 0,
    hard_triggers TEXT,               -- JSON: 命中的硬阻止规则
    findings TEXT NOT NULL,           -- JSON: 所有发现
    scanned_at TEXT NOT NULL
);

-- [新增] 安全公告缓存 (借鉴 ClawSec advisory feed)
CREATE TABLE security_advisories (
    id TEXT PRIMARY KEY,              -- CVE-YYYY-NNNNN 或 CLAW-YYYY-NNNN
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    affected TEXT NOT NULL,           -- JSON: 受影响技能列表
    cvss_score REAL,
    action TEXT,
    published TEXT NOT NULL,
    fetched_at TEXT NOT NULL
);

-- [新增] MCP 工具基线 (借鉴 Pipelock session binding)
CREATE TABLE mcp_tool_baselines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    server_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    description_hash TEXT NOT NULL,   -- 描述哈希（检测漂移）
    capability TEXT,                  -- 'read'|'write'|'exec'|'credentials'
    frozen_at TEXT NOT NULL,
    UNIQUE(session_id, server_id, tool_name)
);

-- [新增] 代理健康检查 (借鉴 CC-Switch provider_health)
CREATE TABLE provider_health (
    provider TEXT PRIMARY KEY,
    is_healthy INTEGER NOT NULL DEFAULT 1,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    last_check_at TEXT
);

-- [新增] 模型定价 (借鉴 CC-Switch model_pricing)
CREATE TABLE model_pricing (
    model_id TEXT PRIMARY KEY,
    input_cost_per_million REAL,
    output_cost_per_million REAL,
    updated_at TEXT NOT NULL
);
```

### 8.2 数据目录结构

```
~/.clawheart/
  clawheart.db              -- 主 SQLite 数据库
  credentials.json          -- 加密凭据（Tauri 存储）
  ca/                       -- TLS CA 证书
    clawheart-ca.pem
    clawheart-ca.key.enc
  logs/                     -- 应用日志（轮转）
    clawheart.log
    proxy.log
  backups/                  -- 迁移前自动备份
    clawheart-v1.db.bak
```

### 8.3 从 v1 迁移

```rust
pub fn migrate_from_v1(v1_db: &Path, v2_db: &Path) -> Result<MigrationReport> {
    // 1. 备份 v1 数据库
    // 2. 读取所有 v1 表
    // 3. 转换并插入 v2 Schema
    // 4. 将设置从 SQLite 迁移到加密存储
    // 5. 报告：迁移数量、跳过项、警告
}
```

---

## 9. 构建与分发

### 9.1 项目结构

```
clawheart-desktop/
  src-tauri/                    -- Rust 后端
    src/
      main.rs                   -- Tauri 应用入口
      lib.rs                    -- 库根模块
      commands/                 -- Tauri IPC 命令处理器
      proxy/                    -- 代理引擎 (hudsucker)
      security/                 -- 安全引擎
      agents/                   -- Agent 发现
      sync/                     -- 云端同步
      storage/                  -- 数据库层
    Cargo.toml
    tauri.conf.json             -- Tauri 配置
    capabilities/               -- 权限定义
    icons/                      -- 应用图标（自动生成）
  src/                          -- 前端源码
    App.tsx
    components/
      layout/                   -- Sidebar, StatusBar, TrayPopup
      protection/               -- ProtectionDashboard, InterceptList
      monitor/                  -- RequestLogs, TokenUsage, BudgetPanel
      skills/                   -- SkillList, SkillDetail, SafetyLabel
      agents/                   -- AgentTree, AgentDetail, McpServers
      scan/                     -- ScanItems, ScanResults, ScanHistory
      settings/                 -- ConnectionSettings, ProxyMode, Account
      ui/                       -- Button, Card, Dialog, Badge 等
    lib/
      tauri.ts                  -- 带类型的 IPC 封装
      i18n/                     -- 国际化 (10 种语言)
      hooks/                    -- Tauri 状态的 React Hooks
    styles/
      globals.css               -- Tailwind 基础样式 + 自定义工具类
  package.json
  tailwind.config.ts
  vite.config.ts
  tsconfig.json
```

### 9.2 构建目标

| 平台 | Target | 安装包 | 大小（预估） |
|------|--------|--------|-------------|
| macOS x64 | `x86_64-apple-darwin` | `.dmg` | ~12MB |
| macOS ARM | `aarch64-apple-darwin` | `.dmg` | ~10MB |
| Windows x64 | `x86_64-pc-windows-msvc` | `.msi` + `.nsis` | ~15MB |
| Linux x64 | `x86_64-unknown-linux-gnu` | `.deb` + `.AppImage` | ~12MB |

无需内嵌 Node.js，无需内嵌 Chromium，无需原生模块编译。

### 9.3 自动更新

使用 `tauri-plugin-updater`：
```json
{
  "plugins": {
    "updater": {
      "endpoints": ["https://api.clawheart.live/releases/{{target}}/{{arch}}/{{current_version}}"],
      "pubkey": "dW50..."
    }
  }
}
```

- 签名验证为强制性（Tauri 强制执行）
- 启动时 + 每 4 小时后台检查
- 带发布说明的用户通知
- 下次重启时应用更新（无中断）

### 9.4 CI/CD

```yaml
# GitHub Actions 矩阵构建
strategy:
  matrix:
    include:
      - os: macos-latest
        target: aarch64-apple-darwin
      - os: macos-13
        target: x86_64-apple-darwin
      - os: windows-latest
        target: x86_64-pc-windows-msvc
      - os: ubuntu-latest
        target: x86_64-unknown-linux-gnu
```

---

## 10. 迁移策略

### 阶段 1: 基础搭建（第 1-4 周）

- [ ] 初始化 Tauri 2 项目及 Rust 后端
- [ ] 实现 `rusqlite` 存储层及 v2 Schema
- [ ] 移植设置管理（IPC 命令）
- [ ] 移植认证流程（登录/注销/令牌管理）
- [ ] 基础前端框架及侧边栏导航
- [ ] 系统托盘及状态指示器

### 阶段 2: 代理核心（第 5-8 周）

- [ ] 集成 hudsucker 作为代理引擎
- [ ] 实现 LLM 请求拦截管线
- [ ] 移植危险指令匹配
- [ ] 移植技能治理检查
- [ ] 移植预算评估
- [ ] 实现真正的流式 SSE 透传
- [ ] 请求/响应日志记录

### 阶段 3: 安全能力（第 9-12 周）

- [ ] 集成 Armorer Guard 内联扫描
- [ ] 实现 MCP JSON-RPC 2.0 检查器
- [ ] 移植安全扫描编排器（云端转发）
- [ ] 实现秘密脱敏引擎
- [ ] CA 证书管理
- [ ] 拦截事件记录与告警

### 阶段 4: 用户界面（第 13-16 周）

- [ ] Tailwind CSS + Radix UI 组件库
- [ ] 防护仪表盘（总览 + 拦截事件）
- [ ] 监控面板（请求日志、Token 用量、预算）
- [ ] 技能市场面板
- [ ] 扫描面板（扫描项/结果/历史标签页）
- [ ] 设置面板
- [ ] 深色/浅色主题
- [ ] 国际化迁移（10 种语言）

### 阶段 5: 高级功能（第 17-20 周）

- [ ] Agent 发现（文件系统 + 进程扫描）
- [ ] Agent 管理面板
- [ ] 云端同步（增量模式）
- [ ] 自动更新器集成
- [ ] v1 数据库迁移工具
- [ ] 性能测试与优化

### 阶段 6: 打磨与发布（第 21-24 周）

- [ ] 跨平台测试（macOS、Windows、Linux）
- [ ] 安全审查
- [ ] 文档更新
- [ ] Beta 版发布
- [ ] 用户迁移指南
- [ ] 正式版发布

---

## 11. 路线图与里程碑

```
2026 Q3: v2.0-alpha  -- 核心代理 + 基础 UI（阶段 1-2）
2026 Q3: v2.0-beta   -- 完整安全能力 + 完整 UI（阶段 3-4）
2026 Q4: v2.0-rc     -- Agent 发现 + 打磨（阶段 5-6）
2026 Q4: v2.0        -- 正式发布

未来规划:
  v2.1: 移动端伴侣应用（通过 Tauri 移动端支持 iOS/Android）
  v2.2: 自定义安全规则的插件市场
  v2.3: 团队/企业多用户管理
  v2.4: AI 驱动的威胁分类（本地模型）
```

### 成功指标

| 指标 | v1 基线 | v2 目标 | 借鉴来源 |
|------|---------|---------|---------|
| 安装包大小 | 200MB+ | <15MB | Tauri 2 |
| 内存占用（空闲） | 150-300MB | <40MB | Tauri 2 |
| 启动时间 | 3-5 秒 | <1 秒 | Tauri 2 |
| 代理延迟开销 | ~50ms | <5ms | hudsucker |
| 协议格式支持 | 2 种 | 5 种（自动检测） | 9Router |
| MCP 安全覆盖 | 0% | 100%（OWASP Top 10 + 攻击链） | Pipelock |
| 技能扫描规则 | 0 条 | 72 条（22 硬阻止 + 50 加权） | SkillGuard |
| 凭据检测模式 | ~6 种 | 48 种 | Pipelock + Audit |
| 安全公告 | 无 | Ed25519 签名 CVE feed | ClawSec |
| 防御层次 | 3 层 | 8 层（含格式归一化+Kill Switch） | 综合 |
| 平台支持 | 2 个（Win/Mac） | 3 个（Win/Mac/Linux） | -- |
| 安全扫描延迟 | 仅云端 | <0.025ms 本地 | Armorer Guard |

---

## 12. 竞品借鉴整合

> 基于对 6 个项目的深度分析: 9Router、Pipelock、SkillGuard、OpenClaw Security Audit、ClawSec、CC-Switch

### 12.1 借鉴全景图

```
+------------------------------------------------------------------+
|                ClawHeart v2 借鉴来源矩阵                           |
+------------------------------------------------------------------+
|                                                                    |
|  CC-Switch (Tauri 2 + Rust)          Pipelock (Go AI 安全代理)     |
|  ├─ Tauri 项目结构 ─────────────┐    ├─ 11 层扫描管线 ────────┐    |
|  ├─ Axum 代理服务器 ────────────┤    ├─ MCP 攻击链检测 ───────┤    |
|  ├─ SQLite DAO + 迁移 ─────────┤    ├─ 工具基线冻结 ─────────┤    |
|  ├─ 熔断器 + 故障转移 ─────────┤    ├─ DLP 优先于 DNS ───────┤    |
|  ├─ shadcn/ui + TanStack Query ┤    ├─ 48 凭据模式 ──────────┤    |
|  ├─ 格式转换 (Claude↔OpenAI) ──┤    ├─ 6 遍注入归一化 ───────┤    |
|  └─ 系统托盘 ──────────────────┘    ├─ 信号分类 ─────────────┤    |
|           ↓                          ├─ Kill Switch 4 源 ────┤    |
|  ┌────────┴────────────┐             ├─ Evidence Receipt ────┤    |
|  │  ClawHeart v2 核心   │             └─ 失败关闭默认 ────────┘    |
|  │  Tauri 2 + Rust     │                       ↓                  |
|  │  + 安全引擎         │◄──────────────────────┘                  |
|  │  + 代理引擎         │◄──┐                                      |
|  │  + 技能治理         │   │                                      |
|  └──────┬──────────────┘   │                                      |
|         │                  │                                      |
|  9Router (多协议路由)       │   SkillGuard (技能扫描)              |
|  ├─ 枢纽格式归一化 ───────┤   ├─ 72 条规则 (22+50) ──────┐       |
|  ├─ 协议自动检测 ────────┤   ├─ 加权评分公式 ────────────┤       |
|  ├─ 流式扫描状态机 ──────┤   ├─ 上下文感知匹配 ─────────┤       |
|  └─ Token 用量多格式提取 ┘   ├─ 适配器模式 ─────────────┤       |
|                               └─ SARIF 输出 ─────────────┘       |
|                                                                    |
|  ClawSec (安全生态)           OpenClaw Audit (审计基线)            |
|  ├─ Ed25519 公告 feed ──────────────────────────────┐             |
|  ├─ NVD CVE 每日轮询 ──────────────────────────────┤             |
|  ├─ 文件漂移检测 ──────────────────────────────────┤             |
|  ├─ 标准化技能包格式 ─────────────────────────────┤             |
|  └─ MCP 工具集成 ────┐    ├─ 80 项确定性检查 ──────┤             |
|                       └────├─ 12 攻击面分类 ────────┤             |
|                            ├─ 凭据正则模式库 ───────┤             |
|                            └─ 模块化检查架构 ───────┘             |
+------------------------------------------------------------------+
```

### 12.2 按优先级排列的借鉴清单

#### P0 -- 必须实现（直接影响核心竞争力）

| # | 借鉴点 | 来源 | 影响模块 | 工作量 |
|---|--------|------|---------|--------|
| 1 | 协议格式归一化（枢纽模式） | 9Router | `proxy/normalizer.rs` | 中 |
| 2 | 协议自动检测 | 9Router | `proxy/format_detector.rs` | 低 |
| 3 | Tauri 2 项目结构 + IPC 设计 | CC-Switch | 整体架构 | 高（但已有参考） |
| 4 | SQLite DAO 层 + 迁移 + 备份 | CC-Switch | `storage/` | 中 |
| 5 | MCP 攻击链检测 | Pipelock | `security/mcp_chains.rs` | 中 |
| 6 | MCP 工具基线冻结 | Pipelock | `security/mcp_baseline.rs` | 中 |
| 7 | 失败关闭默认（所有错误路径阻止） | Pipelock | 全局设计原则 | 低 |
| 8 | DLP 在 DNS 解析前执行 | Pipelock | `proxy/pipeline.rs` | 低 |

#### P1 -- 强烈建议（显著提升安全覆盖）

| # | 借鉴点 | 来源 | 影响模块 | 工作量 |
|---|--------|------|---------|--------|
| 9 | 技能预发布扫描（72 条规则 + 评分） | SkillGuard | `security/skill_scanner.rs` | 中 |
| 10 | 6 遍提示词注入归一化 | Pipelock | `security/injection.rs` | 低 |
| 11 | 信号分类（Threat vs Protective） | Pipelock | `security/signal.rs` | 低 |
| 12 | 安全公告 Ed25519 签名订阅 | ClawSec | `security/advisory.rs` | 中 |
| 13 | 48 种凭据检测模式 | Pipelock + Audit | `security/redact.rs` | 低 |
| 14 | 熔断器 + 自动故障转移 | CC-Switch | `proxy/circuit_breaker.rs` | 中 |
| 15 | 流式扫描状态机 | 9Router | `proxy/stream_scanner.rs` | 中 |
| 16 | 多格式 Token 用量提取 | 9Router | `proxy/usage_extractor.rs` | 低 |

#### P2 -- 建议实现（深度安全 + 体验优化）

| # | 借鉴点 | 来源 | 影响模块 | 工作量 |
|---|--------|------|---------|--------|
| 17 | Kill Switch 4 源 OR 组合 | Pipelock | `security/kill_switch.rs` | 低 |
| 18 | 文件漂移检测 + 自动恢复 | ClawSec | `agents/drift.rs` | 中 |
| 19 | 跨请求分片外泄检测 | Pipelock | `proxy/cross_request.rs` | 高 |
| 20 | shadcn/ui + TanStack Query | CC-Switch | 前端 | 中 |
| 21 | 模块化审计检查架构（80 项） | Audit | `security/scanner.rs` | 中 |
| 22 | 自适应会话评分（4 级升级） | Pipelock | `security/session.rs` | 中 |
| 23 | MITRE ATT&CK 映射审计日志 | Pipelock | `storage/audit.rs` | 低 |
| 24 | 同形异义字符检测 | SkillGuard + Audit | `security/skill_scanner.rs` | 低 |
| 25 | 标准化技能包格式 (skill.json) | ClawSec | 技能市场 | 低 |

#### P3 -- 未来考虑

| # | 借鉴点 | 来源 |
|---|--------|------|
| 26 | Evidence Receipt (Ed25519 签名决策证明) | Pipelock |
| 27 | 行为合约 Learn-and-Lock（统计推断基线） | Pipelock |
| 28 | Deep Link 一键导入 (clawheart://) | CC-Switch |
| 29 | 进程沙箱 (Landlock + seccomp) | Pipelock |
| 30 | 社区事件报告流程 | ClawSec |

### 12.3 核心设计原则借鉴

**从 Pipelock 借鉴的安全哲学:**

1. **失败关闭** -- 所有错误路径默认阻止，而非放行
2. **能力分离** -- 代理不信任 Agent，零密钥持有
3. **DLP 先于 DNS** -- 数据防泄露检查在 DNS 解析之前完成
4. **信号分类** -- 区分真实威胁与防护性阻止，防止评分污染
5. **原子状态** -- 逐请求快照，消除 TOCTOU 竞态

**从 CC-Switch 借鉴的工程实践:**

1. **SSOT** -- SQLite 为唯一事实来源，实时配置文件按需生成
2. **分层架构** -- Commands → Services → DAO → Database
3. **Mutex 保护** -- `Arc<Mutex<Connection>>` 并发安全
4. **原子写入** -- 临时文件 → rename 防止损坏

**从 SkillGuard 借鉴的规则设计:**

1. **硬触发 + 加权评分** -- 致命规则立即阻止，其余按权重扣分
2. **上下文感知** -- 同一模式在代码文件和文档中区别对待
3. **熵过滤** -- 低 Shannon 熵 = 假阳性，跳过
4. **失败关闭** -- 规则加载失败 = 拒绝返回通过报告

### 12.4 详细分析报告索引

每个项目的完整分析报告:

| 报告 | 文件 |
|------|------|
| 9Router 分析 | `9ROUTER_ANALYSIS_CN.md` |
| Pipelock 分析 | `ANALYSIS_PIPELOCK_CN.md` |
| SkillGuard 分析 | `ANALYSIS_SKILLGUARD_CN.md` |
| ClawSec 分析 | `ANALYSIS_CLAWSEC_CN.md` |
| CC-Switch 分析 | `ANALYSIS_CC_SWITCH_CN.md` |
| OpenClaw Audit 分析 | `ANALYSIS_OPENCLAW_SECURITY_AUDIT_CN.md` |

---

## 13. 参考资料与来源

### 框架与库
- [Tauri 2.0 稳定版发布](https://v2.tauri.app/blog/tauri-20/)
- [Tauri 安全模型](https://v2.tauri.app/security/)
- [Tauri 能力系统](https://v2.tauri.app/security/capabilities/)
- [Tauri 插件生态](https://v2.tauri.app/plugin/)
- [Hudsucker - Rust MITM 代理](https://github.com/omjadas/hudsucker)
- [Hudsucker API 文档](https://docs.rs/hudsucker)
- [Armorer Guard - AI Agent 安全扫描器](https://github.com/ArmorerLabs/Armorer-Guard)
- [Proxelar - 可编程 MITM 代理](https://github.com/emanuele-em/proxelar)
- [mitmproxy_rs](https://github.com/mitmproxy/mitmproxy_rs)

### AI 安全研究
- [MCP 安全完整指南 2026](https://www.practical-devsecops.com/mcp-security-guide/)
- [MCP 安全检查清单 2026](https://www.networkintelligence.ai/blogs/model-context-protocol-mcp-security-checklist/)
- [OWASP MCP Top 10](https://www.practical-devsecops.com/mcp-security-vulnerabilities/)
- [MCP 安全事件时间线](https://authzed.com/blog/timeline-mcp-breaches)
- [Red Hat: MCP 安全风险与控制](https://www.redhat.com/en/blog/model-context-protocol-mcp-understanding-security-risks-and-controls)
- [SentinelOne: MCP 安全指南](https://www.sentinelone.com/cybersecurity-101/cybersecurity/mcp-security/)
- [微软 Agent 治理工具包](https://opensource.microsoft.com/blog/2026/04/02/introducing-the-agent-governance-toolkit-open-source-runtime-security-for-ai-agents/)

### 网络分析
- [RustNet - 逐进程网络监控](https://github.com/domcyrus/rustnet)
- [nDPI - 深度包检测](https://github.com/ntop/nDPI)

### UI 框架对比
- [2025 Rust GUI 库调查](https://www.boringcactus.com/2025/04/13/2025-survey-of-rust-gui-libraries.html)
- [Dioxus 框架](https://github.com/DioxusLabs/dioxus)

---

### 竞品项目（内部分析）
- [9Router v0.4.45](9ROUTER_ANALYSIS_CN.md) -- 多供应商 LLM 路由网关，协议翻译架构
- [Pipelock](ANALYSIS_PIPELOCK_CN.md) -- Go 企业级 AI Agent 出站安全代理
- [SkillGuard](ANALYSIS_SKILLGUARD_CN.md) -- TypeScript 技能安全扫描器
- [ClawSec](ANALYSIS_CLAWSEC_CN.md) -- 多平台安全技能生态系统
- [CC-Switch v3.14.1](ANALYSIS_CC_SWITCH_CN.md) -- Tauri 2 + Rust 桌面应用（最直接参考）
- [OpenClaw Security Audit](ANALYSIS_OPENCLAW_SECURITY_AUDIT_CN.md) -- 80 项确定性安全审计

---

*本文档基于截至 2026 年 5 月的网络资料研究及 6 个竞品项目深度分析编写。*
*ClawHeart Desktop v2 -- 为 AI Agent 打造它们值得拥有的守护者。*
