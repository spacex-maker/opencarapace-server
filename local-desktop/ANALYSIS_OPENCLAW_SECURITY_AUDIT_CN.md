# OpenClaw Security Audit 深度分析报告

> **GitHub**: https://github.com/zast-ai/openclaw-security-audit
> **产品简介**: OpenClaw Security Audit 是一套针对 OpenClaw 实例的全面确定性安全审计工具。覆盖 12 个攻击面、80 项确定性检查、27 个 MITRE ATLAS 威胁 ID 映射。零 LLM 依赖，100% 可复现结果。基于 Python 标准库 + CLI 命令实现，支持终端彩色输出、Markdown 报告、JSON（CI/CD 集成）和自动修复脚本四种输出格式。参考 ZAST.AI Security Handbook 编写。

> 项目路径: `/Users/mac/001.code/openclaw-security-audit`
> 分析日期: 2026-05-15

---

## 1. 项目概览

**OpenClaw Security Audit v1.0.0** 是一套针对 OpenClaw 实例的全面确定性安全审计工具。

| 维度 | 数据 |
|------|------|
| 语言 | Python 3.8+（仅使用标准库 + CLI 命令） |
| 检查项总数 | **80 个**确定性检查 |
| 攻击面覆盖 | **12 个**攻击面 |
| 威胁ID映射 | **27 个**官方威胁 ID（MITRE ATLAS 框架） |
| LLM 依赖 | **零** -- 所有检查均为确定性规则 |
| 部署目标 | 本地实例、Docker 容器、远程端口扫描 |
| 输出格式 | 终端彩色输出、Markdown 报告、JSON（CI/CD 集成） |

---

## 2. 架构设计

### 2.1 模块化插件架构

```
openclaw_audit.py          -- 主编排器（加载模块、检测环境、执行检查）
utils.py                   -- 共享工具（严重级别/状态常量、命令执行、文件操作）
report_generator.py        -- 多格式输出生成器（终端、Markdown、JSON、修复脚本）
scripts/checks/
  01_file_permissions.py   -- 文件系统与权限检查 (10 项)
  02_gateway_config.py     -- 网关配置检查 (13 项)
  03_network_exposure.py   -- 网络暴露检查 (9 项)
  04_channel_config.py     -- 通道配置检查 (9 项)
  05_credential_leak.py    -- 凭据泄露检测 (8 项)
  06_skill_supply_chain.py -- 技能供应链审计 (12 项)
  07_sandbox_docker.py     -- 沙箱与 Docker 检查 (11 项)
  08_session_memory.py     -- 会话与记忆检查 (5 项)
  09_agent_behavior.py     -- Agent 行为检查 (8 项)
  10_system_persistence.py -- 系统持久化检查 (4 项)
  11_windows_specific.py   -- Windows 特定检查 (2 项)
```

### 2.2 执行流程

```
1. 环境检测（OS、OpenClaw 版本、Docker 可用性）
       |
2. 模块加载（选择性或全部 11 个模块）
       |
3. 检查执行（每项返回标准化结果字典）
       |
4. 结果聚合与过滤
       |
5. 多格式报告生成
```

### 2.3 标准化结果结构

每项检查返回统一字典：

```python
{
    "id": "FP-001",                    # 检查标识符
    "name": "~/.openclaw/ 目录权限",     # 人类可读名称
    "severity": "CRITICAL",            # CRITICAL | HIGH | MEDIUM | INFO
    "status": "FAIL",                  # PASS | FAIL | WARN | SKIP | ERROR
    "detail": "权限为 755，应为 700",     # 发现描述
    "threat_ids": ["AS-7"],            # 攻击面 ID
    "threat_refs": ["T-ACCESS-001"],   # 威胁映射 ID
    "handbook_ref": "§2.1",            # ZAST.AI 手册章节
    "fix_cmd": "chmod 700 ~/.openclaw", # 自动修复命令
    "evidence": "drwxr-xr-x",         # 具体证据
    "confidence": "HIGH"               # HIGH | MEDIUM | LOW
}
```

