/**
 * 管理员：全局危险指令规则（系统启用、元数据编辑），不含用户个人偏好。
 */
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  fetchDangerCommands,
  type DangerCommandItem,
  type DangerCommandPage,
  updateDangerCommand,
  createDangerCommand,
  type DangerCommandDto,
} from "../api/client";
import {
  ShieldAlert,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  Edit3,
  Plus,
  Save,
  X,
} from "lucide-react";
import {
  CATEGORIES,
  DetailModal,
  FilterSelect,
  RISK_LEVELS,
  SYSTEM_TYPES,
  riskColor,
} from "./danger/dangerShared";

const dangerFormInputRound =
  "w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-4 py-2.5 text-sm rounded-full outline-none focus:ring-2 focus:ring-brand-500/35 focus:border-brand-500/50 transition-shadow";
const dangerFormAreaRound =
  "w-full border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm rounded-3xl outline-none focus:ring-2 focus:ring-brand-500/35 focus:border-brand-500/50 transition-shadow resize-y";
const dangerFormMitigationRound =
  "w-full border border-amber-200/80 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 text-slate-900 dark:text-slate-100 px-4 py-3 text-sm rounded-3xl outline-none focus:ring-2 focus:ring-amber-500/30 transition-shadow resize-y";

/** 模态内自定义下拉（全圆角触发器 + 大圆角菜单，portal 避免被 overflow 裁剪） */
function DangerFormRoundSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number } | null>(null);

  const updateMenuPosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuBox({ top: r.bottom + 8, left: r.left, width: r.width });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuBox(null);
      return;
    }
    updateMenuPosition();
    const onWin = () => updateMenuPosition();
    window.addEventListener("scroll", onWin, true);
    window.addEventListener("resize", onWin);
    return () => {
      window.removeEventListener("scroll", onWin, true);
      window.removeEventListener("resize", onWin);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menu =
    open &&
    menuBox &&
    createPortal(
      <div
        ref={menuRef}
        role="listbox"
        className="max-h-64 overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 py-1.5 shadow-xl ring-1 ring-black/5 dark:ring-white/10"
        style={{
          position: "fixed",
          top: menuBox.top,
          left: menuBox.left,
          width: menuBox.width,
          zIndex: 9999,
        }}
      >
        {options.map((opt) => {
          const selected = opt === value;
          return (
            <button
              key={opt}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                selected
                  ? "bg-brand-500/10 dark:bg-brand-500/15"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800/80"
              }`}
            >
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-900 dark:text-slate-100">
                {opt}
              </span>
              {selected && (
                <span className="shrink-0 rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  当前
                </span>
              )}
            </button>
          );
        })}
      </div>,
      document.body,
    );

  return (
    <div ref={triggerRef}>
      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 ml-1">{label}</label>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 pl-4 pr-3 py-2.5 text-sm rounded-full outline-none transition-shadow focus:ring-2 focus:ring-brand-500/35 focus:border-brand-500/50 disabled:opacity-50"
      >
        <span className="truncate text-left font-mono text-xs">{value}</span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {menu}
    </div>
  );
}

function DangerCommandFormFields({
  form,
  onChange,
}: {
  form: DangerCommandDto;
  onChange: (field: keyof DangerCommandDto, value: string | boolean) => void;
}) {
  const systemEnabled = form.enabled ?? true;
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 ml-1">指令/模式</label>
          <textarea
            value={form.commandPattern}
            onChange={(e) => onChange("commandPattern", e.target.value)}
            rows={2}
            className={`${dangerFormAreaRound} font-mono text-xs`}
            placeholder="例如 rm -rf / 或 DROP DATABASE"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 ml-1">标题</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => onChange("title", e.target.value)}
            className={dangerFormInputRound}
            placeholder="简短说明"
          />
        </div>
        <DangerFormRoundSelect
          label="系统类型"
          value={form.systemType}
          options={SYSTEM_TYPES}
          onChange={(v) => onChange("systemType", v)}
        />
        <DangerFormRoundSelect
          label="分类"
          value={form.category}
          options={CATEGORIES}
          onChange={(v) => onChange("category", v)}
        />
        <DangerFormRoundSelect
          label="风险等级"
          value={form.riskLevel}
          options={RISK_LEVELS}
          onChange={(v) => onChange("riskLevel", v)}
        />
        <div className="flex items-center gap-2 mt-2 sm:mt-4">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1">系统启用</span>
          <button
            type="button"
            onClick={() => onChange("enabled", !systemEnabled)}
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors ${
              systemEnabled ? "bg-emerald-500 border-emerald-500" : "bg-slate-300 dark:bg-slate-700 border-transparent"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                systemEnabled ? "translate-x-4" : "translate-x-0.5"
              }`}
              style={{ marginTop: 1 }}
            />
          </button>
          <span className="text-xs text-slate-600 dark:text-slate-300">{systemEnabled ? "是" : "否"}</span>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 ml-1">说明</label>
        <textarea
          value={form.description ?? ""}
          onChange={(e) => onChange("description", e.target.value)}
          rows={3}
          className={dangerFormAreaRound}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 ml-1">缓解建议</label>
        <textarea
          value={form.mitigation ?? ""}
          onChange={(e) => onChange("mitigation", e.target.value)}
          rows={3}
          className={dangerFormMitigationRound}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 ml-1">标签</label>
        <input
          type="text"
          value={form.tags ?? ""}
          onChange={(e) => onChange("tags", e.target.value)}
          className={dangerFormInputRound}
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
    </>
  );
}

function CreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<DangerCommandDto>({
    commandPattern: "",
    systemType: SYSTEM_TYPES[0],
    category: CATEGORIES[0],
    riskLevel: "HIGH",
    title: "",
    description: "",
    mitigation: "",
    tags: "",
    enabled: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = (field: keyof DangerCommandDto, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.commandPattern.trim()) {
      setError("请填写指令/模式");
      return;
    }
    if (!form.title.trim()) {
      setError("请填写标题");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createDangerCommand({
        ...form,
        description: form.description?.trim() || undefined,
        mitigation: form.mitigation?.trim() || undefined,
        tags: form.tags?.trim() || undefined,
      });
      onCreated();
      onClose();
    } catch (e: any) {
      const msg =
        e?.response?.data?.message || e?.response?.data?.error || e?.message || "创建失败";
      setError(typeof msg === "string" ? msg : "创建失败");
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
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between shrink-0 px-6 py-5 border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">新增危险指令（全局）</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700/80"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-sm">
          {error && (
            <div className="rounded-full bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-xs px-4 py-2.5">
              {error}
            </div>
          )}
          <DangerCommandFormFields form={form} onChange={onChange} />
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200/80 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/30">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700/80"
            disabled={saving}
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium disabled:opacity-50 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            {saving ? "创建中…" : "创建"}
          </button>
        </div>
      </div>
    </div>
  );
}

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
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between shrink-0 px-6 py-5 border-b border-slate-200/80 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">编辑危险指令（全局）</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700/80"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-sm">
          {error && (
            <div className="rounded-full bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-xs px-4 py-2.5">
              {error}
            </div>
          )}

          <DangerCommandFormFields form={form} onChange={onChange} />
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200/80 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/30">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700/80"
            disabled={saving}
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium disabled:opacity-50 shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

function buildUpdatePayload(row: DangerCommandItem, enabled: boolean): DangerCommandDto {
  return {
    commandPattern: row.commandPattern,
    systemType: row.systemType,
    category: row.category,
    riskLevel: row.riskLevel,
    title: row.title,
    description: row.description ?? undefined,
    mitigation: row.mitigation ?? undefined,
    tags: row.tags ?? undefined,
    enabled,
  };
}

export function AdminDangerCommandsPage() {
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
  const [createOpen, setCreateOpen] = useState(false);
  const [updatingEnabledId, setUpdatingEnabledId] = useState<number | null>(null);
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
    })
      .then(setPage)
      .then(() => {
        if (showSuccessMessage) showTopMessage("刷新成功");
      })
      .catch((err) => {
        setError(err?.response?.data?.message || "加载失败");
        setPage(null);
        if (showSuccessMessage) setTopMessage(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [pageNumber, systemType, category, riskLevel]);

  useEffect(() => () => clearTopMessageTimer(), []);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPageNumber(0);
    load();
  };

  const afterDangerCommandCreated = () => {
    showTopMessage("已新增危险指令");
    if (pageNumber === 0) {
      load();
    } else {
      setPageNumber(0);
    }
  };

  const toggleSystemEnabled = async (row: DangerCommandItem) => {
    const next = !row.enabled;
    const prevEnabled = row.enabled;
    setUpdatingEnabledId(row.id);
    setPage((prevPage) =>
      prevPage
        ? {
            ...prevPage,
            content: prevPage.content.map((c) => (c.id === row.id ? { ...c, enabled: next } : c)),
          }
        : prevPage,
    );
    try {
      const updated = await updateDangerCommand(row.id, buildUpdatePayload(row, next));
      setPage((prevPage) =>
        prevPage
          ? {
              ...prevPage,
              content: prevPage.content.map((c) => (c.id === row.id ? { ...c, ...updated } : c)),
            }
          : prevPage,
      );
    } catch {
      setPage((prevPage) =>
        prevPage
          ? {
              ...prevPage,
              content: prevPage.content.map((c) => (c.id === row.id ? { ...c, enabled: prevEnabled } : c)),
            }
          : prevPage,
      );
    } finally {
      setUpdatingEnabledId(null);
    }
  };

  const inputClass =
    "rounded-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-red-500/15 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">全局危险指令</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              维护全站危险指令规则与系统级启用状态；此处不展示或修改任何用户的个人偏好。
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
        >
          <Plus className="w-4 h-4" />
          新增危险指令
        </button>
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
                    <th className="px-4 py-3 font-medium w-40 text-center">系统启用</th>
                    <th className="px-4 py-3 font-medium w-28">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {page.content.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
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
                          <button
                            type="button"
                            disabled={updatingEnabledId === row.id}
                            onClick={() => toggleSystemEnabled(row)}
                            className="inline-flex items-center gap-2 disabled:opacity-50"
                          >
                            <span
                              className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${
                                row.enabled ? "bg-sky-500 dark:bg-sky-400" : "bg-slate-500/80 dark:bg-slate-700"
                              }`}
                            >
                              <span
                                className={`absolute left-[2px] top-1/2 h-4 w-4 rounded-full bg-white shadow transition-transform -translate-y-1/2 ${
                                  row.enabled ? "translate-x-[14px]" : "translate-x-0"
                                }`}
                              />
                            </span>
                            <span className="text-[11px] text-slate-600 dark:text-slate-300">
                              {row.enabled ? "已启用" : "已禁用"}
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setDetailItem(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              详情
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditItem(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              编辑
                            </button>
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
          {createOpen && (
            <CreateModal
              onClose={() => setCreateOpen(false)}
              onCreated={afterDangerCommandCreated}
            />
          )}
          {editItem && (
            <EditModal
              item={editItem}
              onClose={() => setEditItem(null)}
              onSaved={(updated) => {
                setEditItem(null);
                setPage((prev) =>
                  prev
                    ? {
                        ...prev,
                        content: prev.content.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
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
}
