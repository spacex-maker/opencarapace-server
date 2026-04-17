import { useMemo } from "react";
import { useI18n } from "../../i18n";
import { MdOutlinePrivacyTip, MdOutlineChatBubbleOutline, MdChevronRight } from "react-icons/md";
import { groupScanItemsForDisplay } from "./securityScanCatalog";
import type { GroupedScanSection } from "./securityScanCatalog";
import type { PrivacyState, ScanItem } from "./securityScanShared";
import { securityScanCardBase as cardBase } from "./securityScanShared";

/** 各大区左侧色带与角标，便于扫视分层 */
const SECTION_ACCENTS: Record<string, { stripe: string; soft: string }> = {
  SANDBOX_POLICY: { stripe: "#22c55e", soft: "rgba(34,197,94,0.08)" },
  AI_RUNTIME: { stripe: "#0ea5e9", soft: "rgba(14,165,233,0.08)" },
  AI_VULNERABILITY: { stripe: "#f59e0b", soft: "rgba(245,158,11,0.1)" },
  OTHER: { stripe: "rgba(148,163,184,0.7)", soft: "rgba(148,163,184,0.06)" },
};

function sectionAccent(code: string) {
  return SECTION_ACCENTS[code] ?? SECTION_ACCENTS.OTHER;
}

function clientOsScopeBadge(
  scope: string | null | undefined,
  t: (key: string) => string
): { label: string; title: string } | null {
  const s = (scope || "ALL").toUpperCase();
  if (s === "ALL" || !s) return null;
  if (s === "WINDOWS")
    return { label: t("securityScanPage.items.osWindows"), title: t("securityScanPage.items.osWindowsTitle") };
  if (s === "MACOS")
    return { label: t("securityScanPage.items.osMac"), title: t("securityScanPage.items.osMacTitle") };
  return { label: s, title: t("securityScanPage.items.osScopeTitle") };
}

function ToggleSwitch({
  checked,
  disabled,
  onChange,
  accent,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  accent: "green" | "blue";
}) {
  const accentTrack = accent === "green" ? "rgba(34,197,94,0.2)" : "rgba(14,165,233,0.2)";
  const accentBorder = accent === "green" ? "rgba(34,197,94,0.4)" : "rgba(14,165,233,0.4)";
  const accentKnob = accent === "green" ? "#22c55e" : "#0ea5e9";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 42,
        height: 24,
        borderRadius: 999,
        border: `1px solid ${checked ? accentBorder : "var(--panel-border)"}`,
        background: checked ? accentTrack : "rgba(0,0,0,0.05)",
        padding: 2,
        cursor: disabled ? "not-allowed" : "pointer",
        position: "relative",
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
        outline: "none",
        display: "flex",
        alignItems: "center",
      }}
    >
      <span
        style={{
          display: "block",
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: checked ? accentKnob : "var(--muted)",
          transform: checked ? "translateX(18px)" : "translateX(0px)",
          transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)", // 增加轻微的回弹效果
          boxShadow: checked 
            ? `0 2px 8px ${accent === "green" ? "rgba(34,197,94,0.4)" : "rgba(14,165,233,0.4)"}` 
            : "0 2px 4px rgba(0,0,0,0.1)",
        }}
      />
    </button>
  );
}

function RuleItemRow({
  it,
  selected,
  onToggle,
}: {
  it: ScanItem;
  selected: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const isStatic = it.scannerType === "STATIC_INFO";
  return (
    <div
      className="ui-item-card"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "start",
        gap: "12px 16px",
        padding: "14px 16px",
        borderRadius: 12,
        border: "1px solid var(--panel-border)",
        background: selected ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.08)",
        transition: "background 0.2s, border-color 0.2s",
        minWidth: 0,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 10px", marginBottom: it.description ? 6 : 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: selected ? "var(--fg)" : "var(--muted)" }}>{it.title}</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 7px",
                borderRadius: 6,
                background: "rgba(0,0,0,0.2)",
                color: "var(--muted)",
                border: "1px solid var(--panel-border)",
              }}
            >
              {it.category || "OTHER"}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 7px",
                borderRadius: 6,
                background: isStatic ? "rgba(34,197,94,0.12)" : "rgba(14,165,233,0.12)",
                color: isStatic ? "#4ade80" : "#38bdf8",
                border: `1px solid ${isStatic ? "rgba(34,197,94,0.25)" : "rgba(14,165,233,0.25)"}`,
              }}
            >
              {isStatic ? t("securityScanPage.items.badgeStatic") : t("securityScanPage.items.badgeAi")}
            </span>
            {(() => {
              const os = clientOsScopeBadge(it.clientOsScope, t);
              if (!os) return null;
              return (
                <span
                  title={os.title}
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 7px",
                    borderRadius: 6,
                    background: "rgba(148,163,184,0.12)",
                    color: "var(--muted2)",
                    border: "1px solid var(--panel-border)",
                  }}
                >
                  {os.label}
                </span>
              );
            })()}
          </div>
        </div>
        {it.description && (
          <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.55 }}>{it.description}</div>
        )}
        <div
          style={{
            display: "inline-block",
            fontSize: 10,
            color: "var(--muted)",
            marginTop: 8,
            padding: "2px 6px",
            background: "rgba(0,0,0,0.18)",
            borderRadius: 4,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            opacity: 0.85,
          }}
        >
          {it.code}
        </div>
      </div>
      <div style={{ paddingTop: 2 }}>
        <ToggleSwitch checked={selected} onChange={() => onToggle()} accent="green" />
      </div>
    </div>
  );
}

