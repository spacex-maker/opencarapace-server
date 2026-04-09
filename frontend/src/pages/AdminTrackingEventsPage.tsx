import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAdminTrackingEventDetail,
  fetchAdminTrackingEvents,
  type AdminTrackingEventDetail,
  type AdminTrackingEventRow,
} from "../api/client";
import { Activity, Loader2, Search, X } from "lucide-react";

type ActiveFilters = {
  userId: string;
  anonymousId: string;
  sessionId: string;
  eventName: string;
  platform: "" | "web" | "desktop" | "android" | "ios";
  pageId: string;
  module: string;
  fromLocal: string;
  toLocal: string;
  keyword: string;
};

const emptyFilters: ActiveFilters = {
  userId: "",
  anonymousId: "",
  sessionId: "",
  eventName: "",
  platform: "",
  pageId: "",
  module: "",
  fromLocal: "",
  toLocal: "",
  keyword: "",
};

const inputRound =
  "w-full min-w-0 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-xs rounded-full outline-none focus:ring-2 focus:ring-brand-500/35";

function localDatetimeToIso(local: string): string | undefined {
  if (!local || !local.trim()) return undefined;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function formatLocalDateTime(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("zh-CN", { hour12: false });
}

export function AdminTrackingEventsPage() {
  const [draft, setDraft] = useState<ActiveFilters>(emptyFilters);
  const [active, setActive] = useState<ActiveFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [size] = useState(50);
  const [items, setItems] = useState<AdminTrackingEventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminTrackingEventDetail | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / size)), [total, size]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const uid = active.userId.trim() ? Number(active.userId.trim()) : undefined;
      const data = await fetchAdminTrackingEvents({
        page,
        size,
        userId: uid != null && !Number.isNaN(uid) ? uid : undefined,
        anonymousId: active.anonymousId.trim() || undefined,
        sessionId: active.sessionId.trim() || undefined,
        eventName: active.eventName.trim() || undefined,
        platform: active.platform || undefined,
        pageId: active.pageId.trim() || undefined,
        module: active.module.trim() || undefined,
        from: localDatetimeToIso(active.fromLocal),
        to: localDatetimeToIso(active.toLocal),
        keyword: active.keyword.trim() || undefined,
      });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotal(typeof data?.total === "number" ? data.total : 0);
    } catch {
      setError("加载埋点数据失败");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, size, active]);

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

  const openDetail = async (id: number) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const d = await fetchAdminTrackingEventDetail(id);
      setDetail(d);
      if (!d) setDetailError("未找到该记录");
    } catch {
      setDetailError("加载详情失败");
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto space-y-5">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-brand-500/10 p-2 text-brand-600 dark:text-brand-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white m-0">埋点管理</h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 m-0 max-w-2xl">
              支持按用户、匿名标识、会话、事件名、平台、页面、模块、时间范围和关键词进行高级查询。
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 ml-1">用户 ID</label>
            <input type="text" inputMode="numeric" value={draft.userId} onChange={(e) => setDraft((d) => ({ ...d, userId: e.target.value }))} className={inputRound} placeholder="精确匹配" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 ml-1">匿名 ID</label>
            <input type="text" value={draft.anonymousId} onChange={(e) => setDraft((d) => ({ ...d, anonymousId: e.target.value }))} className={inputRound} placeholder="精确匹配" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 ml-1">会话 ID</label>
            <input type="text" value={draft.sessionId} onChange={(e) => setDraft((d) => ({ ...d, sessionId: e.target.value }))} className={inputRound} placeholder="精确匹配" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 ml-1">事件名</label>
            <input type="text" value={draft.eventName} onChange={(e) => setDraft((d) => ({ ...d, eventName: e.target.value }))} className={inputRound} placeholder="如 page_view" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 ml-1">平台</label>
            <div className="flex flex-wrap gap-2">
              {["", "web", "desktop", "android", "ios"].map((p) => (
                <button
                  key={p || "all"}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, platform: p as ActiveFilters["platform"] }))}
                  className={`rounded-full px-3 py-1.5 text-[11px] border ${
                    draft.platform === p
                      ? "border-brand-500 bg-brand-500 text-white"
                      : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {p || "全部"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 ml-1">页面标识</label>
            <input type="text" value={draft.pageId} onChange={(e) => setDraft((d) => ({ ...d, pageId: e.target.value }))} className={inputRound} placeholder="模糊匹配" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 ml-1">模块</label>
            <input type="text" value={draft.module} onChange={(e) => setDraft((d) => ({ ...d, module: e.target.value }))} className={inputRound} placeholder="模糊匹配" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 ml-1">开始时间</label>
            <input type="datetime-local" value={draft.fromLocal} onChange={(e) => setDraft((d) => ({ ...d, fromLocal: e.target.value }))} className={inputRound} />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 ml-1">结束时间</label>
            <input type="datetime-local" value={draft.toLocal} onChange={(e) => setDraft((d) => ({ ...d, toLocal: e.target.value }))} className={inputRound} />
          </div>
          <div className="sm:col-span-2 lg:col-span-2 xl:col-span-2">
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 ml-1">关键词（事件/上下文 JSON）</label>
            <input type="text" value={draft.keyword} onChange={(e) => setDraft((d) => ({ ...d, keyword: e.target.value }))} className={inputRound} placeholder="模糊匹配" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={applySearch}
            className="inline-flex items-center justify-center gap-1.5 min-w-[96px] rounded-full bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium px-4 py-2 shadow-sm disabled:opacity-60 disabled:pointer-events-none"
          >
            {loading ? <><Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />查询中…</> : <><Search className="w-3.5 h-3.5 shrink-0" />查询</>}
          </button>
          <button type="button" onClick={resetFilters} className="rounded-full border border-slate-300 dark:border-slate-600 text-xs font-medium px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900">
            重置条件
          </button>
        </div>

        {error && <div className="mt-4 rounded-full border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300 text-xs px-4 py-2">{error}</div>}

        <div className="mt-5 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[900px]">
            <thead className="bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="text-left font-medium px-3 py-2.5 w-[200px]">用户</th>
                <th className="text-left font-medium px-3 py-2.5 w-[160px]">事件</th>
                <th className="text-left font-medium px-3 py-2.5 w-[140px]">平台/模块</th>
                <th className="text-left font-medium px-3 py-2.5">页面 / 属性摘要</th>
                <th className="text-left font-medium px-3 py-2.5 w-[180px]">时间</th>
                <th className="w-[72px]" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500 dark:text-slate-500">{loading ? "正在加载…" : "暂无数据。"}</td></tr>
              ) : (
                items.map((it) => (
                  <tr key={it.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="px-3 py-2 align-top text-slate-800 dark:text-slate-200">
                      <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">#{it.userId ?? "-"}</div>
                      <div className="mt-0.5 break-all text-slate-700 dark:text-slate-300">{it.userEmail || "-"}</div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{it.eventName}</div>
                    </td>
                    <td className="px-3 py-2 align-top text-slate-700 dark:text-slate-300">
                      <div>{it.platform || "-"}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{it.module || "-"}</div>
                    </td>
                    <td className="px-3 py-2 align-top text-slate-600 dark:text-slate-400">
                      <div className="line-clamp-1">{it.pageId || "-"}</div>
                      <div className="mt-1 font-mono text-[10px] text-slate-500 dark:text-slate-500 line-clamp-2">{it.eventPropsSnippet || "-"}</div>
                    </td>
                    <td className="px-3 py-2 align-top whitespace-nowrap text-slate-700 dark:text-slate-300">{formatLocalDateTime(it.eventTime)}</td>
                    <td className="px-3 py-2 text-right align-top">
                      <button type="button" onClick={() => void openDetail(it.id)} className="text-[11px] px-2.5 py-1 rounded-full border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900">
                        详情
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <button type="button" disabled={loading || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 disabled:opacity-50">上一页</button>
          <span>第 <span className="text-slate-900 dark:text-slate-200">{page}</span> / {totalPages} 页（共 {total} 条）</span>
          <button type="button" disabled={loading || page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 disabled:opacity-50">下一页</button>
        </div>
      </div>

      {detailOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/60 dark:bg-black/70 flex items-center justify-center p-4" onClick={() => setDetailOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-[min(960px,96vw)] max-h-[86vh] overflow-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 m-0">埋点详情（管理员）</h2>
                <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-400">
                  事件ID: {detail?.eventId || "-"} · 用户 #{detail?.userId ?? "-"} · {detail?.userEmail || "-"}
                </div>
              </div>
              <button type="button" onClick={() => setDetailOpen(false)} className="p-2 rounded-full border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 shrink-0" aria-label="关闭">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 text-xs">
                <div>eventName: {detailLoading ? "加载中…" : detail?.eventName || "-"}</div>
                <div className="mt-1">platform: {detail?.platform || "-"}</div>
                <div className="mt-1">pageId: {detail?.pageId || "-"}</div>
                <div className="mt-1">module: {detail?.module || "-"}</div>
                <div className="mt-1">eventTime: {formatLocalDateTime(detail?.eventTime)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 text-xs">
                <div>anonymousId: {detail?.anonymousId || "-"}</div>
                <div className="mt-1">sessionId: {detail?.sessionId || "-"}</div>
                <div className="mt-1">appVersion: {detail?.appVersion || "-"}</div>
                <div className="mt-1">ip: {detail?.ip || "-"}</div>
                <div className="mt-1 break-all">userAgent: {detail?.userAgent || "-"}</div>
              </div>
            </div>
            {detailError && <div className="mt-3 rounded-full border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300 text-xs px-4 py-2">{detailError}</div>}
            <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">eventPropsJson</div>
              <pre className="m-0 max-h-[28vh] overflow-auto whitespace-pre-wrap break-words text-xs text-slate-800 dark:text-slate-200 font-mono">{detailLoading ? "加载中…" : detail?.eventPropsJson || "-"}</pre>
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">contextPropsJson</div>
              <pre className="m-0 max-h-[28vh] overflow-auto whitespace-pre-wrap break-words text-xs text-slate-800 dark:text-slate-200 font-mono">{detailLoading ? "加载中…" : detail?.contextPropsJson || "-"}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

