import {
  MdWarning,
  MdErrorOutline,
  MdCheckCircle,
  MdOutlineLightbulb,
  MdCode,
  MdOutlineAssessment,
} from "react-icons/md";
import { useI18n } from "../../i18n";
import type { Finding } from "./securityScanShared";
import { securityScanCardBase as cardBase } from "./securityScanShared";
import React from "react";

type SeverityFilter = "ALL" | "CRITICAL" | "WARN" | "PASS";

type SeverityCounts = { c: number; w: number; p: number; total: number };

type Props = {
  findings: Finding[];
  scanning: boolean;
  filter: SeverityFilter;
  onFilterChange: (f: SeverityFilter) => void;
  filteredFindings: Finding[];
  severityCounts: SeverityCounts;
};

const enhancedCardBase = {
  ...cardBase,
  padding: "24px",
  borderRadius: "20px",
  background: "var(--panel-bg2)",
  border: "1px solid var(--panel-border)",
  boxShadow: "0 4px 24px -8px rgba(0,0,0,0.05)",
};

/** 柔和语义色：与面板灰底协调，避免高饱和霓虹感 */
function severityConfig(sevRaw: string) {
  const sev = (sevRaw || "").toUpperCase();
  const isC = sev === "CRITICAL";
  const isW = sev === "WARN";
  if (isC) {
    return {
      sev: sev || "CRITICAL",
      icon: <MdErrorOutline />,
      color: "#e07887",
      bg: "rgba(224,120,135,0.14)",
      border: "rgba(224,120,135,0.28)",
      stripe: "#c45c6c",
      cardTint: "rgba(224,120,135,0.04)",
    };
  }
  if (isW) {
    return {
      sev: sev || "WARN",
      icon: <MdWarning />,
      color: "#d4a054",
      bg: "rgba(212,160,84,0.16)",
      border: "rgba(212,160,84,0.3)",
      stripe: "#b8893d",
      cardTint: "rgba(212,160,84,0.05)",
    };
  }
  return {
    sev: sev || "PASS",
    icon: <MdCheckCircle />,
    color: "#5eb88a",
    bg: "rgba(94,184,138,0.14)",
    border: "rgba(94,184,138,0.28)",
    stripe: "#4a9d73",
    cardTint: "rgba(94,184,138,0.04)",
  };
}

function severityDisplayLabel(sevRaw: string, t: (key: string) => string): string {
  const u = (sevRaw || "").toUpperCase();
  if (u === "CRITICAL") return t("securityScanPage.results.severityCritical");
  if (u === "WARN") return t("securityScanPage.results.severityWarn");
  if (u === "PASS") return t("securityScanPage.results.severityPass");
  return sevRaw || u;
}

