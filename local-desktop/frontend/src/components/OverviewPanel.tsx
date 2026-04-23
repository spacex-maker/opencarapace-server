import { useEffect, useState } from "react";
import { StatCard, LocalStatus } from "./Common";
import { ChartCard } from "./ChartCard";
import { EChartsOption } from "echarts";

interface Props {
  status: LocalStatus | null;
  loading: boolean;
}

interface DashboardStats {
  skillsStats?: {
    totalSkills: number;
    activeSkills: number;
    deprecatedSkills: number;
    disabledSkills: number;
    userDisabledCount: number;
    userSafeLabelCount: number;
    userUnsafeLabelCount: number;
    totalSafeMarks: number;
    totalUnsafeMarks: number;
    categoryDistribution: Array<{ category: string; count: number }>;
    typeDistribution: Array<{ type: string; count: number }>;
  };
  dangerStats?: {
    totalCommands: number;
    enabledCommands: number;
    systemTypeDistribution: Array<{ systemType: string; count: number }>;
    categoryDistribution: Array<{ category: string; count: number }>;
    riskLevelDistribution: Array<{ riskLevel: string; count: number }>;
  };
  interceptStats?: {
    totalIntercepts: number;
    riskDistribution: Array<{ riskLevel: string; count: number }>;
    verdictDistribution: Array<{ verdict: string; count: number }>;
  };
  tokenTimeline?: {
    timeline: Array<{ time: string; tokens: number }>;
    totalTokens: number;
    range: string;
  };
  interceptTimeline?: {
    timeline: Array<{ time: string; count: number }>;
    totalIntercepts: number;
    range: string;
  };
}

interface SocialMediaItem {
  id: number;
  name: string;
  iconKey: string;
  url: string;
  showQrCode: boolean;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5分钟

let cachedStats: DashboardStats | null = null;
let cacheTimestamp: number = 0;

// 基础卡片样式提取，保持风格统一
const cardBaseStyle: React.CSSProperties = {
  background: "var(--panel-bg)",
  border: "none",
  borderRadius: 16,
  padding: "clamp(16px, 2vw, 24px)",
  boxShadow: "none",
  transition: "background 0.3s ease",
};

export function OverviewPanel(props: Props) {
  const { status, loading } = props;
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({});
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [dangerLoading, setDangerLoading] = useState(true);
  const [interceptLoading, setInterceptLoading] = useState(true);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [interceptTimelineLoading, setInterceptTimelineLoading] = useState(true);
  const [tokenTimeRange, setTokenTimeRange] = useState<"1h" | "24h" | "7d" | "30d">("24h");
  const [interceptTimeRange, setInterceptTimeRange] = useState<"1h" | "24h" | "7d" | "30d">("24h");
  const [tokenGranularity, setTokenGranularity] = useState<"minute" | "hour" | "day" | "week" | "month">("hour");
  const [interceptGranularity, setInterceptGranularity] = useState<"minute" | "hour" | "day" | "week" | "month">("hour");
  const [lastCacheTime, setLastCacheTime] = useState<string | null>(null);
  const [skillsLoadError, setSkillsLoadError] = useState<string | null>(null);
  const [socialItems, setSocialItems] = useState<SocialMediaItem[]>([]);

  /** 未登录时不拉云端看板，加载位若仍为 true 也不应显示「同步中」 */
  const cloudAuthed = !!status?.auth?.token;
  const dashboardCloudSyncing =
    cloudAuthed &&
    (skillsLoading || dangerLoading || interceptLoading || tokenLoading || interceptTimelineLoading);

  useEffect(() => {
    if (status?.auth?.token) {
      loadSkillsStats();
      loadDangerStats();
      loadInterceptStats();
    }
  }, [status?.auth?.token]);

  useEffect(() => {
    if (status?.auth?.token) {
      loadTokenTimeline();
    }
  }, [status?.auth?.token, tokenTimeRange, tokenGranularity]);

  useEffect(() => {
    if (status?.auth?.token) {
      loadInterceptTimeline();
    }
  }, [status?.auth?.token, interceptTimeRange, interceptGranularity]);

  useEffect(() => {
    fetch("http://127.0.0.1:19111/api/social-media")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setSocialItems(Array.isArray(rows) ? rows : []))
      .catch(() => setSocialItems([]));
  }, []);

