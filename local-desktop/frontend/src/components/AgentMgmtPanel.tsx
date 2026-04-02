import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  MdChevronRight,
  MdDescription,
  MdExtension,
  MdHistory,
  MdMemory,
  MdSettingsSuggest,
} from "react-icons/md";

type AgentFeature = "providers" | "skills" | "prompts" | "mcp" | "sessions";

type PlatformRow = {
  code: string;
  displayName: string;
  accent: string;
  sortOrder: number;
  featureCounts: { featureType: AgentFeature; count: number }[];
};

type AgentItem = {
  id: number;
  name: string;
  subtitle: string | null;
  statusLabel: string | null;
  statusKind: string | null;
};

const FEATURE_META: Record<AgentFeature, { label: string; icon: ReactNode; featTitle: string }> = {
  providers: { label: "Providers", icon: <MdSettingsSuggest />, featTitle: "Providers" },
  skills: { label: "Skills", icon: <MdExtension />, featTitle: "Skills" },
  prompts: { label: "Prompts", icon: <MdDescription />, featTitle: "Prompts" },
  mcp: { label: "MCP", icon: <MdMemory />, featTitle: "MCP Servers" },
  sessions: { label: "Sessions", icon: <MdHistory />, featTitle: "Sessions" },
};

/** 与原型页一致：各 Agent 下可选功能子集 */
const PLATFORM_FEATURES: Record<string, AgentFeature[]> = {
  claude: ["providers", "skills", "prompts", "mcp", "sessions"],
  codex: ["providers", "skills", "mcp", "sessions"],
  gemini: ["providers", "mcp"],
  opencode: ["providers", "sessions"],
  openclaw: ["providers", "skills", "mcp"],
};

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase().slice(0, 2);
  return name.slice(0, 2).toUpperCase();
}

