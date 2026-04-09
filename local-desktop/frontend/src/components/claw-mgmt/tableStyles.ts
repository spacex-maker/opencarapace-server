import type { CSSProperties } from "react";

export const clawTableCellStyle: CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--panel-border)",
  fontSize: 11,
  verticalAlign: "top",
  color: "var(--muted)",
  lineHeight: 1.5,
};

export const clawTableHeadStyle: CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  fontSize: 10,
  fontWeight: 700,
  color: "var(--muted2)",
  borderBottom: "1px solid var(--panel-border)",
  background: "var(--panel-bg2)",
};
