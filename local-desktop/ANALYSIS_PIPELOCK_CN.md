# Pipelock 深度分析报告

> **GitHub**: https://github.com/luckyPipewrench/pipelock
> **产品简介**: Pipelock 是一个用 Go 语言编写的企业级 AI Agent 出站安全代理。核心理念是在 Agent 信任边界之外建立可验证的安全控制，提供 11 层 URL 扫描管线、48 种凭据检测模式、MCP 攻击链检测、工具基线冻结、进程沙箱（Landlock/seccomp）、Kill Switch、Ed25519 签名 Evidence Receipt 等能力。采用"能力分离"架构（Agent 无网络权限，Pipelock 无密钥权限），是当前 AI Agent 安全领域最全面的参考实现。

> 项目路径: `/Users/mac/001.code/pipelock`
> 分析日期: 2026-05-15

---

## 1. 项目概览

**Pipelock** 是一个用 Go 语言编写的**企业级 AI Agent 出站安全代理**，核心理念是在 Agent 信任边界之外建立可验证的安全控制。

| 维度 | 数据 |
|------|------|
| 语言 | Go 1.25/1.26 |
| 二进制大小 | ~20MB 静态链接 |
| 许可证 | 核心 Apache 2.0 / 企业 Elastic 2.0 |
| 依赖数 | 22 个直接依赖 |
| DLP 模式 | 48 个内置凭据检测模式 |
| 注入检测 | 25 个提示词注入模式 |
| MCP 工具策略 | 17 个内置规则 |
| MCP 攻击链 | 10 个内置链模式 |

---

## 2. 核心架构

### 2.1 能力分离模型（三区边界）

```
Agent（持有密钥，无网络）
       |
       | 本地 IPC
       |
Pipelock 代理（无密钥，全网络权限）
       |
       | 受控出站
       |
Internet
```

**核心原则**: Agent 是非特权的；Pipelock 设计上零密钥持有。

### 2.2 四传输统一端口

| 传输方式 | 端点 | 用途 |
|---------|------|------|
| **Fetch** | `/fetch?url=...` | 提取 URL 文本，扫描响应中的注入 |
| **Forward** | HTTP CONNECT | 标准代理（via `HTTPS_PROXY`），扫描主机名 |
| **WebSocket** | `/ws?url=...` | 双向帧扫描，含分片重组 |
| **Reverse** | 完整 HTTP 反向代理 | MCP 和 Agent 出站场景 |

### 2.3 11 层 URL 扫描管线

```
Layer 1: Scheme 验证
Layer 2: 黑名单匹配
Layer 3: DLP 扫描（在 DNS 解析之前！）
Layer 4: 路径熵检测
Layer 5: 子域名熵检测
Layer 6: SSRF 防护（私有 IP、元数据服务器、DNS 重绑定）
Layer 7: 速率限制（每域名 60 req/min）
Layer 8: 长度限制
Layer 9: 数据预算（每域名总字节数）
Layer 10: 跨请求检测（分片重组）
Layer 11: 自适应执行（会话威胁评分）
```

**关键设计**: DLP 在 DNS 解析之前运行 -- 防止基于 DNS 的数据外泄。

---

## 3. 核心安全能力

### 3.1 数据防泄露 (DLP)

- **48 个内置凭据模式**: API 密钥、令牌、环境变量、加密货币助记词、金融标识符
- **校验和验证器**: Luhn、Mod97、ABA、WIF
- **熵分析**: 路径、子域名、请求分片的 Shannon 熵
- **BIP-39 助记词检测**: 字典 + 滑动窗口匹配
- **类保留不可逆脱敏**: `<pl:CLASS:N>` 占位符（无保险箱，无可逆性）

### 3.2 提示词注入响应扫描