export function AgentMgmtPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState<PlatformRow[]>([]);
  const [openAgents, setOpenAgents] = useState<Set<string>>(() => new Set(["claude"]));
  const [selectedPlatform, setSelectedPlatform] = useState("claude");
  const [selectedFeature, setSelectedFeature] = useState<AgentFeature>("providers");
  const [items, setItems] = useState<AgentItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("http://127.0.0.1:19111/api/agent-mgmt/summary");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message || "加载 Agent 目录失败");
        return;
      }
      const list = (data.platforms || []) as PlatformRow[];
      setPlatforms(list);
    } catch (e: any) {
      setError(e?.message ?? "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const loadItems = useCallback(async (platform: string, feature: AgentFeature) => {
    try {
      setItemsLoading(true);
      const qs = new URLSearchParams({ platform, feature });
      const res = await fetch(`http://127.0.0.1:19111/api/agent-mgmt/items?${qs.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setItems([]);
        return;
      }
      setItems((data.items || []) as AgentItem[]);
    } catch {
      setItems([]);
    } finally {
      setItemsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems(selectedPlatform, selectedFeature);
  }, [selectedPlatform, selectedFeature, loadItems]);

  const countFor = useCallback(
    (code: string, ft: AgentFeature) => {
      const p = platforms.find((x) => x.code === code);
      const hit = p?.featureCounts?.find((c) => c.featureType === ft);
      return hit?.count ?? 0;
    },
    [platforms],
  );

  const platformDisplayName = useMemo(() => {
    return platforms.find((p) => p.code === selectedPlatform)?.displayName || selectedPlatform;
  }, [platforms, selectedPlatform]);

  const toggleAgent = (code: string) => {
    setOpenAgents((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const selectFeat = (platform: string, feat: AgentFeature) => {
    setSelectedPlatform(platform);
    setSelectedFeature(feat);
    setOpenAgents((prev) => new Set(prev).add(platform));
  };

  const featMeta = FEATURE_META[selectedFeature];
  const subTitle = `${items.length} 条 · ${platformDisplayName}`;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 1280,
        margin: "0 auto",
        background: "#020617",
        borderRadius: 16,
        border: "1px solid #1f2937",
        boxShadow: "0 20px 40px rgba(15,23,42,0.6)",
        fontSize: 12,
        boxSizing: "border-box",
        minHeight: 480,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #1f2937" }}>
        <h1 style={{ fontSize: 20, margin: "0 0 4px", color: "#f9fafb" }}>Agent 管理</h1>
        <p style={{ margin: 0, fontSize: 12, color: "#9ca3af", lineHeight: 1.5 }}>
          按 Agent 平台浏览 Providers、Skills、Prompts、MCP 与 Sessions；数据存于本机库，可与云端账户扩展同步。
        </p>
      </div>

      {error && (
        <div
          style={{
            margin: "10px 16px 0",
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

      <div style={{ display: "flex", flex: 1, minHeight: 420, overflow: "hidden" }}>
        {/* 左侧树 */}
        <div
          style={{
            width: 200,
            flexShrink: 0,
            borderRight: "1px solid #1f2937",
            overflowY: "auto",
            padding: "10px 6px",
            background: "rgba(15,23,42,0.5)",
          }}
        >
          {loading && <div style={{ padding: 8, color: "#6b7280", fontSize: 11 }}>加载中…</div>}
          {!loading &&
            platforms.map((p) => {
              const open = openAgents.has(p.code);
              const feats = PLATFORM_FEATURES[p.code] || [];
              return (
                <div key={p.code} style={{ marginBottom: 4 }}>
                  <button
                    type="button"
                    onClick={() => toggleAgent(p.code)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "none",
                      background:
                        selectedPlatform === p.code && open ? "rgba(51,65,85,0.5)" : "transparent",
                      color: selectedPlatform === p.code ? "#f1f5f9" : "#cbd5e1",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: p.accent || "#64748b",
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.displayName}
                    </span>
                    <MdChevronRight
                      style={{
                        fontSize: 16,
                        opacity: 0.35,
                        transform: open ? "rotate(90deg)" : "none",
                        transition: "transform 0.15s ease",
                        flexShrink: 0,
                      }}
                    />
                  </button>
                  {open && (
                    <div style={{ paddingLeft: 10, marginTop: 2 }}>
                      {feats.map((ft) => {
                        const active = selectedPlatform === p.code && selectedFeature === ft;
                        const cnt = countFor(p.code, ft);
                        return (
                          <button
                            key={ft}
                            type="button"
                            onClick={() => selectFeat(p.code, ft)}
                            style={{
                              width: "100%",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "5px 8px",
                              borderRadius: 5,
                              border: "none",
                              background: active ? "rgba(59,130,246,0.15)" : "transparent",
                              color: active ? "#93c5fd" : "#94a3b8",
                              fontSize: 11,
                              fontWeight: active ? 700 : 500,
                              cursor: "pointer",
                              textAlign: "left",
                              marginBottom: 2,
                            }}
                          >
                            <span style={{ display: "flex", opacity: 0.55, fontSize: 13 }}>{FEATURE_META[ft].icon}</span>
                            <span style={{ flex: 1 }}>{FEATURE_META[ft].label}</span>
                            <span
                              style={{
                                fontSize: 9,
                                fontFamily: "ui-monospace, monospace",
                                fontWeight: 700,
                                padding: "0 4px",
                                borderRadius: 3,
                                background: "#1e293b",
                                color: "#94a3b8",
                                lineHeight: "14px",
                              }}
                            >
                              {cnt}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* 右侧内容 */}
        <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#f9fafb", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ display: "flex", opacity: 0.55 }}>{featMeta.icon}</span>
                {platformDisplayName} · {featMeta.featTitle}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "#64748b",
                  marginTop: 4,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                }}
              >
                {itemsLoading ? "加载条目…" : subTitle}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button
                type="button"
                disabled
                title="后续版本支持"
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid #334155",
                  background: "rgba(30,41,59,0.6)",
                  color: "#64748b",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "not-allowed",
                }}
              >
                添加
              </button>
            </div>
          </div>

          {selectedFeature === "providers" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map((it) => {
                const on = it.statusKind === "active";
                return (
                  <div
                    key={it.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: on ? "1px solid rgba(34,197,94,0.35)" : "1px solid #1f2937",
                      background: on ? "rgba(34,197,94,0.06)" : "rgba(15,23,42,0.6)",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: "rgba(59,130,246,0.15)",
                        color: "#93c5fd",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 800,
                        fontFamily: "ui-monospace, monospace",
                      }}
                    >
                      {initials(it.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#e5e7eb" }}>{it.name}</div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "#64748b",
                          fontFamily: "ui-monospace, monospace",
                          marginTop: 2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {it.subtitle || "—"}
                      </div>
                    </div>
                    {it.statusLabel && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: on ? "rgba(34,197,94,0.15)" : "rgba(51,65,85,0.8)",
                          color: on ? "#86efac" : "#94a3b8",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {on && <span className="agent-live-dot" />}
                        {it.statusLabel}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {selectedFeature === "skills" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map((it) => {
                const upd = it.statusKind === "update";
                return (
                  <div
                    key={it.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid #1f2937",
                      background: "rgba(15,23,42,0.6)",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: "rgba(168,85,247,0.15)",
                        color: "#d8b4fe",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 800,
                        fontFamily: "ui-monospace, monospace",
                      }}
                    >
                      {initials(it.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#e5e7eb" }}>{it.name}</div>
                      <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{it.subtitle || "—"}</div>
                    </div>
                    {it.statusLabel && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: upd ? "rgba(245,158,11,0.15)" : "rgba(34,197,94,0.12)",
                          color: upd ? "#fcd34d" : "#86efac",
                        }}
                      >
                        {it.statusLabel}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {selectedFeature === "prompts" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map((it) => (
                <div
                  key={it.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #1f2937",
                    background: "rgba(15,23,42,0.6)",
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: "rgba(59,130,246,0.15)",
                      color: "#93c5fd",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MdDescription style={{ fontSize: 16 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#e5e7eb" }}>{it.name}</div>
                    <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{it.subtitle || "—"}</div>
                  </div>
                  <button
                    type="button"
                    disabled
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "1px solid #334155",
                      background: "transparent",
                      color: "#64748b",
                      fontSize: 10,
                      cursor: "not-allowed",
                    }}
                  >
                    编辑
                  </button>
                </div>
              ))}
            </div>
          )}

          {selectedFeature === "mcp" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map((it) => {
                const ok = it.statusKind === "ok";
                const warn = it.statusKind === "warn";
                return (
                  <div
                    key={it.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid #1f2937",
                      background: "rgba(15,23,42,0.6)",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: "rgba(245,158,11,0.12)",
                        color: "#fcd34d",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MdMemory style={{ fontSize: 16 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#e5e7eb" }}>{it.name}</div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "#64748b",
                          fontFamily: "ui-monospace, monospace",
                          marginTop: 2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {it.subtitle || "—"}
                      </div>
                    </div>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: warn ? "#f59e0b" : ok ? "#22c55e" : "#64748b",
                        flexShrink: 0,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {selectedFeature === "sessions" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map((it) => (
                <div
                  key={it.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #1f2937",
                    background: "rgba(15,23,42,0.6)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      color: "#64748b",
                      fontFamily: "ui-monospace, monospace",
                      minWidth: 56,
                      flexShrink: 0,
                    }}
                  >
                    —
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#e5e7eb" }}>{it.name}</div>
                    <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{it.subtitle || "—"}</div>
                  </div>
                  {it.statusLabel && (
                    <span style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", color: "#94a3b8", flexShrink: 0 }}>
                      {it.statusLabel}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {!itemsLoading && items.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 16px", color: "#64748b", fontSize: 12 }}>暂无条目</div>
          )}
        </div>
      </div>

      <style>{`
        .agent-live-dot {
          display: inline-block;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #22c55e;
          margin-right: 4px;
          vertical-align: middle;
          animation: agent-pulse 2s ease-in-out infinite;
        }
        @keyframes agent-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </div>
  );
}
