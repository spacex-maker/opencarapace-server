import { MdOutlinePrivacyTip, MdOutlineChatBubbleOutline } from "react-icons/md";
import type { PrivacyState, ScanItem } from "./securityScanShared";
import { securityScanCardBase as cardBase } from "./securityScanShared";

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
  const accentTrack = accent === "green" ? "rgba(34,197,94,0.25)" : "rgba(14,165,233,0.25)";
  const accentBorder = accent === "green" ? "rgba(34,197,94,0.5)" : "rgba(14,165,233,0.5)";
  const accentKnob = accent === "green" ? "#22c55e" : "#0ea5e9";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 999,
        border: `1px solid ${checked ? accentBorder : "var(--panel-border)"}`,
        background: checked ? accentTrack : "rgba(0,0,0,0.1)",
        padding: 2,
        cursor: disabled ? "not-allowed" : "pointer",
        position: "relative",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        opacity: disabled ? 0.6 : 1,
        flexShrink: 0,
        outline: "none",
      }}
    >
      <span
        style={{
          display: "block",
          width: 18,
          height: 18,
          borderRadius: 999,
          background: checked ? accentKnob : "var(--muted)",
          transform: checked ? "translateX(20px)" : "translateX(0px)",
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: checked ? "0 2px 8px rgba(0,0,0,0.2)" : "0 2px 4px rgba(0,0,0,0.1)",
        }}
      />
    </button>
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
  return (
    <div style={{ display: "grid", gap: 20, gridTemplateColumns: "1fr", alignItems: "start" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        <div style={{ ...cardBase, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <MdOutlinePrivacyTip style={{ color: "var(--muted)", fontSize: 20 }} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--fg)" }}>隐私与数据授权</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: privacySaving ? "not-allowed" : "pointer" }}>
              <div>
                <div style={{ fontSize: 14, color: "var(--fg)", fontWeight: 600 }}>共享对话历史</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>允许提取历史记录用于安全分析</div>
              </div>
              <ToggleSwitch
                checked={privacy?.shareHistoryEnabled ?? false}
                disabled={privacyLoading || privacySaving}
                accent="green"
                onChange={(next) => onSavePrivacy({ shareHistoryEnabled: next })}
              />
            </label>
            <div style={{ height: 1, background: "var(--panel-border)", borderRadius: 999 }} />
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: privacySaving ? "not-allowed" : "pointer" }}>
              <div>
                <div style={{ fontSize: 14, color: "var(--fg)", fontWeight: 600 }}>系统配置扫描</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>同意读取本机 AI 核心配置参数</div>
              </div>
              <ToggleSwitch
                checked={privacy?.consentSystemConfigEnabled ?? false}
                disabled={privacyLoading || privacySaving}
                accent="blue"
                onChange={(next) => onSavePrivacy({ consentSystemConfigEnabled: next })}
              />
            </label>
          </div>
          {privacyError && <div style={{ marginTop: 12, fontSize: 12, color: "#fca5a5" }}>{privacyError}</div>}
        </div>

        <div style={{ ...cardBase, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <MdOutlineChatBubbleOutline style={{ color: "var(--muted)", fontSize: 20 }} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--fg)" }}>环境补充声明 (可选)</h3>
          </div>
          <textarea
            value={contextExtra}
            onChange={(e) => onContextExtraChange(e.target.value)}
            placeholder="在此输入您的特定环境说明，例如：使用的 MCP 列表、特定的 Provider 配置、敏感文件存放路径等，AI 将结合此信息更精准地发现问题..."
            style={{
              flex: 1,
              width: "100%",
              minHeight: 100,
              boxSizing: "border-box",
              padding: "12px",
              borderRadius: 18,
              border: "1px solid var(--panel-border)",
              background: "rgba(0,0,0,0.15)",
              color: "var(--fg)",
              fontSize: 13,
              lineHeight: 1.6,
              resize: "vertical",
              outline: "none",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "rgba(14,165,233,0.5)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--panel-border)")}
          />
        </div>
      </div>

      <div style={cardBase}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--fg)" }}>检测规则集</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => onSelectAll(true)}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                border: "1px solid var(--panel-border)",
                background: "var(--panel-bg2)",
                color: "var(--fg)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              全选
            </button>
            <button
              type="button"
              onClick={() => onSelectAll(false)}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                border: "1px solid var(--panel-border)",
                background: "var(--panel-bg2)",
                color: "var(--fg)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              反选
            </button>
          </div>
        </div>

        {itemsLoading && items.length > 0 && (
          <div style={{ margin: "10px 0 14px", fontSize: 12, color: "var(--muted)" }}>
            正在从云端刷新扫描项…你可以继续操作当前列表。
          </div>
        )}

        {itemsLoading && items.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--muted)" }}>获取云端规则中...</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((it) => (
              <div
                key={it.code}
                className="ui-item-card"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 16,
                  padding: "16px",
                  borderRadius: 22,
                  border: "1px solid var(--panel-border)",
                  background: "rgba(0,0,0,0.1)",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--fg)" }}>{it.title}</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: "var(--panel-bg2)",
                        color: "var(--muted)",
                        border: "1px solid var(--panel-border)",
                      }}
                    >
                      {it.category || "OTHER"}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: it.scannerType === "STATIC_INFO" ? "rgba(34,197,94,0.1)" : "rgba(14,165,233,0.1)",
                        color: it.scannerType === "STATIC_INFO" ? "#4ade80" : "#38bdf8",
                        border: `1px solid ${it.scannerType === "STATIC_INFO" ? "rgba(34,197,94,0.2)" : "rgba(14,165,233,0.2)"}`,
                      }}
                    >
                      {it.scannerType === "STATIC_INFO" ? "静态规则" : "AI 推理"}
                    </span>
                  </div>
                  {it.description && (
                    <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{it.description}</div>
                  )}
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted2)",
                      marginTop: 8,
                      fontFamily: "ui-monospace, monospace",
                      opacity: 0.7,
                    }}
                  >
                    {it.code}
                  </div>
                </div>
                <div style={{ paddingTop: 2 }}>
                  <ToggleSwitch checked={!!selected[it.code]} onChange={() => onToggleItem(it.code)} accent="green" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
