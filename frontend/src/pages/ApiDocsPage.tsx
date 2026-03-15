const codeBlockClass =
  "rounded-lg p-3 text-xs overflow-auto bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700";

export const ApiDocsPage = () => {
  return (
    <div className="space-y-8 text-sm text-slate-600 dark:text-slate-300">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">API 与集成文档</h2>
        <p className="mt-1 text-slate-500 dark:text-slate-400">认证、API Key、LLM 中转代理及安全相关接口说明。</p>
      </div>

      <section className="space-y-3">
        <h3 className="font-semibold text-base text-slate-800 dark:text-slate-100">1. 认证与用户体系</h3>
        <p>
          支持 <span className="font-mono rounded px-1 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">邮箱密码</span> 与{" "}
          <span className="font-mono rounded px-1 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">Google Login</span>，
          登录后获得 JWT，用于访问用户后台与创建 API Key。
        </p>
        <p className="font-medium text-slate-700 dark:text-slate-200">Google 登录</p>
        <pre className={codeBlockClass}>
{`POST /api/auth/google
Content-Type: application/json

{ "idToken": "<google_id_token>" }

// 响应: { "token": "<jwt>", ... }`}
        </pre>
        <p className="font-medium text-slate-700 dark:text-slate-200 mt-3">邮箱登录</p>
        <pre className={codeBlockClass}>
{`POST /api/auth/login
Content-Type: application/json

{ "email": "user@example.com", "password": "..." }

// 响应: { "token": "<jwt>", ... }`}
        </pre>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold text-base text-slate-800 dark:text-slate-100">2. 管理 API Key（用户后台）</h3>
        <p>在用户后台创建 API Key，用于调用本系统 API（含 LLM 中转网关、安全检查等）。请求时携带 JWT：</p>
        <pre className={codeBlockClass}>
{`Authorization: Bearer <jwt_token>

POST /api/api-keys
Content-Type: application/json
{ "label": "OpenClaw 网关", "scopes": "" }

// 响应: { "id": 1, "apiKey": "oc_xxxx..." }  （apiKey 仅展示一次，请保存）`}
        </pre>
        <p>获取已创建的 Key 列表：<span className="font-mono text-slate-700 dark:text-slate-200">GET /api/api-keys</span>（不包含明文 Key）。</p>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold text-base text-slate-800 dark:text-slate-100">3. LLM 中转代理（核心集成）</h3>
        <p>
          OpenClaw、小龙虾等 Agent 将 <strong className="text-slate-800 dark:text-slate-100">Base URL</strong> 改为 ClawHeart 地址，
          即可经网关转发到真实 LLM；网关在中间做<strong className="text-slate-800 dark:text-slate-100">监管层</strong>（危险指令库匹配）与可选<strong className="text-slate-800 dark:text-slate-100">意图层</strong>（AI 判断），危险请求返回 403。
        </p>

        <p className="font-medium text-slate-700 dark:text-slate-200">Base URL</p>
        <pre className={codeBlockClass}>
{`https://你的域名/api/llm

# Agent 无法自定义请求头时，可将 ClawHeart 鉴权放在 URL：
https://你的域名/api/llm?api_key=oc_你创建的APIKey`}
        </pre>

        <p className="font-medium text-slate-700 dark:text-slate-200 mt-3">鉴权方式</p>
        <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
          <li><span className="font-mono">X-OC-API-KEY</span>：ClawHeart 鉴权（用户后台创建的 API Key）；或使用查询参数 <span className="font-mono">api_key</span> / <span className="font-mono">x_oc_api_key</span></li>
          <li><span className="font-mono">Authorization</span>：你的 LLM Key（如 Bearer sk-xxx），转发到上游；不传则使用管理员在系统配置中填写的上游 Key</li>
          <li><span className="font-mono">X-LLM-Backend</span>（可选）：指定后端，如 <span className="font-mono">deepseek</span>、<span className="font-mono">openai</span>，不传则用默认</li>
        </ul>

        <p className="font-medium text-slate-700 dark:text-slate-200 mt-3">请求示例（聊天补全）</p>
        <pre className={codeBlockClass}>
{`POST https://你的域名/api/llm/v1/chat/completions
X-OC-API-KEY: oc_xxx
Authorization: Bearer sk_你的LLM密钥
Content-Type: application/json

{
  "model": "deepseek-chat",
  "messages": [ { "role": "user", "content": "你好" } ],
  "max_tokens": 200
}`}
        </pre>

        <p className="font-medium text-slate-700 dark:text-slate-200 mt-3">监管拦截响应</p>
        <p>当请求或响应命中危险指令库（或意图层判为危险）时，返回 403：</p>
        <pre className={codeBlockClass}>
{`{
  "error": {
    "message": "ClawHeart supervision blocked Request: ...",
    "code": "supervision_blocked"
  }
}`}
        </pre>

        <p className="font-medium text-slate-700 dark:text-slate-200 mt-3">获取可用后端列表</p>
        <pre className={codeBlockClass}>
{`GET https://你的域名/api/llm/backends
X-OC-API-KEY: oc_xxx

// 响应: { "backends": [ "default", "deepseek", "openai", ... ] }`}
        </pre>
        <p>任意 <span className="font-mono">/api/llm/</span> 下的路径（如 <span className="font-mono">/v1/chat/completions</span>、<span className="font-mono">/v1/models</span>、<span className="font-mono">/v1/embeddings</span>）均会透明转发。</p>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold text-base text-slate-800 dark:text-slate-100">4. 工具 / 对话 / 命令安全检查</h3>
        <p>对工具调用、对话内容或命令做安全评估，返回 allow / block / review 及风险等级：</p>
        <pre className={codeBlockClass}>
{`POST /api/safety/check
X-OC-API-KEY: oc_xxx
Content-Type: application/json

{
  "type": "tool",            // tool | conversation | command
  "toolName": "filesystem_delete",
  "content": "{ \\"path\\": \\"/var/www\\" }",
  "command": "rm -rf /var/www"
}`}
        </pre>
        <p>返回示例：</p>
        <pre className={codeBlockClass}>
{`{
  "verdict": "block",
  "riskLevel": "critical",
  "reasons": "...",
  "evaluationId": "..."
}`}
        </pre>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold text-base text-slate-800 dark:text-slate-100">5. 用户信息</h3>
        <pre className={codeBlockClass}>
{`GET /api/me
Authorization: Bearer <jwt_token>

// 当前用户资料（昵称、邮箱等）
PATCH /api/me
Content-Type: application/json
{ "nickname": "...", "email": "..." }`}
        </pre>
      </section>
    </div>
  );
};

