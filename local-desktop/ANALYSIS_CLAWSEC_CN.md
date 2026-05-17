# ClawSec 深度分析报告

> **GitHub**: https://github.com/prompt-security/clawsec
> **产品简介**: ClawSec 是一个面向多 AI Agent 平台（OpenClaw/NanoClaw/Hermes/Picoclaw）的安全技能生态系统，包含 16 个模块化安全技能（流量守护、完整性检测、供应链验证、安全公告、自渗透测试等）。提供 Ed25519 签名的安全公告 feed（每日 NVD CVE 轮询 + 社区驱动报告），配备 React 前端目录浏览器和完整的 CI/CD 发布管线。技术栈: React 19 + Node.js + Ed25519 签名链。

> 项目路径: `/Users/mac/001.code/clawsec`
> 分析日期: 2026-05-15

---

## 1. 项目概览

**ClawSec** 是一个面向多 AI Agent 平台的安全技能生态系统，提供统一安全监控、完整性验证、威胁情报和自动合规检查。

| 维度 | 数据 |
|------|------|
| 技能数 | **16 个**安全技能 |
| 支持平台 | OpenClaw、NanoClaw、Hermes、Picoclaw |
| 前端 | React 19 + Vite + Tailwind CSS |
| 签名 | Ed25519（单密钥对全局签名） |
| 威胁情报 | 每日 NVD CVE 轮询 + 社区驱动公告 |
| 许可证 | AGPL-3.0-or-later |

---

## 2. 架构设计

### 2.1 前端

```
React 19 + TypeScript + Vite
Hash 路由: #/skills, #/feed/:advisoryId, #/wiki/*
7 个路由: Home, SkillsCatalog, SkillDetail, FeedSetup, AdvisoryDetail, ProductDemo, WikiBrowser
8 个 UI 组件: AdvisoryCard, SkillCard, CodeBlock, Header, Footer 等
```

### 2.2 技能系统标准结构

```
skills/<name>/
  skill.json              # 元数据 + SBOM（必须）
  SKILL.md                # Agent 可读安装指南
  CHANGELOG.md            # 版本历史
  scripts/                # 执行脚本 (.sh, .mjs, .py)
  hooks/                  # OpenClaw 事件处理器
  lib/                    # 共享库
  test/                   # 本地测试
```

---

## 3. 16 个安全技能清单

| 技能 | 平台 | 类型 | 核心能力 |
|------|------|------|---------|
| **clawsec-suite** | OpenClaw | 元技能 | 公告守护钩子 + 受保护安装器 + 技能发现 |
| **clawsec-feed** | OpenClaw | 公告 | 独立公告订阅源 |
| **soul-guardian** | OpenClaw | 完整性 | 文件漂移检测 + 自动恢复 (SOUL.md, AGENTS.md) |
| **openclaw-audit-watchdog** | OpenClaw | 审计 | 每日自动审计 + DM/邮件报告 + cron |
| **clawsec-scanner** | OpenClaw | 扫描 | 依赖 + SAST + DAST + CVE 多数据库查询 |
| **clawsec-clawhub-checker** | OpenClaw | 安装门禁 | ClawHub 信誉验证（VirusTotal 支持） |
| **clawtributor** | OpenClaw | 报告 | 社区事件报告（需批准） |
| **clawsec-nanoclaw** | NanoClaw | 套件 | MCP 工具 + 公告源 + 签名验证 + 完整性 |
| **hermes-attestation-guardian** | Hermes | 证明 | 确定性态势工件 + 漂移严重性分类 |
| **hermes-traffic-guardian** | Hermes | 流量监控 | 代理检查 + 出站检测（规格基线） |
| **nanoclaw-traffic-guardian** | NanoClaw | 流量监控 | MCP 状态工具（规格基线） |
| **openclaw-traffic-guardian** | OpenClaw | 流量监控 | HTTP/HTTPS 代理检查（规格基线） |
| **picoclaw-security-guardian** | Picoclaw | 守护 | 公告感知 + 漂移检测 + 供应链验证 |
| **picoclaw-self-pen-testing** | Picoclaw | 安全 | Picoclaw 网关自测试 |
| **picoclaw-traffic-guardian** | Picoclaw | 流量监控 | 轻量级网关 + 配置文件导出 |
| **claw-release** | OpenClaw | 工具 | 发布自动化 |

---

## 4. 安全公告系统

### 4.1 公告源架构

```json
{
  "version": "0.0.3",
  "advisories": [{
    "id": "CVE-2026-8305",
    "severity": "critical",
    "type": "vulnerable_skill",
    "affected": ["skill-name@1.0.0"],
    "platforms": ["openclaw", "nanoclaw"],
    "cvss_score": 7.3,
    "exploitability_score": "high",
    "attack_vector_analysis": {
      "is_network_accessible": true,
      "requires_authentication": false,
      "complexity": "low"
    },
    "exploit_detection": {
      "exploit_available": true,
      "exploit_sources": ["metasploit"]
    }
  }]
}
```

### 4.2 公告生命周期

