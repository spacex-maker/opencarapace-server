import { Link } from "react-router-dom";

export const LandingPage = () => {
  return (
    <div className="grid md:grid-cols-2 gap-10 items-center">
      <div className="space-y-6">
        <p className="inline-flex items-center rounded-full bg-slate-200 dark:bg-slate-800/70 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
          为 OpenClaw / 自主 Agent 打造的安全外壳
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">
          为 Agent、工具和函数调用
          <span className="block text-brand-500 dark:text-brand-400 mt-1">
            提供统一的安全评估与策略治理
          </span>
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          OpenCarapace 作为独立安全层，接管 Agent / LLM 对工具、技能、函数的调用，
          结合历史安全评估与 AI 策略判断，给出可执行 / 阻断 / 需人工审核等分级决策，
          保护你的业务系统免受越权调用、数据外泄和危险命令的影响。
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
            <div className="font-semibold mb-1">工具 / Skill 安全画像</div>
            <div>结构化记录每个工具的权限、风险等级、来源与策略提示。</div>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 bg-slate-100 dark:bg-slate-900/60">
            <div className="font-semibold mb-1">对话 / 命令安全审计</div>
            <div>对对话上下文和执行命令做 LLM 级别的判定与日志留存。</div>
          </div>
        </div>
      </div>
      <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/70 p-4">
          <div className="font-semibold mb-2 text-slate-800 dark:text-slate-100">
            示例：工具安全检查 API
          </div>
          <pre className="bg-slate-200 dark:bg-slate-950/80 rounded-lg p-3 overflow-auto text-[11px] leading-relaxed text-slate-800 dark:text-slate-200">
{`POST https://api.opencarapace.example.com/api/safety/check
X-OC-API-KEY: oc_xxx...
Content-Type: application/json

{
  "type": "tool",
  "toolName": "filesystem_delete",
  "content": "{ \\"path\\": \\"/var/www\\" }"
}`}
          </pre>
          <div className="mt-2 text-[11px]">
            返回：
            {" "}
            <code>{`{ "verdict": "block", "riskLevel": "critical" }`}</code>
          </div>
        </div>
      </div>
    </div>
  );
};

