import { useCallback, useEffect, useRef, useState } from "react";
import { MdExpandMore, MdLanguage } from "react-icons/md";
import { useI18n } from "../i18n";
import { LOCALE_OPTIONS, localeNativeLabel } from "../i18n/localeMeta";

type Theme = "light" | "dark";

/**
 * 自定义语言下拉（非原生 &lt;select&gt;）：按钮 + 浮层面板。
 */
export function LanguageSelect({ theme }: { theme: Theme }) {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (ev: MouseEvent) => {
      const el = rootRef.current;
      if (el && !el.contains(ev.target as Node)) close();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const activeLabel = localeNativeLabel(locale);
  const panelBg =
    theme === "light"
      ? "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)"
      : "linear-gradient(180deg, #0f172a 0%, #020617 100%)";
  const panelBorder = theme === "light" ? "rgba(15,23,42,0.12)" : "rgba(51,65,85,0.9)";
  const rowHover = theme === "light" ? "rgba(15,23,42,0.06)" : "rgba(148,163,184,0.12)";
  const activeRowBg = theme === "light" ? "rgba(34,197,94,0.12)" : "rgba(34,197,94,0.18)";
  const activeRowFg = theme === "light" ? "#15803d" : "#22c55e";

  return (
    <div
      ref={rootRef}
      style={{
        position: "relative",
        flexShrink: 0,
        paddingRight: 6,
        marginRight: 2,
        borderRight: "1px solid var(--border)",
        opacity: theme === "light" ? 0.95 : 0.85,
      }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("header.lang.pickerAria")}
        title={t("header.lang.pickerTitle")}
        onClick={() => setOpen((o) => !o)}
        style={{
          height: 34,
          minWidth: 120,
          maxWidth: 200,
          padding: "0 10px 0 8px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          borderRadius: 12,
          border: open ? "1px solid rgba(34,197,94,0.45)" : "1px solid var(--btn-border)",
          background: "var(--btn-bg)",
          color: "var(--fg)",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          transition: "border-color 0.15s, background 0.15s",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <MdLanguage style={{ fontSize: 18, flexShrink: 0, opacity: 0.85 }} aria-hidden />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeLabel}</span>
        </span>
        <MdExpandMore
          style={{
            fontSize: 20,
            flexShrink: 0,
            opacity: 0.7,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
          }}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t("header.lang.pickerAria")}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: "100%",
            width: "max-content",
            maxWidth: 280,
            maxHeight: 320,
            overflowY: "auto",
            borderRadius: 12,
            border: `1px solid ${panelBorder}`,
            background: panelBg,
            boxShadow:
              theme === "light"
                ? "0 16px 40px rgba(15,23,42,0.12), 0 0 0 1px rgba(15,23,42,0.04) inset"
                : "0 16px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04) inset",
            zIndex: 200,
            padding: 6,
          }}
        >
          {LOCALE_OPTIONS.map((opt) => {
            const selected = opt.code === locale;
            return (
              <button
                key={opt.code}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  setLocale(opt.code);
                  close();
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  textAlign: "inherit",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "none",
                  background: selected ? activeRowBg : "transparent",
                  color: selected ? activeRowFg : "var(--fg)",
                  fontSize: 13,
                  fontWeight: selected ? 800 : 600,
                  cursor: "pointer",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => {
                  if (!selected) e.currentTarget.style.background = rowHover;
                }}
                onMouseLeave={(e) => {
                  if (!selected) e.currentTarget.style.background = "transparent";
                }}
              >
                {opt.nativeLabel}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
