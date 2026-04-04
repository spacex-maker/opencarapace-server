import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { LocalStatus } from "../types";
import {
  MdManageSearch,
  MdErrorOutline,
  MdPlayArrow,
  MdRefresh,
  MdOutlineSecurity,
} from "react-icons/md";
import { SecurityScanRunModal } from "./SecurityScanRunModal";
import { SecurityScanHistoryTab } from "./security-scan/SecurityScanHistoryTab";
import { SecurityScanItemsTab } from "./security-scan/SecurityScanItemsTab";
import { SecurityScanResultsTab } from "./security-scan/SecurityScanResultsTab";
import type { Finding, PrivacyState, ScanItem } from "./security-scan/securityScanShared";
import { securityScanCardBase as cardBase, translateSecurityScanApiError } from "./security-scan/securityScanShared";

export function SecurityScanPanel({ status }: { status: LocalStatus | null }) {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<ScanItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [contextExtra, setContextExtra] = useState("");
  const hasInitSelectedRef = useRef(false);

  const [privacy, setPrivacy] = useState<PrivacyState | null>(null);
  const [privacyLoading, setPrivacyLoading] = useState(true);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [privacySaving, setPrivacySaving] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [scanPhase, setScanPhase] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "CRITICAL" | "WARN" | "PASS">("ALL");
  const [subTab, setSubTab] = useState<"items" | "results" | "history">("items");
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number; status: string } | null>(null);
  const [scanHistory, setScanHistory] = useState<unknown[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyModalRunId, setHistoryModalRunId] = useState<number | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  const loadItems = useCallback(async () => {
    setItemsLoading(true);
    setItemsError(null);
    try {
      const res = await fetch("http://127.0.0.1:19111/api/security-scan/items");
      const data = await res.json();
      if (!res.ok) {
        setItemsError(
          translateSecurityScanApiError(data, t) ??
            (data as { error?: { message?: string } })?.error?.message ??
            t("securityScanPage.err.loadItems")
        );
        return;
      }
      const list = (data?.items || []) as ScanItem[];
      setItems(list);
      setSelected((prev) => {
        const next: Record<string, boolean> = {};
        const shouldInitAll = !hasInitSelectedRef.current || Object.keys(prev).length === 0;
        list.forEach((it) => {
          next[it.code] = shouldInitAll ? true : (prev[it.code] ?? true);
        });
        hasInitSelectedRef.current = true;
        return next;
      });
    } catch (e: any) {
      setItemsError(e?.message ?? t("securityScanPage.err.loadItems"));
    } finally {
      setItemsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const loadPrivacy = useCallback(async () => {
    setPrivacyLoading(true);
    setPrivacyError(null);
    try {
      const res = await fetch("http://127.0.0.1:19111/api/security-scan/privacy");
      const data = await res.json();
      if (!res.ok) {
        setPrivacyError(data?.error?.message || t("securityScanPage.err.loadPrivacy"));
        setPrivacy(null);
        return;
      }
      setPrivacy({
        shareHistoryEnabled: !!data?.shareHistoryEnabled,
        consentSystemConfigEnabled: !!data?.consentSystemConfigEnabled,
      });
    } catch (e: any) {
      setPrivacyError(e?.message ?? t("securityScanPage.err.loadPrivacy"));
      setPrivacy(null);
    } finally {
      setPrivacyLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadPrivacy();
  }, [loadPrivacy]);

  const savePrivacy = useCallback(
    async (nextPartial: Partial<PrivacyState>) => {
      if (!privacy) return;
      const next: PrivacyState = {
        shareHistoryEnabled: nextPartial.shareHistoryEnabled ?? privacy.shareHistoryEnabled,
        consentSystemConfigEnabled:
          nextPartial.consentSystemConfigEnabled ?? privacy.consentSystemConfigEnabled,
      };
      setPrivacySaving(true);
      setPrivacyError(null);
      try {
        const res = await fetch("http://127.0.0.1:19111/api/security-scan/privacy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        const data = await res.json();
        if (!res.ok) {
          setPrivacyError(data?.error?.message || t("securityScanPage.err.savePrivacy"));
          return;
        }
        setPrivacy(next);
      } catch (e: any) {
        setPrivacyError(e?.message ?? t("securityScanPage.err.savePrivacy"));
      } finally {
        setPrivacySaving(false);
      }
    },
    [privacy, t]
  );

  const buildAutoContext = useCallback(() => {
    const lines: string[] = [];
    lines.push(t("securityScanPage.autoContext.banner"));
    lines.push(
      t("securityScanPage.autoContext.client")
        .replace("{platformLabel}", status?.platformLabel || t("securityScanPage.autoContext.unknownSystem"))
        .replace("{platform}", status?.platform || "—")
    );
    lines.push(
      t("securityScanPage.autoContext.cloudBase").replace(
        "{value}",
        status?.settings?.apiBase || t("securityScanPage.autoContext.cloudUnset")
      )
    );
    lines.push(
      t("securityScanPage.autoContext.routeMode").replace(
        "{value}",
        status?.llmRouteMode || t("securityScanPage.autoContext.unknownRoute")
      )
    );
    lines.push(
      t("securityScanPage.autoContext.localStats")
        .replace("{danger}", String(status?.danger ?? "—"))
        .replace("{disabled}", String(status?.disabled ?? "—"))
        .replace("{deprecated}", String(status?.deprecated ?? "—"))
    );
    lines.push(
      t("securityScanPage.autoContext.loginEmail").replace(
        "{value}",
        status?.auth?.email || t("securityScanPage.autoContext.notLoggedIn")
      )
    );
    if (contextExtra.trim()) {
      lines.push("");
      lines.push(t("securityScanPage.autoContext.userExtra"));
      lines.push(contextExtra.trim());
    }
    return lines.join("\n");
  }, [status, contextExtra, t]);

  const counts = useMemo(() => {
    let c = 0,
      w = 0,
      p = 0;
    findings.forEach((f) => {
      const s = (f.severity || "").toUpperCase();
      if (s === "CRITICAL") c++;
      else if (s === "WARN") w++;
      else if (s === "PASS") p++;
    });
    return { c, w, p, total: findings.length };
  }, [findings]);

  const filteredFindings = useMemo(() => {
    if (filter === "ALL") return findings;
    return findings.filter((f) => (f.severity || "").toUpperCase() === filter);
  }, [findings, filter]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:19111/api/security-scan/runs");
      const data = await res.json();
      if (!res.ok) return;
      setScanHistory(Array.isArray(data?.runs) ? data.runs : []);
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (subTab === "history") void loadHistory();
  }, [subTab, loadHistory]);

  const openHistoryModal = useCallback((id: number) => {
    setHistoryModalRunId(id);
    setHistoryModalOpen(true);
  }, []);

  const runScan = async () => {
    const codes = items.filter((it) => selected[it.code]).map((it) => it.code);
    if (codes.length === 0) {
      setScanError(t("securityScanPage.err.pickOneItem"));
      return;
    }
    setScanning(true);
    setScanError(null);
    setFindings([]);
    setSubTab("results");
    setScanPhase(t("securityScanPage.phase.creating"));
    setScanProgress({ done: 0, total: codes.length, status: "RUNNING" });
    try {
      const res = await fetch("http://127.0.0.1:19111/api/security-scan/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemCodes: codes, context: buildAutoContext(), locale }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScanError(
          translateSecurityScanApiError(data, t) ??
            (data as { error?: { message?: string } })?.error?.message ??
            t("securityScanPage.err.scanHttp").replace("{status}", String(res.status))
        );
        return;
      }
      const rid = Number(data?.runId);
      if (!Number.isFinite(rid)) {
        setScanError(t("securityScanPage.err.missingRunId"));
        return;
      }
      setScanPhase(String(data?.phase || t("securityScanPage.phase.taskCreated")));

      let lastStatus = "RUNNING";
      while (lastStatus === "RUNNING" || lastStatus === "PENDING") {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 900));
        // eslint-disable-next-line no-await-in-loop
        const rres = await fetch(`http://127.0.0.1:19111/api/security-scan/runs/${rid}`);
        // eslint-disable-next-line no-await-in-loop
        const rdata = await rres.json();
        if (!rres.ok) {
          setScanError(
            translateSecurityScanApiError(rdata, t) ??
              (rdata as { error?: { message?: string } })?.error?.message ??
              t("securityScanPage.err.scanHttp").replace("{status}", String(rres.status))
          );
          break;
        }
        const runStatus = String(rdata?.status || "RUNNING");
        const done = Number(rdata?.doneItems ?? 0);
        const total = Number(rdata?.totalItems ?? codes.length);
        setScanPhase(String(rdata?.phase || ""));
        setScanProgress({
          done: Number.isFinite(done) ? done : 0,
          total: Number.isFinite(total) ? total : codes.length,
          status: runStatus,
        });
        const list = (rdata?.findings || []) as Finding[];
        if (Array.isArray(list) && list.length > 0) setFindings(list);
        lastStatus = runStatus.toUpperCase();
        if (lastStatus === "SUCCESS") {
          setScanPhase("");
          break;
        }
        if (lastStatus === "FAILED") {
          setScanError(String(rdata?.errorMessage || t("securityScanPage.err.scanFailed")));
          break;
        }
      }

      void loadHistory();
    } catch (e: any) {
      setScanError(e?.message ?? t("securityScanPage.err.scanFailed"));
    } finally {
      setScanning(false);
    }
  };

  const toggle = (code: string) => {
    setSelected((s) => ({ ...s, [code]: !s[code] }));
  };

  const selectAll = (on: boolean) => {
    const next: Record<string, boolean> = {};
    items.forEach((it) => {
      next[it.code] = on;
    });
    setSelected(next);
  };

  return (
    <div style={{ maxWidth: 1024, margin: "0 auto", padding: "10px", color: "var(--fg)" }}>
      <style>{`
        @keyframes pulseScan { 
          0% { opacity: 0.6; transform: translateX(-100%); } 
          50% { opacity: 1; } 
          100% { opacity: 0.6; transform: translateX(200%); } 
        }
        .ui-btn-hover:hover { filter: brightness(1.1); transform: translateY(-1px); }
        .ui-btn-hover:active { transform: translateY(0); }
        .ui-item-card:hover { border-color: rgba(14, 165, 233, 0.3) !important; background: rgba(255,255,255,0.01); }

        .ss-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          background: var(--panel-bg2);
          padding: 4px;
          border-radius: 999px;
          border: 1px solid var(--panel-border);
          box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        }
        .ss-tab {
          appearance: none;
          border: 1px solid transparent;
          background: transparent;
          color: var(--muted);
          padding: 8px 20px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, color 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          line-height: 1;
        }
        .ss-tab:hover {
          color: var(--fg);
          background: rgba(14,165,233,0.08);
          border-color: rgba(14,165,233,0.25);
        }
        .ss-tab:active { transform: translateY(0); }
        .ss-tab:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(14,165,233,0.35);
        }
        .ss-tab--active {
          color: var(--fg);
          background: var(--panel-bg);
          border-color: var(--panel-border);
          box-shadow: 0 2px 10px rgba(0,0,0,0.10);
        }
        .ss-tab-badge {
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          border: 1px solid var(--panel-border);
          background: rgba(14,165,233,0.10);
          color: var(--muted2);
        }
        .ss-tab--active .ss-tab-badge {
          background: rgba(14,165,233,0.14);
          color: var(--fg);
        }

        .ss-finding-loc {
          background: var(--panel-bg2);
          border: 1px solid var(--panel-border);
          color: var(--muted2);
        }
        .ss-finding-remedy {
          background: rgba(14,165,233,0.10);
          border: 1px solid rgba(14,165,233,0.22);
          color: var(--fg);
        }
        .ss-finding-remedy strong {
          color: #38bdf8;
        }
      `}</style>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 999,
            background: "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(14,165,233,0.1))",
            border: "1px solid rgba(34,197,94,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#4ade80",
            boxShadow: "0 4px 20px rgba(34,197,94,0.1)",
          }}
        >
          <MdOutlineSecurity style={{ fontSize: 32 }} />
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "var(--fg)", letterSpacing: "-0.02em" }}>
            {t("securityScanPage.title")}
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>
            {t("securityScanPage.introP1")}
            <br />
            {t("securityScanPage.introP2BeforeCode")}
            <code
              style={{
                fontSize: 12,
                background: "var(--panel-bg2)",
                padding: "2px 10px",
                borderRadius: 999,
                color: "#e2e8f0",
              }}
            >
              deepseek.api_key
            </code>
            {t("securityScanPage.introP2AfterCode")}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginLeft: "auto" }}>
          <button
            className="ui-btn-hover"
            type="button"
            onClick={() => void loadItems()}
            disabled={itemsLoading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 16px",
              borderRadius: 999,
              border: "1px solid var(--panel-border)",
              background: "var(--panel-bg)",
              color: "var(--fg)",
              fontSize: 13,
              fontWeight: 600,
              cursor: itemsLoading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              whiteSpace: "nowrap",
            }}
          >
            <MdRefresh style={{ fontSize: 18, animation: itemsLoading ? "spin 1s linear infinite" : "none" }} />
            {t("securityScanPage.refreshConfig")}
          </button>

          <button
            className="ui-btn-hover"
            type="button"
            onClick={() => void runScan()}
            disabled={scanning || itemsLoading || items.length === 0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderRadius: 999,
              border: "none",
              background: scanning ? "var(--panel-bg2)" : "linear-gradient(135deg, #16a34a, #15803d)",
              color: scanning ? "var(--muted)" : "#fff",
              fontSize: 13,
              fontWeight: 800,
              cursor: scanning ? "not-allowed" : "pointer",
              boxShadow: scanning ? "none" : "0 4px 12px rgba(22,163,74,0.28)",
              transition: "all 0.2s",
              whiteSpace: "nowrap",
            }}
            title={items.length === 0 ? t("securityScanPage.scanDisabledNoItems") : undefined}
          >
            {scanning ? (
              <MdRefresh style={{ fontSize: 18, animation: "spin 1s linear infinite" }} />
            ) : (
              <MdPlayArrow style={{ fontSize: 18 }} />
            )}
            {scanning ? t("securityScanPage.scanning") : t("securityScanPage.runDeepScan")}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", marginBottom: 24 }}>
        <div className="ss-tabs">
          {(
            [
              { id: "items" as const, label: t("securityScanPage.tabs.items"), badge: null as number | null },
              {
                id: "results" as const,
                label: t("securityScanPage.tabs.results"),
                badge: counts.total > 0 ? counts.total : null,
              },
              {
                id: "history" as const,
                label: t("securityScanPage.tabs.history"),
                badge: scanHistory.length > 0 ? scanHistory.length : null,
              },
            ]
          ).map((tabDef) => {
            const isActive = subTab === tabDef.id;
            return (
              <button
                key={tabDef.id}
                type="button"
                onClick={() => setSubTab(tabDef.id)}
                className={`ss-tab ${isActive ? "ss-tab--active" : ""}`}
              >
                {tabDef.label}
                {tabDef.badge != null && <span className="ss-tab-badge">{tabDef.badge}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {(scanning || scanPhase) && (
        <div
          style={{
            ...cardBase,
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 20,
            borderColor: "rgba(14,165,233,0.3)",
            background: "linear-gradient(to right, var(--panel-bg), rgba(14,165,233,0.05))",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 999,
              background: "rgba(14,165,233,0.15)",
              color: "#38bdf8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 15px rgba(14,165,233,0.2)",
            }}
          >
            <MdManageSearch style={{ fontSize: 26, animation: scanning ? "pulse 2s infinite" : "none" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: "var(--fg)",
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              {scanning ? t("securityScanPage.scanStatusRunning") : t("securityScanPage.scanStatusReady")}
              {scanProgress && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: "var(--muted2)",
                    border: "1px solid var(--panel-border)",
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "var(--panel-bg2)",
                  }}
                >
                  {Math.min(scanProgress.done, scanProgress.total)}/{scanProgress.total}
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
              {scanPhase || t("securityScanPage.scanHintSelectItems")}
            </div>
            {scanning && (
              <div
                style={{
                  height: 8,
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: 999,
                  marginTop: 12,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: 0,
                    width:
                      scanProgress && scanProgress.total > 0
                        ? `${Math.max(6, Math.round((scanProgress.done / scanProgress.total) * 100))}%`
                        : "40%",
                    borderRadius: 999,
                    background: "linear-gradient(90deg, transparent, #38bdf8, #22c55e, transparent)",
                    animation: "pulseScan 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite",
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === "results" && findings.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 20 }}>
          {[
            { label: t("securityScanPage.stats.critical"), n: counts.c, color: "#f87171", bg: "rgba(248,113,113,0.05)" },
            { label: t("securityScanPage.stats.warning"), n: counts.w, color: "#fbbf24", bg: "rgba(251,191,36,0.05)" },
            { label: t("securityScanPage.stats.passed"), n: counts.p, color: "#4ade80", bg: "rgba(74,222,128,0.05)" },
            { label: t("securityScanPage.stats.total"), n: counts.total, color: "var(--fg)", bg: "var(--panel-bg2)" },
          ].map((b) => (
            <div key={b.label} style={{ ...cardBase, padding: "16px", textAlign: "center", background: b.bg, border: `1px solid ${b.color}20` }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: b.color, fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>{b.n}</div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--muted)",
                  marginTop: 4,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {b.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {(itemsError || scanError) && (
        <div
          style={{
            ...cardBase,
            background: "rgba(248,113,113,0.05)",
            borderColor: "rgba(248,113,113,0.3)",
            color: "#fca5a5",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <MdErrorOutline style={{ fontSize: 20 }} />
          {itemsError || scanError}
        </div>
      )}

      {subTab === "items" && (
        <SecurityScanItemsTab
          items={items}
          itemsLoading={itemsLoading}
          selected={selected}
          contextExtra={contextExtra}
          onContextExtraChange={setContextExtra}
          privacy={privacy}
          privacyLoading={privacyLoading}
          privacySaving={privacySaving}
          privacyError={privacyError}
          onSavePrivacy={(p) => void savePrivacy(p)}
          onToggleItem={toggle}
          onSelectAll={selectAll}
        />
      )}

      {subTab === "history" && (
        <SecurityScanHistoryTab
          scanHistory={scanHistory}
          historyLoading={historyLoading}
          onRefresh={loadHistory}
          onOpenRun={openHistoryModal}
          historyModalOpen={historyModalOpen}
          historyModalRunId={historyModalRunId}
        />
      )}

      {subTab === "results" && (
        <SecurityScanResultsTab
          findings={findings}
          scanning={scanning}
          filter={filter}
          onFilterChange={setFilter}
          filteredFindings={filteredFindings}
          severityCounts={counts}
        />
      )}

      <SecurityScanRunModal
        open={historyModalOpen}
        runId={historyModalRunId}
        onClose={() => setHistoryModalOpen(false)}
        onApplyFindings={(fs) => {
          setFindings(fs as Finding[]);
          setFilter("ALL");
          setSubTab("results");
          setHistoryModalOpen(false);
        }}
      />
    </div>
  );
}
