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
  const [statsLoading, setStatsLoading] = useState(true);
  const [tokenTimeRange, setTokenTimeRange] = useState<"1h" | "24h" | "7d" | "30d">("24h");
  const [interceptTimeRange, setInterceptTimeRange] = useState<"1h" | "24h" | "7d" | "30d">("24h");
  const [lastCacheTime, setLastCacheTime] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardStats();
  }, [tokenTimeRange, interceptTimeRange]);

  const loadDashboardStats = async (forceRefresh = false) => {
    const now = Date.now();
    
    if (!forceRefresh && cachedStats && (now - cacheTimestamp < CACHE_DURATION)) {
      console.log("[OverviewPanel] 使用缓存数据");
      setDashboardStats(cachedStats);
      setStatsLoading(false);
      const cacheAge = Math.floor((now - cacheTimestamp) / 1000);
      setLastCacheTime(`${cacheAge}秒前`);
      return;
    }

    setStatsLoading(true);
    try {
      const auth = status?.auth?.token;
      const apiBase = (status?.settings?.apiBase || "https://api.clawheart.live").replace(/\/+$/, "");

      if (!auth) {
        console.log("[OverviewPanel] 未登录，跳过加载看板数据");
        setStatsLoading(false);
        return;
      }

      const [skillsRes, dangerRes, interceptRes, tokenRes, interceptTimelineRes] = await Promise.all([
        fetch(`${apiBase}/api/dashboard/skills-stats`, {
          headers: { Authorization: `Bearer ${auth}` },
        }),
        fetch(`${apiBase}/api/dashboard/danger-stats`, {
          headers: { Authorization: `Bearer ${auth}` },
        }),
        fetch(`${apiBase}/api/dashboard/intercept-risk-stats`, {
          headers: { Authorization: `Bearer ${auth}` },
        }),
        fetch(`${apiBase}/api/dashboard/token-usage-timeline?range=${tokenTimeRange}`, {
          headers: { Authorization: `Bearer ${auth}` },
        }),
        fetch(`${apiBase}/api/dashboard/intercept-timeline?range=${interceptTimeRange}`, {
          headers: { Authorization: `Bearer ${auth}` },
        }),
      ]);

      const stats: DashboardStats = {};
      if (skillsRes.ok) stats.skillsStats = await skillsRes.json();
      if (dangerRes.ok) stats.dangerStats = await dangerRes.json();
      if (interceptRes.ok) stats.interceptStats = await interceptRes.json();
      if (tokenRes.ok) stats.tokenTimeline = await tokenRes.json();
      if (interceptTimelineRes.ok) stats.interceptTimeline = await interceptTimelineRes.json();

      cachedStats = stats;
      cacheTimestamp = Date.now();
      setDashboardStats(stats);
      setLastCacheTime("刚刚");
    } catch (e) {
      console.error("加载看板数据失败:", e);
    } finally {
      setStatsLoading(false);
    }
  };

  const getSkillsCategoryChartOption = (): EChartsOption => {
    const data = dashboardStats.skillsStats?.categoryDistribution || [];
    return {
      tooltip: { trigger: "item" },
      legend: { top: "5%", left: "center", textStyle: { color: "#94a3b8" } },
      series: [
        {
          name: "技能分类",
          type: "pie",
          radius: ["40%", "70%"],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 10, borderColor: "#020617", borderWidth: 2 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 14, fontWeight: "bold" } },
          labelLine: { show: false },
          data: data.map((item) => ({ value: item.count, name: item.category })),
        },
      ],
    };
  };

  const getDangerSystemTypeChartOption = (): EChartsOption => {
    const data = dashboardStats.dangerStats?.systemTypeDistribution || [];
    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
      xAxis: { type: "value", axisLabel: { color: "#94a3b8" } },
      yAxis: {
        type: "category",
        data: data.map((item) => item.systemType),
        axisLabel: { color: "#94a3b8" },
      },
      series: [
        {
          name: "数量",
          type: "bar",
          data: data.map((item) => item.count),
          itemStyle: { color: "#3b82f6", borderRadius: [0, 4, 4, 0] },
        },
      ],
    };
  };

  const getDangerRiskLevelChartOption = (): EChartsOption => {
    const data = dashboardStats.dangerStats?.riskLevelDistribution || [];
    const colorMap: Record<string, string> = {
      CRITICAL: "#dc2626",
      HIGH: "#f97316",
      MEDIUM: "#eab308",
      LOW: "#22c55e",
    };
    return {
      tooltip: { trigger: "item" },
      legend: { top: "5%", left: "center", textStyle: { color: "#94a3b8" } },
      series: [
        {
          name: "风险等级",
          type: "pie",
          radius: "60%",
          data: data.map((item) => ({
            value: item.count,
            name: item.riskLevel,
            itemStyle: { color: colorMap[item.riskLevel] || "#64748b" },
          })),
          emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0, 0, 0, 0.5)" } },
        },
      ],
    };
  };

  const getInterceptRiskChartOption = (): EChartsOption => {
    const data = dashboardStats.interceptStats?.riskDistribution || [];
    const colorMap: Record<string, string> = {
      CRITICAL: "#dc2626",
      HIGH: "#f97316",
      MEDIUM: "#eab308",
      LOW: "#22c55e",
    };
    return {
      tooltip: { trigger: "item" },
      legend: { top: "5%", left: "center", textStyle: { color: "#94a3b8" } },
      series: [
        {
          name: "拦截风险",
          type: "pie",
          radius: ["40%", "70%"],
          data: data.map((item) => ({
            value: item.count,
            name: item.riskLevel,
            itemStyle: { color: colorMap[item.riskLevel] || "#64748b" },
          })),
          emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0, 0, 0, 0.5)" } },
        },
      ],
    };
  };

  const getTokenTimelineChartOption = (): EChartsOption => {
    const data = dashboardStats.tokenTimeline?.timeline || [];
    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
      xAxis: {
        type: "category",
        data: data.map((item) => item.time),
        axisLabel: { color: "#94a3b8", rotate: 45 },
      },
      yAxis: { 
        type: "value", 
        axisLabel: { color: "#94a3b8" },
        name: "Tokens",
        nameTextStyle: { color: "#94a3b8" },
      },
      series: [
        {
          name: "Token 消耗",
          type: "bar",
          data: data.map((item) => item.tokens),
          itemStyle: { 
            color: "#3b82f6",
            borderRadius: [4, 4, 0, 0],
          },
          emphasis: {
            itemStyle: { color: "#60a5fa" },
          },
        },
      ],
    };
  };

  const getInterceptTimelineChartOption = (): EChartsOption => {
    const data = dashboardStats.interceptTimeline?.timeline || [];
    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
      xAxis: {
        type: "category",
        data: data.map((item) => item.time),
        axisLabel: { color: "#94a3b8", rotate: 45 },
      },
      yAxis: { 
        type: "value", 
        axisLabel: { color: "#94a3b8" },
        name: "拦截次数",
        nameTextStyle: { color: "#94a3b8" },
      },
      series: [
        {
          name: "拦截次数",
          type: "bar",
          data: data.map((item) => item.count),
          itemStyle: { 
            color: "#ef4444",
            borderRadius: [4, 4, 0, 0],
          },
          emphasis: {
            itemStyle: { color: "#f87171" },
          },
        },
      ],
    };
  };

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        background: "#020617",
        borderRadius: 16,
        padding: "24px 28px",
        border: "1px solid #1f2937",
        boxShadow: "0 20px 40px rgba(15,23,42,0.6)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, margin: "0 0 4px", color: "#f9fafb" }}>ClawHeart 数据看板</h1>
            <p style={{ margin: "4px 0 12px", fontSize: 13, color: "#9ca3af" }}>
              系统运行状态与数据统计概览
            </p>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                padding: "4px 9px",
                borderRadius: 999,
                background: "#0f172a",
                border: "1px solid #1f2937",
                color: "#9ca3af",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: "#22c55e",
                  boxShadow: "0 0 0 4px rgba(34,197,94,0.15)",
                }}
              />
              本地代理运行中
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {lastCacheTime && (
              <span style={{ fontSize: 11, color: "#64748b" }}>
                数据更新于 {lastCacheTime}
              </span>
            )}
            <button
              onClick={() => loadDashboardStats(true)}
              disabled={statsLoading}
              style={{
                padding: "6px 14px",
                fontSize: 12,
                border: "1px solid #334155",
                background: "#0f172a",
                color: "#94a3b8",
                borderRadius: 6,
                cursor: statsLoading ? "not-allowed" : "pointer",
                opacity: statsLoading ? 0.5 : 1,
              }}
            >
              {statsLoading ? "刷新中..." : "刷新数据"}
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <StatCard label="危险指令规则" value={loading ? "…" : status?.danger ?? 0} />
        <StatCard label="系统禁用技能" value={loading ? "…" : status?.disabled ?? 0} />
        <StatCard label="不推荐技能" value={loading ? "…" : status?.deprecated ?? 0} />
        <StatCard
          label="用户禁用技能"
          value={statsLoading ? "…" : dashboardStats.skillsStats?.userDisabledCount ?? 0}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 16, marginBottom: 16 }}>
        <ChartCard
          title="技能分类分布"
          option={getSkillsCategoryChartOption()}
          loading={statsLoading}
          height={280}
        />
        <ChartCard
          title="危险指令风险等级分布"
          option={getDangerRiskLevelChartOption()}
          loading={statsLoading}
          height={280}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 16, marginBottom: 16 }}>
        <ChartCard
          title="危险指令系统类型分布"
          option={getDangerSystemTypeChartOption()}
          loading={statsLoading}
          height={280}
        />
        <ChartCard
          title="拦截日志风险分布"
          option={getInterceptRiskChartOption()}
          loading={statsLoading}
          height={280}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>
              Token 使用趋势
              {dashboardStats.tokenTimeline && (
                <span style={{ marginLeft: 8, fontSize: 12, color: "#64748b", fontWeight: 400 }}>
                  总计: {dashboardStats.tokenTimeline.totalTokens.toLocaleString()} tokens
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(["1h", "24h", "7d", "30d"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTokenTimeRange(range)}
                  style={{
                    padding: "4px 12px",
                    fontSize: 11,
                    border: "1px solid",
                    borderColor: tokenTimeRange === range ? "#3b82f6" : "#334155",
                    background: tokenTimeRange === range ? "#1e3a8a" : "#0f172a",
                    color: tokenTimeRange === range ? "#60a5fa" : "#94a3b8",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  {range === "1h" ? "1小时" : range === "24h" ? "24小时" : range === "7d" ? "7天" : "30天"}
                </button>
              ))}
            </div>
          </div>
          <ChartCard title="" option={getTokenTimelineChartOption()} loading={statsLoading} height={280} />
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>
              拦截日志时间轴
              {dashboardStats.interceptTimeline && (
                <span style={{ marginLeft: 8, fontSize: 12, color: "#64748b", fontWeight: 400 }}>
                  总计: {dashboardStats.interceptTimeline.totalIntercepts} 次
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(["1h", "24h", "7d", "30d"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setInterceptTimeRange(range)}
                  style={{
                    padding: "4px 12px",
                    fontSize: 11,
                    border: "1px solid",
                    borderColor: interceptTimeRange === range ? "#ef4444" : "#334155",
                    background: interceptTimeRange === range ? "#7f1d1d" : "#0f172a",
                    color: interceptTimeRange === range ? "#fca5a5" : "#94a3b8",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  {range === "1h" ? "1小时" : range === "24h" ? "24小时" : range === "7d" ? "7天" : "30天"}
                </button>
              ))}
            </div>
          </div>
          <ChartCard title="" option={getInterceptTimelineChartOption()} loading={statsLoading} height={280} />
        </div>
      </div>
    </div>
  );
}
