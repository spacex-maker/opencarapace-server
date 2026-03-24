/**
 * 管理员：全站用户的 LLM 代理拦截日志（与「我的拦截日志」数据源一致，但跨用户 + 高级筛选）。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAdminBlockLogDetail,
  fetchAdminBlockLogs,
  type AdminBlockLogDetail,
  type AdminBlockLogRow,
} from "../api/client";
import { RefreshCw, Search, ShieldAlert, X } from "lucide-react";

type BlockTypeFilter = "" | "skill_disabled" | "danger_command";

type ActiveFilters = {
  userId: string;
  email: string;
  blockType: BlockTypeFilter;
  riskLevel: string;
  fromLocal: string;
  toLocal: string;
  keyword: string;
};

const emptyFilters: ActiveFilters = {
  userId: "",
  email: "",
  blockType: "",
  riskLevel: "",
  fromLocal: "",
  toLocal: "",
  keyword: "",
};

function formatBlockType(value?: string | null): string {
  if (!value) return "-";
  if (value === "danger_command") return "危险指令";
  if (value === "skill_disabled") return "技能禁用";
  return value;
}

function formatLocalDateTime(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("zh-CN", { hour12: false });
}

function localDatetimeToIso(local: string): string | undefined {
  if (!local || !local.trim()) return undefined;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function riskBadgeClass(level?: string | null): string {
  const r = String(level || "").toLowerCase();
  const base = "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide";
  if (r === "critical")
    return `${base} border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300`;
  if (r === "high")
    return `${base} border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300`;
  if (r === "medium")
    return `${base} border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200`;
  if (r === "low")
    return `${base} border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200`;
  return `${base} border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300`;
}

const inputRound =
  "w-full min-w-0 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-xs rounded-full outline-none focus:ring-2 focus:ring-brand-500/35";

const selectRound =
  "w-full min-w-0 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-xs rounded-full outline-none focus:ring-2 focus:ring-brand-500/35 appearance-none bg-[length:14px] bg-[right_10px_center] bg-no-repeat pr-9";

export function AdminInterceptLogsPage() {
  const [draft, setDraft] = useState<ActiveFilters>(emptyFilters);
  const [active, setActive] = useState<ActiveFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [size] = useState(50);
  const [items, setItems] = useState<AdminBlockLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminBlockLogDetail | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / size)), [total, size]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const uid = active.userId.trim() ? Number(active.userId.trim()) : undefined;
      const data = await fetchAdminBlockLogs({
        page,
        size,
        userId: uid != null && !Number.isNaN(uid) ? uid : undefined,
        email: active.email.trim() || undefined,
        blockType: active.blockType || undefined,
        riskLevel: active.riskLevel.trim() || undefined,
        from: localDatetimeToIso(active.fromLocal),
        to: localDatetimeToIso(active.toLocal),
        keyword: active.keyword.trim() || undefined,
      });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotal(typeof data?.total === "number" ? data.total : 0);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setError(typeof msg === "string" ? msg : "加载失败");
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
      const d = await fetchAdminBlockLogDetail(id);
      setDetail(d);
      if (!d) setDetailError("未找到该记录");
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setDetailError(typeof msg === "string" ? msg : "加载详情失败");
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-5">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-brand-500/10 p-2 text-brand-600 dark:text-brand-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-white m-0">全站拦截日志</h1>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 m-0 max-w-xl">
                查看所有用户的 LLM 代理拦截记录。支持按用户、邮箱、类型、风险、时间与关键词（匹配原因或完整内容）筛选。
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 ml-1">用户 ID</label>
            <input
              type="text"
              inputMode="numeric"
              value={draft.userId}
              onChange={(e) => setDraft((d) => ({ ...d, userId: e.target.value }))}
              className={inputRound}
              placeholder="精确匹配"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 ml-1">用户邮箱</label>
            <input
              type="text"
              value={draft.email}
              onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
              className={inputRound}
              placeholder="模糊匹配"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 ml-1">拦截类型</label>
            <select
              value={draft.blockType}
              onChange={(e) =>
                setDraft((d) => ({ ...d, blockType: e.target.value as BlockTypeFilter }))
              }
              className={selectRound}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              }}
            >
              <option value="">全部</option>
              <option value="skill_disabled">技能禁用</option>
              <option value="danger_command">危险指令</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 ml-1">风险等级</label>
            <select
              value={draft.riskLevel}
              onChange={(e) => setDraft((d) => ({ ...d, riskLevel: e.target.value }))}
              className={selectRound}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              }}
            >
              <option value="">全部</option>
              <option value="low">low</option>
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="critical">critical</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 ml-1">开始时间</label>
            <input
              type="datetime-local"
              value={draft.fromLocal}
              onChange={(e) => setDraft((d) => ({ ...d, fromLocal: e.target.value }))}
              className={inputRound}
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 ml-1">结束时间</label>
            <input
              type="datetime-local"
              value={draft.toLocal}
              onChange={(e) => setDraft((d) => ({ ...d, toLocal: e.target.value }))}
              className={inputRound}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-2 xl:col-span-2">
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 ml-1">
              关键词（原因或完整内容）
            </label>
            <input
              type="text"
              value={draft.keyword}
              onChange={(e) => setDraft((d) => ({ ...d, keyword: e.target.value }))}
              className={inputRound}
              placeholder="模糊匹配，例如命令片段、技能名…"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={applySearch}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium px-4 py-2 shadow-sm"
          >
            <Search className="w-3.5 h-3.5" />
            查询
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-full border border-slate-300 dark:border-slate-600 text-xs font-medium px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
          >
            重置条件
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-full border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300 text-xs px-4 py-2">
            {error}
          </div>
        )}

        <div className="mt-5 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[720px]">
            <thead className="bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="text-left font-medium px-3 py-2.5 w-[200px]">用户</th>
                <th className="text-left font-medium px-3 py-2.5 w-[130px]">类型 / 风险</th>
                <th className="text-left font-medium px-3 py-2.5">触发原因 / 摘要</th>
                <th className="text-left font-medium px-3 py-2.5 w-[160px]">时间</th>
                <th className="w-[72px]" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-500 dark:text-slate-500">
                    {loading ? "正在加载…" : "暂无数据。"}
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr key={it.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="px-3 py-2 align-top text-slate-800 dark:text-slate-200">
                      <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">#{it.userId ?? "-"}</div>
                      <div className="mt-0.5 break-all text-slate-700 dark:text-slate-300">{it.userEmail || "-"}</div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{formatBlockType(it.blockType)}</div>
                      <div className={`mt-1 ${riskBadgeClass(it.riskLevel)}`}>{String(it.riskLevel || "-").toUpperCase()}</div>
                    </td>
                    <td className="px-3 py-2 align-top text-slate-600 dark:text-slate-400">
                      <div className="line-clamp-2">{it.reasons || "-"}</div>
                      {it.promptSnippet && (
                        <div className="mt-1 font-mono text-[10px] text-slate-500 dark:text-slate-500 line-clamp-2 opacity-90">
                          {it.promptSnippet}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top whitespace-nowrap text-slate-700 dark:text-slate-300">
                      {formatLocalDateTime(it.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      <button
                        type="button"
                        onClick={() => void openDetail(it.id)}
                        className="text-[11px] px-2.5 py-1 rounded-full border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900"
                      >
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
          <button
            type="button"
            disabled={loading || page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 disabled:opacity-50"
          >
            上一页
          </button>
          <span>
            第 <span className="text-slate-900 dark:text-slate-200">{page}</span> / {totalPages} 页（共 {total} 条）
          </span>
          <button
            type="button"
            disabled={loading || page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      </div>

      {detailOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 dark:bg-black/70 flex items-center justify-center p-4"
          onClick={() => setDetailOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[min(920px,96vw)] max-h-[86vh] overflow-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 m-0">拦截详情（管理员）</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {formatBlockType(detail?.blockType ?? null)}
                  </span>
                  <span className={riskBadgeClass(detail?.riskLevel)}>{String(detail?.riskLevel || "-").toUpperCase()}</span>
                  <span className="text-[11px] text-slate-500">ID: {detail?.id ?? "-"}</span>
                </div>
                <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-400">
                  用户 #{detail?.userId ?? "-"} · {detail?.userEmail ?? "-"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                className="p-2 rounded-full border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 shrink-0"
                aria-label="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3">
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">时间</div>
                <div className="text-xs font-mono text-slate-800 dark:text-slate-200">{formatLocalDateTime(detail?.createdAt)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3">
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">触发原因</div>
                <div className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
                  {detailLoading ? "加载中…" : detailError ? detailError : detail?.reasons || "-"}
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">完整内容</div>
              <pre className="m-0 max-h-[42vh] overflow-auto whitespace-pre-wrap break-words text-xs text-slate-800 dark:text-slate-200 font-mono">
                {detailLoading ? "加载中…" : detail?.rawInput || "-"}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
