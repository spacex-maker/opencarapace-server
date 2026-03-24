import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export type FilterPortalOption = {
  value: string;
  label: string;
  /** 菜单内副文案 */
  description?: string;
};

/**
 * 高级筛选用自定义下拉：全圆角触发器 + Portal 大圆角菜单，避免被父级 overflow 裁剪。
 */
export function FilterPortalSelect({
  label,
  value,
  options,
  placeholder = "请选择",
  onChange,
  disabled,
  className = "",
  menuMinWidth = 200,
}: {
  label?: string;
  value: string;
  options: FilterPortalOption[];
  placeholder?: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  /** 外层容器 class，如 w-full / w-40 */
  className?: string;
  /** 菜单宽度不低于 max(触发器宽度, menuMinWidth) */
  menuMinWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number } | null>(null);

  const current = options.find((o) => o.value === value);
  const triggerLabel = current?.label ?? placeholder;

  const updateMenuPosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = Math.max(r.width, menuMinWidth);
    setMenuBox({ top: r.bottom + 8, left: r.left, width: w });
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
  }, [open, menuMinWidth]);

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
        aria-label={label || "选项"}
        className="max-h-64 overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 py-2 shadow-xl ring-1 ring-black/5 dark:ring-white/10"
        style={{
          position: "fixed",
          top: menuBox.top,
          left: menuBox.left,
          width: menuBox.width,
          zIndex: 9999,
        }}
      >
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              key={opt.value || "__empty"}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                selected
                  ? "bg-brand-500/10 dark:bg-brand-500/15"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800/80"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-slate-900 dark:text-slate-100">{opt.label}</div>
                {opt.description && (
                  <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-500 leading-snug">{opt.description}</div>
                )}
              </div>
              {selected && (
                <span className="shrink-0 rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-semibold text-white">
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
    <div ref={triggerRef} className={className}>
      {label && (
        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5 ml-1">{label}</label>
      )}
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 pl-3 pr-2.5 py-2 text-xs rounded-full outline-none transition-shadow focus:ring-2 focus:ring-brand-500/35 focus:border-brand-500/40 disabled:opacity-50 disabled:pointer-events-none"
      >
        <span className={`min-w-0 truncate text-left ${current ? "font-medium" : "text-slate-500 dark:text-slate-400"}`}>
          {triggerLabel}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {menu}
    </div>
  );
}