```
1. NVD CVE 轮询（每日 06:00 UTC）
   | 监控关键词: OpenClaw, NanoClaw, Picoclaw 等
   | 利用性上下文增强
   ↓
2. 社区公告摄入（GitHub Issues + advisory-approved 标签）
   | 格式: CLAW-{YEAR}-{ISSUE#}
   ↓
3. Ed25519 签名 + 分发
   | feed.json + feed.json.sig
   ↓
4. 客户端验证
   | 加载 → 验签 → 解析（签名无效则失败关闭）
```

### 4.3 公告匹配流程

```
1. 加载已安装技能列表 (~/.openclaw/skills/)
2. 交叉引用公告 affected[] 与已安装技能名 + 版本
3. 分类: malicious_skill → 移除建议, vulnerable_skill → 更新建议
4. 去重（状态文件，300 秒间隔内不重复告警）
5. 发布告警消息
```

---

## 5. 密码学信任模型

### 5.1 Ed25519 签名策略

- **单密钥对全局**: 私钥在 GitHub Secret，公钥固定在 3 个位置
- **指纹**: `711424e4535f84093fefb024cd1ca4ec87439e53907b305b79a631d5befba9c8`
- **CI 漂移守护**: 每次 PR/标签推送验证 3 个公钥位置一致性

### 5.2 验证流程

```
加载 feed → 加载 .sig → 加载公钥 PEM
→ openssl pkeyutl -verify（Ed25519）
→ 签名无效 = 失败关闭（空 feed，无告警）
→ 可选: 校验和清单验证（逐文件 SHA-256）
→ 签名验证后才解析 JSON
```

---

## 6. MCP 工具集成（NanoClaw）

```
MCP 工具:
  clawsec_check_advisories      # 检查 feed vs 已安装技能
  clawsec_check_skill_safety    # 安装前安全检查
  clawsec_list_advisories       # 列出可用公告
  clawsec_refresh_cache         # 获取新公告源
  clawsec_verify_skill_package  # 验证技能包签名
  clawsec_check_integrity       # 文件完整性状态
  clawsec_approve_change        # 显式漂移批准
  clawsec_integrity_status      # 完整性监控报告
```

---

## 7. 流量守护模式（Traffic Guardian）

所有流量守护在 v0.0.1-beta2，仅规格基线：

| 能力 | 状态 |
|------|------|
| 运行时流量监控 | 规格基线 |
| HTTP 代理检查 | 计划中 |
| HTTPS MITM 检查 | 计划中（可选） |
| 出站外泄检测 | 计划中 |
| 入站注入检测 | 计划中 |
| 阻止能力 | 未来版本 |

**安全护栏**:
- 不自动安装系统级 CA
- 保持检测+记录模式（v0.0.1 不阻止）
- 记录前脱敏密钥
- 仅限于 OpenClaw 进程范围

---

## 8. CI/CD 管线

| 工作流 | 触发器 | 功能 |
|--------|--------|------|
| `ci.yml` | PR/push to main | Lint、Trivy、npm audit、测试、构建 |
| `skill-release.yml` | Tag `*-v*.*.*` | 签名校验和、发布 releases |
| `deploy-pages.yml` | CI/Release 成功后 | 构建前端 + 目录，部署 GitHub Pages |
| `poll-nvd-cves.yml` | 每日 06:00 UTC | 轮询 NVD、更新 feed.json + 签名 |
| `community-advisory.yml` | Issue 标签 `advisory-approved` | 处理社区报告 → CLAW-YYYY-NNNN |
| `codeql.yml` | 定期 + PR | CodeQL 安全分析 |
| `scorecard.yml` | 定期 | OpenSSF Scorecard |

---

## 9. 对 ClawHeart v2 的借鉴价值

### 9.1 极高价值

| 借鉴点 | 说明 |
|--------|------|
| **安全公告系统** | Ed25519 签名 + NVD 轮询 + 社区报告的完整威胁情报管线 |
| **技能标准结构** | `skill.json` + `SKILL.md` 的标准化技能包格式 |
| **失败关闭验证** | 签名无效则拒绝，无法绕过 |
| **多平台适配** | 同一技能格式支持 4 个平台，可扩展 ClawHeart |

### 9.2 高价值

| 借鉴点 | 说明 |
|--------|------|
| **漂移检测** | soul-guardian 的文件漂移 + 自动恢复模式 |
| **MCP 工具架构** | NanoClaw 的 MCP 工具集成模式 |
| **Hook 事件系统** | OpenClaw 的 agent:bootstrap / command:new 事件处理 |
| **安装门禁** | 两阶段安装器（exit code 42 = 公告匹配） |

### 9.3 中等价值

| 借鉴点 | 说明 |
|--------|------|
| **流量守护规格** | 未来 ClawHeart 流量监控的参考基线 |
| **证明系统** | Hermes 的确定性态势工件 |
| **自渗透测试** | Picoclaw 的自测试模式 |

---

## 10. 总结

ClawSec 是一个**生产级安全技能生态系统**，其 16 个模块化技能覆盖了从威胁情报到流量监控的完整安全栈。对 ClawHeart v2 最大的价值在于其**安全公告系统**（Ed25519 签名 + NVD + 社区）和**标准化技能包格式**，这两者可以直接集成为 ClawHeart 技能市场的信任基础设施。

---

*分析完成于 2026-05-15*
