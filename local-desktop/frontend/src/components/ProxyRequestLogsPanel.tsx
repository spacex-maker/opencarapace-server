import { useEffect, useMemo, useState } from "react";

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

function fmtLocalDateTime(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("zh-CN", { hour12: false });
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

function formatBlockType(t: string | null) {
  if (!t) return "-";
  if (t === "danger_command") return "危险指令";
  if (t === "skill_disabled") return "技能禁用";
  if (t === "budget_exceeded") return "预算拦截";
  return t;
}

export function ProxyRequestLogsPanel() {
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
        setError(data?.["error"]?.message || "加载请求日志失败");
        setItems([]);
        setTotal(0);
        return;
      }
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotal(typeof data?.total === "number" ? data.total : 0);
    } catch (e: any) {
      setError(e?.message ?? "加载请求日志失败");
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
        setError(json?.error?.message || "同步失败");
        return;
      }
      setSyncMsg(
        `已同步：上送 ${json.pushed ?? 0} 条（回写云端 ID ${json.idMappingsApplied ?? 0} 条），下行入库 ${
          json.pulled ?? 0
        } 条。`
      );
      await load();
    } catch (e: any) {
      setError(e?.message ?? "同步失败");
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
          {syncing ? "同步中…" : "与云端同步"}
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
          {loading ? "加载中…" : "刷新"}
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
                "时间",
                "Provider",
                "Model",
                "路由",
                "状态",
                "告警类型",
                "延时",
                "费用",
                "Tokens",
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
                  暂无请求日志
                </td>
              </tr>
            ) : (
              items.map((ev) => (
                <tr key={ev.id}>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--fg)" }}>
                    {fmtLocalDateTime(ev.createdAt)}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--fg)" }}>{ev.providerKey}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--fg)" }}>{ev.model || "-"}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--fg)" }}>{ev.routeMode || "-"}</td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--fg)" }}>
                    {ev.statusCode ?? "-"}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--fg)" }}>
                    {formatBlockType(ev.blockType)}
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
          第 {page} / {totalPages} 页（共 {total} 条）
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
          上一页
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
          下一页
        </button>
      </div>
    </div>
  );
}

