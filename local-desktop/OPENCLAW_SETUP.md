# OpenClaw 配置指南

OpenClaw 已内置在客户端中，但需要配置 API token 才能使用。

## 快速开始

### 1. 获取 API Token

OpenClaw 支持多种 LLM 提供商，你需要至少配置一个：

#### OpenAI
- 访问：https://platform.openai.com/api-keys
- 创建新的 API key
- 复制 key（格式：`sk-...`）

#### Anthropic (Claude)
- 访问：https://console.anthropic.com/settings/keys
- 创建新的 API key
- 复制 key（格式：`sk-ant-...`）

#### 其他提供商
- Google Gemini：https://aistudio.google.com/app/apikey
- Groq：https://console.groq.com/keys
- 本地模型（Ollama）：无需 token，直接使用

### 2. 配置 OpenClaw

1. 打开客户端，点击 **OpenClaw** 菜单
2. 在嵌入的 OpenClaw UI 中：
   - 点击右上角的设置图标 ⚙️
   - 选择 **Settings** 或 **API Keys**
   - 添加你的 API token
   - 选择默认模型

### 3. 开始使用

配置完成后，你可以：
- 使用 AI 助手进行对话
- 自动化浏览器操作
- 执行各种任务

## 常见问题

### Q: OpenClaw UI 显示"正在启动"
**A:** 等待几秒钟，OpenClaw Gateway 正在后台启动。如果超过 30 秒还未启动，请：
1. 检查终端是否有错误信息
2. 手动运行：`openclaw daemon start`
3. 重启客户端

### Q: OpenClaw UI 无法访问
**A:** 确保 OpenClaw Gateway 正在运行：
```bash
# 检查状态
openclaw daemon status

# 如果未运行，启动它
openclaw daemon start
```

### Q: 我没有 API token，可以使用吗？
**A:** 可以！你可以：
1. **使用本地模型（推荐）**：
   - 安装 Ollama：https://ollama.ai/
   - 运行模型：`ollama run llama2`
   - 在 OpenClaw 中选择 Ollama 作为提供商

2. **使用免费额度**：
   - 大多数 LLM 提供商都有免费试用额度
   - OpenAI 新用户有 $5 免费额度
   - Groq 提供免费 API 访问

### Q: 如何更新 OpenClaw？
**A:** 运行：
```bash
cd local-desktop
npm update openclaw
```

## 文档链接

- OpenClaw 官方文档：https://docs.openclaw.ai/
- API 配置指南：https://docs.openclaw.ai/cli/gateway
- 更多帮助：https://github.com/openclaw/openclaw

## 技术支持

如果遇到问题，请：
1. 查看终端日志
2. 查看 OpenClaw 日志：`C:\Users\你的用户名\AppData\Local\Temp\openclaw\`
3. 提交 Issue：https://github.com/openclaw/openclaw/issues
