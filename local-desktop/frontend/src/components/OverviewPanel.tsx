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

const CACHE_DURATION = 5 * 60 * 1000; // 5分钟

let cachedStats: DashboardStats | null = null;
let cacheTimestamp: number = 0;

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

  const loadSkillsStats = async () => {
    setSkillsLoading(true);
    try {
      const auth = status?.auth?.token;
      const apiBase = (status?.settings?.apiBase || "https://api.clawheart.live").replace(/\/+$/, "");
      if (!auth) return;

      const res = await fetch(`${apiBase}/api/dashboard/skills-stats`, {
        headers: { Authorization: `Bearer ${auth}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDashboardStats((prev) => ({ ...prev, skillsStats: data }));
      }
    } catch (e) {
      console.error("加载技能统计失败:", e);
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
    left: "3%",
    right: "4%",
    bottom: "3%",
    top: "15%",
    containLabel: true,
  };

  const getSkillsCategoryChartOption = (): EChartsOption => {
    const data = dashboardStats.skillsStats?.categoryDistribution || [];
    return {
      backgroundColor: "transparent",
      tooltip: { trigger: "item", backgroundColor: "rgba(15, 23, 42, 0.9)", borderColor: "#334155", textStyle: { color: "#f8fafc" } },
      legend: { top: "0%", left: "center", textStyle: { color: "#94a3b8" }, itemWidth: 10, itemHeight: 10 },
      series: [
        {
          name: "技能分类",
          type: "pie",
          radius: ["45%", "75%"],
          center: ["50%", "55%"],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 6, borderColor: "#0f172a", borderWidth: 2 },
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
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: "rgba(15, 23, 42, 0.9)", borderColor: "#334155", textStyle: { color: "#f8fafc" } },
      grid: commonGrid,
      xAxis: { type: "value", axisLabel: { color: "#64748b" }, splitLine: { lineStyle: { color: "#1e293b", type: "dashed" } } },
      yAxis: {
        type: "category",
        data: data.map((item) => item.systemType),
        axisLabel: { color: "#94a3b8" },
        axisLine: { lineStyle: { color: "#334155" } },
      },
      series: [
        {
          name: "数量",
          type: "bar",
          data: data.map((item) => item.count),
          itemStyle: { color: "#3b82f6", borderRadius: [0, 4, 4, 0] },
          barMaxWidth: 32,
        },
      ],
    };
  };

  const getDangerRiskLevelChartOption = (): EChartsOption => {
    const data = dashboardStats.dangerStats?.riskLevelDistribution || [];
    const colorMap: Record<string, string> = {
      CRITICAL: "#ef4444",
      HIGH: "#f97316",
      MEDIUM: "#eab308",
      LOW: "#22c55e",
    };
    return {
      backgroundColor: "transparent",
      tooltip: { trigger: "item", backgroundColor: "rgba(15, 23, 42, 0.9)", borderColor: "#334155", textStyle: { color: "#f8fafc" } },
      legend: { top: "0%", left: "center", textStyle: { color: "#94a3b8" }, itemWidth: 10, itemHeight: 10 },
      series: [
        {
          name: "风险等级",
          type: "pie",
          radius: "70%",
          center: ["50%", "55%"],
          data: data.map((item) => ({
            value: item.count,
            name: item.riskLevel,
            itemStyle: { color: colorMap[item.riskLevel] || "#64748b", borderColor: "#0f172a", borderWidth: 1 },
          })),
          emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0, 0, 0, 0.5)" } },
        },
      ],
    };
  };

  const getInterceptRiskChartOption = (): EChartsOption => {
    const data = dashboardStats.interceptStats?.riskDistribution || [];
    const colorMap: Record<string, string> = {
      CRITICAL: "#ef4444",
      HIGH: "#f97316",
      MEDIUM: "#eab308",
      LOW: "#22c55e",
    };
    return {
      backgroundColor: "transparent",
      tooltip: { trigger: "item", backgroundColor: "rgba(15, 23, 42, 0.9)", borderColor: "#334155", textStyle: { color: "#f8fafc" } },
      legend: { top: "0%", left: "center", textStyle: { color: "#94a3b8" }, itemWidth: 10, itemHeight: 10 },
      series: [
        {
          name: "拦截风险",
          type: "pie",
          radius: ["45%", "75%"],
          center: ["50%", "55%"],
          data: data.map((item) => ({
            value: item.count,
            name: item.riskLevel,
            itemStyle: { color: colorMap[item.riskLevel] || "#64748b", borderRadius: 4, borderColor: "#0f172a", borderWidth: 2 },
          })),
          emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0, 0, 0, 0.5)" } },
        },
      ],
    };
  };

  const getTokenTimelineChartOption = (): EChartsOption => {
    const data = dashboardStats.tokenTimeline?.timeline || [];
    return {
      backgroundColor: "transparent",
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: "rgba(15, 23, 42, 0.9)", borderColor: "#334155", textStyle: { color: "#f8fafc" } },
      grid: commonGrid,
      xAxis: {
        type: "category",
        data: data.map((item) => item.time),
        axisLabel: { color: "#64748b", rotate: 0, hideOverlap: true },
        axisLine: { lineStyle: { color: "#334155" } },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#64748b" },
        splitLine: { lineStyle: { color: "#1e293b", type: "dashed" } },
      },
      series: [
        {
          name: "Token 消耗",
          type: "bar",
          data: data.map((item) => item.tokens),
          itemStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: '#60a5fa' }, { offset: 1, color: '#3b82f6' }]
            },
            borderRadius: [4, 4, 0, 0],
          },
          barMaxWidth: 20,
        },
      ],
    };
  };

  const getInterceptTimelineChartOption = (): EChartsOption => {
    const data = dashboardStats.interceptTimeline?.timeline || [];
    return {
      backgroundColor: "transparent",
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: "rgba(15, 23, 42, 0.9)", borderColor: "#334155", textStyle: { color: "#f8fafc" } },
      grid: commonGrid,
      xAxis: {
        type: "category",
        data: data.map((item) => item.time),
        axisLabel: { color: "#64748b", rotate: 0, hideOverlap: true },
        axisLine: { lineStyle: { color: "#334155" } },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#64748b" },
        splitLine: { lineStyle: { color: "#1e293b", type: "dashed" } },
      },
      series: [
        {
          name: "拦截次数",
          type: "bar",
          data: data.map((item) => item.count),
          itemStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: '#f87171' }, { offset: 1, color: '#ef4444' }]
            },
            borderRadius: [4, 4, 0, 0],
          },
          barMaxWidth: 20,
        },
      ],
    };
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 1400,
        margin: "0 auto",
        background: "#0f172a", // 主背景提亮一点点，方便区分模块
        borderRadius: 16,
        padding: "clamp(12px, 2.5vw, 32px)",
        boxSizing: "border-box",
        overflowX: "hidden",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        color: "#f8fafc",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* 头部区域 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px", background: "linear-gradient(to right, #f8fafc, #94a3b8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            ClawHeart 数据看板
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>
              系统运行状态与核心数据统计总览
            </p>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(34, 197, 94, 0.1)",
                border: "1px solid rgba(34, 197, 94, 0.2)",
                color: "#4ade80",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#22c55e",
                  boxShadow: "0 0 8px #22c55e",
                }}
              />
              本地代理运行中
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {lastCacheTime && (
            <span style={{ fontSize: 13, color: "#64748b" }}>
              上次更新: {lastCacheTime}
            </span>
          )}
          <button
            onClick={refreshAllStats}
            disabled={skillsLoading || dangerLoading || interceptLoading || tokenLoading || interceptTimelineLoading}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 500,
              border: "1px solid #334155",
              background: "#1e293b",
              color: "#e2e8f0",
              borderRadius: 8,
              cursor: (skillsLoading || dangerLoading || interceptLoading || tokenLoading || interceptTimelineLoading) ? "not-allowed" : "pointer",
              opacity: (skillsLoading || dangerLoading || interceptLoading || tokenLoading || interceptTimelineLoading) ? 0.6 : 1,
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            onMouseOver={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = "#334155")}
            onMouseOut={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = "#1e293b")}
          >
            {(skillsLoading || dangerLoading || interceptLoading || tokenLoading || interceptTimelineLoading) ? (
              <>
                <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid #64748b", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                刷新中...
              </>
            ) : "立即刷新"}
          </button>
        </div>
      </div>

      {/* 顶部统计卡片 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <StatCard label="危险指令规则" value={loading ? "…" : status?.danger ?? 0} />
        <StatCard label="系统禁用技能" value={loading ? "…" : status?.disabled ?? 0} />
        <StatCard label="不推荐技能" value={loading ? "…" : status?.deprecated ?? 0} />
        <StatCard
          label="用户禁用技能"
          value={skillsLoading ? "…" : dashboardStats.skillsStats?.userDisabledCount ?? 0}
        />
        <StatCard
          label="我标记为安全"
          value={skillsLoading ? "…" : dashboardStats.skillsStats?.userSafeLabelCount ?? 0}
        />
        <StatCard
          label="我标记为不安全"
          value={skillsLoading ? "…" : dashboardStats.skillsStats?.userUnsafeLabelCount ?? 0}
        />
      </div>

      {/* 中部图表：两列布局 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, marginBottom: 20 }}>
        <ChartCard
          title="技能分类分布"
          option={getSkillsCategoryChartOption()}
          loading={skillsLoading}
          height={300}
        />
        <ChartCard
          title="危险指令风险等级分布"
          option={getDangerRiskLevelChartOption()}
          loading={dangerLoading}
          height={300}
        />
        <ChartCard
          title="危险指令系统类型分布"
          option={getDangerSystemTypeChartOption()}
          loading={dangerLoading}
          height={300}
        />
        <ChartCard
          title="拦截监控风险分布"
          option={getInterceptRiskChartOption()}
          loading={interceptLoading}
          height={300}
        />
      </div>

      {/* 底部时间轴图表：单列全宽布局 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Token 时间轴 */}
        <div style={{ background: "#020617", border: "1px solid #1e293b", borderRadius: 12, padding: "clamp(12px, 2vw, 24px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#f8fafc" }}>Token 消耗趋势</h3>
              {dashboardStats.tokenTimeline && (
                <span style={{ fontSize: 13, color: "#3b82f6", background: "rgba(59, 130, 246, 0.1)", padding: "2px 8px", borderRadius: 6 }}>
                  总计: {dashboardStats.tokenTimeline.totalTokens.toLocaleString()}
                </span>
              )}
            </div>
            
            {/* 控制器 */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", width: "100%", justifyContent: "flex-end" }}>
              <div style={{ display: "flex", flexWrap: "wrap", rowGap: 6, background: "#0f172a", borderRadius: 8, padding: 4, border: "1px solid #1e293b", maxWidth: "100%" }}>
                {(["1h", "24h", "7d", "30d"] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTokenTimeRange(range)}
                    style={{
                      padding: "4px 12px",
                      fontSize: 12,
                      border: "none",
                      background: tokenTimeRange === range ? "#1e293b" : "transparent",
                      color: tokenTimeRange === range ? "#3b82f6" : "#64748b",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontWeight: tokenTimeRange === range ? 600 : 400,
                      transition: "all 0.2s",
                    }}
                  >
                    {range === "1h" ? "1小时" : range === "24h" ? "24小时" : range === "7d" ? "7天" : "30天"}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", rowGap: 6, background: "#0f172a", borderRadius: 8, padding: 4, border: "1px solid #1e293b", maxWidth: "100%" }}>
                {(
                  [
                    { key: "minute", label: "分" },
                    { key: "hour", label: "时" },
                    { key: "day", label: "天" },
                    { key: "week", label: "周" },
                    { key: "month", label: "月" },
                  ] as const
                ).map((g) => (
                  <button
                    key={g.key}
                    onClick={() => setTokenGranularity(g.key)}
                    style={{
                      padding: "4px 12px",
                      fontSize: 12,
                      border: "none",
                      background: tokenGranularity === g.key ? "#1e293b" : "transparent",
                      color: tokenGranularity === g.key ? "#3b82f6" : "#64748b",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontWeight: tokenGranularity === g.key ? 600 : 400,
                      transition: "all 0.2s",
                    }}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <ChartCard title="Token 消耗趋势图" option={getTokenTimelineChartOption()} loading={tokenLoading} height={260} />
        </div>

        {/* 拦截监控时间轴 */}
        <div style={{ background: "#020617", border: "1px solid #1e293b", borderRadius: 12, padding: "clamp(12px, 2vw, 24px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#f8fafc" }}>拦截监控时间轴</h3>
              {dashboardStats.interceptTimeline && (
                <span style={{ fontSize: 13, color: "#ef4444", background: "rgba(239, 68, 68, 0.1)", padding: "2px 8px", borderRadius: 6 }}>
                  总计: {dashboardStats.interceptTimeline.totalIntercepts} 次
                </span>
              )}
            </div>
            
            {/* 控制器 */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", width: "100%", justifyContent: "flex-end" }}>
              <div style={{ display: "flex", flexWrap: "wrap", rowGap: 6, background: "#0f172a", borderRadius: 8, padding: 4, border: "1px solid #1e293b", maxWidth: "100%" }}>
                {(["1h", "24h", "7d", "30d"] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setInterceptTimeRange(range)}
                    style={{
                      padding: "4px 12px",
                      fontSize: 12,
                      border: "none",
                      background: interceptTimeRange === range ? "#2a1215" : "transparent", // 微微偏红的选中背景
                      color: interceptTimeRange === range ? "#ef4444" : "#64748b",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontWeight: interceptTimeRange === range ? 600 : 400,
                      transition: "all 0.2s",
                    }}
                  >
                    {range === "1h" ? "1小时" : range === "24h" ? "24小时" : range === "7d" ? "7天" : "30天"}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", rowGap: 6, background: "#0f172a", borderRadius: 8, padding: 4, border: "1px solid #1e293b", maxWidth: "100%" }}>
                {(
                  [
                    { key: "minute", label: "分" },
                    { key: "hour", label: "时" },
                    { key: "day", label: "天" },
                    { key: "week", label: "周" },
                    { key: "month", label: "月" },
                  ] as const
                ).map((g) => (
                  <button
                    key={g.key}
                    onClick={() => setInterceptGranularity(g.key)}
                    style={{
                      padding: "4px 12px",
                      fontSize: 12,
                      border: "none",
                      background: interceptGranularity === g.key ? "#2a1215" : "transparent",
                      color: interceptGranularity === g.key ? "#ef4444" : "#64748b",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontWeight: interceptGranularity === g.key ? 600 : 400,
                      transition: "all 0.2s",
                    }}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <ChartCard title="拦截监控趋势图" option={getInterceptTimelineChartOption()} loading={interceptTimelineLoading} height={260} />
        </div>
      </div>
      
      {/* 添加一个全局 keyframes 供刷新 Loading 动画使用 */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}