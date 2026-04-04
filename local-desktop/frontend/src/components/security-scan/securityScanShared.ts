import type { CSSProperties } from "react";

export type ScanItem = {
  id: number;
  code: string;
  title: string;
  description: string | null;
  category: string | null;
  defaultSeverity: string | null;
  scannerType: string;
};

export type Finding = {
  itemCode: string;
  severity: string;
  title: string;
  detail: string;
  remediation: string;
  location: string;
};

export type PrivacyState = {
  shareHistoryEnabled: boolean;
  consentSystemConfigEnabled: boolean;
};

export const securityScanCardBase: CSSProperties = {
  background: "var(--panel-bg)",
  border: "none",
  borderRadius: 22,
  padding: "20px",
  boxShadow: "none",
  transition: "all 0.2s ease",
};