---

## 3. 12 个攻击面详解

| # | 攻击面 | 核心威胁 | 检查数 |
|---|--------|---------|--------|
| AS-1 | 网关暴露 | 认证绕过、令牌窃取、调试信息泄露 | 22 |
| AS-2 | 消息通道 | DM/群组模式的提示词注入 | 9 |
| AS-3 | 提示词注入 | 记忆投毒、系统提示词覆盖 | 3 |
| AS-4 | 商业文档注入 | 隐藏文本/注释/OCR 攻击 | 1 |
| AS-5 | 技能与供应链 | 恶意技能安装、供应链妥协 | 12 |
| AS-6 | 数据泄露 | 凭据窃取、会话日志泄露 | 8 |
| AS-7 | 文件系统与凭据 | 权限错误、云同步暴露 | 10 |
| AS-8 | 沙箱逃逸 | Docker socket、capabilities、危险挂载 | 11 |
| AS-9 | 网络/SSRF | 端口绑定、网络隔离、代理变量 | 2 |
| AS-10 | Agent 行为滥用 | 无限制执行、金融 API 滥用 | 8 |
| AS-11 | CI/CD 供应链 | Docker 镜像来源、npm audit | 2 |
| AS-12 | Windows 特定 | CVE-2024-27980、.bat/.cmd PATH 注入 | 2 |

---

## 4. 核心检查模块分析

### 4.1 文件系统与权限 (FP-001 ~ FP-010)

| 检查 | 严重级别 | 检查内容 |
|------|---------|---------|
| FP-001 | CRITICAL | `~/.openclaw/` 目录权限必须为 700 |
| FP-002 | CRITICAL | `credentials/` 目录权限必须为 700 |
| FP-003 | CRITICAL | `.env` 文件权限必须为 600 |
| FP-004 | CRITICAL | `openclaw.json` 权限必须为 600（防热重载篡改） |
| FP-005 | HIGH | `sessions/` 目录权限必须为 700 |
| FP-006 | MEDIUM | 附件文件权限扫描（sessions, attachments, uploads 等） |
| FP-007 | INFO | 配置文件不可变标志（chattr +i / chflags uchg） |
| FP-008 | HIGH | OpenClaw 不在云同步目录中（iCloud, OneDrive, Dropbox 等） |
| FP-009 | HIGH | OpenClaw 不被 Git 追踪 |
| FP-010 | HIGH | 用户不在特权组（docker/sudo/wheel/admin） |

### 4.2 技能供应链审计 (SK-001 ~ SK-012) [最复杂模块]

| 检查 | 严重级别 | 检查内容 |
|------|---------|---------|
| SK-001 | MEDIUM | 已安装技能清单 |
| SK-002 | CRITICAL | 危险函数使用（eval, exec, spawn, __import__） |
| SK-003 | HIGH | 凭据提取模式（process.env, fetch 外泄模式） |
| SK-004 | CRITICAL | 恶意 npm 依赖检测 |
| SK-005 | HIGH | **混淆代码检测（同形异义字符、零宽字符）** |
| SK-006 | MEDIUM | 压缩代码分析（.min.js, UglifyJS 输出） |
| SK-007 | HIGH | 隐藏文件模式检测（技能根目录中的 dotfiles） |
| SK-008 | HIGH | **分阶段/多态载荷检测**（动态代码加载模式） |
| SK-009 | MEDIUM | 技能自动更新机制检测 |
| SK-010 | CRITICAL | **权限提升模式**（父进程访问、__dirname 遍历） |
| SK-011 | HIGH | npm audit CVE 检测 |
| SK-012 | MEDIUM | 许可证合规检查 |

### 4.3 凭据泄露检测 (CL-001 ~ CL-008)

关键检测模式：

