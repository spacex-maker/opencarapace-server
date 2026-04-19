# ClawHeart 接管 OpenClaw 后退出不彻底导致原生 OpenClaw 冲突问题说明

> 反馈日期：2026-04-19
> 反馈人：ferdinandji
> 问题类型：接管/退出回滚异常、后台进程残留、原生 OpenClaw 运行冲突
> 影响范围：本机已安装原生 OpenClaw，且曾被 ClawHeart 接管的用户

---

## 一、问题概述

在本机已安装并长期使用原生 `OpenClaw` 的前提下，曾使用 `ClawHeart Desktop` 对本机 `OpenClaw` 进行接管测试。

之后，用户手动关闭了 `ClawHeart Desktop`，但其接管期间启动的内嵌 `OpenClaw runtime` 未被完整退出，仍作为后台进程残留在系统中。

这导致系统中同时存在两套 `OpenClaw` 运行环境：

1. **原生 OpenClaw**（用户自行安装）
2. **ClawHeart 内嵌 OpenClaw runtime**（接管期间由 ClawHeart 拉起）

最终表现为：
- 用户尝试通过原生命令重启/恢复 `OpenClaw` 时，状态异常
- 表面上看像是“原生 OpenClaw 启动失败”或“启动后行为不对”
- 实际根因是 `ClawHeart` 退出不彻底，残留 runtime 与原生环境并存，造成接管关系未完整释放

---

## 二、测试环境

### 2.1 用户原生 OpenClaw 环境

- 原生 `OpenClaw` 命令路径：`/Users/ferdinandji/.local/bin/openclaw`
- 原生网关 LaunchAgent：`/Users/ferdinandji/Library/LaunchAgents/ai.openclaw.gateway.plist`
- 原生配置文件：`/Users/ferdinandji/.openclaw/openclaw.json`
- 原生网关端口：`18789`

### 2.2 ClawHeart 接管后的内嵌运行时

- ClawHeart 应用进程：`/Applications/ClawHeart Desktop.app/Contents/MacOS/ClawHeart Desktop`
- ClawHeart runtime 配置：`/Users/ferdinandji/Library/Application Support/@clawheart/local-desktop/clawheart-openclaw-runtime/openclaw.json`
- ClawHeart 内嵌网关端口：`19278`
- 同时伴随其他本地监听端口：`19280`、`19281`

---

## 三、问题现象

### 3.1 用户主观感知

用户关闭 `ClawHeart Desktop` 后，希望恢复使用原生命令：

```bash
openclaw gateway restart
```

但此时系统行为异常，表现为：
- 原生 `OpenClaw` 看起来“起不来”
- 或者“虽然有启动提示，但实际仍不正常”
- 用户难以判断当前到底是哪一套 `OpenClaw` 在工作

### 3.2 实际检查结果

排查发现，系统中实际同时存在两套 runtime：

- **原生 OpenClaw 网关**：监听 `18789`
- **ClawHeart 内嵌 OpenClaw 网关**：监听 `19278`

也就是说，`ClawHeart` 关闭后，其内嵌 runtime 并未随主程序一起退出，而是继续常驻后台。

---

## 四、复现路径

### 4.1 复现步骤

1. 用户机器上已安装并可正常使用原生 `OpenClaw`
2. 启动 `ClawHeart Desktop`
3. 让 `ClawHeart` 接管本机 `OpenClaw`
4. 接管完成后，关闭 `ClawHeart Desktop`
5. 用户尝试通过原生命令恢复或重启：

```bash
openclaw gateway restart
```

### 4.2 复现结果

关闭 `ClawHeart Desktop` 后：
- `ClawHeart` 主应用窗口关闭
- 但 `ClawHeart` 拉起的 `openclaw` / `openclaw-gateway` 子进程未退出
- 原生 `OpenClaw` 与 `ClawHeart` runtime 并存
- 用户对当前接管状态失去可见性

---

## 五、关键证据

### 5.1 原生 OpenClaw 仍有独立 LaunchAgent

原生网关 LaunchAgent 文件中明确指定：

- 文件：`/Users/ferdinandji/Library/LaunchAgents/ai.openclaw.gateway.plist`
- 端口：`18789`
- 状态目录：`/Users/ferdinandji/.openclaw`
- 配置文件：`/Users/ferdinandji/.openclaw/openclaw.json`

说明用户机器上原本就有一套独立的原生 `OpenClaw` 运行环境。

### 5.2 ClawHeart 另起了一套独立 runtime

`ClawHeart` 的 runtime 配置文件显示：

- 文件：`/Users/ferdinandji/Library/Application Support/@clawheart/local-desktop/clawheart-openclaw-runtime/openclaw.json`
- 网关端口：`19278`
- workspace：`/Users/ferdinandji/Library/Application Support/@clawheart/local-desktop/clawheart-openclaw-runtime/workspace`

说明 `ClawHeart` 在接管时并不是直接复用用户现有 `~/.openclaw`，而是实际启动了自己的一套独立 runtime。

### 5.3 ClawHeart 关闭后，内嵌 runtime 仍残留

进程排查结果显示：

- `ClawHeart Desktop` 主进程退出后
- 其子进程 `openclaw` 与 `openclaw-gateway` 仍继续存活
- 这些进程继续监听 `19278/19280/19281`

