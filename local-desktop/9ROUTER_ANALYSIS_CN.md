# 9Router 项目深度分析报告 -- 对 ClawHeart v2 的借鉴价值

> **GitHub**: https://github.com/decolua/9router
> **产品简介**: 9Router 是一个多供应商 LLM API 统一路由网关，支持 60+ 供应商、800+ 模型、12 种协议格式的自动检测与翻译。核心能力是将来自不同 AI CLI 工具（Claude Code、Codex、Gemini CLI、Cursor、Kiro 等）的请求通过"OpenAI 枢纽格式"统一转发到任意上游供应商，实现一键切换、故障转移和协议兼容。技术栈: Next.js 16 + Express + sql.js。

> 日期: 2026-05-15 | 分析对象: 9Router v0.4.45

---

## 目录

1. [9Router 项目概览](#1-9router-项目概览)
2. [核心架构深度分析](#2-核心架构深度分析)
3. [模型适配体系分析](#3-模型适配体系分析)
4. [协议翻译器架构](#4-协议翻译器架构)
5. [MITM 代理实现分析](#5-mitm-代理实现分析)
6. [对 ClawHeart v2 的借鉴价值评估](#6-对-clawheart-v2-的借鉴价值评估)
7. [具体借鉴方案与优先级](#7-具体借鉴方案与优先级)
8. [不建议借鉴的部分](#8-不建议借鉴的部分)
9. [总结与行动建议](#9-总结与行动建议)

---

## 1. 9Router 项目概览

### 1.1 是什么

9Router 是一个**多供应商 LLM API 统一路由网关**，核心能力是将来自不同客户端（Claude Code、Codex CLI、Gemini CLI、Cursor、Kiro 等）的请求，通过协议翻译转发到 60+ 个 LLM 供应商。

### 1.2 技术栈

| 组件 | 技术 |
|------|------|
| Web 框架 | Next.js 16 + React 19 |
| 代理引擎 | Express + 自定义 SSE handler |
| 数据库 | sql.js / better-sqlite3 |
| MITM 代理 | Node.js https + SNI + node-forge |
| UI | Tailwind CSS + Recharts |
| 状态管理 | Zustand |

### 1.3 规模统计

| 维度 | 数量 |
|------|------|
| 供应商 (Providers) | **60+** |
| 模型枚举 | **800+** 条模型定义 |
| 协议格式 | **12** 种 (OpenAI, Claude, Gemini, Cursor, Kiro, Ollama 等) |
| Executor 实现 | **18** 个专用 + 1 个默认 |
| 翻译器 | **22** 个 (11 请求 + 11 响应) |
| Skills (MCP) | **8** 个 |

---

## 2. 核心架构深度分析

### 2.1 三层架构

```
                 客户端请求 (任意格式)
                        |
          +-------------+-------------+
          |                           |
    [Format Detection]          [MITM Proxy]
    检测请求格式                  拦截原生流量
    (OpenAI/Claude/Gemini/...)   (Antigravity/Copilot/Kiro/Cursor)
          |                           |
          +-------------+-------------+
                        |
              [Translator Layer]
              source -> OpenAI -> target
              (OpenAI 作为中间枢纽格式)
                        |
              [Executor Layer]
              供应商特定的请求执行
              (URL构建/认证/重试/fallback)
                        |
              [Provider Registry]
              60+ 供应商配置
              (baseUrl/format/headers/OAuth)
```

### 2.2 关键设计模式

**1. OpenAI 作为枢纽格式 (Hub-and-Spoke)**

这是 9Router 最核心的设计决策：

```
Claude format  ──→  OpenAI format  ──→  Gemini format
Gemini format  ──→  OpenAI format  ──→  Claude format
Kiro format    ──→  OpenAI format  ──→  OpenAI format
Cursor format  ──→  OpenAI format  ──→  Claude format
```

无论源格式和目标格式是什么，都先转成 OpenAI 格式，再从 OpenAI 转成目标格式。这避免了 N x N 的翻译矩阵，变成了 2N 个翻译器。

**2. Executor 策略模式**

```javascript
// 18 个专用 Executor + 1 个 DefaultExecutor (fallback)
// 每个 Executor 处理供应商特定逻辑:
class BaseExecutor {
  buildUrl(model, stream, urlIndex, credentials)     // URL 构建
  buildHeaders(credentials, stream)                  // 认证头
  transformRequest(model, body, stream, credentials) // 请求变换
  shouldRetry(status, urlIndex)                      // 重试策略
  refreshCredentials(credentials, log)               // 令牌刷新
  execute({ model, body, stream, credentials, ... }) // 执行+fallback
}
```

**3. Provider 声明式注册**

```javascript
// providers.js -- 纯配置, 无逻辑
export const PROVIDERS = {
  claude: { baseUrl: "...", format: "claude", headers: {...} },
  openai: { baseUrl: "...", format: "openai" },
  gemini: { baseUrl: "...", format: "gemini" },
  // ... 60+ 供应商
};
```

---

## 3. 模型适配体系分析

### 3.1 模型枚举结构

`providerModels.js` 是 9Router 的核心资产，包含 **800+** 个模型定义：

```javascript
export const PROVIDER_MODELS = {
  // OAuth 供应商 (使用短别名)
  cc: [  // Claude Code
    { id: "claude-opus-4-7", name: "Claude Opus 4.7" },
    { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
    // ...
  ],
  cx: [  // Codex
    { id: "gpt-5.5", name: "GPT 5.5" },
    { id: "gpt-5.3-codex", name: "GPT 5.3 Codex" },
    // ... 含 review 变体自动生成
  ],
  // API Key 供应商 (别名=ID)
  openai: [
    { id: "gpt-5.4", name: "GPT-5.4" },
    { id: "o4-mini", name: "O4 Mini" },
    // ... 含 embedding, tts, stt, image 类型
  ],
  // ...
};
```

### 3.2 模型元数据字段

每个模型条目可以包含：

| 字段 | 说明 | 示例 |
|------|------|------|
| `id` | 模型标识符 | `"claude-opus-4-6"` |
| `name` | 显示名称 | `"Claude Opus 4.6"` |
| `type` | 模型类型 | `"llm"` / `"embedding"` / `"tts"` / `"stt"` / `"image"` / `"video"` |
| `upstreamModelId` | 上游实际模型ID | 当别名不同于上游ID时使用 |
| `targetFormat` | 覆盖默认格式 | 同一供应商下部分模型用不同协议 |
| `thinking` | 是否支持思考 | `false` 表示去除思考块 |
| `strip` | 去除的内容类型 | `["image", "audio"]` |
| `params` | 支持的参数列表 | `["size", "quality", "style"]` |
| `capabilities` | 能力声明 | `["text2img", "edit", "mask"]` |
| `quotaFamily` | 配额族 | `"review"` / `"normal"` |

### 3.3 辅助函数

```javascript
getProviderModels(aliasOrId)         // 获取供应商的所有模型
getDefaultModel(aliasOrId)           // 获取默认模型 (列表第一个)
isValidModel(aliasOrId, modelId)     // 验证模型是否合法
findModelName(aliasOrId, modelId)    // 查找模型显示名
getModelTargetFormat(alias, modelId) // 获取模型的目标格式覆盖
getModelUpstreamId(alias, modelId)   // 获取上游实际模型ID
getModelStrip(alias, modelId)        // 获取需要去除的内容类型
getModelQuotaFamily(alias, modelId)  // 获取配额族
```

### 3.4 供应商覆盖范围分析

**按类别划分：**

| 类别 | 供应商 | 数量 |
|------|--------|------|
| **头部厂商** | OpenAI, Anthropic, Google (Gemini/Vertex), xAI, Mistral, DeepSeek | 6 |
| **代码工具** | Claude Code, Codex, Cursor, Kiro, Gemini CLI, OpenCode, CommandCode, Cline, KiloCode | 9 |
| **中国厂商** | 智谱(GLM), Kimi(月之暗面), MiniMax, 通义(AliCode), 豆包(火山引擎), Qwen, 小米MiMo, BytePlus | 8 |
| **推理平台** | OpenRouter, Together, Fireworks, Cerebras, Groq, SiliconFlow, DeepInfra, SambaNova, Nebius, Hyperbolic, NScale | 11 |
| **免费/社区** | Puter, UncloseAI, FreeTheAI, BlackBox, Bazaarlink, PublicAI, AgentRouter, 等 | 15+ |
| **专用服务** | Cloudflare AI, Azure, GitHub Copilot, Nvidia, Vertex Partner | 5 |
| **本地部署** | Ollama (本地+远程) | 2 |
| **多媒体** | NanoBanana, FAL.AI, StabilityAI, BlackForestLabs, RunwayML, HuggingFace, ComfyUI, SDWebUI | 8 |
| **语音** | Deepgram, AssemblyAI, ElevenLabs, EdgeTTS, GoogleTTS, MiniMax TTS | 6 |

---

## 4. 协议翻译器架构

### 4.1 支持的 12 种协议格式

```javascript
export const FORMATS = {
  OPENAI: "openai",               // 标准 OpenAI Chat Completions
  OPENAI_RESPONSES: "openai-responses", // OpenAI Responses API (Codex)
  CLAUDE: "claude",               // Anthropic Messages API
  GEMINI: "gemini",               // Google Gemini API
  GEMINI_CLI: "gemini-cli",       // Gemini CLI 内部格式
  VERTEX: "vertex",               // Google Vertex AI
  CODEX: "codex",                 // OpenAI Codex 特殊格式
  ANTIGRAVITY: "antigravity",     // Google Antigravity (Gemini CLI 内部)
  KIRO: "kiro",                   // AWS Kiro (CodeWhisperer)
  CURSOR: "cursor",               // Cursor IDE (Protobuf)
  OLLAMA: "ollama",               // Ollama 本地模型
  COMMANDCODE: "commandcode"      // CommandCode AI
};
```

### 4.2 翻译矩阵

**请求翻译器 (11 个):**

| 翻译器 | 方向 | 说明 |
|--------|------|------|
| `claude-to-openai` | Claude -> OpenAI | 消息格式转换, system 提取, tool_use/tool_result 映射 |
| `openai-to-claude` | OpenAI -> Claude | 反向, max_tokens 调整, 工具名映射 |
| `gemini-to-openai` | Gemini -> OpenAI | contents[] -> messages[], functionCall 映射 |
| `openai-to-gemini` | OpenAI -> Gemini | 反向, 多模态内容处理 |
| `openai-to-vertex` | OpenAI -> Vertex | Vertex AI 特殊参数 |
| `antigravity-to-openai` | Antigravity -> OpenAI | Gemini CLI 内部格式解包 |
| `openai-responses` | OpenAI -> Responses | input[] 与 messages[] 互转 |
| `openai-to-kiro` | OpenAI -> Kiro | AWS CodeWhisperer 格式 |
| `openai-to-cursor` | OpenAI -> Cursor | Protobuf 序列化 |
| `openai-to-ollama` | OpenAI -> Ollama | Ollama 格式适配 |
| `openai-to-commandcode` | OpenAI -> CommandCode | CommandCode 格式 |

**响应翻译器 (11 个):** 对应反方向的流式 SSE 事件转换。

### 4.3 翻译器的关键处理

**Claude <-> OpenAI 转换中的核心差异处理：**

```
1. system 消息: OpenAI 放在 messages[], Claude 放在顶层 system 字段
2. tool_calls: OpenAI 在 assistant message 中, Claude 是 content block (type: "tool_use")
3. tool_result: OpenAI 用 role="tool", Claude 用 content block (type: "tool_result")
4. 流式事件: OpenAI 用 data: {choices:[{delta}]}, Claude 用 event: content_block_delta
5. thinking: Claude 有 thinking block, OpenAI 无 (需要注入/剥离)
6. max_tokens: Claude 必须显式设置, OpenAI 可选
7. 多模态: 图片格式不同 (base64 vs URL)
```

### 4.4 格式自动检测

```javascript
// 基于请求体结构自动判断格式:
function detectFormat(body) {
  if (body.input && !body.messages)     return "openai-responses";
  if (body.request?.contents)           return "antigravity";
  if (body.contents && Array.isArray)   return "gemini";
  if (body.stream_options || body.n)    return "openai";
  if (body.messages?.[0]?.content?.[0]?.type === "tool_result") return "claude";
  // ...更多启发式检测
}

// 基于 URL 路径检测:
function detectFormatByEndpoint(pathname) {
  if (pathname.includes("/v1/responses"))      return "openai-responses";
  if (pathname.includes("/v1/messages"))        return "claude";
  // ...
}
```

---

## 5. MITM 代理实现分析

### 5.1 架构

```
src/mitm/
  server.js         -- HTTPS 代理服务器 (SNI + 证书缓存)
  config.js         -- 目标主机 + URL 模式 + 模型同义词
  cert/generate.js  -- 逐域名证书生成 (node-forge)
  dns/              -- DNS 劫持 (hosts 文件 / 系统代理)
  handlers/
    antigravity.js  -- Gemini CLI 流量处理
    copilot.js      -- GitHub Copilot 流量处理
    kiro.js         -- Kiro/AWS 流量处理
    cursor.js       -- Cursor IDE 流量处理
  logger.js         -- 请求/响应日志记录
  dbReader.js       -- 数据库读取 (别名映射)
```

### 5.2 核心实现

- **SNI 回调**: 根据 TLS ClientHello 中的 SNI 动态生成域名证书
- **证书缓存**: `Map<domain, SecureContext>`, 避免重复生成
- **DNS 解析**: 使用 8.8.8.8 绕过本地 hosts 劫持
- **主机重写**: 如 `cloudcode-pa.googleapis.com` -> `daily-cloudcode-pa.googleapis.com` 绕过限流
- **分场景 Handler**: 不同代码工具的流量有专用处理逻辑

### 5.3 与 ClawHeart 代理的对比

| 维度 | 9Router MITM | ClawHeart v1 代理 | ClawHeart v2 设计 |
|------|-------------|-------------------|-------------------|
| 实现语言 | Node.js | Node.js (Express) | Rust (hudsucker) |
| 代理类型 | 透明 MITM (DNS劫持) | 正向代理 (SDK配置) | MITM + 正向代理 |
| TLS | node-forge + SNI | 无TLS拦截 | rcgen + rustls |
| 流式 | 原生 SSE 透传 | axios 缓冲 (有缺陷) | 零拷贝流式 |
| 协议支持 | 12 种格式翻译 | OpenAI + Anthropic | 待定 |

---

## 6. 对 ClawHeart v2 的借鉴价值评估

### 6.1 高价值借鉴 (强烈推荐)

#### A. 协议翻译器的枢纽架构

**价值: 极高**

9Router 的 "source -> OpenAI -> target" 枢纽模式是最有价值的借鉴点。

**ClawHeart 为什么需要这个：**
- ClawHeart 代理拦截的流量可能来自任何格式（Claude Code 用 Claude 格式, Codex 用 OpenAI Responses 格式, Gemini CLI 用 Gemini 格式）
- 安全扫描引擎需要统一的格式来分析内容（危险指令匹配、MCP 工具调用检查等）
- 将所有格式统一转成 OpenAI 格式后再做安全检查，避免为每种格式写单独的安全逻辑

**借鉴方式：**
```rust
// ClawHeart v2 安全管线:
//
// 客户端请求 (任意格式)
//    |
// [Format Detector] -- 检测请求协议格式
//    |
// [Normalize to OpenAI] -- 翻译为统一格式
//    |
// [Security Pipeline] -- 统一格式上做安全检查
//   |-- 危险指令匹配
//   |-- 技能治理检查
//   |-- 预算评估
//   |-- MCP 工具调用扫描
//   |-- Armorer Guard 提示词注入检测
//    |
// [Restore Original Format] -- 恢复原始格式
//    |
// 转发至上游
```

#### B. 格式自动检测

**价值: 高**

9Router 的 `detectFormat()` 和 `detectFormatByEndpoint()` 逻辑对 ClawHeart 代理层非常有用:

```rust
// ClawHeart v2 proxy/format_detector.rs
pub fn detect_format(body: &Value, path: &str) -> LlmFormat {
    // 1. URL 路径检测
    if path.contains("/v1/messages")    { return LlmFormat::Claude; }
    if path.contains("/v1/responses")   { return LlmFormat::OpenAIResponses; }

    // 2. 请求体结构检测
    if body.get("contents").is_some()   { return LlmFormat::Gemini; }
    if body.get("input").is_some()      { return LlmFormat::OpenAIResponses; }

    // 3. 特征字段检测
    if has_openai_fields(body)          { return LlmFormat::OpenAI; }
    if has_claude_fields(body)          { return LlmFormat::Claude; }

    LlmFormat::OpenAI // 默认
}
```

#### C. 流式 SSE 响应翻译状态机

**价值: 高**

9Router 的 `initState()` 和流式翻译器维护了完整的状态机，用于跟踪：
- 当前内容块类型（text/thinking/tool_use）
- 工具调用的累积参数
- 完成原因（stop/end_turn/tool_use）
- Token 用量累计

ClawHeart v2 在做响应扫描时也需要类似的状态机来：
- 累积流式数据块用于安全检测
- 准确记录 Token 用量
- 识别工具调用内容进行 MCP 安全检查

### 6.2 中等价值借鉴

#### D. 供应商模型注册表 (部分借鉴)

**价值: 中等**

9Router 的 `providerModels.js` 包含 800+ 模型定义。对 ClawHeart 的价值在于：

**有用的部分：**
- **模型元数据结构**: `id`, `name`, `type`, `capabilities`, `params` 的字段设计
- **上游模型ID映射**: `upstreamModelId` 概念 -- 同一模型在不同供应商有不同ID
- **配额族**: `quotaFamily` 用于预算分组（ClawHeart 的预算管理可以借鉴）
- **供应商别名映射**: `PROVIDER_ID_TO_ALIAS` 用于统一引用

**不需要的部分：**
- 具体的 800+ 模型枚举列表 -- ClawHeart 不做路由，不需要知道每个供应商的具体模型
- OAuth clientId/clientSecret -- ClawHeart 不做供应商认证
- 免费供应商列表 -- 与安全监控无关

**建议的精简版：**
```rust
// ClawHeart v2: 只维护安全相关的模型元数据
pub struct ModelMeta {
    pub format: LlmFormat,           // 协议格式
    pub provider_family: String,     // 供应商族 (openai/anthropic/google/...)
    pub supports_streaming: bool,
    pub supports_tools: bool,
    pub supports_thinking: bool,
    pub context_window: Option<u32>, // 用于预算估算
}
```

#### E. Executor 的重试/Fallback 机制

**价值: 中等**

BaseExecutor 的重试逻辑：
- 按 HTTP 状态码配置重试策略 (`retryConfig[429]`, `retryConfig[502]`)
- 多 URL fallback（同一供应商多个端点）
- 令牌自动刷新 (`refreshCredentials`)

ClawHeart v2 的代理转发可以借鉴这个重试模式，特别是 GATEWAY 模式下。

#### F. 请求/响应日志结构

**价值: 中等**

9Router 的 `usageTracking.js` 统一处理不同格式的 Token 用量提取：
- Claude 格式: `input_tokens` / `output_tokens`
- OpenAI 格式: `prompt_tokens` / `completion_tokens`
- 缓冲 Token 计算

ClawHeart v1 已有类似逻辑 (`extractUsage`)，但 9Router 的实现更完整。

### 6.3 低价值借鉴

#### G. MITM DNS 劫持方式

**价值: 低**

9Router 的 MITM 通过修改 hosts 文件实现 DNS 劫持，这种方式：
- 需要管理员权限
- 影响系统全局 DNS
- 对用户侵入性强

ClawHeart v2 的设计（基于 SDK 配置 Base URL）更友好，hudsucker 的显式代理模式更安全。

#### H. Claude CLI 伪装头

**价值: 低（且有安全风险）**

9Router 大量伪造 Claude CLI 的 User-Agent 和 SDK 指纹 (`CLAUDE_CLI_SPOOF_HEADERS`)，这是一种规避检测的手段。ClawHeart 作为安全工具**绝不应该借鉴此类做法**。

#### I. 具体的 800+ 模型列表

**价值: 低**

ClawHeart 不是 LLM 路由器，不需要维护所有供应商的模型目录。安全扫描只需要知道流量使用了哪个格式，不需要枚举所有可用模型。

---

## 7. 具体借鉴方案与优先级

### P0: 协议格式统一层 (必须借鉴)

**在 ClawHeart v2 Rust 核心中实现:**

```rust
// crate::proxy::formats.rs
pub enum LlmFormat {
    OpenAI,           // /v1/chat/completions
    OpenAIResponses,  // /v1/responses
    Claude,           // /v1/messages
    Gemini,           // Google Gemini
    Ollama,           // Ollama 本地
}

// crate::proxy::normalizer.rs
pub trait RequestNormalizer {
    /// 将任意格式的请求归一化为统一的 NormalizedRequest
    fn normalize(&self, body: &Value) -> NormalizedRequest;
}

pub struct NormalizedRequest {
    pub messages: Vec<NormalizedMessage>,
    pub model: String,
    pub tools: Vec<ToolDefinition>,
    pub stream: bool,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f64>,
    pub original_format: LlmFormat,
    pub original_body: Value,  // 保留原始请求，转发时恢复
}

pub struct NormalizedMessage {
    pub role: MessageRole,
    pub text_content: String,           // 纯文本，用于安全检测
    pub tool_calls: Vec<ToolCall>,      // 工具调用，用于 MCP 检查
    pub tool_results: Vec<ToolResult>,  // 工具结果
}
```

**安全管线基于归一化后的数据工作:**

```rust
// crate::security::pipeline.rs
pub async fn check_request(req: &NormalizedRequest) -> SecurityResult {
    // 1. 所有格式统一为 NormalizedMessage 后:
    let user_text = req.latest_user_text(); // 最后一条用户消息

    // 2. 危险指令检测 (格式无关)
    danger_check(&user_text)?;

    // 3. 技能治理 (如果有 x-oc-skills header)
    skill_governance_check(&req)?;

    // 4. 预算检查
    budget_check(&req.model)?;

    // 5. MCP 工具调用安全检查 (格式无关, 已归一化)
    for call in req.all_tool_calls() {
        armorer_guard.scan_tool_call(&call)?;
    }

    Ok(SecurityResult::Pass)
}
```

### P1: 格式自动检测 (强烈建议)

从 9Router 的 `detectFormat()` 和 `detectFormatByEndpoint()` 提炼出 Rust 版本：

```rust
pub fn detect_format(path: &str, body: &Value) -> LlmFormat {
    // 路径优先
    if path.contains("/v1/messages") { return LlmFormat::Claude; }
    if path.contains("/v1/responses") { return LlmFormat::OpenAIResponses; }
    if path.contains("/api/chat") { return LlmFormat::Ollama; }

    // 请求体结构
    if body.get("contents").is_some() { return LlmFormat::Gemini; }
    if body.get("input").is_some() && body.get("messages").is_none() {
        return LlmFormat::OpenAIResponses;
    }
    // Claude 特征
    if let Some(msgs) = body.get("messages").and_then(|m| m.as_array()) {
        if msgs.iter().any(|m| has_claude_content_blocks(m)) {
            return LlmFormat::Claude;
        }
    }

    LlmFormat::OpenAI
}
```

### P2: 流式响应安全扫描状态机 (建议)

从 9Router 的 `initState()` 借鉴流式状态追踪：

```rust
pub struct StreamScanState {
    pub format: LlmFormat,
    pub accumulated_text: String,        // 累积的文本用于扫描
    pub current_tool_call: Option<PartialToolCall>, // 正在进行的工具调用
    pub token_usage: TokenUsage,         // 累积的 token 用量
    pub finish_reason: Option<String>,
    pub scan_triggered: bool,            // 是否已触发安全检查
}

impl StreamScanState {
    /// 处理一个 SSE 事件, 返回是否需要拦截
    pub fn process_chunk(&mut self, chunk: &str) -> ScanDecision {
        match self.format {
            LlmFormat::OpenAI => self.process_openai_chunk(chunk),
            LlmFormat::Claude => self.process_claude_chunk(chunk),
            // ...
        }
    }
}
```

### P3: 统一 Token 用量提取 (建议)

从 9Router 的 `usageTracking.js` 借鉴多格式用量归一化：

```rust
pub fn extract_usage(format: LlmFormat, response: &Value) -> TokenUsage {
    match format {
        LlmFormat::Claude => {
            let usage = response.get("usage");
            TokenUsage {
                prompt_tokens: usage.and_then(|u| u["input_tokens"].as_u64()),
                completion_tokens: usage.and_then(|u| u["output_tokens"].as_u64()),
                ..Default::default()
            }
        }
        LlmFormat::OpenAI | LlmFormat::OpenAIResponses => {
            let usage = response.get("usage");
            TokenUsage {
                prompt_tokens: usage.and_then(|u| u["prompt_tokens"].as_u64()),
                completion_tokens: usage.and_then(|u| u["completion_tokens"].as_u64()),
                ..Default::default()
            }
        }
        // ...
    }
}
```

### P4: 供应商格式映射表 (可选)

维护一个轻量级的"供应商 -> 协议格式"映射，用于代理自动检测：

```rust
// 不需要 800+ 模型枚举, 只需供应商级别的格式映射
pub static KNOWN_PROVIDERS: LazyLock<HashMap<&str, ProviderInfo>> = LazyLock::new(|| {
    let mut m = HashMap::new();
    m.insert("api.anthropic.com", ProviderInfo { format: LlmFormat::Claude, name: "Anthropic" });
    m.insert("api.openai.com", ProviderInfo { format: LlmFormat::OpenAI, name: "OpenAI" });
    m.insert("generativelanguage.googleapis.com", ProviderInfo { format: LlmFormat::Gemini, name: "Google" });
    m.insert("api.deepseek.com", ProviderInfo { format: LlmFormat::OpenAI, name: "DeepSeek" });
    m.insert("api.minimax.io", ProviderInfo { format: LlmFormat::Claude, name: "MiniMax" });
    // ... 按需添加, 精简版 ~30 条即可
    m
});
```

---

## 8. 不建议借鉴的部分

### 8.1 客户端伪装 / 协议欺骗

9Router 大量使用客户端身份伪装:
- `CLAUDE_CLI_SPOOF_HEADERS` -- 伪造 Claude Code SDK 指纹
- `claudeCloaking.js` -- 工具名混淆规避检测
- `cursorProtobuf.js` -- Cursor 私有协议逆向
- Host 重写绕过速率限制

**ClawHeart 作为安全产品，这些做法与产品价值观冲突。**

### 8.2 OAuth 令牌获取/刷新

9Router 存储了多个服务的 OAuth clientId/clientSecret:
- Anthropic, Google, OpenAI, Kiro, Qwen 等
- 实现了完整的 OAuth device flow

ClawHeart 不需要也不应该代替用户管理 LLM 供应商的认证。

### 8.3 完整的模型枚举列表

800+ 模型的具体列表维护成本高、变动频繁，且 ClawHeart 不做路由选择，仅做安全监控，不需要知道模型目录。

### 8.4 具体的翻译器实现代码

9Router 的翻译器是 JavaScript 实现，ClawHeart v2 需要 Rust 实现。概念可以借鉴，但代码无法复用。

---

## 9. 总结与行动建议

### 9.1 核心借鉴总结

| 借鉴点 | 优先级 | 价值 | 工作量 | 说明 |
|--------|--------|------|--------|------|
| 枢纽格式归一化架构 | **P0** | 极高 | 中 | 安全引擎只需处理一种格式 |
| 协议自动检测 | **P1** | 高 | 低 | 路径 + 请求体启发式 |
| 流式扫描状态机 | **P2** | 高 | 中 | SSE 数据块累积与安全检查 |
| Token 用量多格式提取 | **P3** | 中 | 低 | Claude/OpenAI/Gemini 用量归一化 |
| 供应商格式映射表 (精简版) | **P4** | 中 | 低 | ~30 条已知供应商映射 |

### 9.2 不借鉴总结

| 不借鉴 | 原因 |
|--------|------|
| 800+ 模型枚举 | ClawHeart 不做路由，维护成本高 |
| 客户端伪装 | 与安全产品价值观冲突 |
| OAuth 流程 | 不属于 ClawHeart 职责范围 |
| DNS 劫持方式 | 侵入性过强 |
| JavaScript 翻译器代码 | 需要 Rust 重写，概念可借鉴 |

### 9.3 对 ClawHeart v2 设计文档的更新建议

在 `CLAWHEART_RUST_REDESIGN_CN.md` 的代理引擎设计中，增加以下模块：

```
proxy/
  mod.rs
  interceptor.rs
  pipeline.rs
  streaming.rs
  llm_compat.rs
  route.rs
  tls.rs
+ formats.rs          -- LLM 协议格式枚举 (借鉴 9Router formats.js)
+ format_detector.rs  -- 格式自动检测 (借鉴 9Router detectFormat)
+ normalizer.rs       -- 请求归一化层 (借鉴 9Router translator 枢纽模式)
+ normalizers/
+   openai.rs         -- OpenAI -> Normalized
+   claude.rs         -- Claude -> Normalized
+   gemini.rs         -- Gemini -> Normalized
+   ollama.rs         -- Ollama -> Normalized
+ stream_scanner.rs   -- 流式响应安全扫描状态机 (借鉴 9Router initState)
+ usage_extractor.rs  -- 多格式 Token 用量提取 (借鉴 9Router usageTracking)
+ provider_registry.rs -- 已知供应商格式映射 (精简版, ~30条)
```

### 9.4 最终结论

9Router 对 ClawHeart v2 最大的价值不在于它的 800+ 模型枚举（那是路由器的核心资产），而在于它的**协议翻译架构设计模式**：

1. **"OpenAI 枢纽格式"模式** -- 让 ClawHeart 的安全引擎只需要理解一种格式
2. **格式自动检测** -- 让代理层透明处理不同 AI 工具的流量
3. **流式状态机** -- 让安全检查能在流式传输中逐块进行

这三点结合起来，使 ClawHeart v2 能够从"只支持 OpenAI/Anthropic 两种格式"升级为"自动识别并安全监控所有主流 AI 工具的流量"，大幅提升产品覆盖面和竞争力。

---

*分析完成于 2026-05-15，基于 9Router v0.4.45 代码库。*