export function SecurityScanResultsTab({
  findings,
  scanning,
  filter,
  onFilterChange,
  filteredFindings,
  severityCounts: sc,
}: Props) {
  const { t } = useI18n();

  if (findings.length === 0 && !scanning) {
    return (
      <div
        style={{
          ...enhancedCardBase,
          padding: "56px 28px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          background: "linear-gradient(180deg, var(--panel-bg2) 0%, rgba(94,184,138,0.06) 100%)",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "rgba(94,184,138,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 0 6px rgba(94,184,138,0.05)",
          }}
        >
          <MdCheckCircle style={{ fontSize: 36, color: "#5eb88a" }} />
        </div>
        <div style={{ maxWidth: 420 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--fg)" }}>{t("securityScanPage.results.emptyTitle")}</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8, lineHeight: 1.65 }}>
            {t("securityScanPage.results.emptyDesc")}
          </div>
        </div>
      </div>
    );
  }

  const filterChips: Array<{
    id: SeverityFilter;
    label: string;
    count: number;
  }> = [
    { id: "ALL", label: t("securityScanPage.results.filterAll"), count: sc.total },
    { id: "CRITICAL", label: t("securityScanPage.results.filterCritical"), count: sc.c },
    { id: "WARN", label: t("securityScanPage.results.filterWarn"), count: sc.w },
    { id: "PASS", label: t("securityScanPage.results.filterPass"), count: sc.p },
  ];

  return (
    <div style={enhancedCardBase}>
      <style>{`@keyframes security-scan-spin { to { transform: rotate(360deg); } }`}</style>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              padding: 8,
              borderRadius: 10,
              background: "rgba(148,163,184,0.12)",
              color: "var(--muted)",
              flexShrink: 0,
            }}
          >
            <MdOutlineAssessment style={{ fontSize: 20 }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--fg)", lineHeight: 1.35 }}>
              {t("securityScanPage.results.title")}
            </h3>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>
              {t("securityScanPage.results.summaryCritical")}{" "}
              <span style={{ color: "#c45c6c", fontWeight: 600 }}>{sc.c}</span>
              <span style={{ margin: "0 6px", color: "var(--muted2)" }}>·</span>
              {t("securityScanPage.results.summaryWarn")}{" "}
              <span style={{ color: "#b8893d", fontWeight: 600 }}>{sc.w}</span>
              <span style={{ margin: "0 6px", color: "var(--muted2)" }}>·</span>
              {t("securityScanPage.results.summaryPass")}{" "}
              <span style={{ color: "#4a9d73", fontWeight: 600 }}>{sc.p}</span>
              <span style={{ margin: "0 6px", color: "var(--muted2)" }}>·</span>
              {t("securityScanPage.results.summaryTotal").replace("{count}", String(sc.total))}
            </div>
          </div>
        </div>
      </div>

      {scanning && findings.length === 0 ? (
        <div
          style={{
            padding: "48px 16px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
            borderRadius: 14,
            border: "1px dashed var(--panel-border)",
            background: "rgba(0,0,0,0.04)",
          }}
        >
          <MdOutlineAssessment
            style={{
              fontSize: 32,
              color: "var(--muted)",
              animation: "security-scan-spin 1.2s linear infinite",
            }}
          />
          <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>{t("securityScanPage.results.scanning")}</div>
        </div>
      ) : (
        <>
          {findings.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 20,
                paddingBottom: 18,
                borderBottom: "1px solid var(--panel-border)",
              }}
            >
              {filterChips.map((c) => {
                const active = filter === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onFilterChange(c.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 14px",
                      borderRadius: 999,
                      border: `1px solid ${active ? "rgba(148,163,184,0.45)" : "var(--panel-border)"}`,
                      background: active ? "rgba(148,163,184,0.14)" : "rgba(0,0,0,0.05)",
                      color: active ? "var(--fg)" : "var(--muted)",
                      fontSize: 12,
                      fontWeight: active ? 600 : 500,
                      cursor: "pointer",
                      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                      boxShadow: active ? "0 1px 8px rgba(0,0,0,0.06)" : "none",
                    }}
                    onMouseOver={(e) => {
                      if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                    }}
                    onMouseOut={(e) => {
                      if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.05)";
                    }}
                  >
                    <span>{c.label}</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        minWidth: 22,
                        textAlign: "center",
                        padding: "1px 7px",
                        borderRadius: 999,
                        background: active ? "rgba(148,163,184,0.22)" : "rgba(0,0,0,0.14)",
                        color: active ? "var(--fg)" : "var(--muted2)",
                      }}
                    >
                      {c.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {findings.length > 0 && filteredFindings.length === 0 ? (
            <div
              style={{
                padding: "36px 16px",
                textAlign: "center",
                fontSize: 13,
                color: "var(--muted)",
                borderRadius: 14,
                border: "1px dashed var(--panel-border)",
                background: "rgba(0,0,0,0.03)",
              }}
            >
              {t("securityScanPage.results.filterEmpty")}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {filteredFindings.map((f, idx) => {
                const cfg = severityConfig(f.severity);

                return (
                  <div
                    key={`${f.itemCode}-${idx}`}
                    className="ui-item-card"
                    style={{
                      position: "relative",
                      borderRadius: 14,
                      border: "1px solid var(--panel-border)",
                      borderLeft: `3px solid ${cfg.stripe}`,
                      background: `linear-gradient(135deg, ${cfg.cardTint} 0%, var(--panel-bg) 48%, var(--panel-bg) 100%)`,
                      padding: "16px 18px 16px 20px",
                      display: "flex",
                      gap: 14,
                      alignItems: "flex-start",
                      transition: "border-color 0.2s, background 0.2s",
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        flexShrink: 0,
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        background: cfg.bg,
                        color: cfg.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 22,
                        marginTop: 2,
                      }}
                    >
                      {cfg.icon}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 12,
                          flexWrap: "wrap",
                          marginBottom: f.detail ? 10 : 6,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                          <span
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                              color: "var(--fg)",
                              lineHeight: 1.4,
                              wordBreak: "break-word",
                            }}
                          >
                            {f.title}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: "0.04em",
                              padding: "3px 8px",
                              borderRadius: 6,
                              background: cfg.bg,
                              color: cfg.color,
                              border: `1px solid ${cfg.border}`,
                              flexShrink: 0,
                            }}
                          >
                            {severityDisplayLabel(f.severity, t)}
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--muted2)",
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                            padding: "4px 9px",
                            borderRadius: 6,
                            background: "rgba(148,163,184,0.1)",
                            border: "1px solid var(--panel-border)",
                            flexShrink: 0,
                          }}
                        >
                          #{f.itemCode}
                        </div>
                      </div>

                      {f.detail ? (
                        <div
                          style={{
                            fontSize: 13,
                            color: "var(--muted)",
                            lineHeight: 1.65,
                            marginBottom: f.location || f.remediation ? 12 : 0,
                          }}
                        >
                          {f.detail}
                        </div>
                      ) : null}

                      {f.location ? (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 8,
                            fontSize: 12,
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                            padding: "10px 12px",
                            borderRadius: 10,
                            background: "rgba(148,163,184,0.08)",
                            border: "1px solid var(--panel-border)",
                            color: "var(--fg)",
                            marginBottom: f.remediation ? 12 : 0,
                            wordBreak: "break-all",
                          }}
                        >
                          <MdCode style={{ fontSize: 16, color: "var(--muted2)", flexShrink: 0, marginTop: 1 }} />
                          <div style={{ lineHeight: 1.5, minWidth: 0 }}>
                            <span style={{ color: "var(--muted2)", marginRight: 8, userSelect: "none" }}>
                              {t("securityScanPage.results.location")}
                            </span>
                            <span style={{ color: "var(--muted)" }}>{f.location}</span>
                          </div>
                        </div>
                      ) : null}

                      {f.remediation ? (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 10,
                            fontSize: 13,
                            lineHeight: 1.65,
                            padding: "12px 14px",
                            borderRadius: 12,
                            background: "rgba(148,163,184,0.09)",
                            border: "1px solid var(--panel-border)",
                            borderLeft: "3px solid rgba(148,163,184,0.45)",
                            color: "var(--fg)",
                          }}
                        >
                          <MdOutlineLightbulb
                            style={{ fontSize: 18, color: "var(--muted)", flexShrink: 0, marginTop: 2 }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <span style={{ color: "var(--fg)", fontWeight: 600 }}>{t("securityScanPage.results.remediation")}</span>
                            <span style={{ color: "var(--muted)", display: "block", marginTop: 4 }}>{f.remediation}</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
