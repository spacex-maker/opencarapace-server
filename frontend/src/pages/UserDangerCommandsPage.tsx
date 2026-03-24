/**
 * 当前用户：危险指令库浏览与个人启用偏好。
 */
import { useState, useEffect, useRef } from "react";
import { fetchDangerCommands, type DangerCommandItem, type DangerCommandPage, setMyDangerCommand } from "../api/client";
import { ShieldAlert, Search, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  CATEGORIES,
  DetailModal,
  FilterSelect,
  RISK_LEVELS,
  SYSTEM_TYPES,
  riskColor,
} from "./danger/dangerShared";

export function UserDangerCommandsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState<DangerCommandPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageNumber, setPageNumber] = useState(0);
  const [pageSize] = useState(15);
  const [systemType, setSystemType] = useState("");
  const [category, setCategory] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [keyword, setKeyword] = useState("");
  const [userEnabledFilter, setUserEnabledFilter] = useState<"" | "ENABLED" | "DISABLED">("");
  const [detailItem, setDetailItem] = useState<DangerCommandItem | null>(null);
  const [topMessage, setTopMessage] = useState<string | null>(null);
  const topMessageTimerRef = useRef<number | null>(null);

  const clearTopMessageTimer = () => {
    if (topMessageTimerRef.current !== null) {
      window.clearTimeout(topMessageTimerRef.current);
      topMessageTimerRef.current = null;
    }
  };

  const showTopMessage = (message: string) => {
    clearTopMessageTimer();
    setTopMessage(message);
    topMessageTimerRef.current = window.setTimeout(() => {
      setTopMessage(null);
      topMessageTimerRef.current = null;
    }, 2000);
  };

  const load = (showSuccessMessage = false) => {
    setLoading(true);
    setError("");
    fetchDangerCommands({
      page: pageNumber,
      size: pageSize,
      systemType: systemType || undefined,
      category: category || undefined,
      riskLevel: riskLevel || undefined,
      keyword: keyword.trim() || undefined,
      userEnabled: userEnabledFilter || undefined,
    })
      .then(setPage)
      .then(() => {
        if (showSuccessMessage) {
          showTopMessage("刷新成功");
        }
      })
      .catch((err) => {
        const msg =
          err?.response?.status === 403
            ? "无权限，仅管理员可查看危险指令库"
            : err?.response?.data?.message || "加载失败";
        setError(msg);
        setPage(null);
        if (showSuccessMessage) {
          setTopMessage(null);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [pageNumber, systemType, category, riskLevel, userEnabledFilter]);

  useEffect(() => () => clearTopMessageTimer(), []);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPageNumber(0);
    load();
  };

  const inputClass =
    "rounded-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">危险指令库</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              按系统类型、分类、风险等级筛选；可配置个人是否启用各条规则（在系统启用前提下生效）。
            </p>
          </div>
        </div>
        <div className="relative group text-[11px] text-slate-500 dark:text-slate-400 select-none">
          <button
            type="button"
            className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-slate-300 dark:border-slate-600 bg-white/80 dark:bg-slate-900/80 text-slate-500 dark:text-slate-300 text-[11px] font-semibold"
          >
            ?
          </button>
          <div className="hidden group-hover:block absolute right-0 mt-2 w-64 text-[11px] leading-relaxed rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl px-3 py-2 z-20">
            <div className="font-semibold text-slate-800 dark:text-slate-100 mb-1">系统启用 vs 我的启用</div>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>系统启用 = 规则是否在后台生效。</li>
              <li>我的启用 = 在系统启用前提下，当前账号是否允许匹配该规则。</li>
              <li>系统禁用时，无论个人如何配置，该规则都不会对你生效。</li>
              <li>系统启用时，个人显式禁用优先于默认启用。</li>
            </ul>
          </div>
        </div>
      </div>

      <form onSubmit={onSearch} className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">关键词</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="指令、标题、描述..."
              className={`w-full pl-8 pr-3 ${inputClass}`}
            />
          </div>
        </div>
        <FilterSelect
          label="系统类型"
          value={systemType}
          displayLabel="全部"
          options={[{ value: "", label: "全部" }, ...SYSTEM_TYPES.map((t) => ({ value: t, label: t }))]}
          onChange={setSystemType}
        />
        <FilterSelect
          label="分类"
          value={category}
          displayLabel="全部"
          options={[{ value: "", label: "全部" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]}
          onChange={setCategory}
        />
        <FilterSelect
          label="风险等级"
          value={riskLevel}
          displayLabel="全部"
          options={[{ value: "", label: "全部" }, ...RISK_LEVELS.map((r) => ({ value: r, label: r }))]}
          onChange={setRiskLevel}
        />
        <FilterSelect
          label="我的启用状态"
          value={userEnabledFilter}
          displayLabel="全部"
          options={[
            { value: "", label: "全部" },
            { value: "ENABLED", label: "启用" },
            { value: "DISABLED", label: "禁用" },
          ]}
          onChange={(v) => setUserEnabledFilter(v as typeof userEnabledFilter)}
        />
        <button
          type="submit"
          className="px-4 py-2 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium"
        >
          查询
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => load(true)}
          className="px-4 py-2 rounded-full border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "刷新中…" : "刷新"}
        </button>
      </form>

      {topMessage && (
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-400">
          {topMessage}
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-sm">加载中…</div>
      )}

      {!loading && page && (
        <>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-left">
                    <th className="px-4 py-3 font-medium">指令/模式</th>
                    <th className="px-4 py-3 font-medium">风险</th>
                    <th className="px-4 py-3 font-medium">标题</th>
                    <th className="px-4 py-3 font-medium w-24 text-center">系统启用</th>
                    <th className="px-4 py-3 font-medium w-32 text-center">我的启用</th>
                    <th className="px-4 py-3 font-medium w-24">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {page.content.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                        暂无数据
                      </td>
                    </tr>
                  ) : (
                    page.content.map((row: DangerCommandItem) => (
                      <tr
                        key={row.id}
                        className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-2.5 max-w-[220px]">
                          <div
                            className="font-mono text-xs text-slate-800 dark:text-slate-200 truncate"
                            title={row.commandPattern}
                          >
                            {row.commandPattern}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {row.systemType}
                            <span className="mx-1.5">·</span>
                            {row.category}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded border text-xs font-medium ${
                              riskColor[row.riskLevel] ?? "bg-slate-500/20 text-slate-600 dark:text-slate-300"
                            }`}
                          >
                            {row.riskLevel}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 max-w-[220px]">
                          <div className="text-slate-800 dark:text-slate-200 font-medium truncate" title={row.title}>
                            {row.title}
                          </div>
                          {row.description && (
                            <div
                              className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2"
                              title={row.description}
                            >
                              {row.description}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center align-middle">
                          {row.enabled ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40">
                              启用
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-500/10 text-slate-500 dark:text-slate-300 border border-slate-500/30">
                              禁用
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center align-middle">
                          {user ? (
                            row.enabled ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  const next = row.userEnabled === false ? true : false;
                                  const prev = row.userEnabled;
                                  setPage((prevPage) =>
                                    prevPage
                                      ? {
                                          ...prevPage,
                                          content: prevPage.content.map((c) =>
                                            c.id === row.id ? { ...c, userEnabled: next } : c,
                                          ),
                                        }
                                      : prevPage,
                                  );
                                  try {
                                    await setMyDangerCommand(row.id, next);
                                  } catch {
                                    setPage((prevPage) =>
                                      prevPage
                                        ? {
                                            ...prevPage,
                                            content: prevPage.content.map((c) =>
                                              c.id === row.id ? { ...c, userEnabled: prev } : c,
                                            ),
                                          }
                                        : prevPage,
                                    );
                                  }
                                }}
                                className="inline-flex items-center gap-2"
                              >
                                <span
                                  className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${
                                    row.userEnabled === false
                                      ? "bg-slate-500/80 dark:bg-slate-700"
                                      : "bg-emerald-500 dark:bg-emerald-400"
                                  }`}
                                >
                                  <span
                                    className={`absolute left-[2px] top-1/2 h-4 w-4 rounded-full bg-white shadow transition-transform -translate-y-1/2 ${
                                      row.userEnabled === false ? "translate-x-0" : "translate-x-[14px]"
                                    }`}
                                  />
                                </span>
                                <span className="text-[11px] text-slate-600 dark:text-slate-300">
                                  {row.userEnabled === false ? "已禁用" : "已启用"}
                                </span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400">系统禁用</span>
                            )
                          ) : (
                            <span className="text-[11px] text-slate-400">需登录</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setDetailItem(row)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            详情
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {page.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
              <span>
                共 {page.totalElements} 条，第 {page.number + 1} / {page.totalPages} 页
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page.first}
                  onClick={() => setPageNumber((p) => Math.max(0, p - 1))}
                  className="p-2 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={page.last}
                  onClick={() => setPageNumber((p) => Math.min(page.totalPages - 1, p + 1))}
                  className="p-2 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {detailItem && <DetailModal item={detailItem} onClose={() => setDetailItem(null)} />}
        </>
      )}
    </div>
  );
}
