import type { ScanItem } from "./securityScanShared";

/**
 * 与 patch_oc_security_scan_items_classification.sql / seed 一致。
 * 当接口未返回 scanSection（例如服务端未部署带该字段的版本）时用于展示分组。
 */
export const SCAN_CLASSIFICATION_BY_CODE: Record<string, readonly [string, string]> = {
  secrets_api_key: ["SANDBOX_POLICY", "SYSTEM_PROTECTION"],
  mcp_privilege: ["SANDBOX_POLICY", "SYSTEM_PROTECTION"],
  routing_llm: ["SANDBOX_POLICY", "NETWORK_ACCESS"],
  skills_governance: ["AI_RUNTIME", "SKILLS_SECURITY"],
  baseline_tls_files: ["AI_VULNERABILITY", "FIREWALL_BASELINE"],
  history_secrets_exposure: ["AI_RUNTIME", "PROMPT_SECURITY"],
  history_danger_command_suggestion: ["AI_RUNTIME", "SCRIPT_EXECUTION"],
  history_prompt_injection_risk: ["AI_RUNTIME", "PROMPT_SECURITY"],
  supply_chain_dependencies: ["AI_VULNERABILITY", "VULNERABILITY_SCAN"],
  logging_observability_leak: ["SANDBOX_POLICY", "SYSTEM_PROTECTION"],
  agent_tools_scope: ["AI_RUNTIME", "SKILLS_SECURITY"],
  network_egress_exposure: ["SANDBOX_POLICY", "NETWORK_ACCESS"],
  baseline_updates_static: ["AI_VULNERABILITY", "VULNERABILITY_SCAN"],
  /** 历史对话中的个人信息属于「运行时输入/留存」范畴，放在 AI 实时运行 › 个人隐私 */
  history_pii_sensitive_content: ["AI_RUNTIME", "PRIVACY"],
  history_external_link_trust: ["AI_RUNTIME", "SCRIPT_EXECUTION"],
};

function firstNonEmptyString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s !== "") return s;
  }
  return null;
}

/** 从单条扫描项解析大区、子组（兼容 camelCase / snake_case，并支持按 code 回退） */
export function resolveScanClassification(it: ScanItem): { section: string; group: string } {
  const raw = it as unknown as Record<string, unknown>;
  const sec =
    firstNonEmptyString(it.scanSection, raw.scan_section) ??
    (SCAN_CLASSIFICATION_BY_CODE[it.code]?.[0] ?? null) ??
    "OTHER";
  const grp =
    firstNonEmptyString(it.scanGroup, raw.scan_group) ??
    (SCAN_CLASSIFICATION_BY_CODE[it.code]?.[1] ?? null) ??
    "_OTHER";
  return { section: sec, group: grp };
}

/** 与「沙箱策略 / 实时运行 / 漏洞防护」大块对齐的顶级域 */
export const SCAN_SECTION_ORDER = ["SANDBOX_POLICY", "AI_RUNTIME", "AI_VULNERABILITY", "OTHER"] as const;

export const SCAN_SECTION_LABELS: Record<string, string> = {
  SANDBOX_POLICY: "沙箱安全策略",
  AI_RUNTIME: "AI 实时运行保护",
  AI_VULNERABILITY: "AI 漏洞防护",
  OTHER: "其他",
};

/** 二级分组（参考沙箱类产品的扫描模块划分） */
export const SCAN_GROUP_LABELS: Record<string, string> = {
  NETWORK_ACCESS: "网络访问保护",
  FILE_SECURITY: "文件安全保护",
  SYSTEM_PROTECTION: "系统安全保护",
  PRIVACY: "个人隐私保护",
  PROMPT_SECURITY: "Prompt 安全防护",
  SKILLS_SECURITY: "Skills 安全防护",
  SCRIPT_EXECUTION: "执行脚本检测",
  VULNERABILITY_SCAN: "漏洞检测",
  FIREWALL_BASELINE: "防火墙与通道基线",
  _OTHER: "其他",
};

const SCAN_GROUP_ORDER: Record<string, string[]> = {
  SANDBOX_POLICY: ["NETWORK_ACCESS", "SYSTEM_PROTECTION", "PRIVACY", "FILE_SECURITY", "_OTHER"],
  /** 对话隐私类（PII 等）排在 Prompt 安全之后 */
  AI_RUNTIME: ["PROMPT_SECURITY", "PRIVACY", "SKILLS_SECURITY", "SCRIPT_EXECUTION", "_OTHER"],
  AI_VULNERABILITY: ["VULNERABILITY_SCAN", "FIREWALL_BASELINE", "_OTHER"],
  OTHER: ["_OTHER"],
};

function sectionRank(code: string): number {
  const i = SCAN_SECTION_ORDER.indexOf(code as (typeof SCAN_SECTION_ORDER)[number]);
  return i >= 0 ? i : 100;
}

function groupRank(section: string, group: string): number {
  const order = SCAN_GROUP_ORDER[section];
  if (!order) {
    return group === "_OTHER" ? 9999 : 500;
  }
  const i = order.indexOf(group);
  return i >= 0 ? i : 998;
}

export function scanSectionTitle(code: string): string {
  return SCAN_SECTION_LABELS[code] ?? code;
}

export function scanGroupTitle(group: string): string {
  return SCAN_GROUP_LABELS[group] ?? group;
}

export type GroupedScanSection = {
  sectionCode: string;
  sectionTitle: string;
  groups: { groupCode: string; groupTitle: string; items: ScanItem[] }[];
};

export type ScanDisplayLabelResolver = {
  sectionTitle: (code: string) => string;
  groupTitle: (code: string) => string;
};

/**
 * 按大区 → 二级分组展开；组内按 sortOrder、id 排序。
 * @param labelResolver 传入时可覆盖大区/子组展示名（用于 i18n）。
 */
export function groupScanItemsForDisplay(
  items: ScanItem[],
  labelResolver?: ScanDisplayLabelResolver
): GroupedScanSection[] {
  const sectionMap = new Map<string, Map<string, ScanItem[]>>();

  for (const it of items) {
    const { section: sec, group: grp } = resolveScanClassification(it);
    if (!sectionMap.has(sec)) sectionMap.set(sec, new Map());
    const gm = sectionMap.get(sec)!;
    if (!gm.has(grp)) gm.set(grp, []);
    gm.get(grp)!.push(it);
  }

  const sectionCodes = [...sectionMap.keys()].sort((a, b) => {
    const d = sectionRank(a) - sectionRank(b);
    return d !== 0 ? d : a.localeCompare(b);
  });

  const cmpItem = (a: ScanItem, b: ScanItem) => {
    const oa = a.sortOrder ?? 0;
    const ob = b.sortOrder ?? 0;
    if (oa !== ob) return oa - ob;
    return a.id - b.id;
  };

  return sectionCodes.map((sectionCode) => {
    const gm = sectionMap.get(sectionCode)!;
    const groupCodes = [...gm.keys()].sort((a, b) => {
      const d = groupRank(sectionCode, a) - groupRank(sectionCode, b);
      return d !== 0 ? d : a.localeCompare(b);
    });
    return {
      sectionCode,
      sectionTitle: labelResolver?.sectionTitle(sectionCode) ?? scanSectionTitle(sectionCode),
      groups: groupCodes.map((groupCode) => ({
        groupCode,
        groupTitle: labelResolver?.groupTitle(groupCode) ?? scanGroupTitle(groupCode),
        items: (gm.get(groupCode) ?? []).slice().sort(cmpItem),
      })),
    };
  });
}
