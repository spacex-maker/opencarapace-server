# ClawHeart Desktop v2 -- Rust Rewrite Product Design Document

> Version: 1.0 | Date: 2026-05-15 | Status: Draft

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture Analysis & Pain Points](#2-current-architecture-analysis--pain-points)
3. [Technology Selection & Justification](#3-technology-selection--justification)
4. [New Architecture Design](#4-new-architecture-design)
5. [Core Module Design](#5-core-module-design)
6. [UI/UX Redesign](#6-uiux-redesign)
7. [Security Architecture](#7-security-architecture)
8. [Data & Storage Design](#8-data--storage-design)
9. [Build & Distribution](#9-build--distribution)
10. [Migration Strategy](#10-migration-strategy)
11. [Roadmap & Milestones](#11-roadmap--milestones)
12. [References & Sources](#12-references--sources)

---

## 1. Executive Summary

### 1.1 What is ClawHeart Desktop?

ClawHeart Desktop is a local AI security client focused on:
- **Network proxy interception** -- capturing and analyzing LLM API traffic
- **Real-time security monitoring** -- detecting dangerous commands, policy violations, budget overruns
- **Skills governance** -- managing AI tool/skill permissions with enable/disable/safety labels
- **Security scanning** -- scanning local AI configurations and conversation history for vulnerabilities
- **Agent identification** -- discovering and managing local AI agents (Claude Code, Codex, Gemini CLI, etc.)
- **MCP security** -- monitoring Model Context Protocol tool calls for prompt injection and credential leaks

### 1.2 Why Rewrite in Rust?

| Dimension | Current (Electron + Node.js) | Target (Tauri 2 + Rust) |
|-----------|------------------------------|------------------------|
| Binary size | ~200MB+ (bundled Chromium) | ~5-15MB (OS WebView) |
| Memory idle | ~150-300MB | ~20-40MB |
| Startup time | 3-5s | <1s |
| Security | JS runtime, npm supply chain | Memory-safe, no npm in core |
| Proxy performance | Node.js single-thread | Async Rust (tokio), zero-copy |
| Platform | Win/macOS | Win/macOS/Linux + future mobile |

### 1.3 Design Principles

1. **Security-first** -- The tool that guards AI agents must itself be uncompromising on security
2. **Lightweight** -- Minimal resource consumption; users shouldn't notice it running
3. **Local-first** -- Core functionality works offline; cloud sync is optional enhancement
4. **Modular** -- Plugin architecture for extensibility without bloating the core
5. **Beautiful simplicity** -- Clean, focused UI that surfaces only what matters

---

## 2. Current Architecture Analysis & Pain Points

### 2.1 Current Stack

```
Electron (main.ts)
  |-- BrowserWindow (Chromium renderer)
  |     |-- React + Vite frontend (frontend/)
  |     |-- Components: OverviewPanel, SecurityScanPanel, InterceptLogsPanel,
  |     |               SkillsPanel, AgentMgmtPanel, SettingsPanel, etc.
  |     |-- i18n: 10 languages (zh, en, de, ar, es, fr, hi, ja, pt, ru)
  |
  |-- Express HTTP server @ 127.0.0.1:19111 (src/server.js)
  |     |-- LLM Proxy (llm-proxy.js) -- intercepts /v1/chat/completions
  |     |-- Security scan routes (cloud forwarding)
  |     |-- Skills, danger commands, intercept logs routes
  |     |-- Budget monitoring, token usage tracking
  |     |-- Agent management routes
  |     |-- OpenClaw gateway integration
  |
  |-- SQLite (sqlite3) @ ~/.clawheart/local-client.db
  |     |-- danger_commands, disabled_skills, deprecated_skills
  |     |-- local_settings, local_user_settings, local_llm_mappings
  |     |-- conversation_history, llm_usage_cost_events
  |     |-- openclaw_security_monitor_session
  |
  |-- Bundled Node.js runtime (resources/node.exe | Resources/node)
  |-- Bundled OpenClaw (optional, full vs core install)
```

### 2.2 Pain Points

| # | Problem | Impact |
|---|---------|--------|
| 1 | **Electron bloat** -- Chromium bundled = 200MB+, 150MB+ RAM idle | Poor UX on low-end machines |
| 2 | **Node.js proxy** -- single-threaded event loop for LLM traffic interception | Latency under high concurrency |
| 3 | **sqlite3 native module** -- requires platform-specific MSVC/Xcode compilation | Painful cross-platform builds |
| 4 | **Bundled Node runtime** -- Windows/macOS need separate node binaries | Build complexity, 40MB+ overhead |
| 5 | **No streaming proxy** -- `axios.post()` buffers entire response before forwarding | SSE/streaming LLM responses broken for large payloads |
| 6 | **Inline CSS everywhere** -- 900+ line App.tsx with all styles inline | Maintenance nightmare, no design system |
| 7 | **No system tray** -- full window required, can't run in background | Users must keep window open |
| 8 | **No auto-update** -- manual reinstall for updates | Poor update experience |
| 9 | **Express CORS `*`** -- all origins allowed on local server | Security concern |
| 10 | **No MCP-level inspection** -- only HTTP proxy, no MCP JSON-RPC awareness | Misses MCP-specific attacks |

---

## 3. Technology Selection & Justification

### 3.1 Core Framework: Tauri 2.x

**Why Tauri over alternatives:**

| Framework | Rendering | Binary Size | Memory | Maturity | Verdict |
|-----------|-----------|-------------|--------|----------|---------|
| **Tauri 2** | OS WebView | ~5-15MB | ~20-40MB | Stable, audited | **Selected** |
| Dioxus | WebView (uses Tauri) | Similar | Similar | v0.7, less stable | Too early for production |
| egui | Immediate mode GPU | ~10MB | ~30MB | Stable | Not suited for polished UI |
| Slint | Custom renderer | ~15MB | ~25MB | Stable, GPLv3 | Licensing concern |

Tauri 2 advantages:
- **Security audit** by Radically Open Security (NLNet/NGI funded)
- **Capabilities system** -- granular permission control for IPC
- **Plugin ecosystem** -- auto-updater, system tray, encrypted storage, etc.
- **Mobile support** -- iOS/Android from same codebase (future roadmap)
- Keeps existing React + i18n investment for the frontend layer

### 3.2 Network Proxy: hudsucker

**Why hudsucker:**
- Pure Rust MITM HTTP/S proxy with async runtime
- Supports HTTP/1.1, HTTP/2, WebSocket interception
- Certificate authority via `rcgen` (default) or OpenSSL
- TLS via `rustls` (default) or native-tls
- Clean builder API, actively maintained
- Can intercept, modify, and forward both requests and responses

Alternatives considered:
- `mitmproxy_rs` -- more powerful (WireGuard mode) but complex dependency
- `http-mitm-proxy` -- lighter but fewer features
- `proxelar` -- Lua scripting interesting but overkill

### 3.3 AI Security Scanning: Armorer Guard

**Why Armorer Guard:**
- **Rust-native** scanner for AI agent prompt injection and credential leaks
- **0.0247ms** average latency -- real-time inline scanning
- Scans MCP tool calls, prompts, model output, tool-call arguments
- Deterministic rules + local semantic classifier + similarity checks
- **No network calls** -- sensitive data never leaves local environment
- Structured JSON output with redaction, reason labels, confidence scores

### 3.4 Database: rusqlite

- Native Rust SQLite bindings (no C node-gyp compilation needed)
- Bundled SQLite via `bundled` feature -- zero system dependencies
- Async wrapper via `tokio-rusqlite` for non-blocking queries

### 3.5 Frontend: React + Tailwind CSS + Radix UI

Keep React (preserve i18n investment) but modernize:
- **Tailwind CSS** -- replace 900+ lines of inline styles with utility classes
- **Radix UI** -- accessible, unstyled primitives for dialogs, dropdowns, tabs
- **Vite** -- already in use, keep it
- **Lightweight charts** -- replace ECharts with lightweight `uplot` or `chart.js`

### 3.6 Full Technology Stack

```
+------------------------------------------------------------------+
|                     ClawHeart Desktop v2                          |
+------------------------------------------------------------------+
|  Frontend (WebView)                                               |
|  React 19 + TypeScript + Tailwind CSS + Radix UI                 |
|  Vite build | i18n (10 languages) | uPlot charts                |
+------------------------------------------------------------------+
|  Tauri 2.x IPC Layer (Capabilities-based)                        |
|  Commands: get_status, proxy_*, scan_*, skills_*, agent_*        |
+------------------------------------------------------------------+
|  Rust Core                                                        |
|  +------------------+  +------------------+  +-----------------+ |
|  | Proxy Engine     |  | Security Engine  |  | Agent Discovery | |
|  | hudsucker        |  | armorer-guard    |  | fs scanner      | |
|  | LLM intercept    |  | MCP scanner      |  | process detect  | |
|  | streaming SSE    |  | danger commands  |  | config parser   | |
|  | budget check     |  | skill governance |  | MCP server enum | |
|  +------------------+  +------------------+  +-----------------+ |
|  +------------------+  +------------------+  +-----------------+ |
|  | Storage Engine   |  | Cloud Sync       |  | Plugin System   | |
|  | rusqlite         |  | reqwest + tokio  |  | Tauri plugins   | |
|  | encrypted store  |  | auth/token mgmt  |  | auto-updater    | |
|  | migration mgr    |  | delta sync       |  | system tray     | |
|  +------------------+  +------------------+  +-----------------+ |
+------------------------------------------------------------------+
|  OS Layer                                                         |
|  System WebView | System Tray | File System | Network Stack      |
+------------------------------------------------------------------+
```

---

## 4. New Architecture Design

### 4.1 Process Model

```
ClawHeart Desktop v2
  |
  |-- Main Process (Rust/Tauri)
  |     |-- Tauri App lifecycle
  |     |-- IPC command handlers
  |     |-- System tray management
  |     |-- Auto-updater
  |
  |-- Proxy Service (Rust async task)
  |     |-- hudsucker MITM proxy @ 127.0.0.1:19111
  |     |-- True streaming (SSE passthrough, chunked transfer)
  |     |-- Per-request pipeline:
  |     |     1. Skill governance check
  |     |     2. Danger command matching
  |     |     3. Budget evaluation
  |     |     4. MCP tool call scanning (Armorer Guard)
  |     |     5. Forward to upstream (or gateway)
  |     |     6. Response scanning
  |     |     7. Token usage recording
  |     |
  |     |-- OpenAI-compatible endpoint: POST /v1/chat/completions
  |     |-- Anthropic-compatible: POST /v1/messages
  |     |-- MCP-aware: JSON-RPC 2.0 interception
  |
  |-- WebView (OS native)
  |     |-- React frontend via Tauri IPC
  |     |-- No direct HTTP to localhost (all via Tauri commands)
  |
  |-- Background Workers (tokio tasks)
        |-- Cloud sync (periodic, delta-based)
        |-- Agent discovery (file system + process scanning)
        |-- Security scan orchestrator
        |-- Notification manager
```

### 4.2 IPC Design (Tauri Commands)

Replace HTTP API (`/api/*`) with Tauri IPC commands:

```rust
// Status & Settings
#[tauri::command] fn get_status() -> Result<AppStatus, Error>;
#[tauri::command] fn get_settings() -> Result<Settings, Error>;
#[tauri::command] fn save_settings(settings: Settings) -> Result<(), Error>;

// Auth
#[tauri::command] fn login(email: String, password: String) -> Result<AuthResult, Error>;
#[tauri::command] fn logout() -> Result<(), Error>;

// Proxy
#[tauri::command] fn get_proxy_status() -> Result<ProxyStatus, Error>;
#[tauri::command] fn get_request_logs(filter: LogFilter) -> Result<Vec<RequestLog>, Error>;
#[tauri::command] fn get_intercept_logs(filter: InterceptFilter) -> Result<Vec<InterceptLog>, Error>;

// Security Scan
#[tauri::command] fn get_scan_items() -> Result<Vec<ScanItem>, Error>;
#[tauri::command] fn start_scan(items: Vec<String>, locale: String) -> Result<ScanRun, Error>;
#[tauri::command] fn get_scan_progress(run_id: u64) -> Result<ScanProgress, Error>;
#[tauri::command] fn get_scan_history() -> Result<Vec<ScanRun>, Error>;

// Skills
#[tauri::command] fn list_skills(filter: SkillFilter) -> Result<Vec<Skill>, Error>;
#[tauri::command] fn toggle_skill(slug: String, enabled: bool) -> Result<(), Error>;
#[tauri::command] fn set_skill_safety(slug: String, label: SafetyLabel) -> Result<(), Error>;
#[tauri::command] fn sync_skills() -> Result<SyncResult, Error>;

// Agent Management
#[tauri::command] fn list_agents() -> Result<Vec<AgentPlatform>, Error>;
#[tauri::command] fn get_agent_details(platform: String, feature: String) -> Result<Vec<AgentItem>, Error>;

// Budget
#[tauri::command] fn get_budget_rules() -> Result<Vec<BudgetRule>, Error>;
#[tauri::command] fn set_budget_rule(rule: BudgetRule) -> Result<(), Error>;
#[tauri::command] fn get_token_usage(range: TimeRange) -> Result<UsageSummary, Error>;

// Danger Commands
#[tauri::command] fn list_danger_commands() -> Result<Vec<DangerCommand>, Error>;
#[tauri::command] fn toggle_danger_command(id: u64, user_enabled: Option<bool>) -> Result<(), Error>;
#[tauri::command] fn sync_danger_commands() -> Result<SyncResult, Error>;
```

### 4.3 Proxy Pipeline (Streaming-First)

Current problem: `axios.post()` buffers entire response. New design uses true streaming:

```
Client (SDK)                    ClawHeart Proxy                    Upstream LLM
    |                               |                                   |
    |-- POST /v1/chat/completions ->|                                   |
    |                               |-- [1] Skill check                 |
    |                               |-- [2] Danger cmd check            |
    |                               |-- [3] Budget check                |
    |                               |-- [4] MCP scan (if applicable)    |
    |                               |                                   |
    |                               |-- Forward (stream) -------------->|
    |                               |                                   |
    |                               |<----------- SSE chunks -----------|
    |                               |-- [5] Scan each chunk             |
    |<--- SSE passthrough ----------|-- [6] Accumulate for token count  |
    |                               |                                   |
    |                               |-- [7] Final: record usage, sync   |
```

Key improvements:
- **Zero-copy streaming** via `hyper::Body` / `axum::body::Body`
- **Chunk-level scanning** -- Armorer Guard checks each SSE event
- **Backpressure-aware** -- if client is slow, proxy applies backpressure to upstream
- **Connection pooling** -- reuse upstream connections via `reqwest::Client`

### 4.4 Capabilities Security Model

Tauri 2's capabilities system replaces the blanket CORS `*`:

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
    // Custom permissions for ClawHeart commands
    "clawheart:allow-get-status",
    "clawheart:allow-get-settings",
    "clawheart:allow-save-settings",
    "clawheart:allow-login",
    "clawheart:allow-logout",
    "clawheart:allow-list-skills",
    "clawheart:allow-toggle-skill",
    "clawheart:allow-start-scan"
    // ... explicitly list each allowed command
  ]
}
```

---

## 5. Core Module Design

### 5.1 Proxy Engine (`crate::proxy`)

```
proxy/
  mod.rs            -- ProxyEngine struct, start/stop lifecycle
  interceptor.rs    -- hudsucker HttpHandler + WebSocketHandler impl
  pipeline.rs       -- Request/Response processing pipeline
  streaming.rs      -- SSE/chunked transfer passthrough
  llm_compat.rs     -- OpenAI / Anthropic format detection & blocked response
  route.rs          -- DIRECT / GATEWAY / MAPPING routing logic
  tls.rs            -- CA certificate generation & management
```

Key design:
- `ProxyEngine` owns a `hudsucker::Proxy` instance on a dedicated tokio runtime
- `HttpHandler` impl routes each request through the security pipeline
- Blocked requests return LLM-formatted responses (same as current `replyBlockedAsLlmResponse`)
- CA cert auto-generated on first run, stored in `~/.clawheart/ca/`

### 5.2 Security Engine (`crate::security`)

```
security/
  mod.rs            -- SecurityEngine facade
  danger.rs         -- DangerCommandMatcher (regex + substring)
  skills.rs         -- SkillGovernance (system + user enable/disable)
  budget.rs         -- BudgetEvaluator (per provider/model, daily/weekly/monthly)
  scanner.rs        -- SecurityScanner (cloud-forwarding scan orchestrator)
  mcp.rs            -- McpInspector (JSON-RPC 2.0 tool call analysis)
  redact.rs         -- Secret redaction (API keys, tokens, Bearer values)
  armorer.rs        -- Armorer Guard integration wrapper
```

MCP Inspector (new capability):
```rust
pub struct McpInspector {
    guard: ArmorerGuard,  // 0.024ms latency inline scanner
}

impl McpInspector {
    /// Inspect a JSON-RPC 2.0 message for security issues
    pub fn inspect(&self, msg: &JsonRpcMessage) -> InspectionResult {
        match msg {
            JsonRpcMessage::Request { method, params, .. } => {
                // Check tool_call arguments for prompt injection
                // Check for credential leaks in parameters
                // Validate against OWASP MCP Top 10
                self.guard.scan_tool_call(method, params)
            }
            JsonRpcMessage::Response { result, .. } => {
                // Scan tool responses for data exfiltration
                self.guard.scan_tool_response(result)
            }
        }
    }
}
```

### 5.3 Agent Discovery (`crate::agents`)

```
agents/
  mod.rs            -- AgentDiscovery orchestrator
  scanner.rs        -- File system scanner for agent configs
  process.rs        -- Running process detection (ps / tasklist)
  platforms/
    claude.rs       -- ~/.claude/ config parsing
    codex.rs        -- Codex CLI detection
    gemini.rs       -- Gemini CLI config
    openclaw.rs     -- OpenClaw workspace detection
    cursor.rs       -- .cursor/ directory scanning
    windsurf.rs     -- Windsurf config detection
```

Enhancement over current: automatic discovery instead of manual demo data.

### 5.4 Cloud Sync (`crate::sync`)

```
sync/
  mod.rs            -- SyncManager (periodic background task)
  auth.rs           -- Token management, refresh, logout cleanup
  skills.rs         -- Bidirectional skill sync with delta tracking
  danger.rs         -- Danger command rule sync
  usage.rs          -- Token usage ingest to cloud
  intercept.rs      -- Intercept log upload
```

Delta sync: track `last_sync_at` per entity type, only sync changes.

### 5.5 Storage (`crate::storage`)

```
storage/
  mod.rs            -- Database pool (tokio-rusqlite)
  migrations.rs     -- Schema versioning & migration runner
  models.rs         -- Rust structs for all tables
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

## 6. UI/UX Redesign

### 6.1 Design Philosophy

**From:** Dense dashboard with many panels and inline styles
**To:** Clean, focused interface with progressive disclosure

Principles:
1. **Glanceable** -- Key status visible at a glance from system tray
2. **Contextual** -- Show details only when relevant
3. **Minimal chrome** -- No unnecessary borders, shadows, or decorations
4. **Consistent** -- Design tokens via Tailwind, not inline styles

### 6.2 Layout Redesign

```
+----------------------------------------------------------------+
|  [Logo] ClawHeart                    [Search] [Tray] [Settings] |
+--------+-------------------------------------------------------+
|        |                                                        |
| Shield |  Main Content Area                                     |
|   --   |                                                        |
| Monitor|  +--------------------------------------------------+  |
|   --   |  |  Context-sensitive content                       |  |
| Skills |  |  with progressive disclosure                     |  |
|   --   |  |                                                  |  |
| Agents |  |                                                  |  |
|   --   |  +--------------------------------------------------+  |
| Scan   |                                                        |
|        |                                                        |
+--------+-------------------------------------------------------+
|  Status: Protected | 3 agents detected | 127 skills active     |
+----------------------------------------------------------------+
```

Key changes:
- **Vertical sidebar** instead of horizontal top nav (saves vertical space)
- **Collapsible sidebar** -- can minimize to icon-only mode
- **Status bar** at bottom with real-time protection status
- **System tray** with mini status popup (new)

### 6.3 Navigation Structure (Simplified)

| Icon | Section | Description |
|------|---------|-------------|
| Shield | **Protection** | Real-time status, recent intercepts, threat summary |
| Eye | **Monitor** | Request logs, token usage, budget alerts |
| Puzzle | **Skills** | Skill marketplace, governance, safety labels |
| Bot | **Agents** | Auto-discovered agents, MCP servers, configs |
| Scan | **Scan** | Security scanning, history, privacy settings |
| Gear | **Settings** | Connection, proxy mode, mappings, account |

Reduced from 8 top-level items (overview, securityScan, interceptLogs, openclaw, skills, agentMgmt, settings, auth) to 6 focused sections. OpenClaw management moved into Settings as a subsection.

### 6.4 System Tray (New)

```
+---------------------------+
|  ClawHeart  [Connected]   |
+---------------------------+
|  Protection: Active       |
|  Agents: 3 detected       |
|  Today: 1.2K requests     |
|  Budget: $2.14 / $10.00   |
+---------------------------+
|  [Pause Protection]       |
|  [Open Dashboard]         |
|  [Quit]                   |
+---------------------------+
```

- Left-click: toggle mini popup
- Right-click: context menu
- Tray icon changes color based on protection status (green/yellow/red)

### 6.5 Component Library

Replace inline styles with Tailwind + Radix UI:

```tsx
// Before (current): 50+ lines of inline style objects per button
<button style={{ width: 34, height: 34, display: "inline-flex", ... }}>

// After: Tailwind utility classes + Radix primitives
<Button variant="ghost" size="icon" className="rounded-xl">
  <MdSettings className="h-4 w-4" />
</Button>
```

Design tokens in `tailwind.config.ts`:
```ts
export default {
  theme: {
    extend: {
      colors: {
        claw: {
          green: { DEFAULT: '#22c55e', dark: '#16a34a' },
          danger: { DEFAULT: '#ef4444', dark: '#dc2626' },
          warning: '#fbbf24',
          // ... semantic tokens
        }
      }
    }
  }
}
```

### 6.6 Dark/Light Theme

Keep dual theme support, but implement via Tailwind `dark:` variant instead of CSS variables:

```tsx
<div className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
```

### 6.7 Responsive Windows

Support three window modes:
1. **Full** (1024x720+): All panels visible with sidebar
2. **Compact** (600x500): Sidebar collapses to icons, single panel
3. **Mini** (320x400): System tray popup, status-only view

---

## 7. Security Architecture

### 7.1 Threat Model

ClawHeart protects against:

| Threat | Current Coverage | v2 Coverage |
|--------|-----------------|-------------|
| Dangerous commands in LLM prompts | Substring matching | Regex + semantic matching |
| Disabled/malicious skills | System + user disable list | + Armorer Guard scanning |
| Budget overruns | Per-provider/model limits | Same + real-time alerts |
| API key leaks | Redaction before scan upload | + local-only Armorer Guard |
| MCP prompt injection | **Not covered** | Armorer Guard inline scanning |
| MCP tool poisoning | **Not covered** | Tool description validation |
| MCP credential leaks | **Not covered** | Argument/response scanning |
| Supply chain (malicious MCP packages) | **Not covered** | Registry verification |
| Rogue agent detection | **Not covered** | Process + config anomaly detection |
| CORS/local server abuse | CORS `*` (vulnerable) | Tauri IPC (no HTTP server for UI) |

### 7.2 Defense Layers

```
Layer 1: Network (Proxy Engine)
  |-- TLS interception with per-host cert
  |-- Request/response streaming with inspection
  |-- Connection-level rate limiting
  |
Layer 2: Content (Security Engine)
  |-- Danger command matching (regex + substring)
  |-- Skill governance (system + user policy)
  |-- Budget enforcement (pre-request check)
  |-- Armorer Guard inline scanning (0.024ms)
  |
Layer 3: Protocol (MCP Inspector)
  |-- JSON-RPC 2.0 message parsing
  |-- Tool call argument validation
  |-- Tool response data exfiltration check
  |-- OWASP MCP Top 10 coverage
  |
Layer 4: System (Agent Discovery)
  |-- Known agent config file monitoring
  |-- Process enumeration & attribution
  |-- Unauthorized agent alerting
  |
Layer 5: Data (Storage)
  |-- Encrypted credential storage (Tauri secure store)
  |-- Secret redaction before any cloud upload
  |-- Conversation history opt-in with consent tracking
```

### 7.3 CA Certificate Management

```
~/.clawheart/
  ca/
    clawheart-ca.pem    -- Root CA (generated on first run)
    clawheart-ca.key    -- CA private key (encrypted at rest)
    hosts/              -- Per-host cert cache
      api.openai.com.pem
      api.anthropic.com.pem
      ...
```

- CA cert generated via `rcgen` (Rust, no OpenSSL dependency)
- User prompted to trust CA cert on first run (system keychain integration)
- Per-host certs cached in memory (LRU) + disk
- CA key encrypted with OS keychain (macOS Keychain, Windows DPAPI)

### 7.4 Secrets Management

Current: API keys stored as plaintext in SQLite `local_settings` table.

New: Use Tauri's `tauri-plugin-store` with encryption:
```rust
// Encrypted store for sensitive data
let store = app.store("credentials.json")?;
store.set("api_key", encrypted_value);
store.set("auth_token", encrypted_value);
```

Non-sensitive settings remain in SQLite for queryability.

---

## 8. Data & Storage Design

### 8.1 Database Schema (v2)

Migrate from current schema with these improvements:

```sql
-- Version tracking for migrations
CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
);

-- Core settings (non-sensitive)
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Danger command rules
CREATE TABLE danger_commands (
    id INTEGER PRIMARY KEY,
    pattern TEXT NOT NULL,
    pattern_type TEXT NOT NULL DEFAULT 'substring', -- 'substring' | 'regex' | 'semantic'
    system_type TEXT NOT NULL,
    category TEXT NOT NULL,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('critical','high','medium','low')),
    system_enabled INTEGER NOT NULL DEFAULT 1,
    user_enabled INTEGER, -- NULL = inherit system, 0 = disabled, 1 = enabled
    cloud_id INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Skills governance
CREATE TABLE skills (
    slug TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    system_status TEXT NOT NULL DEFAULT 'normal', -- 'normal' | 'disabled' | 'deprecated'
    user_enabled INTEGER, -- NULL = inherit, 0 = off, 1 = on
    safety_label TEXT, -- 'safe' | 'unsafe' | NULL
    cloud_id INTEGER,
    synced_at TEXT,
    updated_at TEXT NOT NULL
);

-- LLM request/response logs
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

-- Security intercept events
CREATE TABLE intercept_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'danger_command' | 'skill_disabled' | 'budget_exceeded' | 'mcp_injection' | 'credential_leak'
    severity TEXT NOT NULL, -- 'critical' | 'high' | 'medium' | 'low'
    details TEXT NOT NULL, -- JSON blob
    prompt_snippet TEXT, -- first 500 chars for context
    cloud_id INTEGER,
    created_at TEXT NOT NULL
);

-- Budget rules
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

-- Discovered agents
CREATE TABLE discovered_agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL, -- 'claude' | 'codex' | 'gemini' | 'cursor' | 'openclaw' | ...
    agent_name TEXT NOT NULL,
    config_path TEXT,
    process_name TEXT,
    last_seen TEXT NOT NULL,
    mcp_servers TEXT, -- JSON array of MCP server configs found
    status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'inactive' | 'suspicious'
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- LLM route mappings
CREATE TABLE llm_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prefix TEXT NOT NULL UNIQUE,
    target_base TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Conversation history (opt-in)
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

-- Cloud sync state tracking
CREATE TABLE sync_state (
    entity_type TEXT PRIMARY KEY, -- 'skills' | 'danger' | 'usage' | 'intercepts'
    last_sync_at TEXT,
    last_cloud_version TEXT,
    status TEXT NOT NULL DEFAULT 'idle' -- 'idle' | 'syncing' | 'error'
);
```

### 8.2 Data Directory Structure

```
~/.clawheart/
  clawheart.db              -- Main SQLite database
  credentials.json          -- Encrypted credentials (Tauri store)
  ca/                       -- TLS CA certificates
    clawheart-ca.pem
    clawheart-ca.key.enc
  logs/                     -- Application logs (rotated)
    clawheart.log
    proxy.log
  backups/                  -- Auto-backup before migrations
    clawheart-v1.db.bak
```

### 8.3 Migration from v1

```rust
pub fn migrate_from_v1(v1_db: &Path, v2_db: &Path) -> Result<MigrationReport> {
    // 1. Backup v1 database
    // 2. Read all v1 tables
    // 3. Transform and insert into v2 schema
    // 4. Migrate settings from SQLite to encrypted store
    // 5. Report: migrated counts, skipped items, warnings
}
```

---

## 9. Build & Distribution

### 9.1 Project Structure

```
clawheart-desktop/
  src-tauri/                    -- Rust backend
    src/
      main.rs                   -- Tauri app entry point
      lib.rs                    -- Library root
      commands/                 -- Tauri IPC command handlers
      proxy/                    -- Proxy engine (hudsucker)
      security/                 -- Security engine
      agents/                   -- Agent discovery
      sync/                     -- Cloud sync
      storage/                  -- Database layer
    Cargo.toml
    tauri.conf.json             -- Tauri configuration
    capabilities/               -- Permission definitions
    icons/                      -- App icons (auto-generated)
  src/                          -- Frontend source
    App.tsx
    components/
      layout/                   -- Sidebar, StatusBar, TrayPopup
      protection/               -- ProtectionDashboard, InterceptList
      monitor/                  -- RequestLogs, TokenUsage, BudgetPanel
      skills/                   -- SkillList, SkillDetail, SafetyLabel
      agents/                   -- AgentTree, AgentDetail, McpServers
      scan/                     -- ScanItems, ScanResults, ScanHistory
      settings/                 -- ConnectionSettings, ProxyMode, Account
      ui/                       -- Button, Card, Dialog, Badge, etc.
    lib/
      tauri.ts                  -- Typed IPC wrappers
      i18n/                     -- Internationalization (10 langs)
      hooks/                    -- React hooks for Tauri state
    styles/
      globals.css               -- Tailwind base + custom utilities
  package.json
  tailwind.config.ts
  vite.config.ts
  tsconfig.json
```

### 9.2 Build Targets

| Platform | Target | Package | Size (est.) |
|----------|--------|---------|-------------|
| macOS x64 | `x86_64-apple-darwin` | `.dmg` | ~12MB |
| macOS ARM | `aarch64-apple-darwin` | `.dmg` | ~10MB |
| Windows x64 | `x86_64-pc-windows-msvc` | `.msi` + `.nsis` | ~15MB |
| Linux x64 | `x86_64-unknown-linux-gnu` | `.deb` + `.AppImage` | ~12MB |

No bundled Node.js, no bundled Chromium, no native module compilation.

### 9.3 Auto-Update

Use `tauri-plugin-updater`:
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

- Signature verification mandatory (Tauri enforced)
- Background check on startup + every 4 hours
- User notification with release notes
- Apply on next restart (non-disruptive)

### 9.4 CI/CD

```yaml
# GitHub Actions matrix
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

## 10. Migration Strategy

### Phase 1: Foundation (Weeks 1-4)

- [ ] Initialize Tauri 2 project with Rust backend
- [ ] Implement `rusqlite` storage layer with v2 schema
- [ ] Port settings management (IPC commands)
- [ ] Port auth flow (login/logout/token management)
- [ ] Basic frontend shell with sidebar navigation
- [ ] System tray with status indicator

### Phase 2: Proxy Core (Weeks 5-8)

- [ ] Integrate hudsucker as proxy engine
- [ ] Implement LLM request interception pipeline
- [ ] Port danger command matching
- [ ] Port skill governance checks
- [ ] Port budget evaluation
- [ ] True streaming SSE passthrough
- [ ] Request/response logging

### Phase 3: Security (Weeks 9-12)

- [ ] Integrate Armorer Guard for inline scanning
- [ ] Implement MCP JSON-RPC 2.0 inspector
- [ ] Port security scan orchestrator (cloud forwarding)
- [ ] Implement secret redaction engine
- [ ] CA certificate management
- [ ] Intercept event recording and alerting

### Phase 4: UI (Weeks 13-16)

- [ ] Tailwind CSS + Radix UI component library
- [ ] Protection dashboard (overview + intercepts)
- [ ] Monitor panel (request logs, token usage, budget)
- [ ] Skills marketplace panel
- [ ] Scan panel with items/results/history tabs
- [ ] Settings panel
- [ ] Dark/light theme
- [ ] i18n migration (10 languages)

### Phase 5: Advanced (Weeks 17-20)

- [ ] Agent discovery (file system + process scanning)
- [ ] Agent management panel
- [ ] Cloud sync (delta-based)
- [ ] Auto-updater integration
- [ ] v1 database migration tool
- [ ] Performance testing and optimization

### Phase 6: Polish & Release (Weeks 21-24)

- [ ] Cross-platform testing (macOS, Windows, Linux)
- [ ] Security review
- [ ] Documentation update
- [ ] Beta release
- [ ] User migration guide
- [ ] Production release

---

## 11. Roadmap & Milestones

```
2026 Q3: v2.0-alpha  -- Core proxy + basic UI (Phases 1-2)
2026 Q3: v2.0-beta   -- Full security + complete UI (Phases 3-4)
2026 Q4: v2.0-rc     -- Agent discovery + polish (Phases 5-6)
2026 Q4: v2.0        -- Production release

Future:
  v2.1: Mobile companion app (iOS/Android via Tauri mobile)
  v2.2: Plugin marketplace for custom security rules
  v2.3: Team/enterprise multi-user management
  v2.4: AI-powered threat classification (local model)
```

### Success Metrics

| Metric | v1 Baseline | v2 Target |
|--------|-------------|-----------|
| Binary size | 200MB+ | <15MB |
| Memory (idle) | 150-300MB | <40MB |
| Startup time | 3-5s | <1s |
| Proxy latency overhead | ~50ms | <5ms |
| MCP security coverage | 0% | 100% (OWASP Top 10) |
| Platform support | 2 (Win/Mac) | 3 (Win/Mac/Linux) |
| Security scan latency | Cloud-only | <0.025ms local |

---

## 12. References & Sources

### Frameworks & Libraries
- [Tauri 2.0 Stable Release](https://v2.tauri.app/blog/tauri-20/)
- [Tauri Security Model](https://v2.tauri.app/security/)
- [Tauri Capabilities](https://v2.tauri.app/security/capabilities/)
- [Tauri Plugin Ecosystem](https://v2.tauri.app/plugin/)
- [Hudsucker - Rust MITM Proxy](https://github.com/omjadas/hudsucker)
- [Hudsucker API Documentation](https://docs.rs/hudsucker)
- [Armorer Guard - AI Agent Security Scanner](https://github.com/ArmorerLabs/Armorer-Guard)
- [Proxelar - Programmable MITM Proxy](https://github.com/emanuele-em/proxelar)
- [mitmproxy_rs](https://github.com/mitmproxy/mitmproxy_rs)

### AI Security Research
- [MCP Security Complete Guide 2026](https://www.practical-devsecops.com/mcp-security-guide/)
- [MCP Security Checklist 2026](https://www.networkintelligence.ai/blogs/model-context-protocol-mcp-security-checklist/)
- [OWASP MCP Top 10](https://www.practical-devsecops.com/mcp-security-vulnerabilities/)
- [Timeline of MCP Security Breaches](https://authzed.com/blog/timeline-mcp-breaches)
- [Red Hat: MCP Security Risks and Controls](https://www.redhat.com/en/blog/model-context-protocol-mcp-understanding-security-risks-and-controls)
- [SentinelOne: MCP Security Guide](https://www.sentinelone.com/cybersecurity-101/cybersecurity/mcp-security/)
- [Microsoft Agent Governance Toolkit](https://opensource.microsoft.com/blog/2026/04/02/introducing-the-agent-governance-toolkit-open-source-runtime-security-for-ai-agents/)

### Network Analysis
- [RustNet - Per-process Network Monitor](https://github.com/domcyrus/rustnet)
- [nDPI - Deep Packet Inspection](https://github.com/ntop/nDPI)

### UI Frameworks Comparison
- [2025 Survey of Rust GUI Libraries](https://www.boringcactus.com/2025/04/13/2025-survey-of-rust-gui-libraries.html)
- [Dioxus Framework](https://github.com/DioxusLabs/dioxus)

---

*Document authored with research assistance from web sources dated through May 2026.*
*ClawHeart Desktop v2 -- Building the guardian that AI agents deserve.*
