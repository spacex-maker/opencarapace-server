/**
 * 当前登录用户：个人技能偏好（启用/禁用、安全打标），与全局 oc_skills 管理无关。
 */
import { useEffect, useState } from "react";
import { fetchSkills, setMyUserSkill, setMySkillSafetyLabel, type SkillItem, type SkillPage } from "../api/client";
import { BookOpen, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { FilterSelect, SkillDetailModal } from "./skills/skillListShared";

type UserSafetyLabel = "SAFE" | "UNSAFE";

function safetyMarkCountDelta(
  prev: UserSafetyLabel | null,
  next: UserSafetyLabel,
): { dSafe: number; dUnsafe: number } {
  return {
    dSafe: next === "SAFE" ? 1 : prev === "SAFE" ? -1 : 0,
    dUnsafe: next === "UNSAFE" ? 1 : prev === "UNSAFE" ? -1 : 0,
  };
}

export function UserSkillsPage() {
  const { user } = useAuth();

  const [page, setPage] = useState<SkillPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageNumber, setPageNumber] = useState(0);
  const [pageSize] = useState(20);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "ACTIVE" | "DEPRECATED" | "DISABLED">("");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [userEnabledFilter, setUserEnabledFilter] = useState<"" | "ENABLED" | "DISABLED">("");
  const [detailItem, setDetailItem] = useState<SkillItem | null>(null);

  const load = () => {
    setLoading(true);
    setError("");
    fetchSkills({
      page: pageNumber,
      size: pageSize,
      status: statusFilter || undefined,
      type: typeFilter.trim() || undefined,
      category: categoryFilter.trim() || undefined,
      keyword: keyword.trim() || undefined,
      userEnabled: userEnabledFilter || undefined,
    })
      .then(setPage)
      .catch((err) => {
        setError(err?.response?.data?.message || "加载失败");
        setPage(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [pageNumber]);

  const handleSearch = () => {
    if (pageNumber !== 0) {
      setPageNumber(0);
    } else {
      load();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">我的技能偏好</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              浏览全站技能目录，并配置当前账号下的启用状态与安全打标（不影响其他用户或全局系统状态）。
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">搜索</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="按名称 / slug / 简介搜索"
              className="w-full rounded-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
        </div>
        <FilterSelect
          label="系统状态"
          value={statusFilter}
          displayLabel="全部"
          options={[
            { value: "", label: "全部" },
            { value: "ACTIVE", label: "ACTIVE（正常）" },
            { value: "DEPRECATED", label: "DEPRECATED（不推荐）" },
            { value: "DISABLED", label: "DISABLED（禁用）" },
          ]}
          onChange={(v) => setStatusFilter(v as typeof statusFilter)}
        />
        <div className="w-36">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">类型</label>
          <input
            type="text"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full rounded-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="w-40">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">分类</label>
          <input
            type="text"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full rounded-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
          />
        </div>
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
        <div className="flex items-end pb-[2px]">
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading}
            className="px-4 py-2 rounded-full bg-brand-500 hover:bg-brand-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-medium"
          >
            {loading ? "查询中…" : "查询"}
          </button>
        </div>
      </div>

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
                    <th className="px-4 py-3 font-medium">名称</th>
                    <th className="px-4 py-3 font-medium">类型/分类</th>
                    <th className="px-4 py-3 font-medium">状态 / 打标</th>
                    <th className="px-4 py-3 font-medium">简介</th>
                    <th className="px-4 py-3 font-medium w-36">我的启用</th>
                    <th className="px-4 py-3 font-medium w-24">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {!page.content || page.content.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                        暂无数据
                      </td>
                    </tr>
                  ) : (
                    page.content.map((row) => (
                      <tr
                        key={row.id}
                        className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-2.5 max-w-[220px]">
                          <div className="text-slate-800 dark:text-slate-200 font-medium truncate" title={row.name}>
                            {row.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono truncate">
                            {row.slug}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="text-xs text-slate-700 dark:text-slate-200">{row.type}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{row.category || "—"}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="space-y-1.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-xs text-slate-700 dark:text-slate-200">
                              {row.status}
                            </span>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              安全 {row.safeMarkCount ?? 0} / 不安全 {row.unsafeMarkCount ?? 0}
                            </div>
                            {user ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const prev = row.userSafetyLabel ?? null;
                                    const prevSafeCount = row.safeMarkCount ?? 0;
                                    const prevUnsafeCount = row.unsafeMarkCount ?? 0;
                                    const next: UserSafetyLabel = "SAFE";
                                    if (prev === next) return;
                                    const { dSafe, dUnsafe } = safetyMarkCountDelta(prev, next);
                                    setPage((p) =>
                                      p
                                        ? {
                                            ...p,
                                            content: p.content.map((s) =>
                                              s.id === row.id
                                                ? {
                                                    ...s,
                                                    userSafetyLabel: next,
                                                    safeMarkCount: (s.safeMarkCount ?? 0) + dSafe,
                                                    unsafeMarkCount: (s.unsafeMarkCount ?? 0) + dUnsafe,
                                                  }
                                                : s,
                                            ),
                                          }
                                        : p,
                                    );
                                    try {
                                      await setMySkillSafetyLabel(row.slug, next);
                                    } catch {
                                      setPage((p) =>
                                        p
                                          ? {
                                              ...p,
                                              content: p.content.map((s) =>
                                                s.id === row.id
                                                  ? {
                                                      ...s,
                                                      userSafetyLabel: prev,
                                                      safeMarkCount: prevSafeCount,
                                                      unsafeMarkCount: prevUnsafeCount,
                                                    }
                                                  : s,
                                              ),
                                            }
                                          : p,
                                      );
                                    }
                                  }}
                                  className={`px-2 py-0.5 rounded-full text-[11px] border ${
                                    row.userSafetyLabel === "SAFE"
                                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/40"
                                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600"
                                  }`}
                                >
                                  安全
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const prev = row.userSafetyLabel ?? null;
                                    const prevSafeCount = row.safeMarkCount ?? 0;
                                    const prevUnsafeCount = row.unsafeMarkCount ?? 0;
                                    const next: UserSafetyLabel = "UNSAFE";
                                    if (prev === next) return;
                                    const { dSafe, dUnsafe } = safetyMarkCountDelta(prev, next);
                                    setPage((p) =>
                                      p
                                        ? {
                                            ...p,
                                            content: p.content.map((s) =>
                                              s.id === row.id
                                                ? {
                                                    ...s,
                                                    userSafetyLabel: next,
                                                    safeMarkCount: (s.safeMarkCount ?? 0) + dSafe,
                                                    unsafeMarkCount: (s.unsafeMarkCount ?? 0) + dUnsafe,
                                                  }
                                                : s,
                                            ),
                                          }
                                        : p,
                                    );
                                    try {
                                      await setMySkillSafetyLabel(row.slug, next);
                                    } catch {
                                      setPage((p) =>
                                        p
                                          ? {
                                              ...p,
                                              content: p.content.map((s) =>
                                                s.id === row.id
                                                  ? {
                                                      ...s,
                                                      userSafetyLabel: prev,
                                                      safeMarkCount: prevSafeCount,
                                                      unsafeMarkCount: prevUnsafeCount,
                                                    }
                                                  : s,
                                              ),
                                            }
                                          : p,
                                      );
                                    }
                                  }}
                                  className={`px-2 py-0.5 rounded-full text-[11px] border ${
                                    row.userSafetyLabel === "UNSAFE"
                                      ? "bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/40"
                                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600"
                                  }`}
                                >
                                  不安全
                                </button>
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-400">登录后可打标</div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 max-w-[260px]">
                          <div
                            className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2"
                            title={row.shortDesc || ""}
                          >
                            {row.shortDesc || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {user ? (
                            <button
                              type="button"
                              onClick={async () => {
                                const next = !(row.userEnabled === false);
                                const prevEnabled = row.userEnabled;
                                setPage((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        content: prev.content.map((s) =>
                                          s.id === row.id ? { ...s, userEnabled: next } : s,
                                        ),
                                      }
                                    : prev,
                                );
                                try {
                                  await setMyUserSkill(row.slug, next);
                                } catch {
                                  setPage((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          content: prev.content.map((s) =>
                                            s.id === row.id ? { ...s, userEnabled: prevEnabled } : s,
                                          ),
                                        }
                                      : prev,
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
                            <span className="text-xs text-slate-400">需登录</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setDetailItem(row)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
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

          {detailItem && <SkillDetailModal item={detailItem} onClose={() => setDetailItem(null)} />}
        </>
      )}
    </div>
  );
}
