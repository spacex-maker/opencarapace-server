/**
 * 用户危险指令页与管理员全局页共用的常量与展示组件。
 */
import { useEffect, useState, useRef } from "react";
import { FileText, X } from "lucide-react";
import type { DangerCommandItem } from "../../api/client";

export const SYSTEM_TYPES = [
  "LINUX",
  "WINDOWS",
  "DATABASE",
  "SHELL",
  "DOCKER",
  "KUBERNETES",
  "GIT",
  "OTHER",
];
export const CATEGORIES = [
  "FILE_SYSTEM",
  "DATABASE",
  "NETWORK",
  "PROCESS",
  "PERMISSION",
  "CONTAINER",
  "VERSION_CONTROL",
  "OTHER",
];
export const RISK_LEVELS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export const riskColor: Record<string, string> = {
  CRITICAL: "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/40",
  HIGH: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40",
  MEDIUM: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/40",
  LOW: "bg-slate-500/20 text-slate-600 dark:text-slate-300 border-slate-500/40",
};

export function truncate(s: string | null, max: number) {
  if (!s) return "—";
  return s.length <= max ? s : s.slice(0, max) + "…";
}

export function formatDate(s: string | undefined) {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleString("zh-CN");
  } catch {
    return s;
  }
}

export function FilterSelect({
  label,
  value,
  options,
  displayLabel,
  onChange,
  widthClass = "w-40",
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  displayLabel: string;
  onChange: (v: string) => void;
  widthClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className={`${widthClass} relative`} ref={ref}>
      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full inline-flex items-center justify-between rounded-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 hover:border-amber-500/60"
      >
        <span className="truncate">{current ? current.label : displayLabel}</span>
        <span className="ml-1 text-[10px] text-slate-400 dark:text-slate-500">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg max-h-52 overflow-y-auto text-xs">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 ${
                opt.value === value
                  ? "text-amber-600 dark:text-amber-300 font-medium"
                  : "text-slate-700 dark:text-slate-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DetailModal({
  item,
  onClose,
}: {
  item: DangerCommandItem;
  onClose: () => void;
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
                <dt className="text-slate-500 dark:text-slate-400 mb-0.5">系统启用</dt>
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
