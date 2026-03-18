import { useEffect, useState } from "react";

export function SkillsPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skills, setSkills] = useState<
    { id: number | null; slug: string; systemStatus: string; userEnabled: number | null }[]
  >([]);
  const [sync, setSync] = useState<{ running: boolean; total: number; synced: number }>({
    running: false,
    total: 0,
    synced: 0,
  });
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [skillsRes, syncRes] = await Promise.all([
        fetch("http://127.0.0.1:19111/api/skills"),
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
    loadData();
  }, []);

  useEffect(() => {
    if (!sync.running) return;
    const timer = setInterval(async () => {
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
    }, 800);
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
              <th style={{ padding: "6px 8px", borderBottom: "1px solid #1f2937", textAlign: "left" }}>Skill Slug</th>
              <th style={{ padding: "6px 8px", borderBottom: "1px solid #1f2937", textAlign: "left" }}>系统状态</th>
              <th style={{ padding: "6px 8px", borderBottom: "1px solid #1f2937", textAlign: "left" }}>用户启用</th>
              <th style={{ padding: "6px 8px", borderBottom: "1px solid #1f2937" }} />
            </tr>
          </thead>
          <tbody>
            {skills.map((s) => (
              <tr key={s.slug} style={{ background: "#020617" }}>
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
                  title={s.slug}
                >
                  {s.slug}
                </td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid #111827", color: "#9ca3af" }}>
                  {s.systemStatus === "DISABLED"
                    ? "系统禁用"
                    : s.systemStatus === "DEPRECATED"
                    ? "系统不推荐"
                    : "正常"}
                </td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid #111827", color: "#9ca3af" }}>
                  {s.userEnabled === null ? "（未配置）" : s.userEnabled ? "启用" : "禁用"}
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
            background: "rgba(15,23,42,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 40,
          }}
        >
          <div
            style={{
              width: 520,
              maxHeight: "80vh",
              background: "#020617",
              borderRadius: 16,
              border: "1px solid #1f2937",
              boxShadow: "0 25px 60px rgba(15,23,42,0.9)",
              padding: "18px 20px 16px",
              boxSizing: "border-box",
              overflowY: "auto",
              fontSize: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#f9fafb" }}>Skill 详情</div>
                {detail && (
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
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
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid #374151",
                  background: "#020617",
                  color: "#e5e7eb",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                关闭
              </button>
            </div>

            {detailLoading && <div style={{ fontSize: 12, color: "#9ca3af" }}>加载详情中…</div>}
            {detailError && <div style={{ fontSize: 12, color: "#f97373" }}>{detailError}</div>}

            {detail && !detailLoading && !detailError && (
              <div>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ color: "#9ca3af" }}>名称：</span>
                  <span style={{ color: "#e5e7eb" }}>{detail.name}</span>
                </div>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ color: "#9ca3af" }}>Slug：</span>
                  <code
                    style={{
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      fontSize: 11,
                      background: "#020617",
                      padding: "1px 4px",
                      borderRadius: 4,
                      border: "1px solid #111827",
                      color: "#e5e7eb",
                    }}
                  >
                    {detail.slug}
                  </code>
                </div>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ color: "#9ca3af" }}>类型：</span>
                  <span style={{ color: "#e5e7eb" }}>{detail.type}</span>
                  {detail.category && (
                    <>
                      <span style={{ color: "#6b7280", margin: "0 4px" }}>·</span>
                      <span style={{ color: "#9ca3af" }}>{detail.category}</span>
                    </>
                  )}
                </div>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ color: "#9ca3af" }}>状态：</span>
                  <span style={{ color: "#e5e7eb" }}>{detail.status}</span>
                  {detail.version && (
                    <>
                      <span style={{ color: "#6b7280", margin: "0 4px" }}>·</span>
                      <span style={{ color: "#9ca3af" }}>v{detail.version}</span>
                    </>
                  )}
                </div>
                {detail.shortDesc && (
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ color: "#9ca3af" }}>简介：</span>
                    <span style={{ color: "#e5e7eb" }}>{detail.shortDesc}</span>
                  </div>
                )}
                {detail.longDesc && (
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ color: "#9ca3af" }}>详细说明：</span>
                    <span style={{ color: "#e5e7eb", whiteSpace: "pre-wrap" }}>{detail.longDesc}</span>
                  </div>
                )}
                {detail.installHint && (
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ color: "#9ca3af" }}>安装提示：</span>
                    <code
                      style={{
                        fontFamily:
                          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                        fontSize: 11,
                        background: "#020617",
                        padding: "1px 4px",
                        borderRadius: 4,
                        border: "1px solid #111827",
                        color: "#e5e7eb",
                      }}
                    >
                      {detail.installHint}
                    </code>
                  </div>
                )}
                {detail.tags && (
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ color: "#9ca3af" }}>标签：</span>
                    <span style={{ color: "#e5e7eb" }}>{detail.tags}</span>
                  </div>
                )}
                {detail.homepageUrl && (
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ color: "#9ca3af" }}>主页：</span>
                    <span style={{ color: "#60a5fa" }}>{detail.homepageUrl}</span>
                  </div>
                )}
                {detail.sourceName && (
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ color: "#9ca3af" }}>来源：</span>
                    <span style={{ color: "#e5e7eb" }}>{detail.sourceName}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

