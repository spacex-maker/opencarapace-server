import { useEffect, useMemo, useState } from "react";

type TokenUsageItem = {
  id: number;
  createdAt: string | null;
  routeMode: string | null;
  upstreamBase: string | null;
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  estimated: boolean;
};

type TokenUsagePage = {
  page: number;
  size: number;
  total: number;
  items: TokenUsageItem[];
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
      hour12: false 
    });
  } catch {
    return s.replace("T", " ").split(".")[0];
  }
}

export function TokenBillPanel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TokenUsagePage | null>(null);
  const [page, setPage] = useState(1);

  const totalPages = useMemo(() => {
    const total = data?.total ?? 0;
    const size = data?.size ?? 50;
    return Math.max(1, Math.ceil(total / size));
  }, [data]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`http://127.0.0.1:19111/api/token-usages?page=${page}&size=50`);
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
      <p style={{ margin: "0 0 14px", fontSize: 12, color: "#9ca3af" }}>
        展示当前登录用户在云端记录的 token 用量。DIRECT/MAPPING 由本地估算上报；GATEWAY 由云端中转计算入库。
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
              <th style={{ textAlign: "left", padding: "8px 10px", color: "#9ca3af", fontWeight: 500, width: 100 }}>
                来源
              </th>
              <th style={{ textAlign: "left", padding: "8px 10px", color: "#9ca3af", fontWeight: 500 }}>
                模型 / 上游
              </th>
              <th style={{ textAlign: "right", padding: "8px 10px", color: "#9ca3af", fontWeight: 500, width: 90 }}>
                Prompt
              </th>
              <th style={{ textAlign: "right", padding: "8px 10px", color: "#9ca3af", fontWeight: 500, width: 90 }}>
                Completion
              </th>
              <th style={{ textAlign: "right", padding: "8px 10px", color: "#9ca3af", fontWeight: 500, width: 90 }}>
                Total
              </th>
              <th style={{ textAlign: "left", padding: "8px 10px", color: "#9ca3af", fontWeight: 500, width: 170 }}>
                时间
              </th>
            </tr>
          </thead>
          <tbody>
            {(data?.items || []).length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "10px", color: "#6b7280" }}>
                  {loading ? "正在加载…" : "暂无账单记录。"}
                </td>
              </tr>
            ) : (
              data!.items.map((it) => {
                const isLocal = it.routeMode === "DIRECT" || it.routeMode === "MAPPING";
                const sourceLabel = isLocal ? "本地中转" : "云端中转";
                const sourceColor = isLocal ? "#fbbf24" : "#22c55e";
                return (
                  <tr key={it.id} style={{ borderTop: "1px solid #111827" }}>
                    <td style={{ padding: "8px 10px", color: "#e5e7eb" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ color: sourceColor, fontWeight: 600, fontSize: 11 }}>{sourceLabel}</span>
                        <span style={{ fontSize: 10, color: "#6b7280" }}>
                          {it.routeMode || "-"}
                          {it.estimated && " · 估算"}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "8px 10px", color: "#9ca3af" }}>
                      <div style={{ color: "#e5e7eb" }}>{it.model || "-"}</div>
                      <div style={{ fontSize: 11, color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 520 }}>
                        {it.upstreamBase || "-"}
                      </div>
                    </td>
                    <td style={{ padding: "8px 10px", color: "#e5e7eb", textAlign: "right" }}>{it.promptTokens ?? "-"}</td>
                    <td style={{ padding: "8px 10px", color: "#e5e7eb", textAlign: "right" }}>{it.completionTokens ?? "-"}</td>
                    <td style={{ padding: "8px 10px", color: "#e5e7eb", textAlign: "right" }}>{it.totalTokens ?? "-"}</td>
                    <td style={{ padding: "8px 10px", color: "#e5e7eb", whiteSpace: "nowrap" }}>
                      {it.createdAt ? formatTime(it.createdAt) : "-"}
                    </td>
                  </tr>
                );
              })
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

