import { useEffect, useMemo, useState } from "react";
import { MdClose, MdRefresh } from "react-icons/md";
import { useI18n } from "../i18n";
import { localeToHtmlLang } from "../i18n/localeMeta";
import { translateSecurityScanApiError } from "./security-scan/securityScanShared";

type Finding = {
  itemCode: string;
  severity: string;
  title: string;
  detail: string;
  remediation: string;
  location: string;
};

type RunDetail = {
  id: number;
  status: string;
  phase: string;
  totalItems: number;
  doneItems: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  findings: Finding[];
  errorMessage?: string | null;
};

export function SecurityScanRunModal(props: {
  open: boolean;
  runId: number | null;
  onClose: () => void;
  onApplyFindings?: (findings: Finding[]) => void;
}) {
  const { open, runId, onClose, onApplyFindings } = props;
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<RunDetail | null>(null);

  const canFetch = open && runId != null && Number.isFinite(runId);

  const progressPct = useMemo(() => {
    if (!detail) return 0;
    const total = Math.max(0, Number(detail.totalItems || 0));
    const done = Math.max(0, Number(detail.doneItems || 0));
    if (total <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
  }, [detail]);

  const formatTime = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    // 使用本机时区展示，避免把 UTC 当成本地时间误读
    return d.toLocaleString(localeToHtmlLang(locale), {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const load = async () => {
    if (!canFetch) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`http://127.0.0.1:19111/api/security-scan/runs/${runId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(
          translateSecurityScanApiError(data, t) ??
            (data as { error?: { message?: string } })?.error?.message ??
            t("securityScanPage.runModal.loadFailedHttp").replace("{status}", String(res.status))
        );
        setDetail(null);
        return;
      }
      const findings = Array.isArray(data?.findings) ? (data.findings as Finding[]) : [];
      setDetail({
        id: Number(data?.id ?? runId),
        status: String(data?.status || ""),
        phase: String(data?.phase || ""),
        totalItems: Number(data?.totalItems ?? 0),
        doneItems: Number(data?.doneItems ?? 0),
        createdAt: data?.createdAt ?? null,
        updatedAt: data?.updatedAt ?? null,
        findings,
        errorMessage: data?.errorMessage ?? null,
      });
    } catch {
      setError(t("securityScanPage.runModal.loadFailedNetwork"));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, runId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 9999,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(920px, 96vw)",
          maxHeight: "86vh",
          overflow: "auto",
          borderRadius: 22,
          border: "1px solid var(--panel-border)",
          background: "var(--panel-bg)",
          color: "var(--fg)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            background: "var(--panel-bg)",
            borderBottom: "1px solid var(--panel-border)",
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: "-0.01em" }}>
              {t("securityScanPage.runModal.titlePrefix")}
              {runId ?? "—"}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {detail
                ? `${detail.status} · ${detail.phase || "—"} · ${detail.doneItems}/${detail.totalItems}`
                : loading
                  ? t("securityScanPage.runModal.subtitleLoading")
                  : "—"}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {detail && onApplyFindings && (
              <button
                type="button"
                className="ui-btn-hover"
                onClick={() => onApplyFindings(detail.findings || [])}
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: "1px solid var(--panel-border)",
                  background: "var(--panel-bg2)",
                  color: "var(--fg)",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {t("securityScanPage.runModal.applyToReport")}
              </button>
            )}
            <button
              type="button"
              className="ui-btn-hover"
              onClick={() => void load()}
              disabled={loading || !canFetch}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid var(--panel-border)",
                background: "var(--panel-bg2)",
                color: "var(--fg)",
                fontSize: 12,
                fontWeight: 800,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
              title={!canFetch ? t("securityScanPage.runModal.invalidRunId") : undefined}
            >
              <MdRefresh style={{ fontSize: 16, animation: loading ? "spin 1s linear infinite" : "none" }} />
              {t("securityScanPage.runModal.refresh")}
            </button>
            <button
              type="button"
              className="ui-btn-hover"
              onClick={onClose}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: 999,
                border: "1px solid var(--panel-border)",
                background: "var(--panel-bg2)",
                color: "var(--fg)",
                cursor: "pointer",
              }}
              aria-label={t("securityScanPage.runModal.closeAria")}
            >
              <MdClose style={{ fontSize: 18 }} />
            </button>
          </div>
        </div>

        <div style={{ padding: 16 }}>
          {error && (
            <div
              style={{
                border: "1px solid rgba(248,113,113,0.35)",
                background: "rgba(248,113,113,0.08)",
                borderRadius: 18,
                padding: "10px 12px",
                color: "var(--fg)",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {detail && (
            <>
              <div style={{ marginTop: 10 }}>
                <div style={{ height: 10, borderRadius: 999, background: "var(--panel-bg2)", border: "1px solid var(--panel-border)", overflow: "hidden" }}>
                  <div style={{ width: `${progressPct}%`, height: "100%", background: "linear-gradient(90deg, #38bdf8, #22c55e)", borderRadius: 999 }} />
                </div>
                <div
                  style={{ marginTop: 8, fontSize: 12, color: "var(--muted2)" }}
                  title={[
                    detail.createdAt ? `createdAt: ${detail.createdAt}` : "",
                    detail.updatedAt ? `updatedAt: ${detail.updatedAt}` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                >
                  {detail.createdAt ? `${t("securityScanPage.runModal.createdAt")}${formatTime(detail.createdAt)}` : ""}
                  {detail.updatedAt ? `${t("securityScanPage.runModal.updatedAt")}${formatTime(detail.updatedAt)}` : ""}
                </div>
                {detail.errorMessage ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#fca5a5" }}>{detail.errorMessage}</div>
                ) : null}
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                {(detail.findings || []).map((f, idx) => (
                  <div
                    key={`${f.itemCode}-${idx}`}
                    style={{
                      borderRadius: 22,
                      border: "1px solid var(--panel-border)",
                      background: "var(--panel-bg2)",
                      padding: "12px 14px",
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                      <div style={{ fontSize: 14, fontWeight: 900, color: "var(--fg)" }}>{f.title}</div>
                      <span style={{ fontSize: 11, fontWeight: 900, padding: "2px 10px", borderRadius: 999, border: "1px solid var(--panel-border)", color: "var(--muted2)" }}>
                        {((): string => {
                          const u = String(f.severity || "WARN").toUpperCase();
                          if (u === "CRITICAL") return t("securityScanPage.results.severityCritical");
                          if (u === "WARN") return t("securityScanPage.results.severityWarn");
                          if (u === "PASS") return t("securityScanPage.results.severityPass");
                          return u;
                        })()}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 10px", borderRadius: 999, border: "1px solid var(--panel-border)", color: "var(--muted2)" }}>
                        #{f.itemCode}
                      </span>
                    </div>
                    {f.detail ? <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted)", lineHeight: 1.65 }}>{f.detail}</div> : null}
                    {f.location ? (
                      <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted2)", border: "1px solid var(--panel-border)", background: "var(--panel-bg)", padding: "8px 10px", borderRadius: 16, wordBreak: "break-all" }}>
                        <span style={{ opacity: 0.6, marginRight: 8 }}>{t("securityScanPage.runModal.pathLocation")}</span>
                        {f.location}
                      </div>
                    ) : null}
                    {f.remediation ? (
                      <div style={{ marginTop: 10, fontSize: 13, color: "var(--fg)", background: "rgba(14,165,233,0.10)", border: "1px solid rgba(14,165,233,0.22)", padding: "10px 12px", borderRadius: 18 }}>
                        <strong style={{ color: "#38bdf8", marginRight: 8 }}>{t("securityScanPage.runModal.remediationStrong")}</strong>
                        {f.remediation}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          )}

          {!loading && !detail && !error && (
            <div style={{ fontSize: 13, color: "var(--muted)" }}>{t("securityScanPage.runModal.noData")}</div>
          )}
        </div>
      </div>
    </div>
  );
}

