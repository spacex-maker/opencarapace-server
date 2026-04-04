import type { CSSProperties } from "react";

export type ScanItem = {
  id: number;
  code: string;
  title: string;
  description: string | null;
  category: string | null;
  /** 顶级安全域：SANDBOX_POLICY / AI_RUNTIME / AI_VULNERABILITY */
  scanSection?: string | null;
  /** 二级分组，见 securityScanCatalog */
  scanGroup?: string | null;
  defaultSeverity: string | null;
  scannerType: string;
  /** ALL | WINDOWS | MACOS，云端按客户端 OS 过滤列表 */
  clientOsScope?: string | null;
  sortOrder?: number;
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

/** 本地 desktop server 在 401 时返回的 error.code，供前端 i18n（避免直出中文 message）。 */
export function translateSecurityScanApiError(data: unknown, t: (key: string) => string): string | null {
  const code = (data as { error?: { code?: string } } | null | undefined)?.error?.code;
  switch (code) {
    case "security_scan_login_items":
      return t("securityScanPage.err.loginForItems");
    case "security_scan_login_scan":
      return t("securityScanPage.err.loginForScan");
    case "security_scan_login_history":
      return t("securityScanPage.err.loginForHistory");
    case "security_scan_login_run_detail":
      return t("securityScanPage.err.loginForRunDetail");
    default:
      return null;
  }
}

export const securityScanCardBase: CSSProperties = {
  background: "var(--panel-bg)",
  border: "none",
  borderRadius: 22,
  padding: "20px",
  boxShadow: "none",
  transition: "all 0.2s ease",
};
