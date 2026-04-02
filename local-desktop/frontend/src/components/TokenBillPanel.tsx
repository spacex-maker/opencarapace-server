import { useEffect, useMemo, useState } from "react";

/** 与「拦截监控 → 用量与预算 → 最近费用流水」同源：本地 llm_usage_cost_events */
type UsageEventItem = {
  id: number;
  createdAt: string;
  providerKey: string;
  model: string;
  routeMode: string | null;
  requestPath: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  costUsd: number;
  cloudId: number | null;
  upstreamBase?: string | null;
  clientId?: string | null;
};

type UsageEventsPage = {
  page: number;
  size: number;
  total: number;
  items: UsageEventItem[];
};

function formatTime(s: string): string {
  try {
    const d = new Date(s);
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return s.replace("T", " ").split(".")[0];
  }
}

function fmtUsd(n: number) {
  if (!Number.isFinite(n)) return "-";
  return `$${n.toFixed(4)}`;
}

export function TokenBillPanel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<UsageEventsPage | null>(null);
  const [page, setPage] = useState(1);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const totalPages = useMemo(() => {
    const total = data?.total ?? 0;
    const size = data?.size ?? 50;
    return Math.max(1, Math.ceil(total / size));
  }, [data]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`http://127.0.0.1:19111/api/llm-budget/usage-events?page=${page}&size=50`);
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || "加载失败");
        setData(null);
        return;
      }
      setData(json);
    } catch (e: any) {
      setError(e?.message ?? "加载失败");
      setData(null);
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
        `已同步：上送 ${json.pushed ?? 0} 条（回写云端 ID ${json.idMappingsApplied ?? 0} 条），下行入库 ${json.pulled ?? 0} 条。`
      );
      await load();
    } catch (e: any) {
      setError(e?.message ?? "同步失败");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 980,
        margin: "0 auto",
        background: "#020617",
        borderRadius: 16,
        padding: "24px 28px",
        border: "1px solid #1f2937",
        boxShadow: "0 20px 40px rgba(15,23,42,0.6)",
      }}
    >
      <h1 style={{ fontSize: 20, margin: "0 0 6px", color: "#f9fafb" }}>Token 账单</h1>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: "#9ca3af", lineHeight: 1.5 }}>
        数据来自本地表 <code style={{ color: "#94a3b8" }}>llm_usage_cost_events</code>，与「拦截监控 → 用量与预算」流水一致；字段与云端{" "}
        <code style={{ color: "#94a3b8" }}>oc_token_usages</code> 对齐（含 Provider、Model、费用等）。登录云端后可「与云端同步」合并两库记录。
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          style={{
            padding: "6px 12px",
            fontSize: 12,
            borderRadius: 999,
            border: "1px solid #334155",
            background: "rgba(15,23,42,0.85)",
            color: "#e5e7eb",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "加载中…" : "刷新"}
        </button>
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
        {syncMsg && <div style={{ fontSize: 12, color: "#4ade80" }}>{syncMsg}</div>}
        {error && <div style={{ fontSize: 12, color: "#f97373" }}>{error}</div>}
      </div>

      <div
        style={{
          marginTop: 12,
          borderRadius: 12,
          border: "1px solid #1f2937",
          background: "rgba(15,23,42,0.85)",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#020617" }}>
              <th style={{ textAlign: "left", padding: "8px 10px", color: "#9ca3af", fontWeight: 500, width: 156 }}>
                时间
              </th>
              <th style={{ textAlign: "left", padding: "8px 10px", color: "#9ca3af", fontWeight: 500, width: 88 }}>
                Provider
              </th>
              <th style={{ textAlign: "left", padding: "8px 10px", color: "#9ca3af", fontWeight: 500 }}>模型 / 路径</th>
              <th style={{ textAlign: "right", padding: "8px 10px", color: "#9ca3af", fontWeight: 500, width: 72 }}>
                Prompt
              </th>
              <th style={{ textAlign: "right", padding: "8px 10px", color: "#9ca3af", fontWeight: 500, width: 84 }}>
                Completion
              </th>
              <th style={{ textAlign: "right", padding: "8px 10px", color: "#9ca3af", fontWeight: 500, width: 72 }}>
                Total
              </th>
              <th style={{ textAlign: "right", padding: "8px 10px", color: "#9ca3af", fontWeight: 500, width: 88 }}>
                费用
              </th>
              <th style={{ textAlign: "left", padding: "8px 10px", color: "#9ca3af", fontWeight: 500, width: 96 }}>
                路由
              </th>
              <th style={{ textAlign: "right", padding: "8px 10px", color: "#9ca3af", fontWeight: 500, width: 72 }}>
                云端ID
              </th>
            </tr>
          </thead>
          <tbody>
            {(data?.items || []).length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: "10px", color: "#6b7280" }}>
                  {loading ? "正在加载…" : "暂无账单记录（需经本地代理成功返回后才会入账）。"}
                </td>
              </tr>
            ) : (
              data!.items.map((it) => (
                <tr key={it.id} style={{ borderTop: "1px solid #111827" }}>
                  <td style={{ padding: "8px 10px", color: "#e5e7eb", whiteSpace: "nowrap", fontSize: 11 }}>
                    {it.createdAt ? formatTime(it.createdAt) : "-"}
                  </td>
                  <td style={{ padding: "8px 10px", color: "#e5e7eb" }}>{it.providerKey}</td>
                  <td style={{ padding: "8px 10px", color: "#9ca3af" }}>
                    <div style={{ color: "#e5e7eb" }}>{it.model || "-"}</div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#6b7280",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 360,
                      }}
                      title={it.requestPath || ""}
                    >
                      {it.requestPath || "-"}
                    </div>
                  </td>
                  <td style={{ padding: "8px 10px", color: "#e5e7eb", textAlign: "right" }}>{it.promptTokens ?? "-"}</td>
                  <td style={{ padding: "8px 10px", color: "#e5e7eb", textAlign: "right" }}>{it.completionTokens ?? "-"}</td>
                  <td style={{ padding: "8px 10px", color: "#e5e7eb", textAlign: "right" }}>{it.totalTokens ?? "-"}</td>
                  <td style={{ padding: "8px 10px", color: "#86efac", textAlign: "right", fontFamily: "monospace" }}>
                    {fmtUsd(it.costUsd)}
                  </td>
                  <td style={{ padding: "8px 10px", color: "#94a3b8", fontSize: 11 }}>{it.routeMode || "-"}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", color: "#64748b", fontSize: 11, fontFamily: "monospace" }}>
                    {it.cloudId != null ? it.cloudId : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#9ca3af" }}>
        <button
          type="button"
          disabled={loading || page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid #334155",
            background: "transparent",
            color: "#e5e7eb",
            cursor: loading || page <= 1 ? "not-allowed" : "pointer",
            opacity: loading || page <= 1 ? 0.5 : 1,
          }}
        >
          上一页
        </button>
        <div>
          第 <span style={{ color: "#e5e7eb" }}>{page}</span> / {totalPages} 页（共 {data?.total ?? 0} 条）
        </div>
        <button
          type="button"
          disabled={loading || page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid #334155",
            background: "transparent",
            color: "#e5e7eb",
            cursor: loading || page >= totalPages ? "not-allowed" : "pointer",
            opacity: loading || page >= totalPages ? 0.5 : 1,
          }}
        >
          下一页
        </button>
      </div>
    </div>
  );
}