function RulesSectionBlock({
  block,
  selected,
  onToggleItem,
}: {
  block: GroupedScanSection;
  selected: Record<string, boolean>;
  onToggleItem: (code: string) => void;
}) {
  const { t } = useI18n();
  const { stripe, soft } = sectionAccent(block.sectionCode);
  const total = block.groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid var(--panel-border)",
        overflow: "hidden",
        background: soft,
      }}
    >
      <div style={{ display: "flex", alignItems: "stretch", minHeight: 48 }}>
        <div style={{ width: 4, flexShrink: 0, background: stripe }} aria-hidden />
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 16px",
            flexWrap: "wrap",
            minWidth: 0,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--fg)", letterSpacing: 0.2 }}>{block.sectionTitle}</div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--muted)",
              padding: "4px 10px",
              borderRadius: 999,
              background: "rgba(0,0,0,0.15)",
              border: "1px solid var(--panel-border)",
              flexShrink: 0,
            }}
          >
            {t("securityScanPage.items.rulesCount").replace("{count}", String(total))}
          </span>
        </div>
      </div>

      <div style={{ padding: "4px 16px 18px 20px", display: "flex", flexDirection: "column", gap: 22 }}>
        {block.groups.map((g) => (
          <div key={`${block.sectionCode}-${g.groupCode}`} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontWeight: 700,
                color: "var(--muted)",
                textTransform: "none",
                letterSpacing: 0.3,
              }}
            >
              <MdChevronRight style={{ fontSize: 16, opacity: 0.65, flexShrink: 0 }} aria-hidden />
              <span>{g.groupTitle}</span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))",
                gap: 10,
                paddingLeft: 2,
              }}
            >
              {g.items.map((it) => (
                <RuleItemRow key={it.code} it={it} selected={!!selected[it.code]} onToggle={() => onToggleItem(it.code)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type Props = {
  items: ScanItem[];
  itemsLoading: boolean;
  selected: Record<string, boolean>;
  contextExtra: string;
  onContextExtraChange: (v: string) => void;
  privacy: PrivacyState | null;
  privacyLoading: boolean;
  privacySaving: boolean;
  privacyError: string | null;
  onSavePrivacy: (next: Partial<PrivacyState>) => void;
  onToggleItem: (code: string) => void;
  onSelectAll: (on: boolean) => void;
};

export function SecurityScanItemsTab({
  items,
  itemsLoading,
  selected,
  contextExtra,
  onContextExtraChange,
  privacy,
  privacyLoading,
  privacySaving,
  privacyError,
  onSavePrivacy,
  onToggleItem,
  onSelectAll,
}: Props) {
  const { t } = useI18n();
  const groupedItems = useMemo(
    () =>
      groupScanItemsForDisplay(items, {
        sectionTitle: (code) => t(`securityScanPage.sections.${code}`),
        groupTitle: (code) => t(`securityScanPage.groups.${code}`),
      }),
    [items, t]
  );

  // 统一的卡片基础样式覆盖
  const enhancedCardBase = {
    ...cardBase,
    padding: "24px",
    borderRadius: "20px",
    background: "var(--panel-bg2)",
    border: "1px solid var(--panel-border)",
    boxShadow: "0 4px 24px -8px rgba(0,0,0,0.05)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
      {/* 顶部两列：隐私设置 & 补充声明 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        
        {/* 隐私与数据授权 */}
        <div style={{ ...enhancedCardBase, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ display: "flex", padding: 6, borderRadius: 8, background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
              <MdOutlinePrivacyTip style={{ fontSize: 18 }} />
            </div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--fg)" }}>
              {t("securityScanPage.items.privacyTitle")}
            </h3>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, justifyContent: "center" }}>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: privacySaving ? "not-allowed" : "pointer", padding: "4px 0" }}>
              <div>
                <div style={{ fontSize: 14, color: "var(--fg)", fontWeight: 500 }}>
                  {t("securityScanPage.items.shareHistoryTitle")}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  {t("securityScanPage.items.shareHistoryDesc")}
                </div>
              </div>
              <ToggleSwitch
                checked={privacy?.shareHistoryEnabled ?? false}
                disabled={privacyLoading || privacySaving}
                accent="green"
                onChange={(next) => onSavePrivacy({ shareHistoryEnabled: next })}
              />
            </label>
            
            <div style={{ height: 1, background: "var(--panel-border)", width: "100%", opacity: 0.6 }} />
            
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: privacySaving ? "not-allowed" : "pointer", padding: "4px 0" }}>
              <div>
                <div style={{ fontSize: 14, color: "var(--fg)", fontWeight: 500 }}>
                  {t("securityScanPage.items.systemScanTitle")}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  {t("securityScanPage.items.systemScanDesc")}
                </div>
              </div>
              <ToggleSwitch
                checked={privacy?.consentSystemConfigEnabled ?? false}
                disabled={privacyLoading || privacySaving}
                accent="blue"
                onChange={(next) => onSavePrivacy({ consentSystemConfigEnabled: next })}
              />
            </label>
          </div>
          {privacyError && (
            <div style={{ marginTop: 16, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", fontSize: 12, color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
              {privacyError}
            </div>
          )}
        </div>

        {/* 环境补充声明 */}
        <div style={{ ...enhancedCardBase, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ display: "flex", padding: 6, borderRadius: 8, background: "rgba(14,165,233,0.1)", color: "#0ea5e9" }}>
              <MdOutlineChatBubbleOutline style={{ fontSize: 18 }} />
            </div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--fg)" }}>
              {t("securityScanPage.items.contextTitle")}{" "}
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--muted)", marginLeft: 4 }}>
                {t("securityScanPage.items.contextOptional")}
              </span>
            </h3>
          </div>
          
          <textarea
            value={contextExtra}
            onChange={(e) => onContextExtraChange(e.target.value)}
            placeholder={t("securityScanPage.items.contextPlaceholder")}
            style={{
              flex: 1,
              width: "100%",
              minHeight: 120,
              boxSizing: "border-box",
              padding: "16px",
              borderRadius: 14,
              border: "1px solid var(--panel-border)",
              background: "rgba(0,0,0,0.15)",
              color: "var(--fg)",
              fontSize: 13,
              lineHeight: 1.6,
              resize: "vertical",
              outline: "none",
              transition: "all 0.2s ease",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "rgba(14,165,233,0.6)";
              e.target.style.boxShadow = "0 0 0 3px rgba(14,165,233,0.15)";
              e.target.style.background = "rgba(0,0,0,0.2)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--panel-border)";
              e.target.style.boxShadow = "none";
              e.target.style.background = "rgba(0,0,0,0.15)";
            }}
          />
        </div>
      </div>

      {/* 底部：检测规则集 */}
      <div style={enhancedCardBase}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 20,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid var(--panel-border)",
            background: "var(--panel-bg2)",
          }}
        >
          <div style={{ flex: "1 1 240px", minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--fg)" }}>
              {t("securityScanPage.items.rulesTitle")}
            </h3>
            <p style={{ margin: "6px 0 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.55, maxWidth: 520 }}>
              {t("securityScanPage.items.rulesDesc")}
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => onSelectAll(true)}
              style={{
                padding: "8px 16px",
                borderRadius: 10,
                border: "1px solid var(--panel-border)",
                background: "var(--panel-bg)",
                color: "var(--fg)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "var(--panel-bg2)")}
              onMouseOut={(e) => (e.currentTarget.style.background = "var(--panel-bg)")}
            >
              {t("securityScanPage.items.selectAll")}
            </button>
            <button
              type="button"
              onClick={() => onSelectAll(false)}
              style={{
                padding: "8px 16px",
                borderRadius: 10,
                border: "1px solid var(--panel-border)",
                background: "var(--panel-bg)",
                color: "var(--fg)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "var(--panel-bg2)")}
              onMouseOut={(e) => (e.currentTarget.style.background = "var(--panel-bg)")}
            >
              {t("securityScanPage.items.selectNone")}
            </button>
          </div>
        </div>

        {itemsLoading && items.length > 0 && (
          <div style={{ marginBottom: 16, padding: "8px 12px", borderRadius: 8, background: "rgba(14,165,233,0.05)", fontSize: 12, color: "#0ea5e9", display: "inline-block" }}>
            <span style={{ marginRight: 6 }}>↻</span> {t("securityScanPage.items.syncingRules")}
          </div>
        )}

        {itemsLoading && items.length === 0 ? (
          <div style={{ padding: "60px 0", textAlign: "center", color: "var(--muted)", fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ width: 24, height: 24, border: "2px solid var(--panel-border)", borderTopColor: "var(--fg)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            {t("securityScanPage.items.loadingRules")}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {groupedItems.map((block) => (
              <RulesSectionBlock key={block.sectionCode} block={block} selected={selected} onToggleItem={onToggleItem} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}