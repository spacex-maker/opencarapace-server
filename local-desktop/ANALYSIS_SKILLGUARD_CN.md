# SkillGuard 深度分析报告

> **GitHub**: https://github.com/yangyixxxx/skillguard
> **产品简介**: SkillGuard 是一个本地优先的 AI 技能包安全扫描器，通过纯静态分析检测恶意代码、供应链攻击和提示词注入。内置 72 条安全规则（22 硬阻止 + 50 加权评分），支持 4 个平台适配器（Newmax/OpenClaw/MCP/GPTs），扫描速度 <2 秒，零 LLM 成本。采用"失败关闭"设计 -- 规则加载失败时拒绝返回通过报告。技术栈: TypeScript + pnpm monorepo，CLI 打包仅 ~300KB。

> 项目路径: `/Users/mac/001.code/skillguard`
> 分析日期: 2026-05-15

---

## 1. 项目概览

**SkillGuard** 是一个本地优先的 AI 技能包安全扫描器，支持 Anthropic Skills、Newmax、OpenClaw、MCP、GPTs Actions 等多平台。

| 维度 | 数据 |
|------|------|
| 语言 | TypeScript 5.9.3 (ESM, strict) |
| 运行时 | Node.js >= 20 |
| 架构 | pnpm monorepo |
| 内置规则 | **72 条**（22 硬阻止 + 50 加权规则） |
| 扫描速度 | <2 秒本地扫描，零 LLM 成本 |
| 平台适配器 | 4 个（Newmax、OpenClaw、MCP、GPTs） |
| 输出格式 | 终端、JSON、SARIF |
| 许可证 | Apache-2.0 |
| CLI 大小 | ~300KB（esbuild 打包） |

---

## 2. 架构设计

### 2.1 多层防御策略

```
Layer 0（结构分析）
  | 文件数/大小限制、符号链接检测、二进制检测、YAML 前置数据验证
  ↓
Layer 1（规则引擎）
  | 72 正则模式: 22 硬阻止 + 50 加权规则，上下文感知
  ↓
Layer 2（依赖分析）
  | 提取 Python/Node/Cargo 导入、环境变量引用 → 仿冒检测
  ↓
报告生成
  | 聚合发现、计算安全评分 (0-100)、风险等级分类
```

### 2.2 Monorepo 结构

```
skillguard/
├── packages/
│   ├── core/           # @aspect/skill-guard 核心扫描引擎
│   │   └── src/
│   │       ├── adapter/     # PlatformAdapter 接口 + 自动检测
│   │       ├── analyzers/   # 结构、依赖、环境变量、权限、归一化、前置数据
│   │       ├── config/      # 默认阈值和限制
│   │       ├── engine/      # 规则加载器、规则引擎、规则类型
│   │       ├── report/      # 报告构建器、SARIF、元数据卡
│   │       ├── scanner.ts   # 主编排器 (scanBundle)
│   │       └── sdk.ts       # 公共 API (SkillGuard 类)
│   ├── adapters/
│   │   ├── newmax/     # Newmax 平台适配器
│   │   ├── openclaw/   # OpenClaw 平台适配器
│   │   ├── mcp/        # MCP Server 适配器
│   │   └── gpts/       # GPTs Actions 适配器
│   └── cli/            # CLI 工具
├── rules/
│   ├── base/           # 硬触发器 + 通用规则
│   ├── definitions/    # 按类别拆分的规则定义
│   └── whitelist/      # 已知安全包白名单
```

---

## 3. 规则系统详解

### 3.1 硬触发器（22 条 -- 立即阻止）

| 规则 | 模式 | 说明 |
|------|------|------|
| RM_RF_ROOT | `rm -rf /` | 根目录删除 |
| CURL_PIPE_SH | `curl \| bash` | RCE 链 |
| READ_SHADOW | `cat /etc/shadow` | 凭据窃取 |
| READ_SSH_KEY | `cat ~/.ssh/id_rsa` | 密钥窃取 |
| READ_AWS_CREDS | `cat ~/.aws/credentials` | AWS 凭据窃取 |
| HARDCODED_SK_KEY | `sk-...` 模式 | Anthropic API 密钥 |
| HARDCODED_GITHUB_PAT | `ghp_...` 模式 | GitHub 令牌 |
| EVAL_INJECTION | `eval(input)` | 代码注入 |
| EXEC_INJECTION | `exec(input)` | 执行注入 |
| ... | ... | 共 22 条 |

### 3.2 加权规则（50 条 -- 扣分制）

**评分公式**: `deduction = weight × (1 - 0.5^count) / (1 - 0.5)`

| 类别 | 规则数 | 示例 | 权重范围 |
|------|--------|------|---------|
| 命令注入 | 6 | `os.system()`, `subprocess(shell=True)` | 6-20 |
| 密钥检测 | 7 | AWS Key(80), JWT(75), DB连接串(70) | 50-80 |
| 网络外泄 | 6 | DNS 外泄模式(65), ICMP 原始套接字(60) | 3-65 |
| 权限提升 | 2 | `chmod 777`(55), `sudo`(3) | 3-55 |
| 持久化 | 3 | crontab(65), 注册表(70), 计划任务(70) | 65-70 |
| 其他 | 4 | pickle 反序列化(40), YAML 类型注入(80) | 40-80 |