- **25 个内置注入模式**: 越狱短语、指令操纵、隐蔽指令
- **6 遍归一化管线**: 零宽字符、同形字替换、Leetspeak、Base64 解包
- **SSE 流式支持**: 逐事件扫描（逐 token UX）
- **可配置动作**: block（阻止）、strip（剥离）、warn（警告）、ask（人工审批）

### 3.3 MCP 安全（极高价值）

| 能力 | 说明 |
|------|------|
| **工具策略** | 17 个内置规则阻止破坏性操作、凭据访问、持久化机制 |
| **攻击链检测** | 10 个内置模式（侦察、外泄、持久化序列） |
| **子序列匹配** | 可配置间隙容忍度 -- 插入无害调用不能绕过检测 |
| **工具基线冻结** | 会话内工具清单固定，检测 rug-pull 变化 |
| **重定向处理** | 危险工具可路由到审计包装程序而非直接阻止 |
| **二进制完整性** | 验证 MCP 服务器可执行文件的签名基线 |

### 3.4 进程沙箱

| 平台 | 机制 |
|------|------|
| **Linux** | Landlock LSM（文件系统）+ seccomp（系统调用）+ 网络命名空间 |
| **macOS** | sandbox-exec profiles |
| **容器** | `--best-effort` 模式（Landlock + seccomp，不创建命名空间） |

### 3.5 Kill Switch（4 个独立源）

```
配置文件启用 ─┐
API 激活    ─┤
SIGUSR1 切换 ─┼─→ OR 组合 ─→ 拒绝所有流量
哨兵文件监视 ─┘
```

- 任一激活 = 全部流量拒绝
- 哨兵文件不可读 = 视为激活（失败关闭）
- 可选独立端口（防止 Agent 自我停用）

### 3.6 人工审批 (HITL)

- 终端审批用于 "ask" 动作
- 超时失败关闭（默认 30 秒）
- 非终端 stdin 自动阻止
- 超时后检测过期输入

### 3.7 浏览器防护盾

- 剥离指纹识别、扩展探测、遥测信标、Agent 陷阱
- 三管线: HTML（完整重写）、JS（正则剥离）、SVG（脚本提取）
- 注入 shim 防御指纹/扩展探测

---

## 4. 密码学与签名基础设施

### 4.1 Ed25519 签名贯穿全程

- **中介签名动作收据** (Evidence Receipt v2)
- **JCS 规范化预映像** 上的分离签名
- **密钥名册** 支持轮换和用途授权矩阵

### 4.2 中介信封 (RFC 8941)

```
Pipelock-Mediation HTTP 头:
  action, verdict, side_effect, actor_identity,
  policy_hash, receipt_id, session_taint, task_id
```

### 4.3 证据收据 (Evidence Receipt v2)

- **13 种载荷类型**: proxy_decision, contract_ratified, shadow_delta, opportunity_missing 等
- **哈希链序列**: 防篡改
- **类型安全验证**: 载荷分发注册表

### 4.4 行为合约（Learn-and-Lock）

```
capture_only 模式 → 观察不执行
       |
推断引擎（Wilson 评分区间）→ 学习行为基线
       |
签名提升仪式 → 提交哈希链合约
       |
shadow 模式 → 漂移检测（合约 vs 实际行为）
       |
enforce 模式 → 强制执行
```

---

## 5. 数据模型

### 5.1 扫描结果

```go
type ScanResult struct {
    Allowed      bool
    Reason       string
    Scanner      string
    Hint         string
    AnomalyScore float64    // 0.0-1.0
    ResultClass  ResultClass // Threat|Protective|ConfigMismatch|InfraError|StructuralExemption
    WarnMatches  []Match
}
```

**ResultClass 设计**: 区分真实威胁 vs 防护性阻止 vs 配置问题，防止自适应评分被污染。

### 5.2 会话记录器

- 升级级别: 0=正常, 1=提升, 2=高, 3+=临界
- 信号类型: Block(+3), NearMiss(+1), DomainAnomaly(+2), EntropyBudget(+2), FragmentDLP(+3), Strip(+2)
- 自动衰减: 清洁信号的可配置衰减率

