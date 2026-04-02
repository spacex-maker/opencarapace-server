import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { fetchMyTokenUsages, type TokenUsageItem, type TokenUsagePageResult } from "../api/client";
import { FilterPortalSelect } from "../components/FilterPortalSelect";

type ActiveFilters = {
  fromLocal: string;
  toLocal: string;
  routeMode: string;
  model: string;
  keyword: string;
  /** null = 不限；true / false */
  estimated: boolean | null;
};

const emptyFilters: ActiveFilters = {
  fromLocal: "",
  toLocal: "",
  routeMode: "",
  model: "",
  keyword: "",
  estimated: null,
};

function localDatetimeToIso(local: string): string | undefined {
  if (!local?.trim()) return undefined;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function formatDate(s?: string | null) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return s;
  }
}

const inputClass =
  "w-full min-w-0 rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-brand-500/35";

export const TokenUsagesPage = () => {
  const [draft, setDraft] = useState<ActiveFilters>(emptyFilters);
  const [active, setActive] = useState<ActiveFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [data, setData] = useState<TokenUsagePageResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil((data?.total ?? 0) / (data?.size ?? pageSize))), [data?.total, data?.size, pageSize]);

  const pageTokenSum = useMemo(() => {
    const items = data?.items;
    if (!items?.length) return 0;
    return items.reduce((acc, it) => acc + (it.totalTokens ?? 0), 0);
  }, [data?.items]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMyTokenUsages({
        page,
        size: pageSize,
        from: localDatetimeToIso(active.fromLocal),
        to: localDatetimeToIso(active.toLocal),
        routeMode: active.routeMode.trim() || undefined,
        model: active.model.trim() || undefined,
        keyword: active.keyword.trim() || undefined,
        estimated: active.estimated === null ? undefined : active.estimated,
      });
      setData(res);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setError(typeof msg === "string" ? msg : "加载 Token 账单失败，请稍后重试");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, active]);

  useEffect(() => {
    void load();
  }, [load]);

  const applySearch = () => {
    setPage(1);
    setActive({ ...draft });
  };

  const resetFilters = () => {
    setDraft(emptyFilters);
    setActive(emptyFilters);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Token 账单</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-xl">
            按时间、路由模式、模型与关键词筛选用量记录。关键词同时匹配模型名、上游 Base 与请求路径。
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-slate-600 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          刷新当前结果
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 ml-1">开始时间</label>
            <input
              type="datetime-local"
              value={draft.fromLocal}
              onChange={(e) => setDraft((d) => ({ ...d, fromLocal: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 ml-1">结束时间</label>
            <input
              type="datetime-local"
              value={draft.toLocal}
              onChange={(e) => setDraft((d) => ({ ...d, toLocal: e.target.value }))}
              className={inputClass}
            />
          </div>
          <FilterPortalSelect
            label="路由模式"
            value={draft.routeMode}
            options={[
              { value: "", label: "全部" },
              { value: "GATEWAY", label: "GATEWAY（云端中转）" },
              { value: "DIRECT", label: "DIRECT（本地直连）" },
              { value: "MAPPING", label: "MAPPING（映射）" },
            ]}
            placeholder="全部"
            onChange={(v) => setDraft((d) => ({ ...d, routeMode: v }))}
            className="w-full"
          />
          <FilterPortalSelect
            label="计量类型"
            value={draft.estimated === null ? "" : draft.estimated ? "est" : "exact"}
            options={[
              { value: "", label: "全部" },
              { value: "est", label: "仅估算（本地上报）" },
              { value: "exact", label: "仅精确（云端计数）" },
            ]}
            placeholder="全部"
            onChange={(v) =>
              setDraft((d) => ({
                ...d,
                estimated: v === "" ? null : v === "est",
              }))
            }
            className="w-full"
          />
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 ml-1">模型名（模糊）</label>
            <input
              type="text"
              value={draft.model}
              onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
              className={inputClass}
              placeholder="如 deepseek-chat"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 ml-1">
              关键词（模型 / 上游 / 路径）
            </label>
            <input
              type="text"
              value={draft.keyword}
              onChange={(e) => setDraft((d) => ({ ...d, keyword: e.target.value }))}
              className={inputClass}
              placeholder="在模型名、上游 Base、请求路径中搜索"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={applySearch}
            className="inline-flex items-center justify-center gap-1.5 min-w-[88px] rounded-full bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium px-4 py-2 shadow-sm disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                查询中…
              </>
            ) : (
              <>
                <Search className="w-3.5 h-3.5 shrink-0" />
                查询
              </>
            )}
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-full border border-slate-300 dark:border-slate-600 text-xs px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80"
          >
            重置条件
          </button>
          <div className="ml-auto flex items-end gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="pb-2">每页</span>
            <FilterPortalSelect
              value={String(pageSize)}
              options={[
                { value: "25", label: "25" },
                { value: "50", label: "50" },
                { value: "100", label: "100" },
              ]}
              placeholder="50"
              onChange={(v) => {
                setPageSize(Number(v));
                setPage(1);
              }}
              className="w-[76px]"
              menuMinWidth={76}
            />
            <span className="pb-2">条</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-full border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-sm px-4 py-2">
          {error}
        </div>
      )}

      {!loading && data && data.total > 0 && (
        <div className="flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-400">
          <span>
            符合条件共 <strong className="text-slate-900 dark:text-white">{data.total}</strong> 条
          </span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span>
            本页 Total 合计{" "}
            <strong className="text-slate-900 dark:text-white tabular-nums">{pageTokenSum.toLocaleString()}</strong> tokens
          </span>
        </div>
      )}

      {loading && <div className="text-sm text-slate-500 dark:text-slate-400">加载中…</div>}

      {!loading && (data?.items?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 overflow-x-auto">
          <table className="w-full text-xs min-w-[720px]">
            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300">
              <tr>
                <th className="px-3 py-2 text-left">时间</th>
                <th className="px-3 py-2 text-left">来源</th>
                <th className="px-3 py-2 text-left">Provider</th>
                <th className="px-3 py-2 text-left">模型 / 上游</th>
                <th className="px-3 py-2 text-right">Prompt</th>
                <th className="px-3 py-2 text-right">Completion</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">费用($)</th>
              </tr>
            </thead>
            <tbody>
              {data!.items.map((it: TokenUsageItem) => {
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
                          {it.estimated ? " · 估算" : ""}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {it.providerKey || "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                      <div className="text-slate-900 dark:text-white">{it.model || "—"}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[520px]">
                        {it.upstreamBase || "—"}
                      </div>
                      {it.requestPath && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-500 truncate max-w-[520px]">{it.requestPath}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{it.promptTokens ?? "—"}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{it.completionTokens ?? "—"}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">{it.totalTokens ?? "—"}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-400">
                      {it.costUsd != null && it.costUsd !== undefined ? it.costUsd.toFixed(4) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && (data?.items?.length ?? 0) === 0 && !error && (
        <div className="text-sm text-slate-500 dark:text-slate-400">暂无符合条件的账单记录</div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 disabled:opacity-50"
        >
          上一页
        </button>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          第 <span className="text-slate-900 dark:text-white">{page}</span> / {totalPages} 页（共 {data?.total ?? 0} 条）
        </div>
        <button
          type="button"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 disabled:opacity-50"
        >
          下一页
        </button>
      </div>
    </div>
  );
};
