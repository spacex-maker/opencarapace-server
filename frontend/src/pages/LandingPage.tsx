import { Link } from "react-router-dom";

export const LandingPage = () => {
  return (
    <div className="grid md:grid-cols-2 gap-10 items-center">
      <div className="space-y-6">
        <p className="inline-flex items-center rounded-full bg-slate-200 dark:bg-slate-800/70 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
          为 OpenClaw / 自主 Agent 打造的安全外壳
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">
          LLM 中转 + 监管拦截，
          <span className="block text-brand-500 dark:text-brand-400 mt-1">
            统一安全网关
          </span>
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          OpenClaw、小龙虾等 Agent 将大模型请求发往 ClawHeart，我们做透明转发；
          在中间接入监管层（危险指令库匹配）与可选意图层（AI 判断是否意图执行危险命令），
          危险请求被拦截并记录，保护业务免受越权调用与危险命令影响。
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/dashboard"
            className="px-4 py-2 rounded-md bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium"
          >
            进入用户后台
          </Link>
          <Link
            to="/login"
            className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            登录
          </Link>
          <Link
            to="/docs"
            className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            查看 API & 集成文档
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-300">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 bg-slate-100 dark:bg-slate-900/60">
            <div className="font-semibold mb-1">LLM 透明中转</div>
            <div>Agent 仅需把 Base URL 改为本网关，路径与请求体原样透传，支持多后端与查询参数鉴权。</div>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 bg-slate-100 dark:bg-slate-900/60">
            <div className="font-semibold mb-1">监管层 + 意图层</div>
            <div>请求/响应与危险指令库匹配即拦截；可选 AI 意图判断（用你自己的 Key + 我们注入的系统提示词），拦截记录可审计。</div>
          </div>
        </div>
      </div>
      <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/70 p-4">
          <div className="font-semibold mb-2 text-slate-800 dark:text-slate-100">
            示例：经网关调用 LLM
          </div>
          <pre className="bg-slate-200 dark:bg-slate-950/80 rounded-lg p-3 overflow-auto text-[11px] leading-relaxed text-slate-800 dark:text-slate-200">
{`Base URL: https://你的域名/api/llm
（无法自定义头时：.../api/llm?api_key=oc_xxx）

POST /v1/chat/completions
X-OC-API-KEY: oc_xxx   （或使用 query api_key）
Authorization: Bearer sk_你的LLM密钥

{"model":"deepseek-chat","messages":[...]}`}
          </pre>
          <div className="mt-2 text-[11px]">
            危险内容被拦截时返回 403，
            {" "}
            <code>{`"code": "supervision_blocked"`}</code>
          </div>
        </div>
      </div>
    </div>
  );
};

