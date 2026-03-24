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

function StatCard({ label, value, loading = false }: { label: string; value: number; loading?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      {loading ? (
        <div className="mt-2 h-8 w-20 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
      ) : (
        <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{value}</div>
      )}
    </div>
  );
}

export const DashboardPage = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [skills, setSkills] = useState<SkillsStats | null>(null);
  const [danger, setDanger] = useState<DangerStats | null>(null);
  const [intercept, setIntercept] = useState<InterceptStats | null>(null);
  const [tokenTimeline, setTokenTimeline] = useState<TokenTimeline | null>(null);
  const [interceptTimeline, setInterceptTimeline] = useState<InterceptTimeline | null>(null);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [dangerLoading, setDangerLoading] = useState(true);
  const [interceptLoading, setInterceptLoading] = useState(true);
  const [tokenTimelineLoading, setTokenTimelineLoading] = useState(true);
  const [interceptTimelineLoading, setInterceptTimelineLoading] = useState(true);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [dangerError, setDangerError] = useState<string | null>(null);
  const [interceptError, setInterceptError] = useState<string | null>(null);
  const [tokenTimelineError, setTokenTimelineError] = useState<string | null>(null);
  const [interceptTimelineError, setInterceptTimelineError] = useState<string | null>(null);
  const [range, setRange] = useState<"1h" | "24h" | "7d" | "30d">("24h");
  const [granularity, setGranularity] = useState<"minute" | "hour" | "day" | "week" | "month">("hour");

  const extractErrorMessage = (e: unknown, fallback: string) => {
    const msg =
      e && typeof e === "object" && "response" in e
        ? (e as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message ||
          (e as { response?: { data?: { message?: string; error?: string } } }).response?.data?.error
        : null;
    return msg || fallback;
  };

  const loadSkills = async () => {
    setSkillsLoading(true);
    setSkillsError(null);
    try {
      const res = await api.get<SkillsStats>("/api/dashboard/skills-stats");
      setSkills(res.data);
    } catch (e: unknown) {
      setSkillsError(extractErrorMessage(e, "Skills 数据加载失败"));
    } finally {
      setSkillsLoading(false);
    }
  };

  const loadDanger = async () => {
    setDangerLoading(true);
    setDangerError(null);
    try {
      const res = await api.get<DangerStats>("/api/dashboard/danger-stats");
      setDanger(res.data);
    } catch (e: unknown) {
      setDangerError(extractErrorMessage(e, "危险指令数据加载失败"));
    } finally {
      setDangerLoading(false);
    }
  };

  const loadIntercept = async () => {
    setInterceptLoading(true);
    setInterceptError(null);
    try {
      const res = await api.get<InterceptStats>("/api/dashboard/intercept-risk-stats");
      setIntercept(res.data);
    } catch (e: unknown) {
      setInterceptError(extractErrorMessage(e, "拦截风险数据加载失败"));
    } finally {
      setInterceptLoading(false);
    }
  };

  const loadTokenTimeline = async () => {
    setTokenTimelineLoading(true);
    setTokenTimelineError(null);
    try {
      const res = await api.get<TokenTimeline>(`/api/dashboard/token-usage-timeline?range=${range}&granularity=${granularity}`);
      setTokenTimeline(res.data);
    } catch (e: unknown) {
      setTokenTimelineError(extractErrorMessage(e, "Token 时间线加载失败"));
    } finally {
      setTokenTimelineLoading(false);
    }
  };

  const loadInterceptTimeline = async () => {
    setInterceptTimelineLoading(true);
    setInterceptTimelineError(null);
    try {
      const res = await api.get<InterceptTimeline>(`/api/dashboard/intercept-timeline?range=${range}&granularity=${granularity}`);
      setInterceptTimeline(res.data);
    } catch (e: unknown) {
      setInterceptTimelineError(extractErrorMessage(e, "拦截日志时间线加载失败"));
    } finally {
      setInterceptTimelineLoading(false);
    }
  };

  const loadAll = async () => {
    setRefreshing(true);
    await Promise.all([loadSkills(), loadDanger(), loadIntercept(), loadTokenTimeline(), loadInterceptTimeline()]);
    setRefreshing(false);
  };

  useEffect(() => {
    loadSkills();
    loadDanger();
    loadIntercept();
  }, []);

  useEffect(() => {
    loadTokenTimeline();
  }, [range, granularity]);

  useEffect(() => {
    loadInterceptTimeline();
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
          onClick={loadAll}
          className="text-xs text-slate-500 dark:text-slate-400 hover:text-brand-500 dark:hover:text-brand-400"
        >
          {refreshing ? "刷新中…" : "刷新"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Skills 总数" value={numberOrZero(skills?.totalSkills)} loading={skillsLoading} />
        <StatCard label="危险指令总数" value={numberOrZero(danger?.totalCommands)} loading={dangerLoading} />
        <StatCard label={`${range} Token 用量`} value={numberOrZero(tokenTimeline?.totalTokens)} loading={tokenTimelineLoading} />
        <StatCard label={`${range} 拦截次数`} value={numberOrZero(interceptTimeline?.totalIntercepts)} loading={interceptTimelineLoading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="系统禁用 Skills" value={numberOrZero(skills?.disabledSkills)} loading={skillsLoading} />
        <StatCard label="我禁用的 Skills" value={numberOrZero(skills?.userDisabledCount)} loading={skillsLoading} />
        <StatCard label="我标记安全" value={numberOrZero(skills?.userSafeLabelCount)} loading={skillsLoading} />
        <StatCard label="我标记不安全" value={numberOrZero(skills?.userUnsafeLabelCount)} loading={skillsLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <ChartCard title="Skills 分类分布" option={pieOption(skillCategoryRows, true)} loading={skillsLoading} />
        <ChartCard title="危险指令风险分布" option={pieOption(dangerRiskRows, false)} loading={dangerLoading} />
        <ChartCard title="拦截风险分布" option={pieOption(interceptRiskRows, true)} loading={interceptLoading} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {skillsError && <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs px-3 py-2">{skillsError}</div>}
        {dangerError && <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs px-3 py-2">{dangerError}</div>}
        {interceptError && <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs px-3 py-2">{interceptError}</div>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Token 时间线</h3>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-xs text-slate-500 dark:text-slate-400">时间范围</span>
                {(["1h", "24h", "7d", "30d"] as const).map((r) => (
                  <button
                    key={`token-range-${r}`}
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
              </div>
              {tokenTimelineLoading ? (
                <div className="h-64 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ) : (
                <ReactECharts option={barOption(tokenRows, "#3b82f6")} style={{ height: 260, width: "100%" }} />
              )}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-xs text-slate-500 dark:text-slate-400">粒度</span>
                {(["minute", "hour", "day", "week", "month"] as const).map((g) => (
                  <button
                    key={`token-granularity-${g}`}
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
              {tokenTimelineError && (
                <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs px-3 py-2">
                  {tokenTimelineError}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">拦截日志时间线</h3>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-xs text-slate-500 dark:text-slate-400">时间范围</span>
                {(["1h", "24h", "7d", "30d"] as const).map((r) => (
                  <button
                    key={`intercept-range-${r}`}
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
              </div>
              {interceptTimelineLoading ? (
                <div className="h-64 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ) : (
                <ReactECharts option={barOption(interceptTimelineRows, "#ef4444")} style={{ height: 260, width: "100%" }} />
              )}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-xs text-slate-500 dark:text-slate-400">粒度</span>
                {(["minute", "hour", "day", "week", "month"] as const).map((g) => (
                  <button
                    key={`intercept-granularity-${g}`}
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
              {interceptTimelineError && (
                <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs px-3 py-2">
                  {interceptTimelineError}
                </div>
              )}
            </div>
      </div>
    </div>
  );
};
