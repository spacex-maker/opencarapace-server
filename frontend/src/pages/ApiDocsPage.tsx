const codeBlockClass =
  "rounded-lg p-3 text-xs overflow-auto bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700";

export const ApiDocsPage = () => {
  return (
    <div className="space-y-6 text-sm text-slate-600 dark:text-slate-200">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">API 调用说明</h2>
      <section className="space-y-2">
        <h3 className="font-semibold text-base text-slate-800 dark:text-slate-100">1. 认证与用户体系</h3>
        <p>
          当前版本通过
          <span className="font-mono mx-1 rounded px-1 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">Google Login + JWT</span>
          建立用户体系。前端获取 Google id_token 后，调用：
        </p>
        <pre className={codeBlockClass}>
{`POST /api/auth/google
Content-Type: application/json

{ "idToken": "<google_id_token>" }`}
        </pre>
        <p>
          返回体中包含
          <span className="font-mono mx-1 rounded px-1 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">token</span>
          字段，用于后续在用户后台管理 API Key。
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold text-base text-slate-800 dark:text-slate-100">2. 管理 API Key（用户后台）</h3>
        <p>需要携带 JWT（用户登录态）在 Header 中：</p>
        <pre className={codeBlockClass}>
{`Authorization: Bearer <jwt_token>`}
        </pre>
        <p className="font-medium text-slate-700 dark:text-slate-200">创建 Key</p>
        <pre className={codeBlockClass}>
{`POST /api/api-keys
Content-Type: application/json

{ "label": "prod-gateway", "scopes": "tools:read,safety:check" }`}
        </pre>
        <p>返回：</p>
        <pre className={codeBlockClass}>
{`{ "id": "...", "apiKey": "oc_..." }`}
        </pre>
        <p>后续调用安全检查接口时，使用此 API Key 即可，无需携带 JWT。</p>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold text-base text-slate-800 dark:text-slate-100">3. 工具 / 对话 / 命令安全检查</h3>
        <p>使用 API Key 调用：</p>
        <pre className={codeBlockClass}>
{`POST /api/safety/check
X-OC-API-KEY: oc_...
Content-Type: application/json

{
  "type": "tool",            // tool | conversation | command 等
  "toolName": "filesystem_delete",
  "content": "{ \\"path\\": \\"/var/www\\" }",
  "command": "rm -rf /var/www"
}`}
        </pre>
        <p>返回示例：</p>
        <pre className={codeBlockClass}>
{`{
  "verdict": "block",        // allow | block | review
  "riskLevel": "critical",   // low | medium | high | critical
  "reasons": "Tool is explicitly blocked in registry. ...",
  "evaluationId": "..."
}`}
        </pre>
        <p>
          后端会综合工具注册信息（类型、风险等级、审批状态等）和简单规则做快速判断，
          后续可以扩展为调用专门的 LLM 审计 Agent，结合策略引擎（如「零信任权限」「花费上限」等）。
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold text-base text-slate-800 dark:text-slate-100">4. 工具 / Skill / Function 注册建议字段</h3>
        <ul className="list-disc list-inside text-xs text-slate-600 dark:text-slate-300 space-y-1">
          <li>基础信息：name, type(tool/function/skill), description, provider, sourceSystem</li>
          <li>权限与范围：category, tags, 所需资源域（数据库、文件系统、外部 API 等）</li>
          <li>风险与策略：riskLevel, approvalStatus, policyHints, lastReviewedAt, lastReviewedBy</li>
          <li>结构化描述：inputSchema, outputSchema, exampleUsage, externalReference</li>
        </ul>
      </section>
    </div>
  );
};

