## OpenCarapace Server

一个面向 Agent / OpenClaw / 各类自主化 Agent 的安全层服务端，提供：

- **用户体系与 Google 登录**：通过 Google id_token 换取后端 JWT。**node -v **
- **API Key 管理**：为每个用户签发独立 API Key，用于接入安全检查接口。
- **工具 / Skill / Function 画像库**：结构化记录工具属性与风险等级。
- **安全检查 API**：对工具定义、对话记录、执行命令等进行安全评估并给出分级决策。
- **前端站点**：包含官网 Landing、用户后台、API 文档三部分。

### 目录结构

- `src/main/java/com/opencarapace/server`：Spring Boot 后端
- `frontend`：Vite + React + Tailwind 前端

### 快速开始

1. 后端开发运行：

```bash
mvn spring-boot:run
```

2. 前端开发运行：

```bash
cd frontend
npm install
npm run dev
```

开发环境默认：

- 后端运行在 `http://localhost:8080`
- 前端运行在 `http://localhost:5173`

