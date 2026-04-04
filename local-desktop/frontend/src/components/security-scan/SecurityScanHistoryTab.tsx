import { MdRefresh, MdHistory, MdOutlineAssessment } from "react-icons/md";
import { useI18n } from "../../i18n";
import { securityScanCardBase as cardBase } from "./securityScanShared";
import React from "react";

type Props = {
  scanHistory: unknown[];
  historyLoading: boolean;
  onRefresh: () => void;
  onOpenRun: (id: number) => void;
  historyModalOpen: boolean;
  historyModalRunId: number | null;
};

export function SecurityScanHistoryTab({
  scanHistory,
  historyLoading,
  onRefresh,
  onOpenRun,
  historyModalOpen,
  historyModalRunId,
}: Props) {
  const { t } = useI18n();
  // 保持与前面的卡片一致的基础样式
  const enhancedCardBase = {
    ...cardBase,
    padding: "24px",
    borderRadius: "20px",
    background: "var(--panel-bg2)",
    border: "1px solid var(--panel-border)",
    boxShadow: "0 4px 24px -8px rgba(0,0,0,0.05)",
  };

  return (
    <div style={enhancedCardBase}>
      {/* 头部区域 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", padding: 6, borderRadius: 8, background: "rgba(139,92,246,0.1)", color: "#8b5cf6" }}>
            <MdHistory style={{ fontSize: 18 }} />
          </div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--fg)" }}>
            {t("securityScanPage.history.title")}
          </h3>
        </div>

        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={historyLoading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            borderRadius: 8,
            border: "1px solid var(--panel-border)",
            background: "transparent",
            color: "var(--fg)",
            fontSize: 12,
            fontWeight: 500,
            cursor: historyLoading ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
            transition: "all 0.2s ease",
            opacity: historyLoading ? 0.6 : 1,
          }}
          onMouseOver={(e) => {
            if (!historyLoading) e.currentTarget.style.background = "rgba(255,255,255,0.05)";
          }}
          onMouseOut={(e) => {
            if (!historyLoading) e.currentTarget.style.background = "transparent";
          }}
        >
          <MdRefresh style={{ fontSize: 16, animation: historyLoading ? "spin 1s linear infinite" : "none" }} />
          {historyLoading ? t("securityScanPage.history.refreshing") : t("securityScanPage.history.refresh")}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* 列表区域 */}
      {scanHistory.length === 0 ? (
        <div style={{ padding: "40px 0", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ padding: 12, borderRadius: "50%", background: "rgba(0,0,0,0.1)", color: "var(--muted)" }}>
            <MdOutlineAssessment style={{ fontSize: 24 }} />
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("securityScanPage.history.empty")}</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {scanHistory.slice(0, 12).map((r) => {
            const row = r as Record<string, unknown>;
            const idRaw = row?.id;
            const id =
              typeof idRaw === "number"
                ? idRaw
                : (() => {
                    const n = parseInt(String(idRaw ?? ""), 10);
                    return Number.isFinite(n) ? n : NaN;
                  })();
            const st = String(row?.status || "");
            const done = Number(row?.doneItems ?? 0);
            const total = Number(row?.totalItems ?? 0);
            const countsObj = row?.counts as Record<string, unknown> | undefined;
            const totalFindings = countsObj?.total ?? null;
            
            const canOpen = Number.isFinite(id);
            const isActive = historyModalOpen && historyModalRunId != null && canOpen && historyModalRunId === id;
            
            return (
              <button
                key={String(row?.id)}
                type="button"
                onClick={() => canOpen && onOpenRun(id)}
                disabled={!canOpen}
                style={{
                  width: "100%",
                  textAlign: "left",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  padding: "16px 20px",
                  borderRadius: 16,
                  border: `1px solid ${isActive ? "rgba(14,165,233,0.5)" : "var(--panel-border)"}`,
                  background: isActive ? "rgba(14,165,233,0.05)" : "rgba(0,0,0,0.1)",
                  color: "var(--fg)",
                  cursor: canOpen ? "pointer" : "not-allowed",
                  opacity: canOpen ? 1 : 0.6,
                  transition: "all 0.2s ease",
                }}
                onMouseOver={(e) => {
                  if (!isActive && canOpen) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                    e.currentTarget.style.borderColor = "rgba(14,165,233,0.3)";
                  }
                }}
                onMouseOut={(e) => {
                  if (!isActive && canOpen) {
                    e.currentTarget.style.background = "rgba(0,0,0,0.1)";
                    e.currentTarget.style.borderColor = "var(--panel-border)";
                  }
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: isActive ? "#38bdf8" : "var(--fg)",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      }}
                    >
                      #{id}
                    </div>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--muted)" }} />
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: isActive ? "var(--fg)" : "var(--muted)",
                      }}
                    >
                      {st}
                    </div>
                  </div>
                  
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                      color: "var(--muted2)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span>{String(row?.phase || "") || "—"}</span>
                    {total > 0 && (
                      <>
                        <span>·</span>
                        <span>
                          {t("securityScanPage.history.progressLabel")
                            .replace("{done}", String(Math.min(done, total)))
                            .replace("{total}", String(total))}
                        </span>
                      </>
                    )}
                    {totalFindings != null && (
                      <>
                        <span>·</span>
                        <span style={{ color: totalFindings > 0 ? "#fca5a5" : "inherit" }}>
                          {t("securityScanPage.history.findingsLabel").replace("{count}", String(totalFindings))}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: isActive ? "#38bdf8" : "var(--muted)",
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: isActive ? "rgba(14,165,233,0.1)" : "rgba(0,0,0,0.2)",
                    transition: "all 0.2s",
                    flexShrink: 0,
                  }}
                >
                  {isActive ? t("securityScanPage.history.opened") : t("securityScanPage.history.open")}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}