```
API 密钥格式: sk-ant-, sk-[A-Za-z0-9]{20,}, AKIA[A-Z0-9]{12,}, ghp_, xox
会话日志: password=, secret=, private_key= (赋值上下文)
调试日志: Bearer 令牌, Set-Cookie, Authorization 头, OAuth 令牌
Shell 历史: ~/.zsh_history, ~/.bash_history 中的令牌模式
Base64 编码: 绕过 sanitize-env-vars.ts 的编码密钥
```

### 4.4 沙箱与 Docker (SB-001 ~ SB-011)

通过 `docker inspect` JSON 解析进行全面容器审计：
- Docker socket 挂载检测
- 网络模式隔离验证（NetworkMode != "host"）
- 出站网络限制（Internal=true）
- 危险 capabilities 检测（ALL/SYS_ADMIN/NET_ADMIN）
- seccomp 配置验证
- 危险路径挂载（/etc, /proc, /sys, /dev, /root）
- SLSA 溯源标签检测

### 4.5 记忆投毒检测 (SM-001)

```python
# MEMORY.md 注入模式检测:
patterns = [
    "ignore instruction",    # 指令覆盖
    "system prompt",         # 系统提示词提取
    "curl|fetch|wget",       # 数据外泄
    "eval|exec",             # 代码执行
    "\\x[0-9a-f]{2}",       # 十六进制转义
    "base64"                 # Base64 编码载荷
]
```

---

## 5. 核心技术实现

### 5.1 跨平台支持

| 能力 | macOS | Linux | Windows |
|------|-------|-------|---------|
| 端口检测 | `lsof` | `ss` / `netstat` | PowerShell |
| 文件锁定 | `chflags uchg` | `chattr +i` | -- |
| 持久化检测 | `launchctl` | `systemctl` | -- |
| Node.js CVE | `node --version` | 同左 | 同左 |

### 5.2 检测方法论

- **文件系统**: `os.stat()`, `os.walk()`, `pathlib`
- **进程**: `lsof`, `ss`, `pgrep`, `ps`
- **容器**: `docker inspect`, `docker network inspect`, `docker exec`
- **配置**: JSON 解析（带 JS 注释剥离）, YAML, .env
- **代码**: grep 正则模式匹配（BRE/ERE）
- **依赖**: `npm audit --json`, `npm list`
- **网络**: `curl` 可达性测试

### 5.3 置信度评分

- **HIGH**: 来自配置检查或文件系统状态的具体证据（FAIL, ERROR, PASS, SKIP）
- **MEDIUM**: 启发式匹配或模式检测（WARN）
- **LOW**: 标记为 `[Advisory]` 的建议项（需人工审查）

---

## 6. 对 ClawHeart v2 的借鉴价值

### 6.1 高价值借鉴

#### A. 模块化检查架构 [极高价值]

11 个模块、80 项检查的组织方式非常适合 ClawHeart v2 的安全扫描：

```rust
// ClawHeart v2 安全扫描器可以采用类似架构:
pub trait SecurityCheckModule {
    fn module_id(&self) -> &str;
    fn checks(&self) -> Vec<Box<dyn SecurityCheck>>;
}

pub trait SecurityCheck {
    fn id(&self) -> &str;
    fn severity(&self) -> Severity;
    fn execute(&self, ctx: &AuditContext) -> CheckResult;
}

// 模块示例:
pub struct FilePermissionModule;      // 对应 Module 01
pub struct CredentialLeakModule;       // 对应 Module 05
pub struct SkillSupplyChainModule;     // 对应 Module 06
pub struct AgentBehaviorModule;        // 对应 Module 09
```

#### B. 标准化结果结构 [高价值]

统一的检查结果格式（id, severity, status, evidence, fix_cmd, threat_refs）应直接纳入 ClawHeart v2 的数据库 schema:

