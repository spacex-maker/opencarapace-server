import { useEffect, useState } from "react";
import {
  fetchSkills,
  updateSkill,
  manualFullSyncClawhubSkills,
  setMyUserSkill,
  type SkillItem,
  type SkillPage,
  type UpdateSkillDto,
} from "../api/client";
import { BookOpen, ChevronLeft, ChevronRight, Edit3, Save, Search, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

interface SkillsListPageProps {
  mode?: "user" | "admin";
}

function formatDate(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleString("zh-CN");
}

function SkillDetailModal({ item, onClose }: { item: SkillItem; onClose: () => void }) {
  const tags = item.tags ? item.tags.split(/[,，\s]+/).filter(Boolean) : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between shrink-0 px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">技能详情</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm">
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">名称</div>
            <div className="text-base font-semibold text-slate-900 dark:text-slate-100">{item.name}</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-300">
            <div>
              <div className="mb-0.5">Slug</div>
              <div className="font-mono break-all bg-slate-50 dark:bg-slate-800/50 rounded px-2 py-1">{item.slug}</div>
            </div>
            <div>
              <div className="mb-0.5">类型</div>
              <div>{item.type}</div>
            </div>
            <div>
              <div className="mb-0.5">分类</div>
              <div>{item.category || "—"}</div>
            </div>
            <div>
              <div className="mb-0.5">状态</div>
              <div>{item.status}</div>
            </div>
            <div>
              <div className="mb-0.5">来源</div>
              <div>{item.sourceName || "ClawHub"}</div>
            </div>
            <div>
              <div className="mb-0.5">最近同步时间</div>
              <div className="font-mono">{formatDate(item.lastSyncAt)}</div>
            </div>
          </div>
          {item.shortDesc && (
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">简介</div>
              <div className="text-sm text-slate-800 dark:text-slate-200">{item.shortDesc}</div>
            </div>
          )}
          {item.tags && (
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">标签</div>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
          {item.homepageUrl && (
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">主页</div>
              <a
                href={item.homepageUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 dark:text-blue-400 underline break-all"
              >
                {item.homepageUrl}
              </a>
            </div>
          )}
          {item.installHint && (
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">安装提示</div>
              <div className="text-xs text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/50 rounded px-3 py-2">
                {item.installHint}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SkillEditModal({
  item,
  onClose,
  onSaved,
}: {
  item: SkillItem;
  onClose: () => void;
  onSaved: (s: SkillItem) => void;
}) {
  const [form, setForm] = useState<UpdateSkillDto>({
    name: item.name,
    status: item.status,
    shortDesc: item.shortDesc ?? "",
    tags: item.tags ?? "",
    homepageUrl: item.homepageUrl ?? "",
    installHint: item.installHint ?? "",
    category: item.category ?? "",
    type: item.type,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = (field: keyof UpdateSkillDto, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: UpdateSkillDto = {
        ...form,
        shortDesc: form.shortDesc?.trim() || undefined,
        tags: form.tags?.trim() || undefined,
        homepageUrl: form.homepageUrl?.trim() || undefined,
        installHint: form.installHint?.trim() || undefined,
        category: form.category?.trim() || undefined,
      };
      const updated = await updateSkill(item.id, payload);
      onSaved(updated);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between shrink-0 px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">编辑技能</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-xs px-3 py-2">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">名称</label>
              <input
                type="text"
                value={form.name ?? ""}
                onChange={(e) => onChange("name", e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">类型</label>
              <input
                type="text"
                value={form.type ?? ""}
                onChange={(e) => onChange("type", e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">分类</label>
              <input
                type="text"
                value={form.category ?? ""}
                onChange={(e) => onChange("category", e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">状态</label>
              <select
                value={form.status ?? "ACTIVE"}
                onChange={(e) => onChange("status", e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="ACTIVE">ACTIVE（正常）</option>
                <option value="DEPRECATED">DEPRECATED（不推荐使用）</option>
                <option value="DISABLED">DISABLED（禁用）</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">简介</label>
            <textarea
              value={form.shortDesc ?? ""}
              onChange={(e) => onChange("shortDesc", e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">标签</label>
            <input
              type="text"
              value={form.tags ?? ""}
              onChange={(e) => onChange("tags", e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              placeholder="以逗号或空格分隔"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">主页</label>
            <input
              type="text"
              value={form.homepageUrl ?? ""}
              onChange={(e) => onChange("homepageUrl", e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">安装提示</label>
            <textarea
              value={form.installHint ?? ""}
              onChange={(e) => onChange("installHint", e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            disabled={saving}
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

export const SkillsListPage = ({ mode = "user" }: SkillsListPageProps) => {
  const { user } = useAuth();
  const isAdmin = mode === "admin" && user?.role === "ADMIN";

  const [page, setPage] = useState<SkillPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageNumber, setPageNumber] = useState(0);
  const [pageSize] = useState(20);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "ACTIVE" | "DEPRECATED" | "DISABLED">("");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [userEnabledFilter, setUserEnabledFilter] = useState<"" | "ENABLED" | "DISABLED" | "DEFAULT">("");
  const [detailItem, setDetailItem] = useState<SkillItem | null>(null);
  const [editItem, setEditItem] = useState<SkillItem | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError("");
    fetchSkills({ page: pageNumber, size: pageSize })
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

  const handleFullSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await manualFullSyncClawhubSkills();
      setSyncResult(`已从 ${res.source} 全量同步 ${res.synced} 条技能`);
      // 同步完成后刷新第一页数据
      setPageNumber(0);
      load();
    } catch (e: any) {
      setSyncResult(e?.response?.data?.message || e?.message || "同步失败");
    } finally {
      setSyncing(false);
    }
  };

  const filteredContent = page?.content.filter((s) => {
    const k = keyword.trim().toLowerCase();
    if (k) {
      const hitText =
        s.name.toLowerCase().includes(k) ||
        (s.slug && s.slug.toLowerCase().includes(k)) ||
        (s.shortDesc && s.shortDesc.toLowerCase().includes(k));
      if (!hitText) return false;
    }
    if (statusFilter && s.status !== statusFilter) return false;
    if (typeFilter.trim() && !s.type.toLowerCase().includes(typeFilter.trim().toLowerCase())) return false;
    if (categoryFilter.trim() && !(s.category || "").toLowerCase().includes(categoryFilter.trim().toLowerCase()))
      return false;
    if (userEnabledFilter) {
      const ue = s.userEnabled;
      if (userEnabledFilter === "ENABLED" && ue === false) return false;
      if (userEnabledFilter === "DISABLED" && ue !== false) return false;
      if (userEnabledFilter === "DEFAULT" && ue !== null && ue !== undefined) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">技能目录</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              来自 ClawHub 的已同步技能列表，{isAdmin ? "管理员可调整部分元信息" : "仅供查看"}。
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={handleFullSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {syncing ? "同步中…" : "手动全量同步"}
          </button>
        )}
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
              className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 pl-8 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
        </div>
        <div className="w-40">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">系统状态</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
          >
            <option value="">全部</option>
            <option value="ACTIVE">ACTIVE（正常）</option>
            <option value="DEPRECATED">DEPRECATED（不推荐）</option>
            <option value="DISABLED">DISABLED（禁用）</option>
          </select>
        </div>
        <div className="w-36">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">类型</label>
          <input
            type="text"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="w-40">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">分类</label>
          <input
            type="text"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="w-40">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">用户启用状态</label>
          <select
            value={userEnabledFilter}
            onChange={(e) => setUserEnabledFilter(e.target.value as typeof userEnabledFilter)}
            className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
          >
            <option value="">全部</option>
            <option value="ENABLED">显式启用</option>
            <option value="DISABLED">显式禁用</option>
            <option value="DEFAULT">默认启用（未配置）</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {syncResult && (
        <div className="rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs px-4 py-2 text-slate-700 dark:text-slate-200">
          {syncResult}
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-sm">加载中…</div>
      )}

      {!loading && page && (
        <>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-left">
                    <th className="px-4 py-3 font-medium">名称</th>
                    <th className="px-4 py-3 font-medium">类型/分类</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 font-medium">简介</th>
                    <th className="px-4 py-3 font-medium w-24">启用</th>
                    <th className="px-4 py-3 font-medium w-32">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {!filteredContent || filteredContent.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                        暂无数据
                      </td>
                    </tr>
                  ) : (
                    filteredContent.map((row) => (
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
                        <td className="px-4 py-2.5">
                          <div className="text-xs text-slate-700 dark:text-slate-200">{row.type}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{row.category || "—"}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-xs text-slate-700 dark:text-slate-200">
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 max-w-[260px]">
                          <div
                            className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2"
                            title={row.shortDesc || ""}
                          >
                            {row.shortDesc || "—"}
                          </div>
                        </td>
                        {/* 启用开关（普通用户可见；未配置 userEnabled 视为默认启用） */}
                        <td className="px-4 py-2.5">
                          {user ? (
                            <button
                              type="button"
                              onClick={async () => {
                                const next = !(row.userEnabled === false);
                                const prevEnabled = row.userEnabled;
                                // 乐观更新
                                setPage((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        content: prev.content.map((s) =>
                                          s.id === row.id ? { ...s, userEnabled: next } : s
                                        ),
                                      }
                                    : prev
                                );
                                try {
                                  await setMyUserSkill(row.slug, next);
                                } catch {
                                  // 失败回滚
                                  setPage((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          content: prev.content.map((s) =>
                                            s.id === row.id ? { ...s, userEnabled: prevEnabled } : s
                                          ),
                                        }
                                      : prev
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
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setDetailItem(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              详情
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => setEditItem(row)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                编辑
                              </button>
                            )}
                          </div>
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
                  className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={page.last}
                  onClick={() => setPageNumber((p) => Math.min(page.totalPages - 1, p + 1))}
                  className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {detailItem && <SkillDetailModal item={detailItem} onClose={() => setDetailItem(null)} />}
          {isAdmin && editItem && (
            <SkillEditModal
              item={editItem}
              onClose={() => setEditItem(null)}
              onSaved={(updated) => {
                setPage((prev) =>
                  prev
                    ? {
                        ...prev,
                        content: prev.content.map((s) => (s.id === updated.id ? updated : s)),
                      }
                    : prev,
                );
              }}
            />
          )}
        </>
      )}
    </div>
  );
};

