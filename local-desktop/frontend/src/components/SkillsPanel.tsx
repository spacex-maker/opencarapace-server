import { useEffect, useRef, useState } from "react";

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
      if (!ref.current.contains(e.target as any)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const current = props.options.find((o) => o.value === props.value)?.label || props.placeholder;

  return (
    <div ref={ref} style={{ position: "relative", minWidth: 160 }}>
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

export function SkillsPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [skills, setSkills] = useState<
    {
      id: number | null;
      slug: string;
      name: string | null;
      type: string | null;
      category: string | null;
      systemStatus: string;
      shortDesc: string | null;
      userEnabled: number | null;
      sourceName: string | null;
    }[]
  >([]);
  const [sync, setSync] = useState<{ running: boolean; total: number; synced: number }>({
    running: false,
    total: 0,
    synced: 0,
  });
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [keyword, setKeyword] = useState("");
  const [systemStatus, setSystemStatus] = useState("");
  const [userEnabled, setUserEnabled] = useState("");
  const [updatingSlug, setUpdatingSlug] = useState<string | null>(null);

  const loadData = async (withFilters = false) => {
    try {
      setLoading(true);
      setError(null);
      const qs = new URLSearchParams();
      if (withFilters) {
        if (keyword.trim()) qs.set("keyword", keyword.trim());
        if (systemStatus) qs.set("systemStatus", systemStatus);
        if (userEnabled) qs.set("userEnabled", userEnabled);
      }
      const url = `http://127.0.0.1:19111/api/skills${qs.toString() ? `?${qs.toString()}` : ""}`;
      const [skillsRes, syncRes] = await Promise.all([
        fetch(url),
        fetch("http://127.0.0.1:19111/api/sync-status?type=skills"),
      ]);
      const skillsData = await skillsRes.json();
      const syncJson = await syncRes.json();
      setSkills(skillsData.items || []);
      setSync(syncJson || { running: false, total: 0, synced: 0 });
    } catch (e: any) {
      setError(e?.message ?? "加载本地数据失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  useEffect(() => {
    if (!sync.running) return;
    
    let pollCount = 0;
    const maxPolls = 60; // 最多轮询 60 次（2 分钟）
    
    const timer = setInterval(async () => {
      pollCount++;
      
      // 超时保护：避免无限轮询
      if (pollCount > maxPolls) {
        clearInterval(timer);
        setSync((s) => ({ ...s, running: false }));
        console.warn("[SkillsPanel] 同步轮询超时，已停止");
        return;
      }
      
      try {
        const res = await fetch("http://127.0.0.1:19111/api/sync-status?type=skills");
        const json = await res.json();
        setSync(json);
        if (!json.running) {
          clearInterval(timer);
          loadData();
        }
      } catch {
        // ignore
      }
    }, 2000); // 改为 2 秒轮询一次
    
    return () => clearInterval(timer);
  }, [sync.running]);

  const triggerSync = async () => {
    try {
      setError(null);
      await fetch("http://127.0.0.1:19111/api/skills/sync", { method: "POST" });
      setSync((s) => ({ ...s, running: true }));
    } catch (e: any) {
      setError(e?.message ?? "触发同步失败");
    }
  };

  const percent =
    sync.total > 0 ? Math.min(100, Math.round((sync.synced / sync.total) * 100)) : sync.running ? 0 : 100;

  const runQuery = () => loadData(true);

  const toggleUserEnabled = async (slug: string, currentEnabled: number | null) => {
    if (updatingSlug !== null) return;

    const nextEnabled = currentEnabled === 1 ? false : true;
    setUpdatingSlug(slug);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`http://127.0.0.1:19111/api/user-skills/${encodeURIComponent(slug)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data?.error?.message || "更新用户技能失败");
        setTimeout(() => setError(null), 3000);
        return;
      }
      setSkills((prev) =>
        prev.map((s) => (s.slug === slug ? { ...s, userEnabled: nextEnabled ? 1 : 0 } : s))
      );
      setMessage(`已${nextEnabled ? "启用" : "禁用"}该技能。`);
      setTimeout(() => setMessage(null), 2000);
    } catch (e: any) {
      setError(e?.message ?? "更新用户技能失败");
      setTimeout(() => setError(null), 3000);
    } finally {
      setUpdatingSlug(null);
    }
  };

  const openDetail = async (slug: string) => {
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:19111/api/skills/detail/${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (!res.ok) {
        setDetailError(data?.error?.message || "加载详情失败");
      } else {
        setDetail(data);
      }
    } catch (e: any) {
      setDetailError(e?.message ?? "加载详情失败");
    } finally {
      setDetailLoading(false);
    }
  };

  const clearLocal = async () => {
    try {
      setError(null);
      setDetail(null);
      setDetailError(null);
      await fetch("http://127.0.0.1:19111/api/skills/clear", { method: "POST" });
      await loadData();
    } catch (e: any) {
      setError(e?.message ?? "清空本地数据失败");
    }
  };

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
          <h1 style={{ fontSize: 20, margin: "0 0 4px", color: "#f9fafb" }}>Skills 仓库</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9ca3af" }}>系统禁用 / 不推荐 + 用户偏好视图。</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
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
          <button
            type="button"
            onClick={clearLocal}
            disabled={sync.running}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid #374151",
              background: "#020617",
              color: "#e5e7eb",
              fontSize: 12,
              fontWeight: 500,
              cursor: sync.running ? "not-allowed" : "pointer",
              opacity: sync.running ? 0.7 : 1,
            }}
          >
            清空本地数据
          </button>
        </div>
      </div>

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
            : `已同步：${sync.synced} 条（总计：${sync.total || skills.length}）`}
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

      {/* 高级查询 */}
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
          placeholder="关键词（slug）"
          style={{
            flex: "1 1 260px",
            minWidth: 240,
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
          value={systemStatus}
          onChange={setSystemStatus}
          placeholder="系统状态（全部）"
          options={[
            { label: "系统状态（全部）", value: "" },
            { label: "正常", value: "NORMAL" },
            { label: "系统禁用", value: "DISABLED" },
            { label: "系统不推荐", value: "DEPRECATED" },
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
              <th style={{ padding: "6px 8px", borderBottom: "1px solid #1f2937", textAlign: "left" }}>名称</th>
              <th style={{ padding: "6px 8px", borderBottom: "1px solid #1f2937", textAlign: "left" }}>提供商</th>
              <th style={{ padding: "6px 8px", borderBottom: "1px solid #1f2937", textAlign: "left" }}>状态</th>
              <th style={{ padding: "6px 8px", borderBottom: "1px solid #1f2937", textAlign: "left" }}>简介</th>
              <th style={{ padding: "6px 8px", borderBottom: "1px solid #1f2937", textAlign: "left", width: 80 }}>启用</th>
              <th style={{ padding: "6px 8px", borderBottom: "1px solid #1f2937", width: 80 }} />
            </tr>
          </thead>
          <tbody>
            {skills.map((s) => (
              <tr key={s.slug} style={{ background: "#020617" }}>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid #111827", maxWidth: 280 }}>
                  <div
                    style={{
                      color: "#e5e7eb",
                      fontWeight: 500,
                      fontSize: 12,
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                    }}
                    title={s.name || s.slug}
                  >
                    {s.name || s.slug}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#6b7280",
                      marginTop: 3,
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                    }}
                    title={s.slug}
                  >
                    {s.slug}
                  </div>
                  <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {s.type && (
                      <span
                        style={{
                          padding: "2px 6px",
                          borderRadius: 999,
                          fontSize: 9,
                          fontWeight: 500,
                          background: "rgba(59,130,246,0.12)",
                          color: "#93c5fd",
                          border: "1px solid rgba(59,130,246,0.3)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {s.type}
                      </span>
                    )}
                    {s.category && (
                      <span
                        style={{
                          padding: "2px 6px",
                          borderRadius: 999,
                          fontSize: 9,
                          fontWeight: 500,
                          background: "rgba(168,85,247,0.12)",
                          color: "#c4b5fd",
                          border: "1px solid rgba(168,85,247,0.3)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {s.category}
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid #111827", color: "#9ca3af", fontSize: 11, whiteSpace: "nowrap" }}>
                  {s.sourceName || "-"}
                </td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid #111827", whiteSpace: "nowrap" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 6px",
                      borderRadius: 4,
                      border: "1px solid #374151",
                      fontSize: 10,
                      color: "#e5e7eb",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.systemStatus === "DISABLED"
                      ? "系统禁用"
                      : s.systemStatus === "DEPRECATED"
                      ? "系统不推荐"
                      : "正常"}
                  </span>
                </td>
                <td
                  style={{
                    padding: "6px 8px",
                    borderBottom: "1px solid #111827",
                    maxWidth: 260,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "#9ca3af",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      lineHeight: 1.4,
                    }}
                    title={s.shortDesc || ""}
                  >
                    {s.shortDesc || "-"}
                  </div>
                </td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid #111827", whiteSpace: "nowrap" }}>
                  {s.userEnabled === null ? (
                    <div style={{ fontSize: 10, color: "#6b7280" }}>（未配置）</div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleUserEnabled(s.slug, s.userEnabled)}
                      disabled={updatingSlug === s.slug}
                      style={{
                        position: "relative",
                        width: 42,
                        height: 20,
                        borderRadius: 999,
                        border: "none",
                        background: s.userEnabled === 1 ? "#22c55e" : "#374151",
                        cursor: updatingSlug === s.slug ? "not-allowed" : "pointer",
                        opacity: updatingSlug === s.slug ? 0.6 : 1,
                        transition: "background 0.2s, opacity 0.2s",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: 2,
                          left: s.userEnabled === 1 ? 24 : 2,
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
                <td
                  style={{
                    padding: "6px 8px",
                    borderBottom: "1px solid #111827",
                    textAlign: "right",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => openDetail(s.slug)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: "1px solid #1f2937",
                      background: "#020617",
                      color: "#e5e7eb",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    详情
                  </button>
                </td>
              </tr>
            ))}
            {skills.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={3}
                  style={{ padding: "8px 10px", textAlign: "center", color: "#6b7280", background: "#020617" }}
                >
                  当前本地还没有任何技能状态数据（系统禁用 / 不推荐 / 用户自定义）。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 详情弹窗 */}
      {(detailLoading || detail || detailError) && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={() => {
            setDetail(null);
            setDetailError(null);
            setDetailLoading(false);
          }}
        >
          <div
            style={{
              width: 640,
              maxHeight: "85vh",
              background: "#020617",
              borderRadius: 16,
              border: "1px solid #1f2937",
              boxShadow: "0 25px 60px rgba(0,0,0,0.8)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #1f2937",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#f9fafb" }}>技能详情</div>
                {detail && (
                  <div
                    style={{
                      fontSize: 10,
                      color: "#6b7280",
                      marginTop: 4,
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    }}
                  >
                    {detail.slug || "—"}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetail(null);
                  setDetailError(null);
                  setDetailLoading(false);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid #374151",
                  background: "transparent",
                  color: "#e5e7eb",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                关闭
              </button>
            </div>

            {/* 内容区 */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 20px",
                fontSize: 12,
              }}
            >
              {detailLoading && <div style={{ color: "#9ca3af" }}>加载详情中…</div>}
              {detailError && <div style={{ color: "#f97373" }}>{detailError}</div>}

              {detail && !detailLoading && !detailError && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      名称
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#f9fafb" }}>{detail.name || detail.slug}</div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 11 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>Slug</div>
                      <code
                        style={{
                          fontFamily:
                            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                          fontSize: 10,
                          background: "rgba(15,23,42,0.85)",
                          padding: "4px 6px",
                          borderRadius: 6,
                          border: "1px solid #111827",
                          color: "#e5e7eb",
                          display: "block",
                          wordBreak: "break-all",
                        }}
                      >
                        {detail.slug}
                      </code>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>类型</div>
                      <div style={{ color: "#e5e7eb" }}>{detail.type || "-"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>分类</div>
                      <div style={{ color: "#e5e7eb" }}>{detail.category || "-"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>状态</div>
                      <div style={{ color: "#e5e7eb" }}>{detail.status || "-"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>来源</div>
                      <div style={{ color: "#e5e7eb" }}>{detail.sourceName || "ClawHub"}</div>
                    </div>
                    {detail.version && (
                      <div>
                        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>版本</div>
                        <div style={{ color: "#e5e7eb" }}>v{detail.version}</div>
                      </div>
                    )}
                  </div>

                  {detail.shortDesc && (
                    <div>
                      <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        简介
                      </div>
                      <div style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.6 }}>{detail.shortDesc}</div>
                    </div>
                  )}

                  {detail.longDesc && (
                    <div>
                      <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        详细说明
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#d1d5db",
                          lineHeight: 1.6,
                          whiteSpace: "pre-wrap",
                          background: "rgba(15,23,42,0.85)",
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: "1px solid #111827",
                        }}
                      >
                        {detail.longDesc}
                      </div>
                    </div>
                  )}

                  {detail.tags && (
                    <div>
                      <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        标签
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {detail.tags.split(/[,，\s]+/).filter(Boolean).map((t: string) => (
                          <span
                            key={t}
                            style={{
                              padding: "3px 8px",
                              borderRadius: 999,
                              fontSize: 10,
                              fontWeight: 500,
                              background: "rgba(34,197,94,0.12)",
                              color: "#86efac",
                              border: "1px solid rgba(34,197,94,0.3)",
                            }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {detail.installHint && (
                    <div>
                      <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        安装提示
                      </div>
                      <code
                        style={{
                          display: "block",
                          fontFamily:
                            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                          fontSize: 10,
                          background: "rgba(15,23,42,0.85)",
                          padding: "8px 10px",
                          borderRadius: 6,
                          border: "1px solid #111827",
                          color: "#e5e7eb",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-all",
                        }}
                      >
                        {detail.installHint}
                      </code>
                    </div>
                  )}

                  {detail.homepageUrl && (
                    <div>
                      <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        主页
                      </div>
                      <a
                        href={detail.homepageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 11,
                          color: "#60a5fa",
                          textDecoration: "underline",
                          wordBreak: "break-all",
                        }}
                      >
                        {detail.homepageUrl}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

