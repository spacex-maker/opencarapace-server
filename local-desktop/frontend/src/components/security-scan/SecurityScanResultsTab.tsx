import { MdWarning, MdErrorOutline, MdCheckCircle } from "react-icons/md";
import type { Finding } from "./securityScanShared";
import { securityScanCardBase as cardBase } from "./securityScanShared";

type SeverityFilter = "ALL" | "CRITICAL" | "WARN" | "PASS";

type Props = {
  findings: Finding[];
  scanning: boolean;
  filter: SeverityFilter;
  onFilterChange: (f: SeverityFilter) => void;
  filteredFindings: Finding[];
};

export function SecurityScanResultsTab({
  findings,
  scanning,
  filter,
  onFilterChange,
  filteredFindings,
}: Props) {
  if (findings.length === 0 && !scanning) {
    return (
      <div
        style={{
          ...cardBase,
          padding: "60px 20px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 999,
            background: "var(--panel-bg2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MdCheckCircle style={{ fontSize: 32, color: "var(--muted)" }} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--fg)" }}>暂无发现项</div>
          <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 6 }}>
            请在「配置与扫描项」中执行扫描；历史记录可在「扫描历史」中查看。
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {findings.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {(
            [
              { id: "ALL" as const, label: "全部结果" },
              { id: "CRITICAL" as const, label: "严重 (Critical)" },
              { id: "WARN" as const, label: "警告 (Warning)" },
              { id: "PASS" as const, label: "通过 (Passed)" },
            ]
          ).map((c) => {
            const active = filter === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onFilterChange(c.id)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 999,
                  border: `1px solid ${active ? "rgba(14,165,233,0.5)" : "var(--panel-border)"}`,
                  background: active ? "rgba(14,165,233,0.1)" : "var(--panel-bg)",
                  color: active ? "#38bdf8" : "var(--muted)",
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ display: "grid", gap: 16 }}>
        {filteredFindings.map((f, idx) => {
          const sev = (f.severity || "").toUpperCase();
          const isC = sev === "CRITICAL";
          const isW = sev === "WARN";

          const icon = isC ? (
            <MdErrorOutline style={{ color: "#f87171", fontSize: 24 }} />
          ) : isW ? (
            <MdWarning style={{ color: "#fbbf24", fontSize: 24 }} />
          ) : (
            <MdCheckCircle style={{ color: "#4ade80", fontSize: 24 }} />
          );

          const badgeBg = isC ? "rgba(248,113,113,0.1)" : isW ? "rgba(251,191,36,0.1)" : "rgba(74,222,128,0.1)";
          const badgeColor = isC ? "#fca5a5" : isW ? "#fcd34d" : "#86efac";
          const borderColor = isC ? "#ef4444" : isW ? "#f59e0b" : "#22c55e";

          return (
            <div
              key={idx}
              className="ui-item-card"
              style={{
                ...cardBase,
                position: "relative",
                overflow: "hidden",
                borderLeft: `4px solid ${borderColor}`,
                paddingLeft: 24,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                <div style={{ flexShrink: 0, marginTop: 2 }}>{icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "var(--fg)" }}>{f.title}</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: "0.05em",
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: badgeBg,
                        color: badgeColor,
                        border: `1px solid ${badgeBg}`,
                      }}
                    >
                      {sev || "WARN"}
                    </span>
                  </div>

                  {f.detail && (
                    <div style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, marginBottom: 12 }}>{f.detail}</div>
                  )}

                  {f.location && (
                    <div
                      className="ss-finding-loc"
                      style={{
                        fontSize: 13,
                        fontFamily: "ui-monospace, SFMono-Regular, monospace",
                        padding: "6px 12px",
                        borderRadius: 16,
                        marginBottom: 12,
                        wordBreak: "break-all",
                      }}
                    >
                      <span style={{ opacity: 0.5, marginRight: 8 }}>路径/位置:</span>
                      {f.location}
                    </div>
                  )}

                  {f.remediation && (
                    <div
                      className="ss-finding-remedy"
                      style={{
                        fontSize: 14,
                        lineHeight: 1.6,
                        padding: "10px 14px",
                        borderRadius: 18,
                        borderLeft: "2px solid #38bdf8",
                      }}
                    >
                      <strong style={{ marginRight: 8 }}>修复建议:</strong>
                      {f.remediation}
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  fontSize: 12,
                  color: "var(--muted2)",
                  fontFamily: "ui-monospace, monospace",
                  opacity: 0.5,
                }}
              >
                #{f.itemCode}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
