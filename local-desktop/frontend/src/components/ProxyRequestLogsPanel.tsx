import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { localeToHtmlLang } from "../i18n/localeMeta";

type ProxyRequestLog = {
  id: number;
  createdAt: string;
  providerKey: string;
  model: string | null;
  routeMode: string | null;
  requestPath: string | null;
  statusCode: number | null;
  blockType: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  costUsd: number;
  latencyMs: number | null;
  errorSnippet: string | null;
  clientId: string | null;
};

type PageResponse = {
  page: number;
  size: number;
  total: number;
  items: ProxyRequestLog[];
};

function fmtLocalDateTime(value: string | null | undefined, htmlLang: string): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString(htmlLang, { hour12: false });
}

function fmtUsd(n: number) {
  if (!Number.isFinite(n)) return "-";
  return `$${n.toFixed(4)}`;
}

function fmtLatencyMs(n: number | null) {
  if (n == null) return "-";
  if (!Number.isFinite(n)) return "-";
  if (n < 1000) return `${Math.round(n)} ms`;
  return `${(n / 1000).toFixed(2)} s`;
}

function formatBlockType(code: string | null, tr: (key: string) => string) {
  if (!code) return "-";
  if (code === "danger_command") return tr("interceptMonitorPage.blockTypes.danger_command");
  if (code === "skill_disabled") return tr("interceptMonitorPage.blockTypes.skill_disabled");
  if (code === "budget_exceeded") return tr("interceptMonitorPage.blockTypes.budget_exceeded");
  return code;
}

export function ProxyRequestLogsPanel() {
  const { t, locale } = useI18n();
  const dateLocale = localeToHtmlLang(locale);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ProxyRequestLog[]>([]);

  const [page, setPage] = useState(1);
  const [size] = useState(50);
  const [total, setTotal] = useState(0);

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / size)), [total, size]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("page", String(page));
      qs.set("size", String(size));

      const res = await fetch(`http://127.0.0.1:19111/api/intercept-request-logs?${qs.toString()}`);
      const data = (await res.json()) as PageResponse;
      if (!res.ok) {
        setError(data?.["error"]?.message || t("interceptMonitorPage.proxyRequests.loadFailed"));
        setItems([]);
        setTotal(0);
        return;
      }
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotal(typeof data?.total === "number" ? data.total : 0);
    } catch (e: any) {
      setError(e?.message ?? t("interceptMonitorPage.proxyRequests.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const syncToCloud = async () => {
    setSyncing(true);
    setSyncMsg(null);
    setError(null);
    try {
      const res = await fetch("http://127.0.0.1:19111/api/token-usages/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || t("interceptMonitorPage.proxyRequests.syncFailed"));
        return;
      }
      setSyncMsg(
        t("interceptMonitorPage.proxyRequests.syncResult")
          .replace("{pushed}", String(json.pushed ?? 0))
          .replace("{idMaps}", String(json.idMappingsApplied ?? 0))
          .replace("{pulled}", String(json.pulled ?? 0))
      );
      await load();
    } catch (e: any) {
      setError(e?.message ?? t("interceptMonitorPage.proxyRequests.syncFailed"));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={() => void syncToCloud()}
          disabled={loading || syncing}
          style={{
            padding: "6px 12px",
            fontSize: 12,
            borderRadius: 999,
            border: "1px solid rgba(34,197,94,0.45)",
            background: "rgba(34,197,94,0.12)",
            color: "#86efac",
            cursor: loading || syncing ? "not-allowed" : "pointer",
          }}
        >
          {syncing ? t("interceptMonitorPage.proxyRequests.syncing") : t("interceptMonitorPage.proxyRequests.syncCloud")}
        </button>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          style={{
            padding: "6px 12px",
            fontSize: 12,
            borderRadius: 999,
            border: "1px solid var(--panel-border)",
            background: "var(--panel-bg)",
            color: "var(--fg)",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? t("interceptMonitorPage.proxyRequests.loading") : t("interceptMonitorPage.proxyRequests.refresh")}
        </button>
      </div>

      {syncMsg && <div style={{ marginTop: 10, fontSize: 12, color: "#4ade80" }}>{syncMsg}</div>}
      {error && <div style={{ marginTop: 10, fontSize: 12, color: "#f97373" }}>{error}</div>}

      <div
        style={{
          marginTop: 12,
          borderRadius: 12,
          border: "1px solid var(--panel-border)",
          background: "var(--panel-bg)",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {[
                t("interceptMonitorPage.proxyRequests.colTime"),
                t("interceptMonitorPage.proxyRequests.colProvider"),
                t("interceptMonitorPage.proxyRequests.colModel"),
                t("interceptMonitorPage.proxyRequests.colRoute"),
                t("interceptMonitorPage.proxyRequests.colStatus"),
                t("interceptMonitorPage.proxyRequests.colAlertType"),
                t("interceptMonitorPage.proxyRequests.colLatency"),
                t("interceptMonitorPage.proxyRequests.colCost"),
                t("interceptMonitorPage.proxyRequests.colTokens"),
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    fontSize: 12,
                    color: "var(--muted)",
                    fontWeight: 700,
                    padding: "10px 12px",
                    borderBottom: "1px solid var(--panel-border)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 16, color: "var(--muted)", fontSize: 12 }}>
                  {t("interceptMonitorPage.proxyRequests.tableEmpty")}
                </td>
              </tr>
            ) : (
              items.map((ev) => (
                <tr key={ev.id}>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--fg)" }}>
                    {fmtLocalDateTime(ev.createdAt, dateLocale)}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--fg)" }}>{ev.providerKey}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--fg)" }}>{ev.model || "-"}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--fg)" }}>{ev.routeMode || "-"}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--fg)" }}>
                    {ev.statusCode ?? "-"}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--fg)" }}>
                    {formatBlockType(ev.blockType, t)}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--fg)" }}>
                    {fmtLatencyMs(ev.latencyMs)}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--fg)" }}>
                    {fmtUsd(ev.costUsd ?? 0)}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--fg)" }}>
                    {ev.totalTokens ?? "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
          alignItems: "center",
          marginTop: 12,
        }}
      >
        <div style={{ fontSize: 12, color: "var(--muted)", marginRight: 8 }}>
          {t("interceptMonitorPage.proxyRequests.pageInfo")
            .replace("{page}", String(page))
            .replace("{totalPages}", String(totalPages))
            .replace("{total}", String(total))}
        </div>
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          style={{
            padding: "6px 12px",
            fontSize: 12,
            borderRadius: 999,
            border: "1px solid var(--panel-border)",
            background: page <= 1 ? "var(--panel-bg2)" : "var(--panel-bg)",
            color: "var(--fg)",
            cursor: page <= 1 ? "not-allowed" : "pointer",
          }}
        >
          {t("interceptMonitorPage.proxyRequests.prevPage")}
        </button>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          style={{
            padding: "6px 12px",
            fontSize: 12,
            borderRadius: 999,
            border: "1px solid var(--panel-border)",
            background: page >= totalPages ? "var(--panel-bg2)" : "var(--panel-bg)",
            color: "var(--fg)",
            cursor: page >= totalPages ? "not-allowed" : "pointer",
          }}
        >
          {t("interceptMonitorPage.proxyRequests.nextPage")}
        </button>
      </div>
    </div>
  );
}

