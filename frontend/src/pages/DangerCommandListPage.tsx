import { useState, useEffect } from "react";
import {
  fetchDangerCommands,
  type DangerCommandItem,
  type DangerCommandPage,
  updateDangerCommand,
  type DangerCommandDto,
} from "../api/client";
import { ShieldAlert, Search, ChevronLeft, ChevronRight, FileText, X, Edit3, Save } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const SYSTEM_TYPES = [
  "LINUX",
  "WINDOWS",
  "DATABASE",
  "SHELL",
  "DOCKER",
  "KUBERNETES",
  "GIT",
  "OTHER",
];
const CATEGORIES = [
  "FILE_SYSTEM",
  "DATABASE",
  "NETWORK",
  "PROCESS",
  "PERMISSION",
  "CONTAINER",
  "VERSION_CONTROL",
  "OTHER",
];
const RISK_LEVELS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const riskColor: Record<string, string> = {
  CRITICAL: "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/40",
  HIGH: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40",
  MEDIUM: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/40",
  LOW: "bg-slate-500/20 text-slate-600 dark:text-slate-300 border-slate-500/40",
};

function truncate(s: string | null, max: number) {
  if (!s) return "—";
  return s.length <= max ? s : s.slice(0, max) + "…";
}

function formatDate(s: string | undefined) {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleString("zh-CN");
  } catch {
    return s;
  }
}

