# OpenClaw Gateway 管理模块架构

## 概览

`openclaw-manager` 负责在 ClawHeart 桌面端中管理 OpenClaw Gateway 的完整生命周期——启动、停止、运行态检测、Dashboard URL 获取、诊断日志。

支持**双路并行**：内置（bundled）和外置（external）Gateway 各自独立运行。

---

## 文件结构

```
server/
├── openclaw-manager.js                 # 薄编排层（290 行）
└── openclaw-manager/
    ├── platform.js                     # 平台调度（10 行）
    ├── win.js                          # Windows 实现（87 行）
    ├── darwin.js                       # macOS/Unix 实现（70 行）
    ├── diag.js                         # 诊断日志系统（182 行）
    ├── dashboard-url.js                # URL 清洗 / token / getDashboardUrl（307 行）
    └── lifecycle.js                    # start / stop / exec-stop-cli（534 行）
```

---

## 各模块职责

### `openclaw-manager.js` — 编排层

| 职责 | 说明 |
|---|---|
| 常量 | `BUNDLED_GATEWAY_PORT=19278`、`OPENCLAW_UI_URL`、`BUNDLED_OPENCLAW_UI_URL` |
| 共享状态 | `gatewayProcesses`（子进程句柄）、`lastGatewayStopEpochMs`（停止时间戳）、`cachedDashboardUrl` |
| 二进制检测 | `hasEmbeddedOpenClaw`、`getOpenClawCliSource`、`hasBundledOpenClawCli` |
| 运行态检测 | `checkOpenClawRunning`（TCP 端口 + 进程扫描 + 诊断日志兜底）、`probeGatewayReadyAfterSpawn` |
| 状态聚合 | `getOpenClawStatus` — 并行检测双路运行态、串行获取 URL、拼入诊断和端口冲突 payload |

**对外 exports：**
`hasEmbeddedOpenClaw`, `hasBundledOpenClawCli`, `getOpenClawCliSource`, `startEmbeddedOpenClaw`, `stopEmbeddedOpenClaw`, `getOpenClawStatus`, `getGatewayDiagnosticLog`, `getGatewayDiagnosticLogsPayload`, `clearCachedDashboardUrl`, `OPENCLAW_UI_URL`, `BUNDLED_OPENCLAW_UI_URL`, `BUNDLED_GATEWAY_PORT`

---

### `platform.js` / `win.js` / `darwin.js` — 平台抽象

按 `process.platform` 加载对应实现，暴露统一 API：

| 函数 | Windows | macOS/Unix |
|---|---|---|
| `platformBinName("openclaw")` | `"openclaw.cmd"` | `"openclaw"` |
| `localBinPath(dir)` | `path.join(dir, "openclaw.cmd")` | `path.join(dir, "openclaw")` |
| `findGlobalOpenClawBin()` | `wherePathsSync("openclaw.exe"/.cmd)` | `null` |
| `spawnOpenClawBin(bin, args, opts)` | `spawn(cmd.exe, ["/c", bin, ...args], opts)` | `spawn(bin, args, opts)` |
| `execOpenClawBin(bin, args, opts)` | 同上，用 `execWithOutput` | 直接执行 |
| `formatSpawnCommand(bin, args)` | `cmd.exe /c "bin" args` | `bin args` |
| `killProcessTree(pid)` | `taskkill /F /T /PID` | 空操作 |
| `getNodeMissingDiagnostics(port)` | `.exe` / 安装包文案 | DMG / Resources 文案 |
| `getNodeMissingStopError()` | `"未找到 node.exe…"` | `"未找到内置 node…"` |
| `getLaunchctlHint()` | `null` | `"macOS 提示: launchctl…"` |

---

### `diag.js` — 诊断日志系统

- 内存缓冲 `gatewayDiagnosticLogs = { bundled, external }` + 磁盘持久化到 `logs/openclaw-gateway-{bundled,external}.log`
- `attachChildProcessLogs(child, mode)` — 自动挂载 stdout/stderr 到诊断日志，stderr 同时解析端口冲突
- `latestClawHeartDiagGatewayUpTimestampMs(mode)` — 从日志行推断 Gateway 最近就绪时间（用于运行态兜底判断）
- `gatewayDiagLogShowsGatewayListening(mode)` — 日志中是否出现了 `listening on` / `ready` 标记

---

### `dashboard-url.js` — URL 解析

- `sanitizeDashboardUrlCandidate(raw)` — 从 CLI 输出或配置中清洗 URL（去 ANSI、修正截断 token）
- `composeUiUrlWithToken(baseUrl, token, opts)` — 拼接 `#token=xxx`
- `getUiUrlFromActiveConfig(baseUrl, configPath)` — 从 `openclaw.json` 读 token + port 拼 URL
- `getUiUrlFromListeningGatewayProcess(baseUrl)` — macOS 用 `lsof` 从监听进程的 fd 找到 config 文件，再读 token（Windows 返回 null）
- `getDashboardUrl(ctx)` — 多路径解析链：缓存 → 监听进程 → config 文件 → `openclaw dashboard --no-open` CLI 输出 → fallback

---

### `lifecycle.js` — 生命周期

- `initLifecycle(shared)` — 接收主模块注入的共享状态（`gatewayProcesses`、`checkOpenClawRunning` 等），避免循环依赖
- `startEmbeddedOpenClaw(modeArg)` — 双路启动编排：
  - 模式解析（bundled / external）
  - 环境隔离（每路独立 `OPENCLAW_STATE_DIR` / `CONFIG_PATH`）
  - 内置模式先 `initOpenClawConfig` + `ensureGatewayModeLocal` + `ensureManagedGatewayPort`
  - 预停止 `preemptiveGatewayStopBeforeStart`
  - 多种启动路径：packaged `.bin`、`openclaw.mjs + node`、dev `node_modules/.bin`、外置解析
  - 就绪轮询（45 秒，每 500ms）
