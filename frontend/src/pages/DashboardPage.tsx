import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

type NamedCount = { [key: string]: string | number };

type SkillsStats = {
  totalSkills: number;
  activeSkills: number;
  deprecatedSkills: number;
  disabledSkills: number;
  userDisabledCount: number;
  userSafeLabelCount: number;
  userUnsafeLabelCount: number;
  totalSafeMarks: number;
  totalUnsafeMarks: number;
  categoryDistribution: NamedCount[];
  typeDistribution: NamedCount[];
};

type DangerStats = {
  totalCommands: number;
  enabledCommands: number;
  riskLevelDistribution: NamedCount[];
  categoryDistribution: NamedCount[];
  systemTypeDistribution: NamedCount[];
};

type InterceptStats = {
  totalIntercepts: number;
  riskDistribution: NamedCount[];
  verdictDistribution: NamedCount[];
};

type TokenTimeline = {
  totalTokens: number;
  timeline?: Array<{ time: string; tokens: number }>;
};

type InterceptTimeline = {
  totalIntercepts: number;
  timeline?: Array<{ time: string; count: number }>;
};

function numberOrZero(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function toNameCount(
  rows: NamedCount[] | undefined,
  nameKey: string,
  valueKey: string,
): Array<{ name: string; count: number }> {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => ({
      name: String(r?.[nameKey] ?? "未知"),
      count: numberOrZero(r?.[valueKey]),
    }))
    .sort((a, b) => b.count - a.count);
}