这说明当前退出逻辑没有完整回收 ClawHeart 启动的子进程，出现了 **orphaned runtime**。

---

## 六、问题根因分析

### 根因 1：接管后缺少完整的退出回滚

`ClawHeart` 接管原生 `OpenClaw` 后，关闭应用时未完整执行“退出接管 / 回滚到原生状态”的流程。

从现象看，至少存在以下缺失：
- 未完整停止 ClawHeart 拉起的 `openclaw` 子进程
- 未完整停止 ClawHeart 拉起的 `openclaw-gateway` 子进程
- 未明确恢复“当前由谁接管”的状态标识
- 未向用户提示后台 runtime 仍在运行

### 根因 2：ClawHeart 与原生 OpenClaw 并存，但缺少冲突可视化

当前实现允许以下状态同时存在：
- 原生 `OpenClaw` LaunchAgent 仍在系统中
- `ClawHeart` 又额外拉起一套 runtime

但用户侧没有明确提示：
- 当前活跃的是哪一套 runtime
- 哪一套拥有控制权
- 关闭 `ClawHeart` 后是否已完全释放接管

因此用户只能感知到“命令不对劲”，却无法判断真实冲突点。

### 根因 3：原生 watchdog 配置残留放大了问题体感

排查中还发现本机原生 watchdog 配置存在旧路径残留：

- 文件：`/Users/ferdinandji/Library/LaunchAgents/com.openclaw.gateway-watchdog.plist`
- 配置中仍引用不存在的 `~/.nvm/.../openclaw`

这不是本次冲突的主因，但会使自动恢复逻辑不稳定，进一步放大“原生 OpenClaw 起不来”的体感。

---

## 七、对用户的实际影响

### 7.1 功能影响

- 用户无法确认当前究竟是原生 `OpenClaw` 还是 `ClawHeart` 接管版在工作
- 原生命令虽然可执行，但结果可能与预期不一致
- 用户关闭 `ClawHeart` 后，无法自然回到“干净的原生状态” 

### 7.2 体验影响

- 用户会误以为原生 `OpenClaw` 本身坏了
- 用户难以定位问题来源是 `ClawHeart` 的残留 runtime
- 会降低用户对接管功能安全性和可回退性的信任

### 7.3 技术风险

如果未来接管逻辑继续扩展，未处理的残留 runtime 可能导致：
- 状态漂移
- 端口占用混乱
- 诊断困难
- 用户环境污染
- 关闭应用不等于停止服务的误解

---

## 八、期望行为

当 `ClawHeart` 接管用户本机 `OpenClaw` 后，若用户关闭 `ClawHeart Desktop`，系统应满足以下行为：

1. **完整停止 ClawHeart 拉起的所有内嵌 runtime 进程**
2. **释放接管状态，并恢复原生 OpenClaw 的控制权**
3. **明确提示用户当前仍有哪些后台服务在运行**
4. **如果无法自动释放接管，应给出可操作的恢复提示**
5. **在启动/接管前，检测本机是否已有原生 OpenClaw，并明确告知即将发生的影响**

---

## 九、建议修复方向

### 建议 1：应用退出时显式回收所有子进程

`ClawHeart Desktop` 退出时，不应只关闭主窗口或主进程，应确保：
- `openclaw`
- `openclaw-gateway`
- 其他由接管逻辑拉起的辅助进程

全部被显式终止。

### 建议 2：接管与释放接管需要成对设计

建议将接管逻辑改为显式状态机：
- 未接管
- 接管中
- 已接管
- 释放中
- 已释放

退出应用时必须完成“已接管 → 释放中 → 已释放”的完整流程。

### 建议 3：增加接管冲突检测

在启动接管前检测：
- 本机是否已有原生 `OpenClaw` LaunchAgent
- 本机是否已有原生 gateway 端口监听
- 是否将创建第二套 runtime

并在 UI 中明确提示用户。

### 建议 4：增加一键恢复原生 OpenClaw 的能力

建议提供类似以下能力：
- 停止 ClawHeart runtime
- 恢复原生 OpenClaw
- 清理接管残留状态
- 输出诊断报告

便于用户自行恢复。

---

## 十、临时解决方案（当前用户侧已验证）

本次问题最终通过以下步骤恢复：

1. 终止 `ClawHeart Desktop` 主进程
2. 手动终止其残留的 `openclaw` / `openclaw-gateway` 子进程
3. 确认 `19278/19280/19281` 不再监听
4. 仅保留原生 `OpenClaw` 网关端口 `18789`
5. 修复原生 watchdog 配置
6. 重启原生 `OpenClaw` 网关
7. 验证健康检查接口恢复正常

恢复后，原生健康检查已返回：

```json
{"ok":true,"status":"live"}
```

---

## 十一、结论

这不是单纯的“端口冲突”问题，也不是原生命令本身异常。

更准确地说，这是一个 **ClawHeart 接管后退出不彻底、没有完整释放接管关系、导致内嵌 runtime 残留并与原生 OpenClaw 并存** 的问题。

建议开发团队优先从以下方向修复：
- 接管退出的完整回滚
- 子进程生命周期管理
- 原生/托管 runtime 的冲突检测与可视化
- 用户侧一键恢复机制

如果上述问题不修复，任何已经被 `ClawHeart` 接管过、且本机又保留原生 `OpenClaw` 的用户，都可能在退出后遇到类似的环境混乱问题。
