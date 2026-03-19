import { useEffect, useState } from "react";
import { api } from "../api/client";

type TokenUsageItem = {
  id: number;
  createdAt: string | null;
  routeMode: string | null;
  upstreamBase: string | null;
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  estimated: boolean;
};

type TokenUsagePage = {
  page: number;
  size: number;
  total: number;
  items: TokenUsageItem[];
};

export const TokenUsagesPage = () => {
  const [data, setData] = useState<TokenUsagePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<TokenUsagePage>(`/api/billing/token-usages/me?page=${page}&size=50`);
      setData(data);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setError(msg || "加载 Token 账单失败，请稍后重试");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.size ?? 50)));

  const formatDate = (s?: string | null) => {
    if (!s) return "—";
    try {
      return new Date(s).toLocaleString("zh-CN");
    } catch {
      return s;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Token 账单</h2>
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

      {!loading && (data?.items?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300">
              <tr>
                <th className="px-3 py-2 text-left">时间</th>
                <th className="px-3 py-2 text-left">来源</th>
                <th className="px-3 py-2 text-left">模型 / 上游</th>
                <th className="px-3 py-2 text-right">Prompt</th>
                <th className="px-3 py-2 text-right">Completion</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data!.items.map((it) => {
                const isLocal = it.routeMode === "DIRECT" || it.routeMode === "MAPPING";
                const sourceLabel = isLocal ? "本地中转" : "云端中转";
                const sourceColor = isLocal ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";
                return (
                  <tr key={it.id} className="border-t border-slate-200 dark:border-slate-800 align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(it.createdAt)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className={`font-semibold text-[11px] ${sourceColor}`}>{sourceLabel}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {it.routeMode || "—"}
                          {it.estimated && " · 估算"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                      <div className="text-slate-900 dark:text-white">{it.model || "—"}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[520px]">
                        {it.upstreamBase || "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{it.promptTokens ?? "—"}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{it.completionTokens ?? "—"}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">{it.totalTokens ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && (data?.items?.length ?? 0) === 0 && !error && (
        <div className="text-sm text-slate-500 dark:text-slate-400">暂无账单记录</div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 disabled:opacity-50"
        >
          上一页
        </button>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          第 <span className="text-slate-900 dark:text-white">{page}</span> / {totalPages} 页（共 {data?.total ?? 0} 条）
        </div>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 disabled:opacity-50"
        >
          下一页
        </button>
      </div>
    </div>
  );
};

