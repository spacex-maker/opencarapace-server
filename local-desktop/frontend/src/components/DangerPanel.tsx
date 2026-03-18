import { useEffect, useState } from "react";
import { StatCard } from "./Common";

export function DangerPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dangerCommands, setDangerCommands] = useState<
    {
      id: number;
      command_pattern: string;
      system_type: string;
      category: string;
      risk_level: string;
      enabled: number;
      user_enabled: number | null;
    }[]
  >([]);
  const [sync, setSync] = useState<{ running: boolean; total: number; synced: number }>({
    running: false,
    total: 0,
    synced: 0,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [dataRes, syncRes] = await Promise.all([
        fetch("http://127.0.0.1:19111/api/danger-commands"),
        fetch("http://127.0.0.1:19111/api/sync-status?type=danger"),
      ]);
      const dataJson = await dataRes.json();
      const syncJson = await syncRes.json();
      setDangerCommands(dataJson.items || []);
      setSync(syncJson || { running: false, total: 0, synced: 0 });
    } catch (e: any) {
      setError(e?.message ?? "加载本地数据失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 轮询同步进度
  useEffect(() => {
    if (!sync.running) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch("http://127.0.0.1:19111/api/sync-status?type=danger");
        const json = await res.json();
        setSync(json);
        if (!json.running) {
          clearInterval(timer);
          loadData();
        }
      } catch {
        // ignore
      }
    }, 800);
    return () => clearInterval(timer);
  }, [sync.running]);

  const triggerSync = async () => {
    try {
      setError(null);
      await fetch("http://127.0.0.1:19111/api/danger-commands/sync", { method: "POST" });
      setSync((s) => ({ ...s, running: true }));
    } catch (e: any) {
      setError(e?.message ?? "触发同步失败");
    }
  };

  const percent =
    sync.total > 0 ? Math.min(100, Math.round((sync.synced / sync.total) * 100)) : sync.running ? 0 : 100;

  return (
    <div
      style={{
        maxWidth: 960,
        margin: "0 auto",
        background: "#020617",
        borderRadius: 16,
        padding: "24px 28px",
        border: "1px solid #1f2937",
        boxShadow: "0 20px 40px rgba(15,23,42,0.6)",
        fontSize: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: 20, margin: "0 0 4px", color: "#f9fafb" }}>危险指令库</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9ca3af" }}>
            从云端增量同步至本地 SQLite，每批次 10 条。
          </p>
        </div>
        <button
          type="button"
          onClick={triggerSync}
          disabled={sync.running}
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            border: "none",
            background: "#22c55e",
            color: "#022c22",
            fontSize: 12,
            fontWeight: 600,
            cursor: sync.running ? "not-allowed" : "pointer",
            opacity: sync.running ? 0.7 : 1,
          }}
        >
          {sync.running ? "同步中…" : "手动同步"}
        </button>
      </div>

      {/* 进度条 */}
      <div style={{ margin: "6px 0 14px" }}>
        <div
          style={{
            height: 6,
            borderRadius: 999,
            background: "#020617",
            border: "1px solid #111827",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${percent}%`,
              background: "#22c55e",
              transition: "width 0.3s ease-out",
            }}
          />
        </div>
        <div style={{ marginTop: 4, fontSize: 11, color: "#6b7280" }}>
          {sync.running
            ? `同步中：${sync.synced}/${sync.total || "?"} 条`
            : `已同步：${sync.synced} 条（总计：${sync.total || dangerCommands.length}）`}
        </div>
      </div>

      {loading && <div style={{ color: "#9ca3af", marginBottom: 8 }}>加载中…</div>}
      {error && <div style={{ color: "#f97373", marginBottom: 8 }}>{error}</div>}

      <div
        style={{
          borderRadius: 10,
          border: "1px solid #1f2937",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#020617" }}>
            <tr>
              <th style={{ padding: "6px 8px", borderBottom: "1px solid #1f2937", textAlign: "left" }}>ID</th>
              <th style={{ padding: "6px 8px", borderBottom: "1px solid #1f2937", textAlign: "left" }}>规则片段</th>
              <th style={{ padding: "6px 8px", borderBottom: "1px solid #1f2937", textAlign: "left" }}>系统</th>
              <th style={{ padding: "6px 8px", borderBottom: "1px solid #1f2937", textAlign: "left" }}>分类</th>
              <th style={{ padding: "6px 8px", borderBottom: "1px solid #1f2937", textAlign: "left" }}>风险等级</th>
              <th style={{ padding: "6px 8px", borderBottom: "1px solid #1f2937", textAlign: "left" }}>系统启用</th>
              <th style={{ padding: "6px 8px", borderBottom: "1px solid #1f2937", textAlign: "left" }}>用户启用</th>
            </tr>
          </thead>
          <tbody>
            {dangerCommands.map((r) => (
              <tr key={r.id} style={{ background: "#020617" }}>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid #111827", color: "#9ca3af" }}>{r.id}</td>
                <td
                  style={{
                    padding: "6px 8px",
                    borderBottom: "1px solid #111827",
                    color: "#e5e7eb",
                    maxWidth: 420,
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  }}
                  title={r.command_pattern}
                >
                  {r.command_pattern}
                </td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid #111827", color: "#9ca3af" }}>
                  {r.system_type}
                </td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid #111827", color: "#9ca3af" }}>
                  {r.category}
                </td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid #111827", color: "#fbbf24" }}>
                  {r.risk_level}
                </td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid #111827", color: "#9ca3af" }}>
                  {r.enabled ? "是" : "否"}
                </td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid #111827", color: "#9ca3af" }}>
                  {r.enabled ? (r.user_enabled === 0 ? "禁用" : "启用") : "（系统禁用）"}
                </td>
              </tr>
            ))}
            {dangerCommands.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={6}
                  style={{ padding: "8px 10px", textAlign: "center", color: "#6b7280", background: "#020617" }}
                >
                  当前本地还没有同步到危险指令规则。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

