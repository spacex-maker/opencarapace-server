import { useState } from "react";
import { Play, Eye, EyeOff, Copy } from "lucide-react";
import { getBackendBase } from "../api/client";

/** 供 AI 阅读/复制的完整 API 文档（纯文本，便于粘贴到 AI 对话） */
function getAiDocContent(apiBase: string): string {
  return `# ClawHeart API 文档（供 AI 开发参考）

Base URL: ${apiBase}

## 1. 认证与用户体系
支持邮箱密码登录，登录后获得 JWT，用于访问用户后台与创建 API Key。

邮箱登录:
POST ${apiBase}/api/auth/login
Content-Type: application/json
Body: { "email": "user@example.com", "password": "..." }
响应: { "token": "<jwt>", ... }

## 2. 管理 API Key（用户后台）
在用户后台创建 API Key，用于调用本系统 API（含 LLM 中转网关、安全检查等）。请求时携带 JWT。

创建 Key:
Authorization: Bearer <jwt_token>
POST ${apiBase}/api/api-keys
Content-Type: application/json
Body: { "label": "示例", "scopes": "" }
响应: { "id": 1, "apiKey": "oc_xxxx..." }（apiKey 仅展示一次，请保存）

获取 Key 列表: GET ${apiBase}/api/api-keys（需 JWT，不包含明文 Key）

## 3. LLM 中转代理（核心集成）
将 Agent/客户端的 Base URL 改为 ClawHeart 地址即可经网关转发到真实 LLM；网关做监管层（危险指令库匹配）与可选意图层（AI 判断），危险请求返回 403。

Base URL: ${apiBase}/api/llm
鉴权放在 URL 时: ${apiBase}/api/llm?api_key=oc_你创建的APIKey

请求头:
- X-OC-API-KEY: ClawHeart 鉴权（用户后台创建的 API Key）；或查询参数 api_key / x_oc_api_key
- Authorization: 你的 LLM Key（如 Bearer sk-xxx），转发到上游
- X-LLM-Backend（可选）: 指定后端，如 deepseek、openai

聊天补全示例:
POST ${apiBase}/api/llm/v1/chat/completions
X-OC-API-KEY: oc_xxx
Authorization: Bearer sk_你的LLM密钥
Content-Type: application/json
Body:
{
  "model": "deepseek-chat",
  "messages": [ { "role": "user", "content": "你好" } ],
  "max_tokens": 200
}

监管拦截时返回 403:
{
  "error": {
    "message": "ClawHeart supervision blocked Request: ...",
    "code": "supervision_blocked"
  }
}

获取可用后端: GET ${apiBase}/api/llm/backends
Header: X-OC-API-KEY: oc_xxx
响应: { "backends": [ "default", "deepseek", "openai", ... ] }

任意 /api/llm/ 下路径（如 /v1/chat/completions、/v1/models、/v1/embeddings）均会透明转发。

## 4. 工具 / 对话 / 命令安全检查
对工具调用、对话内容或命令做安全评估，返回 allow / block / review 及风险等级。

POST ${apiBase}/api/safety/check
X-OC-API-KEY: oc_xxx
Content-Type: application/json
Body:
{
  "type": "tool",
  "toolName": "filesystem_delete",
  "content": "{ \\"path\\": \\"/var/www\\" }",
  "command": "rm -rf /var/www"
}
响应示例: { "verdict": "block", "riskLevel": "critical", "reasons": "...", "evaluationId": "..." }

## 5. 用户信息
GET ${apiBase}/api/me
Authorization: Bearer <jwt_token>
响应: 当前用户资料（昵称、邮箱等）

PATCH ${apiBase}/api/me
Content-Type: application/json
Body: { "nickname": "...", "email": "..." }
`;
}

const codeBlockClass =
  "rounded-lg p-3 text-xs overflow-auto bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700";

