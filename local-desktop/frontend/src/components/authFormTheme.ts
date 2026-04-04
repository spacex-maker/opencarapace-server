import type { CSSProperties } from "react";

export type AuthFormTheme = "light" | "dark";

const basePillLayout: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 18px",
  borderRadius: 9999,
  transition: "border-color 0.2s",
};

export function getAuthFormTheme(theme: AuthFormTheme) {
  const L = theme === "light";

  /** 不再使用独立卡片容器，仅保留 colorScheme 供表单控件 */
  const root: CSSProperties = {
    colorScheme: L ? "light" : "dark",
    background: "transparent",
    border: "none",
    boxShadow: "none",
    borderRadius: 0,
  };

  const pillRow: CSSProperties = {
    ...basePillLayout,
    border: L ? "1px solid rgba(15,23,42,0.14)" : "1px solid rgba(51,65,85,0.95)",
    background: L ? "rgba(255,255,255,0.92)" : "rgba(15,23,42,0.75)",
    boxShadow: "none",
  };

  const pillInput: CSSProperties = {
    flex: 1,
    minWidth: 0,
    border: "none",
    outline: "none",
    background: "transparent",
    color: L ? "#0f172a" : "#f1f5f9",
    fontSize: 14,
  };

  const title: CSSProperties = {
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: "-0.03em",
    color: L ? "#0f172a" : "#f8fafc",
    margin: 0,
    textAlign: "center",
  };

  const subtitle: CSSProperties = {
    margin: "10px 0 0",
    fontSize: 13,
    lineHeight: 1.55,
    color: L ? "#64748b" : "#94a3b8",
    textAlign: "center",
    maxWidth: 320,
  };

  const footerMuted: CSSProperties = {
    fontSize: 13,
    color: L ? "#64748b" : "#94a3b8",
  };

  const linkAccent = L ? "#15803d" : "#4ade80";

  const iconMuted = L ? "#64748b" : "#94a3b8";

  const rowFocusStyle = (focused: boolean): CSSProperties =>
    focused
      ? {
          borderColor: "rgba(34,197,94,0.75)",
        }
      : {};

  const submitButton = (loading: boolean): CSSProperties => ({
    marginTop: 8,
    width: "100%",
    padding: "14px 20px",
    borderRadius: 9999,
    border: "none",
    background: loading
      ? L
        ? "linear-gradient(135deg, #cbd5e1, #94a3b8)"
        : "linear-gradient(135deg, #475569, #334155)"
      : "linear-gradient(135deg, #22c55e, #16a34a)",
    color: loading ? (L ? "#475569" : "#cbd5e1") : "#022c22",
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: "0.02em",
    cursor: loading ? "not-allowed" : "pointer",
    boxShadow: "none",
    transition: "opacity 0.15s, transform 0.15s",
  });

  const messageSuccess: CSSProperties = {
    marginTop: 18,
    padding: "12px 16px",
    borderRadius: 9999,
    fontSize: 13,
    lineHeight: 1.45,
    textAlign: "center",
    color: L ? "#166534" : "#86efac",
    background: L ? "rgba(34,197,94,0.12)" : "rgba(34,197,94,0.12)",
    border: L ? "1px solid rgba(34,197,94,0.35)" : "1px solid rgba(34,197,94,0.28)",
  };

  const messageError: CSSProperties = {
    marginTop: 18,
    padding: "12px 16px",
    borderRadius: 9999,
    fontSize: 13,
    lineHeight: 1.45,
    textAlign: "center",
    color: L ? "#b91c1c" : "#fca5a5",
    background: L ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.1)",
    border: L ? "1px solid rgba(239,68,68,0.35)" : "1px solid rgba(248,113,113,0.35)",
  };

  /** 供 ::placeholder 注入（避免亮色下占位符过深） */
  const placeholderCss = L
    ? ".auth-form-ph::placeholder { color: #94a3b8; opacity: 1; }"
    : ".auth-form-ph::placeholder { color: #64748b; opacity: 1; }";

  return {
    root,
    pillRow,
    pillInput,
    title,
    subtitle,
    footerMuted,
    linkAccent,
    iconMuted,
    rowFocusStyle,
    submitButton,
    messageSuccess,
    messageError,
    placeholderCss,
  };
}