- `stopEmbeddedOpenClaw(modeArg)` — 双路停止编排：
  - `proc.kill()` + `killProcessTree`
  - Windows 孤儿进程清理（路径标记匹配 + `findBundledGatewayRunPidsWindows`）
  - `openclaw gateway stop` CLI
  - 停止确认轮询（15 秒）

---

## 外部依赖模块

| 模块 | 职责 |
|---|---|
| `openclaw-paths.js` | 解析打包路径（unpacked root、packaged bin/mjs）、构建子进程 `PATH`/`NODE_PATH`/`OPENCLAW_*` 环境变量 |
| `openclaw-workspace.js` | 定义两个"世界"：managed（`clawheart-openclaw-runtime`）vs user（`~/.openclaw`）；同步工作区状态 |
| `openclaw-external.js` | 外置模式专属：`~/.opencarapace/external-openclaw` npm 前缀、二进制解析、模式标准化 |
| `openclaw-discovery.js` | 全局 OpenClaw 安装发现（npm prefix / PATH / Homebrew）；`resolveEffectiveExternalOpenClawBin` |
| `openclaw-config.js` | 读写 `openclaw.json`、provider 预设、端口迁移、`restartGateway`（反向 lazy require manager） |
| `openclaw-gateway-process.js` | 进程表扫描（`ps` / `wmic`），检测 `gateway run` 进程是否存在 |
| `openclaw-gateway-port-conflict.js` | 端口冲突检测与 `lsof`/`netstat` 丰富，TCP 监听者列表 |
| `openclaw.js` | Express 路由层，调用 manager 的 `start`/`stop`/`status` 并返回 JSON |

---

## 依赖关系图

```
openclaw.js (路由)
  └─→ openclaw-manager.js (编排)
        ├─→ openclaw-manager/platform.js → win.js | darwin.js
        ├─→ openclaw-manager/diag.js
        │     └─→ openclaw-gateway-port-conflict.js
        ├─→ openclaw-manager/dashboard-url.js
        │     ├─→ platform.js
        │     ├─→ openclaw-paths.js
        │     ├─→ openclaw-discovery.js
        │     └─→ openclaw-workspace.js
        ├─→ openclaw-manager/lifecycle.js
        │     ├─→ platform.js
        │     ├─→ diag.js
        │     ├─→ openclaw-paths.js
        │     ├─→ openclaw-discovery.js
        │     ├─→ openclaw-workspace.js
        │     ├─→ openclaw-external.js
        │     ├─→ openclaw-config.js
        │     └─→ openclaw-gateway-process.js
        ├─→ openclaw-gateway-process.js
        ├─→ openclaw-gateway-port-conflict.js
        └─→ openclaw-workspace.js

openclaw-config.js ──lazy──→ openclaw-manager.js (restartGateway)
```

---

## 双路模型

| 维度 | bundled（内置） | external（外置） |
|---|---|---|
| 二进制来源 | 安装包内 `app.asar.unpacked` 或 `node_modules/.bin` | ClawHeart npm 前缀或本机 PATH 全局 |
| 端口 | `19278`（专属固定） | `18789`（默认，可配置） |
| 配置/状态目录 | `clawheart-openclaw-runtime/` 下隔离 | `~/.openclaw/` |
| 进程管理 | ClawHeart 直接 spawn + 管道 | 同左 |
| 运行态检测 | TCP 端口检测优先 | TCP 端口 + 进程命令行扫描 |

两路各自独立的状态：`gatewayProcesses.bundled / .external`、`lastGatewayStopEpochMs`、`cachedDashboardUrl`、诊断日志缓冲和文件。

---

## 关键流程

### 启动 Gateway

```
startEmbeddedOpenClaw(mode)
  ├─ 解析 binaryMode (bundled/external)
  ├─ clearCachedDashboardUrl
  ├─ 构建隔离 env (OPENCLAW_STATE_DIR / CONFIG_PATH)
  ├─ checkOpenClawRunning → 已在跑则直接返回
  ├─ clearGatewayDiag → 开始新日志会话
  ├─ [bundled only] initOpenClawConfig + ensureGatewayModeLocal + ensureManagedGatewayPort
  ├─ preemptiveGatewayStopBeforeStart → openclaw gateway stop (释放锁)
  ├─ spawnOpenClawBin / spawn(node, [mjs, ...]) / ...
  ├─ trackGatewayChild → 挂日志 + 记录句柄
  └─ 轮询 probeGatewayReadyAfterSpawn (每 500ms, 最多 45s)
       ├─ [bundled] TCP 端口检测 + 诊断日志
       └─ [external] TCP + 进程扫描 + 诊断日志
```

### 停止 Gateway

```
stopEmbeddedOpenClaw(mode)
  ├─ 记录 lastGatewayStopEpochMs
  ├─ proc.kill() + killProcessTree
  ├─ [Windows] 孤儿进程匹配 + taskkill
  ├─ execOpenClawGatewayStopCli → openclaw gateway stop
  ├─ clearCachedDashboardUrl
  └─ 轮询确认已停止 (每 300ms, 最多 15s)
```

### 获取 Dashboard URL

```
getDashboardUrl(mode)
  ├─ 命中缓存 → 直接返回
  ├─ 停止冷却期内 → 返回基础 URL (不跑 CLI)
  ├─ getUiUrlFromListeningGatewayProcess → lsof 找 config → 读 token
  ├─ getUiUrlFromActiveConfig → 直接读 openclaw.json → token + port
  ├─ execOpenClawBin("openclaw", ["dashboard", "--no-open"]) → 解析输出
  └─ fallback → 默认 URL
```