### 5.3 审计事件

- MITRE ATT&CK 技术 ID 映射 (T1048 外泄, T1059 注入, T1195.002 供应链)
- 结构化 JSON 日志
- 会话 ID、行为者、风险评分

---

## 6. 关键设计模式

### 6.1 失败关闭架构

| 场景 | 行为 |
|------|------|
| 解析错误 | 阻止 |
| 超时 | 阻止 |
| 配置缺失 | 阻止 |
| HITL 无响应 | 阻止 |
| 哨兵文件不可读 | Kill Switch 激活 |
| 信封签名失败 | 请求拒绝 |

### 6.2 原子状态管理

- `atomic.Pointer[T]` 用于配置、扫描器、信封发射器快照
- **逐请求快照** 防止 TOCTOU 竞态
- Kill Switch 状态在请求入口时快照

### 6.3 信号分类

- **Threat**: 真实攻击
- **Protective**: 速率限制、数据预算
- **ConfigMismatch**: 域名在允许列表但层级错误
- **InfrastructureError**: DNS 超时、解析器故障
- **StructuralExemption**: 已验证的能力令牌豁免

### 6.4 传输平等验证

特性必须在所有适用传输上验证: fetch、forward、CONNECT、WebSocket、MCP stdio、MCP HTTP/SSE。

---

## 7. 对 ClawHeart v2 的借鉴价值

### 7.1 极高价值（P0）

| 借鉴点 | 说明 |
|--------|------|
| **能力分离模型** | 代理在 Agent 信任边界外运行，零密钥持有 |
| **DLP 在 DNS 前** | 阻止基于 DNS 的数据外泄 |
| **失败关闭默认** | 所有错误路径阻止，包括超时 |
| **信号分类** | 区分威胁 vs 防护性阻止，防止误报污染评分 |
| **MCP 攻击链检测** | 子序列匹配检测多步攻击 |
| **MCP 工具基线冻结** | 会话内工具清单固定 |

### 7.2 高价值（P1）

| 借鉴点 | 说明 |
|--------|------|
| **6 遍注入归一化** | 零宽字符、同形字、Leetspeak、Base64 |
| **自适应会话评分** | 基于信号的升级级别（4 级） |
| **跨请求检测 (CEE)** | 分片重组跨 HTTP 请求检测 |
| **Kill Switch 四源 OR** | 配置+API+信号+哨兵，任一触发 |
| **原子配置热重载** | 逐请求快照，无 TOCTOU 竞态 |
| **Evidence Receipt** | Ed25519 签名的决策证明 |

### 7.3 中等价值（P2）

| 借鉴点 | 说明 |
|--------|------|
| **Learn-and-Lock 合约** | 统计推断行为基线 + 漂移检测 |
| **沙箱执行** | Landlock + seccomp 进程级隔离 |
| **浏览器防护盾** | HTML/JS/SVG 重写剥离指纹/陷阱 |
| **文件哨兵** | 实时文件监控 + DLP 扫描 |
| **HITL 审批** | 人工审批循环 |
| **地址保护** | 加密货币地址替换检测 |

---

## 8. 总结

Pipelock 是当前 AI Agent 安全领域**最全面的参考实现**。其 11 层扫描管线、MCP 攻击链检测、行为合约系统、以及失败关闭的哲学，代表了 AI 安全代理的最高标准。

对 ClawHeart v2 最关键的借鉴是:
1. **能力分离** -- 代理不信任 Agent，零密钥持有
2. **DLP 优先于 DNS** -- 阻止一切外泄尝试
3. **MCP 深度安全** -- 工具策略 + 攻击链 + 基线冻结 + 二进制完整性
4. **信号分类** -- 不将防护性阻止计为威胁
5. **Evidence Receipt** -- 可验证的安全决策证明

---

*分析完成于 2026-05-15*
