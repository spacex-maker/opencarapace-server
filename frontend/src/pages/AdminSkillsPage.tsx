/**
 * 管理员：全局技能目录（oc_skills），与当前用户个人偏好无关。
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  fetchSkills,
  updateSkill,
  manualFullSyncClawhubSkills,
  type SkillItem,
  type SkillPage,
  type UpdateSkillDto,
} from "../api/client";
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, Edit3, Save, Search, X } from "lucide-react";
import { FilterSelect, SkillDetailModal } from "./skills/skillListShared";

const SKILL_STATUS_OPTIONS = [
  {
    value: "ACTIVE",
    label: "ACTIVE",
    hint: "正常可用",
    dot: "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.25)]",
  },
  {
    value: "DEPRECATED",
    label: "DEPRECATED",
    hint: "不推荐",
    dot: "bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.25)]",
  },
  {
    value: "DISABLED",
    label: "DISABLED",
    hint: "系统禁用",
    dot: "bg-slate-500 dark:bg-slate-400 shadow-[0_0_0_3px_rgba(100,116,139,0.2)]",
  },
] as const;

function SkillStatusSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
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

  const current =
    SKILL_STATUS_OPTIONS.find((o) => o.value === value) ?? SKILL_STATUS_OPTIONS[0];

  const menu =
    open &&
    menuBox &&
    createPortal(
      <div
        ref={menuRef}
        role="listbox"
        className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 py-1.5 shadow-xl ring-1 ring-black/5 dark:ring-white/10"
        style={{
          position: "fixed",
          top: menuBox.top,
          left: menuBox.left,
          width: menuBox.width,
          zIndex: 9999,
        }}
      >
        {SKILL_STATUS_OPTIONS.map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors ${
                selected
                  ? "bg-brand-500/10 dark:bg-brand-500/15"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800/80"
              }`}
            >
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${opt.dot}`} aria-hidden />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-medium text-slate-900 dark:text-slate-100">{opt.label}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{opt.hint}</span>
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
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 pl-4 pr-3 py-2.5 text-sm rounded-full outline-none transition-shadow focus:ring-2 focus:ring-brand-500/35 focus:border-brand-500/50 disabled:opacity-50"
      >
        <span className="flex items-center gap-2.5 min-w-0 text-left">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${current.dot}`} aria-hidden />
          <span className="flex flex-col min-w-0">
            <span className="font-medium truncate leading-tight">{current.label}</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate leading-tight">{current.hint}</span>
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {menu}
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

  const fieldBase =
    "w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/35 focus:border-brand-500/50 transition-shadow";
  const inputRound = `${fieldBase} rounded-full`;
  const areaRound = `${fieldBase} rounded-3xl resize-y bg-slate-50 dark:bg-slate-800/50`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between shrink-0 px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/15 dark:bg-blue-500/20">
              <Edit3 className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            </span>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white truncate">编辑技能（全局）</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-full text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 ml-1">名称</label>
              <input type="text" value={form.name ?? ""} onChange={(e) => onChange("name", e.target.value)} className={inputRound} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 ml-1">类型</label>
              <input type="text" value={form.type ?? ""} onChange={(e) => onChange("type", e.target.value)} className={inputRound} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 ml-1">分类</label>
              <input
                type="text"
                value={form.category ?? ""}
                onChange={(e) => onChange("category", e.target.value)}
                className={inputRound}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 ml-1">状态</label>
              <SkillStatusSelect
                value={form.status ?? "ACTIVE"}
                onChange={(v) => onChange("status", v)}
                disabled={saving}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 ml-1">简介</label>
            <textarea
              value={form.shortDesc ?? ""}
              onChange={(e) => onChange("shortDesc", e.target.value)}
              rows={3}
              className={areaRound}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 ml-1">标签</label>
            <input
              type="text"
              value={form.tags ?? ""}
              onChange={(e) => onChange("tags", e.target.value)}
              className={inputRound}
              placeholder="以逗号或空格分隔"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 ml-1">主页</label>
            <input
              type="text"
              value={form.homepageUrl ?? ""}
              onChange={(e) => onChange("homepageUrl", e.target.value)}
              className={inputRound}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 ml-1">安装提示</label>
            <textarea
              value={form.installHint ?? ""}
              onChange={(e) => onChange("installHint", e.target.value)}
              rows={2}
              className={areaRound}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/90 dark:hover:bg-slate-700/90 transition-colors"
            disabled={saving}
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium disabled:opacity-50 shadow-sm transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminSkillsPage() {
  const [page, setPage] = useState<SkillPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageNumber, setPageNumber] = useState(0);
  const [pageSize] = useState(20);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "ACTIVE" | "DEPRECATED" | "DISABLED">("");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [detailItem, setDetailItem] = useState<SkillItem | null>(null);
  const [editItem, setEditItem] = useState<SkillItem | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [updatingSystemId, setUpdatingSystemId] = useState<number | null>(null);

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

  const handleFullSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await manualFullSyncClawhubSkills();
      setSyncResult(`已从 ${res.source} 全量同步 ${res.synced} 条技能`);
      setPageNumber(0);
      load();
    } catch (e: any) {
      setSyncResult(e?.response?.data?.message || e?.message || "同步失败");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">全局技能管理</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              维护全站技能目录与系统状态（oc_skills）。启用/禁用写入 status；全量同步会保留 DISABLED / DEPRECATED。
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleFullSync}
          disabled={syncing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {syncing ? "同步中…" : "手动全量同步"}
        </button>
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

      {syncResult && (
        <div className="rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs px-4 py-2 text-slate-700 dark:text-slate-200">
          {syncResult}
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
                    <th className="px-4 py-3 font-medium">系统状态</th>
                    <th className="px-4 py-3 font-medium">简介</th>
                    <th className="px-4 py-3 font-medium w-36">系统启用</th>
                    <th className="px-4 py-3 font-medium w-32">操作</th>
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
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            disabled={updatingSystemId === row.id}
                            onClick={async () => {
                              const newStatus = row.status !== "DISABLED" ? "DISABLED" : "ACTIVE";
                              const prevStatus = row.status;
                              setUpdatingSystemId(row.id);
                              setPage((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      content: prev.content.map((s) =>
                                        s.id === row.id ? { ...s, status: newStatus } : s,
                                      ),
                                    }
                                  : prev,
                              );
                              try {
                                const updated = await updateSkill(row.id, { status: newStatus });
                                setPage((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        content: prev.content.map((s) =>
                                          s.id === row.id
                                            ? {
                                                ...s,
                                                ...updated,
                                                userEnabled: s.userEnabled,
                                                userSafetyLabel: s.userSafetyLabel,
                                              }
                                            : s,
                                        ),
                                      }
                                    : prev,
                                );
                              } catch {
                                setPage((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        content: prev.content.map((s) =>
                                          s.id === row.id ? { ...s, status: prevStatus } : s,
                                        ),
                                      }
                                    : prev,
                                );
                              } finally {
                                setUpdatingSystemId(null);
                              }
                            }}
                            className="inline-flex items-center gap-2 disabled:opacity-50"
                          >
                            <span
                              className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${
                                row.status === "DISABLED"
                                  ? "bg-slate-500/80 dark:bg-slate-700"
                                  : "bg-sky-500 dark:bg-sky-400"
                              }`}
                            >
                              <span
                                className={`absolute left-[2px] top-1/2 h-4 w-4 rounded-full bg-white shadow transition-transform -translate-y-1/2 ${
                                  row.status === "DISABLED" ? "translate-x-0" : "translate-x-[14px]"
                                }`}
                              />
                            </span>
                            <span className="text-[11px] text-slate-600 dark:text-slate-300">
                              {row.status === "DISABLED" ? "系统禁用" : "系统可用"}
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
                              <BookOpen className="w-3.5 h-3.5" />
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

          {detailItem && <SkillDetailModal item={detailItem} onClose={() => setDetailItem(null)} />}
          {editItem && (
            <SkillEditModal
              item={editItem}
              onClose={() => setEditItem(null)}
              onSaved={(updated) => {
                setPage((prev) =>
                  prev
                    ? {
                        ...prev,
                        content: prev.content.map((s) =>
                          s.id === updated.id
                            ? {
                                ...s,
                                ...updated,
                                userEnabled: s.userEnabled,
                                userSafetyLabel: s.userSafetyLabel,
                              }
                            : s,
                        ),
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