### 3.3 智能过滤

- **上下文感知**: `context: exec` 跳过 `.md` 文件; `context: mention` 仅 `.md` 文件
- **扩展名过滤**: `extensions: [".py"]` 仅 Python 文件
- **值级排除**: `excludeValuePattern` 跳过占位符 (`${ENV}`, `xxxx`, `your-api-key`)
- **熵过滤**: `minValueEntropy: 3.5` Shannon 熵阈值（低熵 = 假阳性）

### 3.4 风险等级映射

| 评分 | 等级 | 操作 |
|------|------|------|
| >= 90 | Safe | 通过 |
| >= 70 | Low | 通过（带提示） |
| >= 50 | Medium | 通过（带警告） |
| >= 30 | High | 通过（需审核） |
| < 30 | Critical | **阻止**（默认阈值） |

---

## 4. 适配器模式

### 4.1 PlatformAdapter 接口

```typescript
interface PlatformAdapter {
  id: string;
  parseBundle(input): Promise<ParsedBundle>;
  extractMetadata(bundle): Promise<ExtensionMetadata>;
  extractDependencies(bundle): Promise<Dependency[]>;
  extractEnvRefs(bundle): Promise<EnvRef[]>;
}
```

### 4.2 自动检测逻辑

```
1. SKILL.md + scripts/ → OpenClawAdapter
2. SKILL.md（无 scripts/） → NewmaxAdapter
3. package.json/pyproject.toml + MCP 依赖 → McpAdapter
4. openapi.json/yaml → GptsAdapter
5. 兜底: 第一个注册的适配器
```

### 4.3 各适配器特点

| 适配器 | 检测标志 | 元数据来源 | 依赖提取 |
|--------|---------|-----------|---------|
| **Newmax** | `SKILL.md`（无 scripts/） | YAML 前置数据 | Python/Node/Shell |
| **OpenClaw** | `SKILL.md` + `scripts/` | YAML 前置数据 | 通用提取 |
| **MCP** | `package.json` + `@modelcontextprotocol/sdk` | npm/pyproject 解析 | `.tool()` 调用提取 |
| **GPTs** | `openapi.json/yaml` | OpenAPI spec | Server URLs |

---

## 5. 代码归一化（反混淆）

```typescript
// analyzers/normalizer.ts 去混淆技术:
1. Base64 解码: Buffer.from(encoded, 'base64')
2. 十六进制转义: \x41 → A
3. 字符码拼接: chr(72) + chr(105) → "Hi"
4. 字符串拼接: "foo" + "bar" → "foobar"
5. 动态导入: __import__('os') → import os
```

---

## 6. 失败关闭设计

| 场景 | 行为 |
|------|------|
| 规则加载失败 | HTTP 503，拒绝返回通过报告 |
| 扫描超时 | HTTP 503（"宁可阻止也不放行"） |
| 解析错误 | 4xx/5xx 传播 |
| 绝不返回 | 假阳性的"绿色通过" |

---

## 7. 对 ClawHeart v2 的借鉴价值

### 7.1 极高价值

| 借鉴点 | 说明 |
|--------|------|
| **技能预发布网关** | 安装前自动扫描，拒绝硬触发器或低评分技能 |
| **加权评分系统** | 指数衰减公式，多处命中递减扣分 |
| **上下文感知规则** | 区分代码文件 vs 文档文件中的模式匹配 |
| **适配器模式** | 单引擎多平台，可扩展新平台 |
| **allowed-tools 执行** | YAML 前置数据中声明允许的工具白名单 |

### 7.2 高价值

| 借鉴点 | 说明 |
|--------|------|
| **SARIF 输出** | GitHub Code Scanning 集成 |
| **依赖追踪** | 识别所需包（供应链审查） |
| **环境变量提取** | 记录技能需要的环境变量 |
| **熵过滤** | 减少密钥检测假阳性 |
| **代码归一化** | 击败基本混淆手段 |

### 7.3 集成方案

```
ClawHeart v2 技能治理管线:

用户安装技能 → SkillGuard 扫描 → 评分 >= 30?
     |              |                    |
     |              |              Yes: 安装成功
     |              |                    |
     |              |              No: 阻止 + 展示原因
     |              |
     |         硬触发器命中?
     |              |
     |         Yes: 立即阻止
```

---

## 8. 总结

SkillGuard 是一个**成熟的生产级安全扫描器**，为 ClawHeart v2 的技能治理提供了关键的"预发布安全门禁"能力。其 72 条规则、上下文感知匹配、加权评分、多平台适配器的组合，使其成为可信技能市场的理想基础。

核心借鉴: **规则系统设计（硬触发 + 加权评分 + 上下文 + 熵过滤）** 和 **适配器模式（单引擎多平台）**。

---

*分析完成于 2026-05-15*
