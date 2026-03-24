/**
 * 用户技能页与管理员全局技能页共用的纯展示组件（无业务分支）。
 */
import { useEffect, useState, useRef } from "react";
import { BookOpen, X } from "lucide-react";
import type { SkillItem } from "../../api/client";

export function formatDate(s?: string) {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleString("zh-CN");
}

export function FilterSelect({
  label,
  value,
  displayLabel,
  options,
  onChange,
}: {
  label: string;
  value: string;
  displayLabel: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
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
    <div className="w-40 relative" ref={ref}>
      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full inline-flex items-center justify-between rounded-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 hover:border-brand-500/60"
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
                opt.value === value ? "text-brand-600 dark:text-brand-400 font-medium" : "text-slate-700 dark:text-slate-200"
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

export function SkillDetailModal({ item, onClose }: { item: SkillItem; onClose: () => void }) {
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
