import { useEffect, useRef, useState } from "react";
import { StatCard } from "./Common";

function FilterSelect(props: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as any)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const current = props.options.find((o) => o.value === props.value)?.label || props.placeholder;

  return (
    <div ref={ref} style={{ position: "relative", minWidth: 140 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          padding: "6px 10px",
          borderRadius: 999,
          border: "1px solid #1f2937",
          background: "#020617",
          color: props.value ? "#e5e7eb" : "#6b7280",
          fontSize: 11,
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        {current}
        <span style={{ float: "right", color: "#6b7280" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 10,
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            maxHeight: 220,
            overflowY: "auto",
            borderRadius: 10,
            border: "1px solid #1f2937",
            background: "rgba(2,6,23,0.98)",
            boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
          }}
        >
          {props.options.map((o) => (
            <button
              key={o.value || "__all"}
              type="button"
              onClick={() => {
                props.onChange(o.value);
                setOpen(false);
              }}
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "none",
                background: o.value === props.value ? "rgba(34,197,94,0.12)" : "transparent",
                color: o.value === props.value ? "#bbf7d0" : "#e5e7eb",
                fontSize: 11,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DangerPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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

  const [keyword, setKeyword] = useState("");
  const [systemType, setSystemType] = useState("");
  const [category, setCategory] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [systemEnabled, setSystemEnabled] = useState("");
  const [userEnabled, setUserEnabled] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const [meta, setMeta] = useState<{ systemTypes: string[]; categories: string[]; riskLevels: string[] }>({
    systemTypes: [],
    categories: [],
    riskLevels: [],
  });

  const loadMeta = async () => {
    try {
      const res = await fetch("http://127.0.0.1:19111/api/danger-commands/meta");
      const json = await res.json();
      if (res.ok) {
        setMeta({
          systemTypes: Array.isArray(json?.systemTypes) ? json.systemTypes : [],
          categories: Array.isArray(json?.categories) ? json.categories : [],
          riskLevels: Array.isArray(json?.riskLevels) ? json.riskLevels : [],
        });
      }
    } catch {
      // ignore
    }
  };

  const loadData = async (withFilters = false) => {
    try {
      setLoading(true);
      setError(null);
      const qs = new URLSearchParams();
      if (withFilters) {
        if (keyword.trim()) qs.set("keyword", keyword.trim());
        if (systemType) qs.set("systemType", systemType);
        if (category) qs.set("category", category);
        if (riskLevel) qs.set("riskLevel", riskLevel);
        if (systemEnabled) qs.set("systemEnabled", systemEnabled);
        if (userEnabled) qs.set("userEnabled", userEnabled);
      }
      const url = `http://127.0.0.1:19111/api/danger-commands${qs.toString() ? `?${qs.toString()}` : ""}`;
      const [dataRes, syncRes] = await Promise.all([
        fetch(url),
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

  const runQuery = () => loadData(true);

  const toggleUserEnabled = async (id: number, currentUserEnabled: number | null, systemEnabled: number) => {
    if (systemEnabled === 0) {
      setError("系统已禁用此危险指令，无法修改用户启用状态");
      setTimeout(() => setError(null), 3000);
      return;
    }
    if (updatingId !== null) return;

    const nextEnabled = currentUserEnabled === 0 ? true : false;
    setUpdatingId(id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`http://127.0.0.1:19111/api/user-danger-commands/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data?.error?.message || "更新用户危险指令失败");
        setTimeout(() => setError(null), 3000);
        return;
      }
      setDangerCommands((prev) =>
        prev.map((d) => (d.id === id ? { ...d, user_enabled: nextEnabled ? 1 : 0 } : d))
      );
      setMessage(`已${nextEnabled ? "启用" : "禁用"}该危险指令。`);
      setTimeout(() => setMessage(null), 2000);
    } catch (e: any) {
      setError(e?.message ?? "更新用户危险指令失败");
      setTimeout(() => setError(null), 3000);
    } finally {
      setUpdatingId(null);
    }
  };

  useEffect(() => {
    loadMeta();
    loadData(false);
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
      {error && (
        <div
          style={{
            marginBottom: 8,
            padding: "8px 12px",
            borderRadius: 10,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#fca5a5",
            fontSize: 11,
          }}
        >
          {error}
        </div>
      )}
      {message && (
        <div
          style={{
            marginBottom: 8,
            padding: "8px 12px",
            borderRadius: 10,
            background: "rgba(34,197,94,0.1)",
            border: "1px solid rgba(34,197,94,0.3)",
            color: "#bbf7d0",
            fontSize: 11,
          }}
        >
          {message}
        </div>
      )}

      {/* 高级搜索 */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runQuery();
            }
          }}
          placeholder="关键词（规则片段）"
          style={{
            flex: "1 1 220px",
            minWidth: 220,
            background: "#020617",
            borderRadius: 999,
            border: "1px solid #1f2937",
            padding: "6px 10px",
            fontSize: 11,
            color: "#e5e7eb",
            outline: "none",
          }}
        />

        <FilterSelect
          value={systemType}
          onChange={setSystemType}
          placeholder="系统类型（全部）"
          options={[
            { label: "系统类型（全部）", value: "" },
            ...meta.systemTypes.map((v) => ({ label: v, value: v })),
          ]}
        />
        <FilterSelect
          value={category}
          onChange={setCategory}
          placeholder="分类（全部）"
          options={[
            { label: "分类（全部）", value: "" },
            ...meta.categories.map((v) => ({ label: v, value: v })),
          ]}
        />
        <FilterSelect
          value={riskLevel}
          onChange={setRiskLevel}
          placeholder="风险等级（全部）"
          options={[
            { label: "风险等级（全部）", value: "" },
            ...meta.riskLevels.map((v) => ({ label: v, value: v })),
          ]}
        />
        <FilterSelect
          value={systemEnabled}
          onChange={setSystemEnabled}
          placeholder="官方状态（全部）"
          options={[
            { label: "官方状态（全部）", value: "" },
            { label: "正常", value: "1" },
            { label: "禁用", value: "0" },
          ]}
        />
        <FilterSelect
          value={userEnabled}
          onChange={setUserEnabled}
          placeholder="用户启用（全部）"
          options={[
            { label: "用户启用（全部）", value: "" },
            { label: "启用", value: "1" },
            { label: "禁用", value: "0" },
          ]}
        />

        <button
          type="button"
          onClick={runQuery}
          disabled={loading}
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            border: "1px solid #1f2937",
            background: loading ? "#111827" : "rgba(15,23,42,0.85)",
            color: "#e5e7eb",
            fontSize: 11,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "查询中…" : "查询"}
        </button>
      </div>

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
              <th style={{ padding: "6px 8px", borderBottom: "1px solid #1f2937", textAlign: "left" }}>官方状态</th>
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
                <td style={{ padding: "6px 8px", borderBottom: "1px solid #111827", whiteSpace: "nowrap" }}>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: r.enabled ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                      color: r.enabled ? "#bbf7d0" : "#fca5a5",
                      border: r.enabled ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(239,68,68,0.3)",
                    }}
                  >
                    {r.enabled ? "正常" : "禁用"}
                  </span>
                </td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid #111827", whiteSpace: "nowrap" }}>
                  {r.enabled === 0 ? (
                    <div style={{ fontSize: 10, color: "#6b7280" }}>（系统禁用）</div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleUserEnabled(r.id, r.user_enabled, r.enabled)}
                      disabled={updatingId === r.id}
                      style={{
                        position: "relative",
                        width: 42,
                        height: 20,
                        borderRadius: 999,
                        border: "none",
                        background: r.user_enabled === 0 ? "#374151" : "#22c55e",
                        cursor: updatingId === r.id ? "not-allowed" : "pointer",
                        opacity: updatingId === r.id ? 0.6 : 1,
                        transition: "background 0.2s, opacity 0.2s",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: 2,
                          left: r.user_enabled === 0 ? 2 : 24,
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background: "#fff",
                          transition: "left 0.2s",
                        }}
                      />
                    </button>
                  )}
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