  const loadSkillsStats = async () => {
    setSkillsLoading(true);
    setSkillsLoadError(null);
    try {
      const auth = status?.auth?.token;
      const apiBase = (status?.settings?.apiBase || "https://api.clawheart.live").replace(/\/+$/, "");
      if (!auth) {
        setSkillsLoadError("未登录：无法请求看板接口（需要 Bearer Token）。");
        return;
      }

      const res = await fetch(`${apiBase}/api/dashboard/skills-stats`, {
        headers: { Authorization: `Bearer ${auth}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDashboardStats((prev) => ({ ...prev, skillsStats: data }));
        return;
      }
      const raw = await res.text();
      let detail = "";
      try {
        const j = JSON.parse(raw) as { error?: string; message?: string };
        detail = j?.error || j?.message || "";
      } catch {
        detail = raw.slice(0, 200);
      }
      setSkillsLoadError(
        `skills-stats 失败（HTTP ${res.status}）${detail ? `：${detail}` : "。请在浏览器直连时附带 Authorization: Bearer <JWT>；数据库无技能时总数为 0 属正常。"}`
      );
    } catch (e) {
      console.error("加载技能统计失败:", e);
      setSkillsLoadError(e instanceof Error ? e.message : "网络或 CORS 错误，请确认云端地址与后端已启动。");
    } finally {
      setSkillsLoading(false);
    }
  };

  const loadDangerStats = async () => {
    setDangerLoading(true);
    try {
      const auth = status?.auth?.token;
      const apiBase = (status?.settings?.apiBase || "https://api.clawheart.live").replace(/\/+$/, "");
      if (!auth) return;

      const res = await fetch(`${apiBase}/api/dashboard/danger-stats`, {
        headers: { Authorization: `Bearer ${auth}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDashboardStats((prev) => ({ ...prev, dangerStats: data }));
      }
    } catch (e) {
      console.error("加载危险指令统计失败:", e);
    } finally {
      setDangerLoading(false);
    }
  };

  const loadInterceptStats = async () => {
    setInterceptLoading(true);
    try {
      const auth = status?.auth?.token;
      const apiBase = (status?.settings?.apiBase || "https://api.clawheart.live").replace(/\/+$/, "");
      if (!auth) return;

      const res = await fetch(`${apiBase}/api/dashboard/intercept-risk-stats`, {
        headers: { Authorization: `Bearer ${auth}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDashboardStats((prev) => ({ ...prev, interceptStats: data }));
      }
    } catch (e) {
      console.error("加载拦截统计失败:", e);
    } finally {
      setInterceptLoading(false);
    }
  };

  const loadTokenTimeline = async () => {
    setTokenLoading(true);
    try {
      const auth = status?.auth?.token;
      const apiBase = (status?.settings?.apiBase || "https://api.clawheart.live").replace(/\/+$/, "");
      if (!auth) return;

      const res = await fetch(`${apiBase}/api/dashboard/token-usage-timeline?range=${tokenTimeRange}&granularity=${tokenGranularity}`, {
        headers: { Authorization: `Bearer ${auth}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDashboardStats((prev) => ({ ...prev, tokenTimeline: data }));
        const now = new Date();
        setLastCacheTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
      }
    } catch (e) {
      console.error("加载 Token 时间线失败:", e);
    } finally {
      setTokenLoading(false);
    }
  };

  const loadInterceptTimeline = async () => {
    setInterceptTimelineLoading(true);
    try {
      const auth = status?.auth?.token;
      const apiBase = (status?.settings?.apiBase || "https://api.clawheart.live").replace(/\/+$/, "");
      if (!auth) return;

      const res = await fetch(`${apiBase}/api/dashboard/intercept-timeline?range=${interceptTimeRange}&granularity=${interceptGranularity}`, {
        headers: { Authorization: `Bearer ${auth}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDashboardStats((prev) => ({ ...prev, interceptTimeline: data }));
      }
    } catch (e) {
      console.error("加载拦截时间线失败:", e);
    } finally {
      setInterceptTimelineLoading(false);
    }
  };

  const refreshAllStats = () => {
    loadSkillsStats();
    loadDangerStats();
    loadInterceptStats();
    loadTokenTimeline();
    loadInterceptTimeline();
  };

  // ECharts 通用网格样式设置
  const commonGrid = {
    left: "2%",
    right: "3%",
    bottom: "2%",
    top: "15%",
    containLabel: true,
  };

  const commonTooltip = {
    trigger: "axis" as const,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    borderColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    padding: [12, 16],
    textStyle: { color: "#f8fafc", fontSize: 13 },
    backdropFilter: "blur(8px)", // Note: ECharts canvas doesn't natively support css backdrop-filter yet, but kept for future-proofing or custom HTML tooltip
    borderRadius: 8,
  };

  const getSkillsCategoryChartOption = (): EChartsOption => {
    const data = dashboardStats.skillsStats?.categoryDistribution || [];
    return {
      backgroundColor: "transparent",
      tooltip: { ...commonTooltip, trigger: "item" },
      legend: { top: "0%", left: "center", textStyle: { color: "#94a3b8" }, itemWidth: 8, itemHeight: 8, icon: "circle" },
      series: [
        {
          name: "技能分类",
          type: "pie",
          radius: ["50%", "75%"],
          center: ["50%", "55%"],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 8, borderColor: "var(--panel-bg)", borderWidth: 3 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 14, fontWeight: "bold", color: "#f8fafc" } },
          labelLine: { show: false },
          data: data.map((item) => ({ value: item.count, name: item.category })),
        },
      ],
    };
  };

  const getDangerSystemTypeChartOption = (): EChartsOption => {
    const data = dashboardStats.dangerStats?.systemTypeDistribution || [];
    return {
      backgroundColor: "transparent",
      tooltip: { ...commonTooltip, axisPointer: { type: "shadow" } },
      grid: commonGrid,
      xAxis: { type: "value", axisLabel: { color: "#64748b" }, splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)", type: "dashed" } } },
      yAxis: {
        type: "category",
        data: data.map((item) => item.systemType),
        axisLabel: { color: "#94a3b8" },
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
      },
      series: [
        {
          name: "数量",
          type: "bar",
          data: data.map((item) => item.count),
          itemStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [{ offset: 0, color: '#3b82f6' }, { offset: 1, color: '#60a5fa' }]
            },
            borderRadius: [0, 6, 6, 0]
          },
          barMaxWidth: 24,
        },
      ],
    };
  };

  const getDangerRiskLevelChartOption = (): EChartsOption => {
    const data = dashboardStats.dangerStats?.riskLevelDistribution || [];
    const colorMap: Record<string, string> = { CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#eab308", LOW: "#22c55e" };
    return {
      backgroundColor: "transparent",
      tooltip: { ...commonTooltip, trigger: "item" },
      legend: { top: "0%", left: "center", textStyle: { color: "#94a3b8" }, itemWidth: 8, itemHeight: 8, icon: "circle" },
      series: [
        {
          name: "风险等级",
          type: "pie",
          radius: ["40%", "75%"],
          center: ["50%", "55%"],
          roseType: 'radius', // 增加南丁格尔玫瑰图效果，视觉更丰满
          itemStyle: { borderRadius: 6, borderColor: "var(--panel-bg)", borderWidth: 2 },
          data: data.map((item) => ({
            value: item.count,
            name: item.riskLevel,
            itemStyle: { color: colorMap[item.riskLevel] || "#64748b" },
          })),
          emphasis: { itemStyle: { shadowBlur: 15, shadowOffsetX: 0, shadowColor: "rgba(0, 0, 0, 0.4)" } },
        },
      ],
    };
  };

  const getInterceptRiskChartOption = (): EChartsOption => {
    const data = dashboardStats.interceptStats?.riskDistribution || [];
    const colorMap: Record<string, string> = { CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#eab308", LOW: "#22c55e" };
    return {
      backgroundColor: "transparent",
      tooltip: { ...commonTooltip, trigger: "item" },
      legend: { top: "0%", left: "center", textStyle: { color: "#94a3b8" }, itemWidth: 8, itemHeight: 8, icon: "circle" },
      series: [
        {
          name: "拦截风险",
          type: "pie",
          radius: ["50%", "75%"],
          center: ["50%", "55%"],
          data: data.map((item) => ({
            value: item.count,
            name: item.riskLevel,
            itemStyle: { color: colorMap[item.riskLevel] || "#64748b", borderRadius: 8, borderColor: "var(--panel-bg)", borderWidth: 3 },
          })),
          emphasis: { itemStyle: { shadowBlur: 15, shadowOffsetX: 0, shadowColor: "rgba(0, 0, 0, 0.4)" } },
        },
      ],
    };
  };

  // 将 Token 消耗趋势优化为面积折线图
  const getTokenTimelineChartOption = (): EChartsOption => {
    const data = dashboardStats.tokenTimeline?.timeline || [];
    return {
      backgroundColor: "transparent",
      tooltip: { ...commonTooltip, axisPointer: { type: "line", lineStyle: { color: "rgba(255,255,255,0.1)" } } },
      grid: commonGrid,
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: data.map((item) => item.time),
        axisLabel: { color: "#64748b", rotate: 0, hideOverlap: true, margin: 12 },
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#64748b" },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)", type: "dashed" } },
      },
      series: [
        {
          name: "Token 消耗",
          type: "line",
          smooth: true,
          symbol: "none",
          data: data.map((item) => item.tokens),
          lineStyle: { width: 3, color: '#3b82f6' },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: 'rgba(59, 130, 246, 0.4)' }, { offset: 1, color: 'rgba(59, 130, 246, 0)' }]
            }
          },
        },
      ],
    };
  };

  // 将拦截趋势优化为面积折线图
  const getInterceptTimelineChartOption = (): EChartsOption => {
    const data = dashboardStats.interceptTimeline?.timeline || [];
    return {
      backgroundColor: "transparent",
      tooltip: { ...commonTooltip, axisPointer: { type: "line", lineStyle: { color: "rgba(255,255,255,0.1)" } } },
      grid: commonGrid,
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: data.map((item) => item.time),
        axisLabel: { color: "#64748b", rotate: 0, hideOverlap: true, margin: 12 },
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#64748b" },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.05)", type: "dashed" } },
      },
      series: [
        {
          name: "拦截次数",
          type: "line",
          smooth: true,
          symbol: "none",
          data: data.map((item) => item.count),
          lineStyle: { width: 3, color: '#ef4444' },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: 'rgba(239, 68, 68, 0.4)' }, { offset: 1, color: 'rgba(239, 68, 68, 0)' }]
            }
          },
        },
      ],
    };
  };

  // 可复用的分段控制器组件样式
  const renderSegmentedControl = (
    options: { label: string; value: string }[],
    currentValue: string,
    onChange: (val: any) => void,
    colorScheme: "blue" | "red"
  ) => {
    const activeColor = colorScheme === "blue" ? "#3b82f6" : "#ef4444";
    const activeBg = colorScheme === "blue" ? "rgba(59, 130, 246, 0.15)" : "rgba(239, 68, 68, 0.15)";

    return (
      <div style={{
        display: "inline-flex",
        background: "rgba(0, 0, 0, 0.2)",
        borderRadius: 8,
        padding: 4,
        border: "1px solid rgba(255, 255, 255, 0.05)",
      }}>
        {options.map((opt) => {
          const isActive = currentValue === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              style={{
                padding: "4px 14px",
                fontSize: 13,
                border: "none",
                background: isActive ? activeBg : "transparent",
                color: isActive ? activeColor : "var(--muted)",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: isActive ? 600 : 400,
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.2)" : "none",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  };

  const socialIcon = (key: string | null | undefined): string => {
    const k = String(key || "").toLowerCase();
    if (k === "x" || k === "twitter") return "𝕏";
    if (k === "github") return "GH";
    if (k === "linkedin") return "in";
    if (k === "wechat" || k === "weixin") return "微";
    if (k === "xiaohongshu") return "红";
    if (k === "douyin") return "抖";
    if (k === "zhihu") return "知";
    if (k === "bilibili") return "B";
    if (k === "youtube") return "▶";
    if (k === "telegram") return "TG";
    return "•";
  };

  const qrUrl = (raw: string) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=0&data=${encodeURIComponent(raw)}`;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 1600, // 放宽最大宽度以适应大屏
        margin: "0 auto",
        background: "transparent",
        padding: "clamp(16px, 3vw, 40px)",
        boxSizing: "border-box",
        overflowX: "hidden",
        color: "var(--fg)",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* 头部区域 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32, flexWrap: "wrap", gap: 20 }}>
        <div>
          <h1 style={{ 
            fontSize: 28, 
            fontWeight: 800, 
            margin: "0 0 10px", 
            letterSpacing: "-0.5px",
            color: "var(--fg)",
            background: "none",
          }}>
            ClawHeart 数据看板
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: "var(--fg)",
                fontWeight: 600,
                padding: "6px 10px",
                borderRadius: 999,
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.10)",
                boxShadow: "0 1px 8px rgba(0, 0, 0, 0.16)",
                lineHeight: 1.2,
              }}
            >
              系统运行状态与核心数据统计总览
            </p>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                padding: "4px 12px",
                borderRadius: 999,
                background: "rgba(34, 197, 94, 0.1)",
                border: "1px solid rgba(34, 197, 94, 0.2)",
                color: "#4ade80",
                fontWeight: 600,
                boxShadow: "0 0 12px rgba(34, 197, 94, 0.1)"
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#22c55e",
                  boxShadow: "0 0 8px #22c55e",
                  animation: "pulse 2s infinite"
                }}
              />
              本地代理运行中
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {lastCacheTime && (
            <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>
              上次更新: {lastCacheTime}
            </span>
          )}
          <button
            onClick={refreshAllStats}
            disabled={dashboardCloudSyncing}
            style={{
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)",
              color: "var(--fg)",
              borderRadius: 10,
              cursor: dashboardCloudSyncing ? "not-allowed" : "pointer",
              opacity: dashboardCloudSyncing ? 0.6 : 1,
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
            }}
            onMouseOver={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
            onMouseOut={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
          >
            {dashboardCloudSyncing ? (
              <>
                <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid var(--muted)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                同步中…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21v-5h5"/></svg>
                立即刷新
              </>
            )}
          </button>
        </div>
      </div>

      {/* 顶部统计卡片 - 优化 Grid 布局 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 20,
          marginBottom: 32,
        }}
      >
        <StatCard noBorder label="危险指令规则" value={loading ? "…" : status?.danger ?? 0} />
        <StatCard noBorder label="系统禁用技能" value={loading ? "…" : status?.disabled ?? 0} />
        <StatCard noBorder label="不推荐技能" value={loading ? "…" : status?.deprecated ?? 0} />
        <StatCard
          noBorder
          label="用户禁用技能"
          value={cloudAuthed && skillsLoading ? "…" : dashboardStats.skillsStats?.userDisabledCount ?? 0}
        />
        <StatCard
          noBorder
          label="我标记为安全"
          value={cloudAuthed && skillsLoading ? "…" : dashboardStats.skillsStats?.userSafeLabelCount ?? 0}
        />
        <StatCard
          noBorder
          label="我标记为不安全"
          value={cloudAuthed && skillsLoading ? "…" : dashboardStats.skillsStats?.userUnsafeLabelCount ?? 0}
        />
      </div>

      {skillsLoadError && (
        <div
          style={{
            marginBottom: 20,
            padding: "12px 14px",
            borderRadius: 12,
            fontSize: 13,
            lineHeight: 1.5,
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.35)",
            color: "#fca5a5",
          }}
        >
          云端技能统计未加载：{skillsLoadError}
        </div>
      )}

      {/* 中部图表：统一网格布局 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 24, marginBottom: 24 }}>
        <div style={cardBaseStyle}>
          <ChartCard title="技能分类分布" option={getSkillsCategoryChartOption()} loading={cloudAuthed && skillsLoading} height={320} />
        </div>
        <div style={cardBaseStyle}>
          <ChartCard title="危险指令风险等级" option={getDangerRiskLevelChartOption()} loading={cloudAuthed && dangerLoading} height={320} />
        </div>
        <div style={cardBaseStyle}>
          <ChartCard title="危险指令系统类型" option={getDangerSystemTypeChartOption()} loading={cloudAuthed && dangerLoading} height={320} />
        </div>
        <div style={cardBaseStyle}>
          <ChartCard title="拦截监控风险分布" option={getInterceptRiskChartOption()} loading={cloudAuthed && interceptLoading} height={320} />
        </div>
      </div>

      {/* 底部时间轴图表 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
        
        {/* Token 时间轴 */}
        <div style={cardBaseStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--fg)" }}>Token 消耗趋势</h3>
              {dashboardStats.tokenTimeline && (
                <span style={{ fontSize: 14, fontWeight: 600, color: "#60a5fa", background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.2)", padding: "2px 10px", borderRadius: 8 }}>
                  总计: {dashboardStats.tokenTimeline.totalTokens.toLocaleString()}
                </span>
              )}
            </div>
            
            {/* 现代化分段控制器 */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {renderSegmentedControl(
                [{label: "1小时", value: "1h"}, {label: "24小时", value: "24h"}, {label: "7天", value: "7d"}, {label: "30天", value: "30d"}],
                tokenTimeRange,
                setTokenTimeRange,
                "blue"
              )}
              {renderSegmentedControl(
                [{label: "分", value: "minute"}, {label: "时", value: "hour"}, {label: "天", value: "day"}, {label: "周", value: "week"}, {label: "月", value: "month"}],
                tokenGranularity,
                setTokenGranularity,
                "blue"
              )}
            </div>
          </div>
          <ChartCard title="" option={getTokenTimelineChartOption()} loading={cloudAuthed && tokenLoading} height={320} />
        </div>

        {/* 拦截监控时间轴 */}
        <div style={cardBaseStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--fg)" }}>拦截监控时间轴</h3>
              {dashboardStats.interceptTimeline && (
                <span style={{ fontSize: 14, fontWeight: 600, color: "#f87171", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", padding: "2px 10px", borderRadius: 8 }}>
                  总计拦截: {dashboardStats.interceptTimeline.totalIntercepts} 次
                </span>
              )}
            </div>
            
            {/* 现代化分段控制器 */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {renderSegmentedControl(
                [{label: "1小时", value: "1h"}, {label: "24小时", value: "24h"}, {label: "7天", value: "7d"}, {label: "30天", value: "30d"}],
                interceptTimeRange,
                setInterceptTimeRange,
                "red"
              )}
              {renderSegmentedControl(
                [{label: "分", value: "minute"}, {label: "时", value: "hour"}, {label: "天", value: "day"}, {label: "周", value: "week"}, {label: "月", value: "month"}],
                interceptGranularity,
                setInterceptGranularity,
                "red"
              )}
            </div>
          </div>
          <ChartCard title="" option={getInterceptTimelineChartOption()} loading={cloudAuthed && interceptTimelineLoading} height={320} />
        </div>
      </div>
      
      {/* 全局动画关键帧 */}
      {socialItems.length > 0 && (
        <div style={{ ...cardBaseStyle, marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--fg)" }}>社媒与社区</h3>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>二维码由 URL 动态生成</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            {socialItems.map((it) => (
              <div
                key={it.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.02)",
                  padding: 12,
                }}
              >
                <a
                  href={it.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--fg)", textDecoration: "none" }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {socialIcon(it.iconKey)}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{it.name}</span>
                </a>
                {it.showQrCode ? (
                  <img
                    src={qrUrl(it.url)}
                    alt={`${it.name} 二维码`}
                    style={{ marginTop: 10, width: 90, height: 90, borderRadius: 8, border: "1px solid var(--border)", background: "#fff", padding: 4 }}
                    loading="lazy"
                  />
                ) : (
                  <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>二维码已关闭</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}