function ChartCard({ title, option, loading = false }: { title: string; option: EChartsOption; loading?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-4">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{title}</h3>
      {loading ? (
        <div className="h-64 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
      ) : (
        <ReactECharts option={option} style={{ height: 260, width: "100%" }} />
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}

export const DashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skills, setSkills] = useState<SkillsStats | null>(null);
  const [danger, setDanger] = useState<DangerStats | null>(null);
  const [intercept, setIntercept] = useState<InterceptStats | null>(null);
  const [tokenTimeline, setTokenTimeline] = useState<TokenTimeline | null>(null);
  const [interceptTimeline, setInterceptTimeline] = useState<InterceptTimeline | null>(null);
  const [range, setRange] = useState<"1h" | "24h" | "7d" | "30d">("24h");
  const [granularity, setGranularity] = useState<"minute" | "hour" | "day" | "week" | "month">("hour");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [skillsRes, dangerRes, interceptRes, tokenRes, interceptTimelineRes] = await Promise.all([
        api.get<SkillsStats>("/api/dashboard/skills-stats"),
        api.get<DangerStats>("/api/dashboard/danger-stats"),
        api.get<InterceptStats>("/api/dashboard/intercept-risk-stats"),
        api.get<TokenTimeline>(`/api/dashboard/token-usage-timeline?range=${range}&granularity=${granularity}`),
        api.get<InterceptTimeline>(`/api/dashboard/intercept-timeline?range=${range}&granularity=${granularity}`),
      ]);
      setSkills(skillsRes.data);
      setDanger(dangerRes.data);
      setIntercept(interceptRes.data);
      setTokenTimeline(tokenRes.data);
      setInterceptTimeline(interceptTimelineRes.data);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message ||
            (e as { response?: { data?: { message?: string; error?: string } } }).response?.data?.error
          : null;
      setError(msg || "加载看板数据失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [range, granularity]);

  const skillCategoryRows = useMemo(
    () => toNameCount(skills?.categoryDistribution, "category", "count"),
    [skills?.categoryDistribution],
  );
  const dangerRiskRows = useMemo(
    () => toNameCount(danger?.riskLevelDistribution, "riskLevel", "count"),
    [danger?.riskLevelDistribution],
  );
  const interceptRiskRows = useMemo(
    () => toNameCount(intercept?.riskDistribution, "riskLevel", "count"),
    [intercept?.riskDistribution],
  );
  const tokenRows = useMemo(
    () =>
      Array.isArray(tokenTimeline?.timeline)
        ? tokenTimeline.timeline.map((t) => ({ name: String(t.time), count: numberOrZero(t.tokens) }))
        : [],
    [tokenTimeline?.timeline],
  );
  const interceptTimelineRows = useMemo(
    () =>
      Array.isArray(interceptTimeline?.timeline)
        ? interceptTimeline.timeline.map((t) => ({ name: String(t.time), count: numberOrZero(t.count) }))
        : [],
    [interceptTimeline?.timeline],
  );
  const pieOption = (rows: Array<{ name: string; count: number }>, donut = true): EChartsOption => ({
    tooltip: { trigger: "item" },
    legend: { bottom: 0, textStyle: { color: "#94a3b8", fontSize: 11 } },
    series: [
      {
        type: "pie",
        radius: donut ? ["45%", "75%"] : "70%",
        center: ["50%", "45%"],
        data: rows.map((r) => ({ name: r.name, value: r.count })),
        label: { color: "#94a3b8", fontSize: 11 },
      },
    ],
  });
  const barOption = (rows: Array<{ name: string; count: number }>, color: string): EChartsOption => ({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
    xAxis: {
      type: "category",
      data: rows.map((r) => r.name),
      axisLabel: { color: "#94a3b8", rotate: rows.length > 8 ? 35 : 0, hideOverlap: true },
      axisLine: { lineStyle: { color: "#334155" } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#94a3b8" },
      splitLine: { lineStyle: { color: "#1e293b", type: "dashed" } },
    },
    series: [
      {
        type: "bar",
        data: rows.map((r) => r.count),
        itemStyle: { color, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 24,
      },
    ],
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">概览看板</h2>
        <button
          type="button"
          onClick={load}
          className="text-xs text-slate-500 dark:text-slate-400 hover:text-brand-500 dark:hover:text-brand-400"
        >
          刷新
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm px-3 py-2">
          {error}
        </div>
      )}
      {loading && <div className="text-sm text-slate-500 dark:text-slate-400">加载中…</div>}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Skills 总数" value={numberOrZero(skills?.totalSkills)} />
            <StatCard label="危险指令总数" value={numberOrZero(danger?.totalCommands)} />
            <StatCard label={`${range} Token 用量`} value={numberOrZero(tokenTimeline?.totalTokens)} />
            <StatCard label={`${range} 拦截次数`} value={numberOrZero(interceptTimeline?.totalIntercepts)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="系统禁用 Skills" value={numberOrZero(skills?.disabledSkills)} />
            <StatCard label="我禁用的 Skills" value={numberOrZero(skills?.userDisabledCount)} />
            <StatCard label="我标记安全" value={numberOrZero(skills?.userSafeLabelCount)} />
            <StatCard label="我标记不安全" value={numberOrZero(skills?.userUnsafeLabelCount)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <ChartCard title="Skills 分类分布" option={pieOption(skillCategoryRows, true)} loading={loading} />
            <ChartCard title="危险指令风险分布" option={pieOption(dangerRiskRows, false)} loading={loading} />
            <ChartCard title="拦截风险分布" option={pieOption(interceptRiskRows, true)} loading={loading} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-4">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mr-2">Token 时间线</h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">时间范围</span>
                {(["1h", "24h", "7d", "30d"] as const).map((r) => (
                  <button
                    key={`token-${r}`}
                    type="button"
                    onClick={() => setRange(r)}
                    className={`px-2.5 py-1 rounded text-xs border ${
                      range === r
                        ? "border-brand-500 text-brand-600 dark:text-brand-400 bg-brand-500/10"
                        : "border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {r}
                  </button>
                ))}
                <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">粒度</span>
                {(["minute", "hour", "day", "week", "month"] as const).map((g) => (
                  <button
                    key={`token-${g}`}
                    type="button"
                    onClick={() => setGranularity(g)}
                    className={`px-2.5 py-1 rounded text-xs border ${
                      granularity === g
                        ? "border-brand-500 text-brand-600 dark:text-brand-400 bg-brand-500/10"
                        : "border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              {loading ? (
                <div className="h-64 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ) : (
                <ReactECharts option={barOption(tokenRows, "#3b82f6")} style={{ height: 260, width: "100%" }} />
              )}
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-4">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mr-2">拦截日志时间线</h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">时间范围</span>
                {(["1h", "24h", "7d", "30d"] as const).map((r) => (
                  <button
                    key={`intercept-${r}`}
                    type="button"
                    onClick={() => setRange(r)}
                    className={`px-2.5 py-1 rounded text-xs border ${
                      range === r
                        ? "border-brand-500 text-brand-600 dark:text-brand-400 bg-brand-500/10"
                        : "border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {r}
                  </button>
                ))}
                <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">粒度</span>
                {(["minute", "hour", "day", "week", "month"] as const).map((g) => (
                  <button
                    key={`intercept-${g}`}
                    type="button"
                    onClick={() => setGranularity(g)}
                    className={`px-2.5 py-1 rounded text-xs border ${
                      granularity === g
                        ? "border-brand-500 text-brand-600 dark:text-brand-400 bg-brand-500/10"
                        : "border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              {loading ? (
                <div className="h-64 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ) : (
                <ReactECharts option={barOption(interceptTimelineRows, "#ef4444")} style={{ height: 260, width: "100%" }} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
