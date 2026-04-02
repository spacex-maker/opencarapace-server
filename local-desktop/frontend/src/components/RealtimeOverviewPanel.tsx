import { useEffect, useState } from "react";

type SummaryResponse = {
  todayToken: number;
  todayCostUsd: number;
  requestCount: number;
  avgLatencyMs: number | null;
};

function fmtUsd(n: number) {
  if (!Number.isFinite(n)) return "-";
  return `$${n.toFixed(4)}`;
}

function fmtKTokens(n: number) {
  if (!Number.isFinite(n)) return "-";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}

function fmtLatencyMs(n: number | null) {
  if (n == null) return "-";
  if (!Number.isFinite(n)) return "-";
  if (n < 1000) return `${Math.round(n)} ms`;
  return `${(n / 1000).toFixed(2)} s`;
}

export function RealtimeOverviewPanel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://127.0.0.1:19111/api/intercept-request-logs/summary");
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "加载实时概览失败");
        setSummary(null);
        return;
      }
      setSummary(data as SummaryResponse);
    } catch (e: any) {
      setError(e?.message ?? "加载实时概览失败");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const t = setInterval(() => {
      void load();
    }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
        <div
          style={{
            borderRadius: 12,
            border: "1px solid var(--panel-border)",
            background: "var(--panel-bg)",
            padding: "14px 16px",
          }}
        >
          <div style={{ fontSize: 12, color: "var(--muted)" }}>今日 Token</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--fg)", marginTop: 6 }}>
            {summary ? fmtKTokens(summary.todayToken) : loading ? "…" : "-"}
          </div>
        </div>

        <div
          style={{
            borderRadius: 12,
            border: "1px solid var(--panel-border)",
            background: "var(--panel-bg)",
            padding: "14px 16px",
          }}
        >
          <div style={{ fontSize: 12, color: "var(--muted)" }}>今日费用</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--fg)", marginTop: 6 }}>
            {summary ? fmtUsd(summary.todayCostUsd) : loading ? "…" : "-"}
          </div>
        </div>

        <div
          style={{
            borderRadius: 12,
            border: "1px solid var(--panel-border)",
            background: "var(--panel-bg)",
            padding: "14px 16px",
          }}
        >
          <div style={{ fontSize: 12, color: "var(--muted)" }}>请求次数</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--fg)", marginTop: 6 }}>
            {summary ? summary.requestCount : loading ? "…" : "-"}
          </div>
        </div>

        <div
          style={{
            borderRadius: 12,
            border: "1px solid var(--panel-border)",
            background: "var(--panel-bg)",
            padding: "14px 16px",
          }}
        >
          <div style={{ fontSize: 12, color: "var(--muted)" }}>平均延时</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--fg)", marginTop: 6 }}>
            {summary ? fmtLatencyMs(summary.avgLatencyMs) : loading ? "…" : "-"}
          </div>
        </div>
      </div>

      {error && <div style={{ marginTop: 10, fontSize: 12, color: "#f97373" }}>{error}</div>}
    </div>
  );
}

