import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAdminTrackingEventDetail,
  fetchAdminTrackingEvents,
  type AdminTrackingEventDetail,
  type AdminTrackingEventRow,
} from "../api/client";
import { Activity, ChevronRight, Clock, Loader2, Search, User, X } from "lucide-react";

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

function platformBadge(platform: string | null | undefined): { label: string; className: string } {
  const raw = (platform || "").trim();
  const p = raw.toLowerCase();
  const base = "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide";
  if (!p) return { label: "—", className: `${base} bg-slate-500/10 text-slate-500 dark:text-slate-500 ring-1 ring-slate-500/15` };
  if (p === "web") return { label: "Web", className: `${base} bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/25` };
  if (p === "desktop") return { label: "Desktop", className: `${base} bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/25` };
  if (p === "android") return { label: "Android", className: `${base} bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/25` };
  if (p === "ios") return { label: "iOS", className: `${base} bg-amber-500/15 text-amber-800 dark:text-amber-300 ring-1 ring-amber-500/25` };
  return { label: raw, className: `${base} bg-slate-500/10 text-slate-600 dark:text-slate-400 ring-1 ring-slate-500/20` };
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

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300 text-xs px-4 py-3">
            {error}
          </div>
        )}

        <div className="mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 px-0.5">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">{total.toLocaleString("zh-CN")}</span>
              <span>条匹配记录</span>
              {loading ? (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  刷新中
                </span>
              ) : null}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-500">
              本页 {items.length} 条 · 每页 {size} 条
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/50 overflow-hidden shadow-sm">
            {items.length === 0 ? (
              <div className="px-6 py-16 text-center">
                {loading ? (
                  <div className="inline-flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                    正在加载埋点数据…
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-500 m-0">暂无数据，可调整筛选条件后重试。</p>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-slate-200/80 dark:divide-slate-800/90">
                {items.map((it) => {
                  const plat = platformBadge(it.platform);
                  return (
                    <li key={it.id}>
                      <div className="group flex flex-col lg:flex-row lg:items-stretch gap-4 p-4 sm:p-5 bg-white dark:bg-slate-950/40 hover:bg-brand-500/[0.03] dark:hover:bg-brand-500/[0.06] transition-colors">
                        <div className="flex-1 min-w-0 space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="m-0 text-sm sm:text-base font-bold text-slate-900 dark:text-white font-mono tracking-tight break-all">
                                  {it.eventName}
                                </h3>
                                <span className={plat.className}>{plat.label}</span>
                                {it.module ? (
                                  <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                    {it.module}
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                                <span className="inline-flex items-center gap-1.5 min-w-0">
                                  <User className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-500 shrink-0">#{it.userId ?? "—"}</span>
                                  <span className="truncate max-w-[220px] sm:max-w-[320px]" title={it.userEmail || undefined}>
                                    {it.userEmail || "未登录 / 无邮箱"}
                                  </span>
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 lg:flex-col lg:items-end lg:justify-start">
                              <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                <Clock className="w-3.5 h-3.5 shrink-0" />
                                {formatLocalDateTime(it.eventTime)}
                              </div>
                              <button
                                type="button"
                                onClick={() => void openDetail(it.id)}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-sm hover:border-brand-500/40 hover:text-brand-600 dark:hover:text-brand-400 hover:shadow-md transition-all"
                              >
                                详情
                                <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                              </button>
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/60 px-3 py-2.5">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                              页面
                            </div>
                            <div className="font-mono text-xs text-slate-800 dark:text-slate-200 break-all line-clamp-2">
                              {it.pageId || "—"}
                            </div>
                            {(it.eventPropsSnippet || "").trim() ? (
                              <>
                                <div className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                  属性摘要
                                </div>
                                <div className="mt-0.5 font-mono text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-2 break-all">
                                  {it.eventPropsSnippet}
                                </div>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40 px-4 py-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 m-0 tabular-nums">
            第 <span className="font-semibold text-slate-800 dark:text-slate-200">{page}</span>
            <span className="mx-1">/</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{totalPages}</span> 页
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-45 disabled:pointer-events-none transition-colors"
            >
              上一页
            </button>
            <button
              type="button"
              disabled={loading || page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-45 disabled:pointer-events-none transition-colors"
            >
              下一页
            </button>
          </div>
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