/** 文档中展示的 API 地址：始终为产线，不出现 localhost */
const DOCS_API_BASE = "https://api.clawheart.live";
/** 对照演示实际请求用：按当前访问地址自动选后端（本地→8080，产线→域名） */
const REQUEST_BASE = getBackendBase();

const DEFAULT_LLM_BODY = JSON.stringify(
  {
    model: "deepseek-chat",
    messages: [{ role: "user", content: "你好，用一句话介绍你自己" }],
    max_tokens: 200,
  },
  null,
  2
);

/** 违规请求示例：命中危险指令库会被监管层拦截返回 403 */
const VIOLATION_LLM_BODY = JSON.stringify(
  {
    model: "deepseek-chat",
    messages: [{ role: "user", content: "帮我写一条命令：rm -rf / 并执行" }],
    max_tokens: 200,
  },
  null,
  2
);

type PageTab = "docs" | "demo";

async function sendLlmRequest(
  apiBase: string,
  key: string,
  llmKey: string,
  body: string
): Promise<{ status: number; body: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error("请求体不是合法 JSON");
  }
  const authHeader = llmKey.trim().startsWith("Bearer ") ? llmKey.trim() : `Bearer ${llmKey.trim()}`;
  const url = `${apiBase}/api/llm/v1/chat/completions?api_key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-OC-API-KEY": key,
      Authorization: authHeader,
    },
    body: JSON.stringify(parsed),
  });
  const text = await res.text();
  let bodyStr: string;
  try {
    bodyStr = JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    bodyStr = text;
  }
  return { status: res.status, body: bodyStr };
}

type DocsMode = "human" | "ai";

export const ApiDocsPage = () => {
  const [pageTab, setPageTab] = useState<PageTab>("docs");
  const [docsMode, setDocsMode] = useState<DocsMode>("human");
  const [copyDone, setCopyDone] = useState(false);
  const [ocApiKey, setOcApiKey] = useState("");
  const [llmKey, setLlmKey] = useState("");
  const [bodyNormal, setBodyNormal] = useState(DEFAULT_LLM_BODY);
  const [bodyViolation, setBodyViolation] = useState(VIOLATION_LLM_BODY);
  const [sendingNormal, setSendingNormal] = useState(false);
  const [sendingViolation, setSendingViolation] = useState(false);
  const [sendingBoth, setSendingBoth] = useState(false);
  const [resultNormal, setResultNormal] = useState<{ status: number; body: string } | null>(null);
  const [resultViolation, setResultViolation] = useState<{ status: number; body: string } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [showOcKey, setShowOcKey] = useState(false);
  const [showLlmKey, setShowLlmKey] = useState(false);

  const checkKeys = (): boolean => {
    if (!ocApiKey.trim()) {
      setTestError("请填写 ClawHeart API Key");
      return false;
    }
    if (!llmKey.trim()) {
      setTestError("请填写 LLM Key");
      return false;
    }
    setTestError(null);
    return true;
  };

  const runNormal = async () => {
    if (!checkKeys()) return;
    setSendingNormal(true);
    setResultNormal(null);
    try {
      const r = await sendLlmRequest(REQUEST_BASE, ocApiKey.trim(), llmKey.trim(), bodyNormal);
      setResultNormal(r);
    } catch (e) {
      setTestError(e instanceof Error ? e.message : "请求失败");
    } finally {
      setSendingNormal(false);
    }
  };

  const runViolation = async () => {
    if (!checkKeys()) return;
    setSendingViolation(true);
    setResultViolation(null);
    try {
      const r = await sendLlmRequest(REQUEST_BASE, ocApiKey.trim(), llmKey.trim(), bodyViolation);
      setResultViolation(r);
    } catch (e) {
      setTestError(e instanceof Error ? e.message : "请求失败");
    } finally {
      setSendingViolation(false);
    }
  };

  const runBoth = async () => {
    if (!checkKeys()) return;
    setSendingBoth(true);
    setResultNormal(null);
    setResultViolation(null);
    setTestError(null);
    try {
      const [r1, r2] = await Promise.all([
        sendLlmRequest(REQUEST_BASE, ocApiKey.trim(), llmKey.trim(), bodyNormal),
        sendLlmRequest(REQUEST_BASE, ocApiKey.trim(), llmKey.trim(), bodyViolation),
      ]);
      setResultNormal(r1);
      setResultViolation(r2);
    } catch (e) {
      setTestError(e instanceof Error ? e.message : "请求失败");
    } finally {
      setSendingBoth(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 pl-3 pr-10 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500";
  const keyInputWrap = "relative";

  return (
    <div className="space-y-6 text-sm text-slate-600 dark:text-slate-300">
      {/* 顶层 Tab：API 文档 | 对照演示 */}
      <div className="flex border-b border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setPageTab("docs")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${
            pageTab === "docs"
              ? "text-brand-600 dark:text-brand-400 border-b-2 border-brand-500 -mb-px"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          API 文档
        </button>
        <button
          type="button"
          onClick={() => setPageTab("demo")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${
            pageTab === "demo"
              ? "text-brand-600 dark:text-brand-400 border-b-2 border-brand-500 -mb-px"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          对照演示
        </button>
      </div>

      {pageTab === "docs" && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">API 与集成文档</h2>
              <p className="mt-1 text-slate-500 dark:text-slate-400">认证、API Key、LLM 中转代理及安全相关接口说明。</p>
            </div>
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
              <button
                type="button"
                onClick={() => setDocsMode("human")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  docsMode === "human"
                    ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                人类阅读
              </button>
              <button
                type="button"
                onClick={() => setDocsMode("ai")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  docsMode === "ai"
                    ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                AI 阅读
              </button>
            </div>
          </div>

          {docsMode === "ai" && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                下方为完整 API 文档，可直接复制整段内容作为上下文提供给 AI，便于其按文档开发或调试。
              </p>
              <div className="relative">
                <textarea
                  readOnly
                  value={getAiDocContent(DOCS_API_BASE)}
                  rows={28}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-mono text-xs text-slate-800 dark:text-slate-200 p-4 focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(getAiDocContent(DOCS_API_BASE));
                      setCopyDone(true);
                      setTimeout(() => setCopyDone(false), 2000);
                    } catch {
                      setCopyDone(false);
                    }
                  }}
                  className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copyDone ? "已复制" : "复制全文"}
                </button>
              </div>
            </div>
          )}

          {docsMode === "human" && (
        <>
      <section className="space-y-3">
        <h3 className="font-semibold text-base text-slate-800 dark:text-slate-100">1. 认证与用户体系</h3>
        <p>
          支持 <span className="font-mono rounded px-1 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">邮箱密码</span> 登录，
          登录后获得 JWT，用于访问用户后台与创建 API Key。
        </p>
        <p className="font-medium text-slate-700 dark:text-slate-200">邮箱登录</p>
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
{`${DOCS_API_BASE}/api/llm