```sql
-- ClawHeart v2: intercept_events 表可以借鉴此结构
CREATE TABLE scan_findings (
    id INTEGER PRIMARY KEY,
    check_id TEXT NOT NULL,        -- "FP-001"
    check_name TEXT NOT NULL,
    severity TEXT NOT NULL,        -- CRITICAL|HIGH|MEDIUM|INFO
    status TEXT NOT NULL,          -- PASS|FAIL|WARN|SKIP|ERROR
    detail TEXT NOT NULL,
    evidence TEXT,
    fix_cmd TEXT,
    threat_ids TEXT,               -- JSON array: ["AS-7"]
    confidence TEXT DEFAULT 'HIGH',
    scan_run_id INTEGER,
    created_at TEXT NOT NULL
);
```

#### C. 技能供应链扫描 [高价值]

Module 06 的技能安全扫描逻辑与 ClawHeart 的技能治理高度相关：

- **SK-002**: 危险函数检测 -> ClawHeart 可在技能安装时自动扫描
- **SK-005**: 同形异义字符检测 -> 防范 Unicode 混淆攻击
- **SK-008**: 分阶段载荷检测 -> 防范供应链攻击
- **SK-010**: 权限提升模式 -> 沙箱逃逸防护

#### D. 凭据模式库 [高价值]

CL 模块的正则模式库可以直接移植到 ClawHeart v2 的 `redact.rs`:

```rust
pub static CREDENTIAL_PATTERNS: &[(&str, &str)] = &[
    ("sk-ant-[A-Za-z0-9_-]{20,}", "Anthropic API Key"),
    ("sk-[A-Za-z0-9]{20,}", "OpenAI API Key"),
    ("AKIA[A-Z0-9]{12,}", "AWS Access Key"),
    ("ghp_[A-Za-z0-9]{36}", "GitHub Token"),
    ("xox[baprs]-[A-Za-z0-9-]+", "Slack Token"),
    ("Bearer\\s+[A-Za-z0-9._-]{20,}", "Bearer Token"),
];
```

### 6.2 中等价值借鉴

#### E. 攻击面分类法

12 个攻击面的分类体系可以作为 ClawHeart 安全扫描的组织框架。

#### F. 多格式输出

终端 + Markdown + JSON + 修复脚本的四格式输出模式，适用于 ClawHeart 的扫描结果展示。

#### G. 记忆投毒检测

MEMORY.md 注入模式检测（SM-001）与 ClawHeart 的 MCP 安全检查相关。

### 6.3 低价值借鉴

- **Docker/沙箱检查**: ClawHeart 主要面向桌面用户，Docker 检查场景有限
- **Windows 特定检查**: 覆盖面窄（仅 2 项）
- **网关配置检查**: 与 ClawHeart 架构不直接对应

---

## 7. 关键数据资产

### 参考资料
- `reference/threat_model.json`: 80 项检查的完整威胁模型映射
- `SKILL.md`: 作为 OpenClaw 技能的集成规范
- 基于 ZAST.AI Security Handbook 的章节交叉引用

### 可复用资产
- **正则模式库**: 凭据检测、危险函数、混淆代码检测模式
- **检查清单**: 80 项检查可作为 ClawHeart 安全扫描的参考基线
- **威胁分类**: 12 攻击面 + 27 威胁 ID 的分类体系

---

## 8. 总结

OpenClaw Security Audit 是一个**生产级、纵深防御**的安全扫描框架。对 ClawHeart v2 最大的借鉴价值在于：

1. **模块化检查架构** -- 11 模块 80 检查的组织方式
2. **标准化结果结构** -- 统一的 severity/status/evidence/fix_cmd 字段
3. **技能供应链扫描** -- 同形异义字符、分阶段载荷、权限提升检测
4. **凭据正则模式库** -- 可直接移植到 Rust 脱敏引擎

该工具的核心理念 -- **确定性、零 LLM 依赖、可复现** -- 与 ClawHeart v2 的安全扫描设计高度一致。

---

*分析完成于 2026-05-15*