/** 详情模态框 */
function DetailModal({
  item,
  onClose,
  riskColor,
}: {
  item: DangerCommandItem;
  onClose: () => void;
  riskColor: Record<string, string>;
}) {
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
            <FileText className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">危险指令详情</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 dark:hover:bg-slate-800"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              基本信息
            </h4>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-slate-500 dark:text-slate-400 mb-0.5">指令/模式</dt>
                <dd className="font-mono text-slate-900 dark:text-slate-100 break-all bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2">
                  {item.commandPattern}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400 mb-0.5">标题</dt>
                <dd className="text-slate-900 dark:text-slate-100 font-medium">{item.title}</dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400 mb-0.5">系统类型</dt>
                <dd className="text-slate-800 dark:text-slate-200">{item.systemType}</dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400 mb-0.5">分类</dt>
                <dd className="text-slate-800 dark:text-slate-200">{item.category}</dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400 mb-0.5">风险等级</dt>
                <dd>
                  <span
                    className={`inline-block px-2.5 py-1 rounded-md border text-xs font-medium ${
                      riskColor[item.riskLevel] ?? "bg-slate-500/20 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {item.riskLevel}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400 mb-0.5">启用</dt>
                <dd>
                  {item.enabled ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">是</span>
                  ) : (
                    <span className="text-slate-500">否</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          {item.description && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                说明
              </h4>
              <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-3 max-h-32 overflow-y-auto">
                {item.description}
              </div>
            </section>
          )}

          {item.mitigation && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                缓解建议
              </h4>
              <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 px-3 py-3 max-h-32 overflow-y-auto">
                {item.mitigation}
              </div>
            </section>
          )}

          {tags.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                标签
              </h4>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                  >
                    {t.trim()}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="pt-2 border-t border-slate-200 dark:border-slate-700">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
              <div>
                <dt>创建时间</dt>
                <dd className="font-mono">{formatDate(item.createdAt)}</dd>
              </div>
              <div>
                <dt>更新时间</dt>
                <dd className="font-mono">{formatDate(item.updatedAt)}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}

/** 编辑模态框（仅管理员） */
function EditModal({
  item,
  onClose,
  onSaved,
}: {
  item: DangerCommandItem;
  onClose: () => void;
  onSaved: (updated: DangerCommandItem) => void;
}) {
  const [form, setForm] = useState<DangerCommandDto>({
    commandPattern: item.commandPattern,
    systemType: item.systemType,
    category: item.category,
    riskLevel: item.riskLevel,
    title: item.title,
    description: item.description ?? "",
    mitigation: item.mitigation ?? "",
    tags: item.tags ?? "",
    enabled: item.enabled,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = (field: keyof DangerCommandDto, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: DangerCommandDto = {
        ...form,
        description: form.description?.trim() || undefined,
        mitigation: form.mitigation?.trim() || undefined,
        tags: form.tags?.trim() || undefined,
      };
      const updated = await updateDangerCommand(item.id, payload);
      onSaved(updated);
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "保存失败";
      setError(msg);
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
            <Edit3 className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">编辑危险指令</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 dark:hover:bg-slate-800"
            aria-label="关闭"
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
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                指令/模式
              </label>
              <textarea
                value={form.commandPattern}
                onChange={(e) => onChange("commandPattern", e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 font-mono text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                标题
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => onChange("title", e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                系统类型
              </label>
              <select
                value={form.systemType}
                onChange={(e) => onChange("systemType", e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              >
                {SYSTEM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                分类
              </label>
              <select
                value={form.category}
                onChange={(e) => onChange("category", e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                风险等级
              </label>
              <select
                value={form.riskLevel}
                onChange={(e) => onChange("riskLevel", e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              >
                {RISK_LEVELS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">启用</span>
              <button
                type="button"
                onClick={() => onChange("enabled", !form.enabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors ${
                  form.enabled ? "bg-emerald-500 border-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    form.enabled ? "translate-x-4" : "translate-x-0.5"
                  }`}
                  style={{ marginTop: 1 }}
                />
              </button>
              <span className="text-xs text-slate-600 dark:text-slate-300">{form.enabled ? "是" : "否"}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">说明</label>
            <textarea
              value={form.description ?? ""}
              onChange={(e) => onChange("description", e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              缓解建议
            </label>
            <textarea
              value={form.mitigation ?? ""}
              onChange={(e) => onChange("mitigation", e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">标签</label>
            <input
              type="text"
              value={form.tags ?? ""}
              onChange={(e) => onChange("tags", e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              placeholder="以逗号或空格分隔，如: rm linux delete"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(form.tags ?? "")
                .split(/[,，\s]+/)
                .filter(Boolean)
                .map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                  >
                    {t}
                  </span>
                ))}
            </div>
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

interface DangerCommandListPageProps {
  mode?: "user" | "admin";
}

export const DangerCommandListPage = ({ mode = "user" }: DangerCommandListPageProps) => {
  const { user } = useAuth();
  const isAdmin = mode === "admin" && user?.role === "ADMIN";
  const [page, setPage] = useState<DangerCommandPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageNumber, setPageNumber] = useState(0);
  const [pageSize] = useState(15);
  const [systemType, setSystemType] = useState("");
  const [category, setCategory] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [keyword, setKeyword] = useState("");
  const [detailItem, setDetailItem] = useState<DangerCommandItem | null>(null);
  const [editItem, setEditItem] = useState<DangerCommandItem | null>(null);

  const load = () => {
    setLoading(true);
    setError("");
    fetchDangerCommands({
      page: pageNumber,
      size: pageSize,
      systemType: systemType || undefined,
      category: category || undefined,
      riskLevel: riskLevel || undefined,
      keyword: keyword.trim() || undefined,
    })
      .then(setPage)
      .catch((err) => {
        const msg =
          err?.response?.status === 403
            ? "无权限，仅管理员可查看危险指令库"
            : err?.response?.data?.message || "加载失败";
        setError(msg);
        setPage(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [pageNumber, systemType, category, riskLevel]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPageNumber(0);
    load();
  };

  const inputClass =
    "rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
          <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">危险指令库</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isAdmin ? "按系统类型、分类、风险等级筛选与维护危险指令" : "按系统类型、分类、风险等级筛选与查询"}
          </p>
        </div>
      </div>

      <form onSubmit={onSearch} className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
            关键词
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="指令、标题、描述..."
              className={`w-full pl-8 pr-3 py-2 ${inputClass}`}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
            系统类型
          </label>
          <select value={systemType} onChange={(e) => setSystemType(e.target.value)} className={inputClass}>
            <option value="">全部</option>
            {SYSTEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
            分类
          </label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
            <option value="">全部</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
            风险等级
          </label>
          <select value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)} className={inputClass}>
            <option value="">全部</option>
            {RISK_LEVELS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium"
        >
          查询
        </button>
      </form>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-sm">
          加载中…
        </div>
      )}

      {!loading && page && (
        <>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-left">
                    <th className="px-4 py-3 font-medium">指令/模式</th>
                    <th className="px-4 py-3 font-medium">风险</th>
                    <th className="px-4 py-3 font-medium">标题</th>
                    <th className="px-4 py-3 font-medium">启用</th>
                    <th className="px-4 py-3 font-medium w-24">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {page.content.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                      >
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
                          <div className="font-mono text-xs text-slate-800 dark:text-slate-200 truncate" title={row.commandPattern}>
                            {row.commandPattern}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {row.systemType}<span className="mx-1.5">·</span>{row.category}
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
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2" title={row.description}>
                              {row.description}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {row.enabled ? (
                            <span className="text-emerald-600 dark:text-emerald-400 text-xs">是</span>
                          ) : (
                            <span className="text-slate-500 text-xs">否</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setDetailItem(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                            >
                              <FileText className="w-3.5 h-3.5" />
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
                  onClick={() =>
                    setPageNumber((p) => Math.min(page.totalPages - 1, p + 1))
                  }
                  className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {detailItem && (
            <DetailModal
              item={detailItem}
              onClose={() => setDetailItem(null)}
              riskColor={riskColor}
            />
          )}
          {isAdmin && editItem && (
            <EditModal
              item={editItem}
              onClose={() => setEditItem(null)}
              onSaved={(updated) => {
                setEditItem(null);
                setPage((prev) =>
                  prev
                    ? {
                        ...prev,
                        content: prev.content.map((c) => (c.id === updated.id ? updated : c)),
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
