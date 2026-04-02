import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  MdChevronRight,
  MdDescription,
  MdExtension,
  MdHistory,
  MdMemory,
  MdSettingsSuggest,
  MdDashboardCustomize,
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
  const subTitle = `${items.length} 条数据接入`;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 1400, // 略微放宽以适配 Grid 布局
        margin: "0 auto",
        background: "var(--panel-bg)",
        borderRadius: 16,
        border: "1px solid var(--panel-border)",
        boxShadow: "0 12px 32px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.02) inset",
        boxSizing: "border-box",
        minHeight: 600, // 增加初始高度让布局更大气
        display: "flex",
        flexDirection: "column",
        overflow: "hidden", // 防止子元素溢出圆角
        color: "var(--fg)",
      }}
    >
      {/* 注入全局小动画与网格卡片悬浮样式 */}
      <style>{`
        .agent-live-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #4ade80;
          margin-right: 6px;
          vertical-align: middle;
          animation: agent-pulse 2s ease-in-out infinite;
          box-shadow: 0 0 8px #4ade80;
        }
        @keyframes agent-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
        .ui-agent-card {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .ui-agent-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px -4px rgba(0,0,0,0.15);
          border-color: rgba(255,255,255,0.15) !important;
          background: rgba(255,255,255,0.02) !important;
        }
        .ui-sidebar-btn:hover {
          background: rgba(255,255,255,0.03) !important;
        }
      `}</style>

      {/* 头部 */}
      <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--panel-border)", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(168,85,247,0.1))",
          color: "#60a5fa",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid rgba(59,130,246,0.2)"
        }}>
          <MdDashboardCustomize style={{ fontSize: 24 }} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px", color: "var(--fg)" }}>Agent 资源管理器</h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
            按平台维度管理 Providers、Skills、Prompts、MCP 与会话状态；支持本地知识库与云端环境的桥接同步。
          </p>
        </div>
      </div>

      {error && (
        <div
          style={{
            margin: "16px 32px 0",
            padding: "10px 16px",
            borderRadius: 8,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#fca5a5",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* 左侧树状导航 */}
        <div
          style={{
            width: 260,
            flexShrink: 0,
            borderRight: "1px solid var(--panel-border)",
            overflowY: "auto",
            padding: "16px 12px",
            background: "var(--panel-bg2)",
          }}
        >
          {loading && <div style={{ padding: 12, color: "var(--muted2)", fontSize: 13, textAlign: "center" }}>获取架构目录中...</div>}
          {!loading &&
            platforms.map((p) => {
              const open = openAgents.has(p.code);
              const feats = PLATFORM_FEATURES[p.code] || [];
              const isActivePlatform = selectedPlatform === p.code;
              
              return (
                <div key={p.code} style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    onClick={() => toggleAgent(p.code)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: isActivePlatform && open ? "rgba(255,255,255,0.05)" : "transparent",
                      color: isActivePlatform ? "var(--fg)" : "var(--muted)",
                      fontSize: 14,
                      fontWeight: isActivePlatform ? 700 : 600,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.2s"
                    }}
                    className={!isActivePlatform ? "ui-sidebar-btn" : ""}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: p.accent || "#64748b",
                        flexShrink: 0,
                        boxShadow: `0 0 8px ${p.accent || "#64748b"}40`
                      }}
                    />
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.displayName}
                    </span>
                    <MdChevronRight
                      style={{
                        fontSize: 20,
                        opacity: 0.4,
                        transform: open ? "rotate(90deg)" : "none",
                        transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        flexShrink: 0,
                      }}
                    />
                  </button>
                  
                  {/* 子菜单 */}
                  <div style={{ 
                    overflow: "hidden", 
                    maxHeight: open ? 500 : 0, 
                    transition: "max-height 0.3s ease-in-out, opacity 0.3s ease-in-out",
                    opacity: open ? 1 : 0
                  }}>
                    <div style={{ padding: "4px 0 4px 28px", display: "flex", flexDirection: "column", gap: 2 }}>
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
                              gap: 10,
                              padding: "8px 12px",
                              borderRadius: 8,
                              border: "none",
                              background: active ? "rgba(59,130,246,0.15)" : "transparent",
                              color: active ? "#93c5fd" : "var(--muted)",
                              fontSize: 13,
                              fontWeight: active ? 600 : 500,
                              cursor: "pointer",
                              textAlign: "left",
                              transition: "all 0.2s",
                              position: "relative"
                            }}
                            className={!active ? "ui-sidebar-btn" : ""}
                          >
                            {active && (
                              <div style={{ position: "absolute", left: 0, top: "20%", bottom: "20%", width: 3, borderRadius: "0 4px 4px 0", background: "#3b82f6" }} />
                            )}
                            <span style={{ display: "flex", opacity: active ? 0.9 : 0.5, fontSize: 16 }}>{FEATURE_META[ft].icon}</span>
                            <span style={{ flex: 1 }}>{FEATURE_META[ft].label}</span>
                            <span
                              style={{
                                fontSize: 11,
                                fontFamily: "ui-monospace, monospace",
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 999,
                                background: active ? "rgba(59,130,246,0.2)" : "var(--panel-bg)",
                                color: active ? "#93c5fd" : "var(--muted)",
                                border: `1px solid ${active ? "rgba(59,130,246,0.1)" : "var(--panel-border)"}`,
                              }}
                            >
                              {cnt}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        {/* 右侧主内容区 */}
        <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "32px", background: "var(--panel-bg)" }}>
          {/* 标题栏 */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--fg)", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ display: "flex", color: "#60a5fa", padding: 8, background: "rgba(59,130,246,0.1)", borderRadius: 8 }}>
                  {featMeta.icon}
                </span>
                {platformDisplayName} · {featMeta.featTitle}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--muted)",
                  marginTop: 8,
                }}
              >
                {itemsLoading ? "数据同步中..." : subTitle}
              </div>
            </div>
            
            <button
              type="button"
              disabled
              title="功能开发中"
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid var(--panel-border)",
                background: "var(--panel-bg2)",
                color: "var(--muted2)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "not-allowed",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              新建条目
            </button>
          </div>

          {/* 加载骨架屏 or 数据为空 */}
          {itemsLoading && items.length === 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ height: 72, background: "var(--panel-bg2)", borderRadius: 12, opacity: 0.5, animation: "pulse 1.5s infinite" }} />
              ))}
            </div>
          )}

          {!itemsLoading && items.length === 0 && (
            <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--muted)", border: "1px dashed var(--panel-border)", borderRadius: 16 }}>
              <div style={{ fontSize: 32, opacity: 0.2, marginBottom: 12 }}>{featMeta.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>未找到相关 {featMeta.featTitle} 配置</div>
              <div style={{ fontSize: 12, marginTop: 4, opacity: 0.6 }}>当前平台尚未接入此类型的扩展资源</div>
            </div>
          )}

          {/* 网格卡片列表 */}
          {items.length > 0 && (
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", 
              gap: 16 
            }}>
              {items.map((it) => {
                // 根据当前模块类型决定卡片的强调色与逻辑
                let accentColor = "#64748b";
                let bgRgba = "rgba(100, 116, 139, 0.1)";
                let iconEl = featMeta.icon;
                
                let isHighlight = false;
                let isWarning = false;

                if (selectedFeature === "providers") {
                  isHighlight = it.statusKind === "active";
                  accentColor = isHighlight ? "#4ade80" : "#3b82f6";
                  bgRgba = isHighlight ? "rgba(34,197,94,0.15)" : "rgba(59,130,246,0.15)";
                  iconEl = <span style={{ fontSize: 12, fontWeight: 800, fontFamily: "ui-monospace, monospace" }}>{initials(it.name)}</span>;
                } else if (selectedFeature === "skills") {
                  isWarning = it.statusKind === "update";
                  accentColor = "#c084fc"; // Purple
                  bgRgba = "rgba(168,85,247,0.15)";
                  iconEl = <span style={{ fontSize: 12, fontWeight: 800, fontFamily: "ui-monospace, monospace" }}>{initials(it.name)}</span>;
                } else if (selectedFeature === "prompts") {
                  accentColor = "#94a3b8"; // Slate
                  bgRgba = "rgba(148,163,184,0.15)";
                } else if (selectedFeature === "mcp") {
                  isHighlight = it.statusKind === "ok";
                  isWarning = it.statusKind === "warn";
                  accentColor = "#fbbf24"; // Amber
                  bgRgba = "rgba(245,158,11,0.15)";
                } else if (selectedFeature === "sessions") {
                  accentColor = "#64748b";
                  bgRgba = "transparent";
                  iconEl = <span style={{ fontSize: 12, fontWeight: 800 }}>#</span>;
                }

                // 统一的卡片外框样式
                const cardBorder = (selectedFeature === "providers" && isHighlight) 
                  ? "1px solid rgba(34,197,94,0.4)" 
                  : "1px solid var(--panel-border)";
                  
                const cardBg = (selectedFeature === "providers" && isHighlight) 
                  ? "rgba(34,197,94,0.04)" 
                  : "var(--panel-bg2)";

                return (
                  <div
                    key={it.id}
                    className="ui-agent-card"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "16px",
                      borderRadius: 12,
                      border: cardBorder,
                      background: cardBg,
                    }}
                  >
                    {/* 左侧图标/首字母缩写 */}
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: bgRgba,
                        color: accentColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                        flexShrink: 0
                      }}
                    >
                      {iconEl}
                    </div>

                    {/* 中间信息 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {it.name}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--muted)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {it.subtitle || "暂无描述信息"}
                      </div>
                    </div>

                    {/* 右侧状态区 */}
                    <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
                      
                      {/* MCP 特有的状态圆点 */}
                      {selectedFeature === "mcp" && (
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: isWarning ? "#f59e0b" : isHighlight ? "#22c55e" : "#64748b",
                            boxShadow: `0 0 8px ${isWarning ? "#f59e0b80" : isHighlight ? "#22c55e80" : "transparent"}`
                          }}
                        />
                      )}

                      {/* 通用状态标签 (Provider, Skills, Sessions) */}
                      {it.statusLabel && selectedFeature !== "mcp" && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "4px 8px",
                            borderRadius: 6,
                            background: 
                              (selectedFeature === "providers" && isHighlight) ? "rgba(34,197,94,0.15)" :
                              (selectedFeature === "skills" && isWarning) ? "rgba(245,158,11,0.15)" : 
                              (selectedFeature === "skills" && !isWarning) ? "rgba(34,197,94,0.15)" :
                              "rgba(255,255,255,0.05)",
                            color: 
                              (selectedFeature === "providers" && isHighlight) ? "#4ade80" :
                              (selectedFeature === "skills" && isWarning) ? "#fcd34d" : 
                              (selectedFeature === "skills" && !isWarning) ? "#4ade80" :
                              "var(--muted)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {selectedFeature === "providers" && isHighlight && <span className="agent-live-dot" />}
                          {it.statusLabel}
                        </span>
                      )}

                      {/* Prompts 特有的编辑按钮 (禁用态) */}
                      {selectedFeature === "prompts" && (
                        <button
                          type="button"
                          disabled
                          style={{
                            padding: "4px 12px",
                            borderRadius: 6,
                            border: "1px solid var(--panel-border)",
                            background: "transparent",
                            color: "var(--muted)",
                            fontSize: 12,
                            cursor: "not-allowed",
                          }}
                        >
                          详情
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}