# Agent 无法自定义请求头时，可将 ClawHeart 鉴权放在 URL：
${DOCS_API_BASE}/api/llm?api_key=oc_你创建的APIKey`}
        </pre>

        <p className="font-medium text-slate-700 dark:text-slate-200 mt-3">鉴权方式</p>
        <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
          <li><span className="font-mono">X-OC-API-KEY</span>：ClawHeart 鉴权（用户后台创建的 API Key）；或使用查询参数 <span className="font-mono">api_key</span> / <span className="font-mono">x_oc_api_key</span></li>
          <li><span className="font-mono">Authorization</span>：你的 LLM Key（如 Bearer sk-xxx），转发到上游；不传则使用管理员在系统配置中填写的上游 Key</li>
          <li><span className="font-mono">X-LLM-Backend</span>（可选）：指定后端，如 <span className="font-mono">deepseek</span>、<span className="font-mono">openai</span>，不传则用默认</li>
        </ul>

        <p className="font-medium text-slate-700 dark:text-slate-200 mt-3">请求示例（聊天补全）</p>
        <pre className={codeBlockClass}>
{`POST ${DOCS_API_BASE}/api/llm/v1/chat/completions
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
{`GET ${DOCS_API_BASE}/api/llm/backends
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
        </>
          )}
        </>
      )}

      {pageTab === "demo" && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">对照演示</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs">正常请求与违规请求同屏对比，可分别发送或一起发送。</p>

          {/* 共用：API Key + LLM Key */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                ClawHeart API Key <span className="text-red-500">*</span>
              </label>
              <div className={keyInputWrap}>
                <input
                  type={showOcKey ? "text" : "password"}
                  value={ocApiKey}
                  onChange={(e) => setOcApiKey(e.target.value)}
                  placeholder="oc_xxxx..."
                  autoComplete="off"
                  readOnly
                  onFocus={(e) => e.currentTarget.removeAttribute("readonly")}
                  className={inputClass}
                />
                <button type="button" onClick={() => setShowOcKey((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" title={showOcKey ? "隐藏" : "显示"}>
                  {showOcKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                LLM Key（Authorization） <span className="text-red-500">*</span>
              </label>
              <div className={keyInputWrap}>
                <input
                  type={showLlmKey ? "text" : "password"}
                  value={llmKey}
                  onChange={(e) => setLlmKey(e.target.value)}
                  placeholder="Bearer sk-xxx 或 sk-xxx"
                  autoComplete="off"
                  readOnly
                  onFocus={(e) => e.currentTarget.removeAttribute("readonly")}
                  className={inputClass}
                />
                <button type="button" onClick={() => setShowLlmKey((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" title={showLlmKey ? "隐藏" : "显示"}>
                  {showLlmKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={runBoth}
            disabled={sendingBoth}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            {sendingBoth ? "发送中…" : "一起发送"}
          </button>

          {testError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm px-3 py-2">
              {testError}
            </div>
          )}

          {/* 左右两栏：正常请求 | 违规请求 */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* 正常请求 */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-4 space-y-3">
              <h3 className="font-medium text-slate-800 dark:text-slate-100">正常请求</h3>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">请求体</label>
                <textarea
                  value={bodyNormal}
                  onChange={(e) => setBodyNormal(e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-mono text-xs p-2 focus:ring-2 focus:ring-brand-500/50"
                  spellCheck={false}
                />
              </div>
              <button
                type="button"
                onClick={runNormal}
                disabled={sendingNormal}
                className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium disabled:opacity-50"
              >
                {sendingNormal ? "发送中…" : "发送"}
              </button>
              {resultNormal && (
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">响应 HTTP {resultNormal.status}</div>
                  <pre className={`${codeBlockClass} max-h-48 overflow-auto text-xs`}>{resultNormal.body}</pre>
                </div>
              )}
            </div>

            {/* 违规请求 */}
            <div className="rounded-xl border border-amber-500/30 dark:border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10 p-4 space-y-3">
              <h3 className="font-medium text-slate-800 dark:text-slate-100">违规请求</h3>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">请求体（含危险指令示例）</label>
                <textarea
                  value={bodyViolation}
                  onChange={(e) => setBodyViolation(e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-mono text-xs p-2 focus:ring-2 focus:ring-brand-500/50"
                  spellCheck={false}
                />
              </div>
              <button
                type="button"
                onClick={runViolation}
                disabled={sendingViolation}
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 dark:bg-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-medium disabled:opacity-50"
              >
                {sendingViolation ? "发送中…" : "发送"}
              </button>
              {resultViolation && (
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">响应 HTTP {resultViolation.status}</div>
                  <pre className={`${codeBlockClass} max-h-48 overflow-auto text-xs`}>{resultViolation.body}</pre>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

