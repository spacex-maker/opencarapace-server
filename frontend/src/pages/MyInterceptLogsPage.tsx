import { useEffect, useState } from "react";
import { fetchMyInterceptLogs, type ClientInterceptLogItem } from "../api/client";

export const MyInterceptLogsPage = () => {
  const [logs, setLogs] = useState<ClientInterceptLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchMyInterceptLogs(50);
      setLogs(items);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setError(msg || "加载拦截日志失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const formatDate = (s?: string) => {
    if (!s) return "—";
    try {
      const d = new Date(s);
      return d.toLocaleString("zh-CN");
    } catch {
      return s;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">我的拦截日志</h2>
        <button
          type="button"
          onClick={load}
          className="text-xs text-slate-500 dark:text-slate-400 hover:text-brand-500 dark:hover:text-brand-400"
        >
          刷新
        </button>
      </div>
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm px-3 py-2">
          {error}
        </div>
      )}
      {loading && <div className="text-sm text-slate-500 dark:text-slate-400">加载中…</div>}
      {!loading && logs.length === 0 && !error && (
        <div className="text-sm text-slate-500 dark:text-slate-400">暂无拦截日志</div>
      )}
      {!loading && logs.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300">
              <tr>
                <th className="px-3 py-2 text-left">时间</th>
                <th className="px-3 py-2 text-left">类型 / 上游</th>
                <th className="px-3 py-2 text-left">结果</th>
                <th className="px-3 py-2 text-left">规则/原因</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-slate-200 dark:border-slate-800 align-top">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600 dark:text-slate-400">
                    {log.requestType || "chat.completion"} · {log.upstream || "上游未标注"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className={
                        log.verdict === "BLOCK"
                          ? "inline-flex px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400"
                          : "inline-flex px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      }
                    >
                      {log.verdict === "BLOCK" ? "拦截" : "通过"}
                    </span>
                    {log.riskLevel && (
                      <span className="ml-1 text-[10px] text-slate-500 dark:text-slate-400">{log.riskLevel}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                    {log.matchedRuleIds && (
                      <div className="mb-1">
                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          规则ID: {log.matchedRuleIds}
                        </span>
                      </div>
                    )}
                    {log.reason && <div className="mb-1">{log.reason}</div>}
                    {log.requestSnippet && (
                      <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap bg-slate-50 dark:bg-slate-900/70 rounded border border-slate-200 dark:border-slate-700 p-2 text-[11px] text-slate-500 dark:text-slate-400">
                        {log.requestSnippet}
                      </pre>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

