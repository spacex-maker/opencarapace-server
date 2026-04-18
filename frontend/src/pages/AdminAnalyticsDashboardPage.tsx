import { useCallback, useEffect, useMemo, useState } from "react";
import * as echarts from "echarts";
import ReactECharts from "echarts-for-react";
import {
  BarChart3,
  CalendarRange,
  Download,
  Loader2,
  MousePointerClick,
  RefreshCw,
  Users,
  Activity,
} from "lucide-react";
import {
  fetchAdminAnalyticsDashboard,
  type AdminAnalyticsDashboard,
} from "../api/client";
import { useTheme } from "../contexts/ThemeContext";

type PresetKey = 7 | 14 | 30 | 90;

function axisColors(isDark: boolean) {
  return {
    text: isDark ? "#94a3b8" : "#64748b",
    line: isDark ? "#334155" : "#e2e8f0",
    split: isDark ? "#1e293b" : "#f1f5f9",
  };
}

export function AdminAnalyticsDashboardPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const ax = useMemo(() => axisColors(isDark), [isDark]);

  const [preset, setPreset] = useState<PresetKey>(14);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [customMode, setCustomMode] = useState(false);

  const [data, setData] = useState<AdminAnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = customMode && customFrom && customTo
        ? await fetchAdminAnalyticsDashboard({ from: customFrom, to: customTo })
        : await fetchAdminAnalyticsDashboard({ days: preset });
      setData(d);
    } catch {
      setError("加载看板数据失败，请稍后重试");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [customMode, customFrom, customTo, preset]);

  useEffect(() => {
    void load();
  }, [load]);

  const dates = useMemo(() => data?.dauAll.map((x) => x.date) ?? [], [data]);

  const engagementOption = useMemo(() => {
    if (!data) return {};
    return {
      textStyle: { color: ax.text },
      tooltip: {
        trigger: "axis",
        backgroundColor: isDark ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.96)",
        borderColor: ax.line,
        textStyle: { color: isDark ? "#e2e8f0" : "#334155" },
      },
      legend: {
        textStyle: { color: ax.text },
        top: 0,
      },
      grid: { left: 48, right: 24, top: 40, bottom: 28 },
      xAxis: {
        type: "category",
        data: dates,
        axisLine: { lineStyle: { color: ax.line } },
        axisLabel: { color: ax.text, fontSize: 11 },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: ax.split } },
        axisLabel: { color: ax.text, fontSize: 11 },
      },
      series: [
        {
          name: "DAU（访客）",
          type: "line",
          smooth: true,
          showSymbol: dates.length < 20,
          data: data.dauAll.map((x) => x.value),
          lineStyle: { width: 2.5, color: "#3b82f6" },
          itemStyle: { color: "#3b82f6" },
        },
        {
          name: "登录用户日活",
          type: "line",
          smooth: true,
          showSymbol: dates.length < 20,
          data: data.dauRegistered.map((x) => x.value),
          lineStyle: { width: 2, color: "#8b5cf6" },
          itemStyle: { color: "#8b5cf6" },
        },
        {
          name: "新增注册",
          type: "bar",
          barMaxWidth: 18,
          data: data.newRegistrations.map((x) => x.value),
          itemStyle: { color: "rgba(16,185,129,0.75)", borderRadius: [4, 4, 0, 0] },
        },
        {
          name: "当日登录人数",
          type: "line",
          smooth: true,
          showSymbol: dates.length < 20,
          data: data.uniqueLoginUsers.map((x) => x.value),
          lineStyle: { width: 2, color: "#f59e0b" },
          itemStyle: { color: "#f59e0b" },
        },
      ],
    };
  }, [data, dates, ax, isDark]);

  const pageViewsOption = useMemo(() => {
    if (!data) return {};
    return {
      textStyle: { color: ax.text },
      tooltip: {
        trigger: "axis",
        backgroundColor: isDark ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.96)",
        borderColor: ax.line,
        textStyle: { color: isDark ? "#e2e8f0" : "#334155" },
      },
      grid: { left: 44, right: 16, top: 16, bottom: 28 },
      xAxis: {
        type: "category",
        data: dates,
        axisLine: { lineStyle: { color: ax.line } },
        axisLabel: { color: ax.text, fontSize: 11 },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: ax.split } },
        axisLabel: { color: ax.text, fontSize: 11 },
      },
      series: [
        {
          name: "page_view",
          type: "bar",
          barMaxWidth: 22,
          data: data.dailyPageViews.map((x) => x.value),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "#6366f1" },
              { offset: 1, color: "#3b82f6" },
            ]),
            borderRadius: [6, 6, 0, 0],
          },
        },
      ],
    };
  }, [data, dates, ax, isDark]);

  const dlPlatformOption = useMemo(() => {
    if (!data) return {};
    return {
      textStyle: { color: ax.text },
      tooltip: {
        trigger: "axis",
        backgroundColor: isDark ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.96)",
        borderColor: ax.line,
        textStyle: { color: isDark ? "#e2e8f0" : "#334155" },
      },
      legend: { textStyle: { color: ax.text }, top: 0 },
      grid: { left: 44, right: 16, top: 36, bottom: 28 },
      xAxis: {
        type: "category",
        data: dates,
        axisLine: { lineStyle: { color: ax.line } },
        axisLabel: { color: ax.text, fontSize: 11 },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: ax.split } },
        axisLabel: { color: ax.text, fontSize: 11 },
      },
      series: [
        {
          name: "Web",
          type: "bar",
          stack: "p",
          barMaxWidth: 28,
          data: data.downloadsByDay.map((x) => x.platformWeb),
          itemStyle: { color: "#3b82f6" },
        },
        {
          name: "Desktop",
          type: "bar",
          stack: "p",
          data: data.downloadsByDay.map((x) => x.platformDesktop),
          itemStyle: { color: "#a855f7" },
        },
        {
          name: "其他",
          type: "bar",
          stack: "p",
          data: data.downloadsByDay.map((x) => x.platformOther),
          itemStyle: { color: "#94a3b8" },
        },
      ],
    };
  }, [data, dates, ax, isDark]);

  const dlTargetOption = useMemo(() => {
    if (!data) return {};
    return {
      textStyle: { color: ax.text },
      tooltip: {
        trigger: "axis",
        backgroundColor: isDark ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.96)",
        borderColor: ax.line,
        textStyle: { color: isDark ? "#e2e8f0" : "#334155" },
      },
      legend: { textStyle: { color: ax.text }, top: 0 },
      grid: { left: 44, right: 16, top: 36, bottom: 28 },
      xAxis: {
        type: "category",
        data: dates,
        axisLine: { lineStyle: { color: ax.line } },
        axisLabel: { color: ax.text, fontSize: 11 },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: ax.split } },
        axisLabel: { color: ax.text, fontSize: 11 },
      },
      series: [
        {
          name: "Windows",
          type: "bar",
          stack: "t",
          barMaxWidth: 28,
          data: data.downloadsByDay.map((x) => x.targetWindows),
          itemStyle: { color: "#0ea5e9" },
        },
        {
          name: "macOS",
          type: "bar",
          stack: "t",
          data: data.downloadsByDay.map((x) => x.targetMac),
          itemStyle: { color: "#10b981" },
        },
        {
          name: "其他/未知",
          type: "bar",
          stack: "t",
          data: data.downloadsByDay.map((x) => x.targetOther),
          itemStyle: { color: "#cbd5e1" },
        },
      ],
    };
  }, [data, dates, ax, isDark]);

  const pieTargetsOption = useMemo(() => {
    if (!data) return {};
    const pieData = data.downloadTargetsInRange
      .filter((x) => x.count > 0)
      .map((x) => ({ name: x.name, value: x.count }));
    return {
      textStyle: { color: ax.text },
      tooltip: {
        trigger: "item",
        backgroundColor: isDark ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.96)",
        borderColor: ax.line,
        textStyle: { color: isDark ? "#e2e8f0" : "#334155" },
      },
      legend: { bottom: 0, textStyle: { color: ax.text }, type: "scroll" },
      series: [
        {
          type: "pie",
          radius: ["38%", "68%"],
          center: ["50%", "46%"],
          itemStyle: { borderRadius: 6, borderColor: isDark ? "#0f172a" : "#fff", borderWidth: 2 },
          label: { color: ax.text, formatter: "{b}\n{d}%", fontSize: 11 },
          data: pieData,
        },
      ],
    };
  }, [data, ax, isDark]);

  const topPagesOption = useMemo(() => {
    if (!data) return {};
    const rows = [...data.topPageViews].reverse();
    return {
      textStyle: { color: ax.text },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: isDark ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.96)",
        borderColor: ax.line,
        textStyle: { color: isDark ? "#e2e8f0" : "#334155" },
      },
      grid: { left: 8, right: 28, top: 8, bottom: 8, containLabel: true },
      xAxis: {
        type: "value",
        splitLine: { lineStyle: { color: ax.split } },
        axisLabel: { color: ax.text, fontSize: 11 },
      },
      yAxis: {
        type: "category",
        data: rows.map((x) => x.name),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: ax.text, fontSize: 11, width: 160, overflow: "truncate" },
      },
      series: [
        {
          type: "bar",
          data: rows.map((x) => x.count),
          barMaxWidth: 18,
          itemStyle: {
            color: "#6366f1",
            borderRadius: [0, 6, 6, 0],
          },
        },
      ],
    };
  }, [data, ax, isDark]);

  const topEventsOption = useMemo(() => {
    if (!data) return {};
    const rows = [...data.topEventNames].reverse();
    return {
      textStyle: { color: ax.text },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: isDark ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.96)",
        borderColor: ax.line,
        textStyle: { color: isDark ? "#e2e8f0" : "#334155" },
      },
      grid: { left: 8, right: 28, top: 8, bottom: 8, containLabel: true },
      xAxis: {
        type: "value",
        splitLine: { lineStyle: { color: ax.split } },
        axisLabel: { color: ax.text, fontSize: 11 },
      },
      yAxis: {
        type: "category",
        data: rows.map((x) => x.name),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: ax.text, fontSize: 11, width: 200, overflow: "truncate" },
      },
      series: [
        {
          type: "bar",
          data: rows.map((x) => x.count),
          barMaxWidth: 16,
          itemStyle: {
            color: "#f59e0b",
            borderRadius: [0, 6, 6, 0],
          },
        },
      ],
    };
  }, [data, ax, isDark]);

  const variantsOption = useMemo(() => {
    if (!data) return {};
    const top = data.downloadVariantsInRange.slice(0, 12);
    return {
      textStyle: { color: ax.text },
      tooltip: {
        trigger: "axis",
        backgroundColor: isDark ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.96)",
        borderColor: ax.line,
        textStyle: { color: isDark ? "#e2e8f0" : "#334155" },
      },
      grid: { left: 40, right: 12, top: 16, bottom: 56, containLabel: false },
      xAxis: {
        type: "category",
        data: top.map((x) => x.name),
        axisLine: { lineStyle: { color: ax.line } },
        axisLabel: { color: ax.text, fontSize: 10, rotate: 28, interval: 0 },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: ax.split } },
        axisLabel: { color: ax.text, fontSize: 11 },
      },
      series: [
        {
          type: "bar",
          data: top.map((x) => x.count),
          barMaxWidth: 26,
          itemStyle: {
            color: "#ec4899",
            borderRadius: [6, 6, 0, 0],
          },
        },
      ],
    };
  }, [data, ax, isDark]);

  const kpi = data?.summary;

  const presetBtn = (d: PresetKey, label: string) => (
    <button
      key={d}
      type="button"
      disabled={loading}
      onClick={() => {
        setCustomMode(false);
        setPreset(d);
      }}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
        !customMode && preset === d
          ? "bg-brand-600 text-white shadow-sm"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400 font-semibold text-sm">
            <BarChart3 className="w-4 h-4" />
            运营看板
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            用户与埋点概览
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
            基于全站埋点日志按北京时间（{data?.timezone ?? "Asia/Shanghai"}）聚合。DAU
            为去重访客（匿名 ID 或用户 ID）；下载量按 Web / Desktop 平台及安装包目标（Windows / macOS）拆分。
            桌面客户端若仅本地上报，可能未计入云端统计。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            刷新
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            <CalendarRange className="w-4 h-4" />
            时间范围
          </div>
          <div className="flex flex-wrap gap-2">
            {presetBtn(7, "近 7 天")}
            {presetBtn(14, "近 14 天")}
            {presetBtn(30, "近 30 天")}
            {presetBtn(90, "近 90 天")}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-700 pt-3 sm:pt-0 sm:pl-4">
            <button
              type="button"
              onClick={() => setCustomMode(true)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                customMode
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              自定义
            </button>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 text-xs px-2 py-1.5 text-slate-800 dark:text-slate-100"
              aria-label="开始日期"
            />
            <span className="text-slate-400 text-xs">至</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 text-xs px-2 py-1.5 text-slate-800 dark:text-slate-100"
              aria-label="结束日期"
            />
            <button
              type="button"
              disabled={loading || !customFrom || !customTo}
              onClick={() => void load()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-white dark:bg-slate-700 disabled:opacity-50"
            >
              应用
            </button>
          </div>
        </div>
        {data ? (
          <div className="text-xs text-slate-500 dark:text-slate-400">
            当前区间：<span className="font-mono font-medium text-slate-700 dark:text-slate-200">{data.fromDate}</span>
            {" — "}
            <span className="font-mono font-medium text-slate-700 dark:text-slate-200">{data.toDate}</span>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {kpi ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {[
            {
              label: "埋点事件总数",
              value: kpi.totalTrackedEvents,
              icon: Activity,
              accent: "from-sky-500/15 to-transparent",
            },
            {
              label: "页面浏览 (page_view)",
              value: kpi.totalPageViews,
              icon: MousePointerClick,
              accent: "from-violet-500/15 to-transparent",
            },
            {
              label: "下载点击",
              value: kpi.totalDownloadClicks,
              icon: Download,
              accent: "from-emerald-500/15 to-transparent",
            },
            {
              label: "独立访客（匿名 ID）",
              value: kpi.distinctAnonymousInRange,
              icon: Users,
              accent: "from-amber-500/15 to-transparent",
            },
            {
              label: "有事件的用户数",
              value: kpi.distinctUsersWithAnyEventInRange,
              icon: Users,
              accent: "from-brand-500/15 to-transparent",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-5 shadow-sm"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${card.accent} pointer-events-none`} />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {card.label}
                  </div>
                  <div className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                    {card.value.toLocaleString("zh-CN")}
                  </div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                  <card.icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center justify-center py-24 text-slate-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          加载中…
        </div>
      ) : null}

      {data && !loading ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4 sm:p-6 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-1">用户活跃与转化</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              DAU（访客）· 登录用户日活 · 新增注册 · 当日登录人数（auth_login_success 去重）
            </p>
            <ReactECharts option={engagementOption} style={{ height: 360 }} notMerge lazyUpdate />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4 sm:p-6 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-1">每日页面浏览量</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">事件 page_view 计数</p>
              <ReactECharts option={pageViewsOption} style={{ height: 300 }} notMerge lazyUpdate />
            </div>
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4 sm:p-6 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-1">下载：平台拆分（日）</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Web 官网 vs Desktop 客户端上报</p>
              <ReactECharts option={dlPlatformOption} style={{ height: 300 }} notMerge lazyUpdate />
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4 sm:p-6 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-1">下载：安装包目标（日）</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">埋点字段 target（windows / mac）</p>
              <ReactECharts option={dlTargetOption} style={{ height: 300 }} notMerge lazyUpdate />
            </div>
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4 sm:p-6 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-1">下载目标占比（区间累计）</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Windows / macOS / 其他</p>
              <ReactECharts option={pieTargetsOption} style={{ height: 300 }} notMerge lazyUpdate />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4 sm:p-6 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-1">下载变体 Top（区间）</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">完整版 / Core、Intel / Apple Silicon 等 variant 字段</p>
            <ReactECharts option={variantsOption} style={{ height: 320 }} notMerge lazyUpdate />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4 sm:p-6 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-1">页面访问 Top</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">page_view 的 pageId 分布</p>
              <ReactECharts option={topPagesOption} style={{ height: 380 }} notMerge lazyUpdate />
            </div>
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4 sm:p-6 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-1">事件名 Top</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">区间内所有埋点事件频次</p>
              <ReactECharts option={topEventsOption} style={{ height: 380 }} notMerge lazyUpdate />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
