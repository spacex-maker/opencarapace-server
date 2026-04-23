import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Shield,
  KeyRound,
  ArrowRight,
  BookOpen,
  Moon,
  Sun,
  LogOut,
  LayoutDashboard,
  ShieldAlert,
  Settings,
  ReceiptText,
  FileText,
  Zap,
  Lock,
  Server,
  Sparkles,
  Activity,
  Users,
  Eye,
  Cpu,
  ChevronRight,
  Monitor,
  Package,
  Download,
  Layers,
  Gauge,
  Apple,
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { fetchPublicSocialMedia, type SocialMediaItem } from "../api/client";
import { SocialMediaModule } from "../components/SocialMediaModule";

const USER_MODULES = [
  {
    icon: LayoutDashboard,
    title: "数据概览",
    desc: "技能、危险指令、拦截与 Token 等多维统计与趋势，掌握运行健康度。",
  },
  {
    icon: BookOpen,
    title: "我的技能",
    desc: "工具 / Skill 画像、启用与偏好，与全局技能库联动。",
  },
  {
    icon: ShieldAlert,
    title: "我的危险指令",
    desc: "个人视角下的风险规则与提示，叠加全局策略。",
  },
  {
    icon: KeyRound,
    title: "API Keys",
    desc: "密钥创建、轮换与吊销，对接 Agent 与自动化流水线。",
  },
  {
    icon: Shield,
    title: "拦截日志",
    desc: "LLM 代理侧阻断记录：类型、风险、原因与原文可追溯。",
  },
  {
    icon: ReceiptText,
    title: "Token 账单",
    desc: "用量与成本可查，便于配额与预算治理。",
  },
  {
    icon: Settings,
    title: "用户设置",
    desc: "含 LLM 路由模式等偏好，支持经 ClawHeart 网关或直连上游。",
  },
];

const ADMIN_MODULES = [
  { title: "全局技能", desc: "跨用户技能元数据与同步策略（如 ClawHub 等来源）。" },
  { title: "全局危险指令", desc: "系统级规则库、分类与风险等级，支撑全站拦截。" },
  { title: "系统配置", desc: "键值与分组配置，驱动同步、网关与安全参数。" },
  { title: "全站拦截日志", desc: "跨用户审计与高级筛选：用户、时间、类型、关键词。" },
  { title: "埋点管理", desc: "产品事件查询与筛选（管理员），用于体验与稳定性分析。" },
];

const PILLARS = [
  {
    icon: Zap,
    title: "统一安全层",
    body: "在工具调用与对话到达执行前完成评估：可执行、阻断或扩展为人工审核。",
  },
  {
    icon: Lock,
    title: "双鉴权体系",
    body: "JWT 登录与 X-OC-API-KEY 并行，人机与机机调用各得其所。",
  },
  {
    icon: Activity,
    title: "可观测闭环",
    body: "拦截、用量与配置变更可追溯，满足审计与排障。",
  },
];

/** 与当前 ClawHeart Desktop 能力对齐（内置 / 外置 OpenClaw、Node、Gateway） */
const DESKTOP_FEATURES = [
  "本地 HTTP 服务（默认 127.0.0.1:19111），OpenAI 兼容路径；SDK 只需改 Base URL。",
  "OpenClaw 双形态：内置（安装包集成）与外置（独立 npm 前缀、专用 Node 目录与本机 PATH 协同）。",
  "Gateway 启停、诊断日志、Dashboard 外链；Windows / macOS 安装包与下载页变体可选（如 Core）。",
  "危险指令与 Skills：系统规则 + 用户偏好、本地拦截并写拦截日志；看板可与云端控制台联动。",
  "设置中心：云端基地址与 OC API Key、LLM 路由（经 ClawHeart / 直连上游）及前缀映射。",
];

const OPENCLAW_HIGHLIGHTS = [
  "内置模式：打包内 OpenClaw 与运行时 Node，降低本机环境门槛；一键启停 Gateway。",
  "外置模式：ClawHeart 管理的 npm 前缀与本机 PATH 解析；外置专用 Node 目录可选下载。",
  "可将 OpenClaw 上游指向 ClawHeart 网关或本地 19111，使 Agent 走同一套安全策略。",
];

const HERO_STATS = [
  {
    k: "8+",
    v: "用户侧模块",
    sub: "概览 · 技能 · 危险指令 · 密钥等",
    className:
      "bg-sky-50/90 border-sky-200/70 dark:bg-sky-950/35 dark:border-sky-800/60 text-sky-950 dark:text-sky-100",
    accentClass: "text-sky-600 dark:text-sky-400",
  },
  {
    k: "5",
    v: "管理员入口",
    sub: "全局库 · 配置 · 日志 · 埋点",
    className:
      "bg-violet-50/90 border-violet-200/70 dark:bg-violet-950/35 dark:border-violet-800/60 text-violet-950 dark:text-violet-100",
    accentClass: "text-violet-600 dark:text-violet-400",
  },
  {
    k: "双通道",
    v: "鉴权与接入",
    sub: "JWT + API Key",
    className:
      "bg-emerald-50/90 border-emerald-200/70 dark:bg-emerald-950/35 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-100",
    accentClass: "text-emerald-600 dark:text-emerald-400",
  },
  {
    k: "全链路",
    v: "拦截与用量",
    sub: "日志 · Token · 可审计",
    className:
      "bg-amber-50/90 border-amber-200/70 dark:bg-amber-950/40 dark:border-amber-800/60 text-amber-950 dark:text-amber-100",
    accentClass: "text-amber-700 dark:text-amber-400",
  },
  {
    k: "双形态",
    v: "OpenClaw",
    sub: "内置包 / 外置 prefix",
    className:
      "bg-rose-50/90 border-rose-200/70 dark:bg-rose-950/35 dark:border-rose-800/60 text-rose-950 dark:text-rose-100",
    accentClass: "text-rose-600 dark:text-rose-400",
  },
] as const;

const PILLAR_STYLES = [
  {
    surface:
      "bg-gradient-to-br from-emerald-100/95 to-white dark:from-emerald-950/35 dark:to-slate-900/85 shadow-[0_18px_40px_-18px_rgba(16,185,129,0.45)]",
    clipPath: "polygon(0 8%, 9% 0, 100% 0, 100% 88%, 91% 100%, 0 100%)",
    offset: "md:-translate-y-2",
  },
  {
    surface:
      "bg-gradient-to-br from-violet-100/95 to-white dark:from-violet-950/35 dark:to-slate-900/85 shadow-[0_18px_40px_-18px_rgba(139,92,246,0.45)]",
    clipPath: "polygon(0 0, 92% 0, 100% 14%, 100% 100%, 8% 100%, 0 86%)",
    offset: "md:translate-y-2",
  },
  {
    surface:
      "bg-gradient-to-br from-amber-100/95 to-white dark:from-amber-950/35 dark:to-slate-900/85 shadow-[0_18px_40px_-18px_rgba(245,158,11,0.45)]",
    clipPath: "polygon(0 12%, 7% 0, 100% 0, 100% 92%, 93% 100%, 0 100%)",
    offset: "md:-translate-y-1",
  },
] as const;

const USER_BENTO_LAYOUT: { span: string; tint: string; iconWrap: string; clipPath: string }[] = [
  {
    span: "lg:col-span-5 lg:row-span-2 lg:row-start-1 lg:col-start-1 min-h-[200px]",
    tint: "bg-gradient-to-br from-sky-500/[0.08] via-white to-cyan-500/[0.06] dark:from-sky-500/15 dark:via-slate-900 dark:to-cyan-950/20",
    iconWrap: "bg-sky-500/15 text-sky-700 dark:bg-sky-500/25 dark:text-sky-300",
    clipPath: "polygon(0 6%, 7% 0, 100% 0, 100% 92%, 93% 100%, 0 100%)",
  },
  {
    span: "lg:col-span-3 lg:row-start-1 lg:col-start-6",
    tint: "bg-indigo-50/80 dark:bg-indigo-950/25",
    iconWrap: "bg-indigo-500/15 text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-300",
    clipPath: "polygon(0 0, 92% 0, 100% 18%, 100% 100%, 8% 100%, 0 82%)",
  },
  {
    span: "lg:col-span-4 lg:row-start-1 lg:col-start-9",
    tint: "bg-orange-50/85 dark:bg-orange-950/20",
    iconWrap: "bg-orange-500/15 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300",
    clipPath: "polygon(0 14%, 10% 0, 100% 0, 100% 86%, 90% 100%, 0 100%)",
  },
  {
    span: "lg:col-span-3 lg:row-start-2 lg:col-start-6",
    tint: "bg-fuchsia-50/80 dark:bg-fuchsia-950/20",
    iconWrap: "bg-fuchsia-500/15 text-fuchsia-800 dark:bg-fuchsia-500/20 dark:text-fuchsia-300",
    clipPath: "polygon(0 10%, 8% 0, 100% 0, 100% 90%, 92% 100%, 0 100%)",
  },
  {
    span: "lg:col-span-4 lg:row-start-2 lg:col-start-9",
    tint: "bg-teal-50/85 dark:bg-teal-950/25",
    iconWrap: "bg-teal-500/15 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300",
    clipPath: "polygon(0 0, 94% 0, 100% 24%, 100% 100%, 6% 100%, 0 76%)",
  },
  {
    span: "lg:col-span-6 lg:row-start-3 lg:col-start-1",
    tint: "bg-amber-50/80 dark:bg-amber-950/20",
    iconWrap: "bg-amber-500/15 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300",
    clipPath: "polygon(0 8%, 5% 0, 100% 0, 100% 92%, 95% 100%, 0 100%)",
  },
  {
    span: "lg:col-span-6 lg:row-start-3 lg:col-start-7",
    tint: "bg-slate-100/90 dark:bg-slate-800/40",
    iconWrap: "bg-slate-600/15 text-slate-800 dark:bg-slate-500/20 dark:text-slate-200",
    clipPath: "polygon(0 0, 96% 0, 100% 22%, 100% 100%, 4% 100%, 0 78%)",
  },
];

const PRODUCT_STRIP = [
  { icon: Monitor, label: "ClawHeart Desktop", sub: "Windows · macOS" },
  { icon: Layers, label: "Web 控制台", sub: "同账号策略与看板" },
  { icon: Gauge, label: "19111 本地代理", sub: "OpenAI 兼容" },
  { icon: Package, label: "OpenClaw", sub: "内置 / 外置" },
];

export const OfficialIntroPage = () => {
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, user, logout } = useAuth();
  const [socialItems, setSocialItems] = useState<SocialMediaItem[]>([]);

  useEffect(() => {
    fetchPublicSocialMedia()
      .then((rows) => setSocialItems(Array.isArray(rows) ? rows : []))
      .catch(() => setSocialItems([]));
  }, []);

  return (
    <div
      className="intro-root min-h-screen flex flex-col antialiased transition-colors duration-200"
      style={{
        backgroundColor: "var(--intro-bg)",
        color: "var(--intro-text)",
      }}
    >
      <header
        className="shrink-0 sticky top-0 z-50 h-14 backdrop-blur-xl transition-colors duration-200 border-b"
        style={{
          backgroundColor: "var(--intro-header-bg)",
          borderColor: "var(--intro-border)",
        }}
      >
        <div className="max-w-6xl mx-auto h-full px-4 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2.5 hover:opacity-90 transition-opacity"
            style={{ color: "var(--intro-text)" }}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-500/25">
              <Shield className="w-[18px] h-[18px] text-white" strokeWidth={2.2} />
            </div>
            <div className="leading-tight">
              <span className="font-semibold tracking-tight text-[15px]">ClawHeart</span>
              <span
                className="hidden sm:block text-[10px] uppercase tracking-[0.2em]"
                style={{ color: "var(--intro-text-subtle)" }}
              >
                Agent Security
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-0.5 sm:gap-1">
            <Link
              to="/download"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              style={{ color: "var(--intro-text-muted)" }}
            >
              <Download className="w-4 h-4" />
              下载
            </Link>
            {isAuthenticated && user ? (
              <>
                <Link
                  to="/dashboard"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  style={{ color: "var(--intro-text-muted)" }}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  控制台
                </Link>
                <span
                  className="max-w-[120px] sm:max-w-[180px] truncate px-2 text-sm"
                  style={{ color: "var(--intro-text-subtle)" }}
                  title={user.email}
                >
                  {user.displayName || user.email}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  style={{ color: "var(--intro-text-muted)" }}
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">登出</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3 py-2 rounded-full text-sm transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  style={{ color: "var(--intro-text-muted)" }}
                >
                  登录
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 rounded-full text-sm font-medium bg-brand-600 text-white hover:bg-brand-500 shadow-md shadow-brand-600/20"
                >
                  注册
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 rounded-full transition-colors hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
              style={{ color: "var(--intro-text-subtle)" }}
              title={theme === "dark" ? "明亮模式" : "暗黑模式"}
            >
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      <main id="intro-top" className="flex-1 w-full scroll-mt-14">
        <section
          className="relative overflow-hidden border-b transition-colors duration-200"
          style={{ borderColor: "var(--intro-border-soft)" }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-35"
            style={{
              backgroundImage: `radial-gradient(at 40% 20%, var(--intro-mesh-a) 0px, transparent 50%),
                radial-gradient(at 80% 0%, var(--intro-mesh-b) 0px, transparent 45%),
                radial-gradient(at 0% 50%, var(--intro-mesh-c) 0px, transparent 40%)`,
            }}
          />
          <div
            className="absolute inset-0 bg-[length:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent)]"
            style={{
              backgroundImage: `linear-gradient(to right, var(--intro-grid-line) 1px, transparent 1px),
                linear-gradient(to bottom, var(--intro-grid-line) 1px, transparent 1px)`,
            }}
          />

          <div className="relative max-w-6xl mx-auto px-4 pt-14 pb-20 md:pt-20 md:pb-28">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-start">
              <div className="lg:col-span-7 max-w-3xl">
                <p
                  className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] backdrop-blur-sm transition-colors"
                  style={{
                    borderColor: "var(--intro-border)",
                    backgroundColor: "var(--intro-bg-elevated)",
                    color: "var(--intro-text-muted)",
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  面向自主 Agent 的安全外壳
                </p>
                <h1 className="mt-6 text-4xl sm:text-5xl md:text-[3.25rem] font-semibold tracking-tight leading-[1.1]">
                  让每一次
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-violet-600 dark:from-brand-400 dark:to-violet-400">
                    工具调用
                  </span>
                  <br className="hidden sm:block" />
                  都可被看见、被治理、被信任
                </h1>
                <p className="mt-6 text-base sm:text-lg leading-relaxed max-w-2xl" style={{ color: "var(--intro-text-muted)" }}>
                  ClawHeart 在 LLM 与执行层之间插入统一策略：危险指令、技能库、拦截与用量全链路留痕。
                  <span className="font-semibold" style={{ color: "var(--intro-text)" }}>
                    {" "}
                    网页控制台
                  </span>
                  与
                  <span className="font-semibold" style={{ color: "var(--intro-text)" }}>
                    {" "}
                    桌面客户端
                  </span>
                  （内置或外置 OpenClaw、本地 Gateway）共用账号与策略模型，适配 OpenClaw、自研 Agent 与企业自动化。
                </p>
                <div className="mt-10 flex flex-wrap items-center gap-3">
                  <Link
                    to={isAuthenticated ? "/dashboard" : "/register"}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold shadow-lg shadow-brand-600/25 transition-colors"
                  >
                    {isAuthenticated ? "进入控制台" : "免费开始使用"}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to="/download"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full border text-sm font-medium transition-colors"
                    style={{
                      borderColor: "var(--intro-border)",
                      color: "var(--intro-text)",
                      backgroundColor: "var(--intro-bg-elevated)",
                    }}
                  >
                    <Download className="w-4 h-4" />
                    下载桌面端
                  </Link>
                  <Link
                    to="/docs"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-transparent text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    <FileText className="w-4 h-4" />
                    API 与集成
                  </Link>
                </div>

                <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {PRODUCT_STRIP.map((p) => (
                    <div
                      key={p.label}
                      className="rounded-xl border px-3 py-3 flex gap-2.5 items-start transition-colors"
                      style={{
                        borderColor: "var(--intro-border-soft)",
                        backgroundColor: "var(--intro-bg-elevated)",
                      }}
                    >
                      <div className="shrink-0 mt-0.5 text-brand-600 dark:text-brand-400">
                        <p.icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold leading-tight" style={{ color: "var(--intro-text)" }}>
                          {p.label}
                        </div>
                        <div className="text-[10px] mt-0.5 leading-snug" style={{ color: "var(--intro-text-subtle)" }}>
                          {p.sub}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hidden lg:flex lg:col-span-5 flex-col gap-4">
                <div className="rounded-[1.75rem] border border-brand-200/60 dark:border-brand-500/25 bg-gradient-to-br from-brand-500/15 via-violet-500/10 to-fuchsia-500/10 dark:from-brand-500/20 dark:via-violet-600/15 dark:to-fuchsia-900/20 p-6 shadow-lg shadow-brand-500/5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-700 dark:text-brand-300">
                    策略平面
                  </p>
                  <p className="mt-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    云端与桌面共用策略与账号：配置一次，在 19111 与控制台侧一致生效。
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {["拦截", "Skills", "用量", "审计"].map((t) => (
                      <span
                        key={t}
                        className="rounded-full border px-3 py-1 text-[11px] font-medium bg-white/70 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-emerald-200/70 dark:border-emerald-800/50 bg-emerald-500/10 dark:bg-emerald-950/30 p-4 min-h-[100px] flex flex-col justify-end">
                    <span className="text-2xl font-bold tabular-nums text-emerald-800 dark:text-emerald-300">19111</span>
                    <span className="text-[11px] text-emerald-900/80 dark:text-emerald-400/90 mt-1">本地 OpenAI 兼容入口</span>
                  </div>
                  <div className="rounded-2xl border border-violet-200/70 dark:border-violet-800/50 bg-violet-500/10 dark:bg-violet-950/30 p-4 min-h-[100px] flex flex-col justify-between">
                    <Cpu className="w-6 h-6 text-violet-600 dark:text-violet-400 opacity-80" />
                    <span className="text-[11px] font-medium text-violet-900 dark:text-violet-200 leading-snug">
                      网关 · 直连 · 前缀映射
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-16 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              {HERO_STATS.map((s) => (
                <div
                  key={s.v}
                  className={`rounded-2xl border px-4 py-4 shadow-sm backdrop-blur-sm transition-transform hover:-translate-y-0.5 hover:shadow-md ${s.className}`}
                >
                  <div className={`text-2xl sm:text-3xl font-semibold tabular-nums ${s.accentClass}`}>{s.k}</div>
                  <div className="mt-1 text-sm font-medium opacity-95">{s.v}</div>
                  <div className="mt-1.5 text-[11px] leading-snug opacity-75 dark:opacity-70">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 主页显眼：客户端下载 */}
        <section
          className="border-b transition-colors duration-200"
          style={{
            borderColor: "var(--intro-border-soft)",
            backgroundColor: "var(--intro-bg-elevated)",
          }}
        >
          <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">
                  ClawHeart Desktop
                </p>
                <h2 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight" style={{ color: "var(--intro-text)" }}>
                  客户端下载
                </h2>
                <p className="mt-3 text-sm md:text-base max-w-2xl leading-relaxed" style={{ color: "var(--intro-text-muted)" }}>
                  Windows x64 与 macOS 安装包（完整版内置 OpenClaw；另有 Core 等变体）。点击下方平台卡片或「进入下载页」查看全部链接与说明。
                </p>
              </div>
              <Link
                to="/download"
                className="inline-flex items-center justify-center gap-2 shrink-0 px-6 py-3 rounded-full bg-brand-600 text-white text-sm font-semibold hover:bg-brand-500 shadow-lg shadow-brand-600/25 transition-colors"
              >
                <Download className="w-4 h-4" />
                进入下载页
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 md:gap-5">
              <Link
                to="/download"
                className="group flex gap-4 md:gap-5 rounded-2xl border p-5 md:p-6 text-left transition-all hover:shadow-xl hover:-translate-y-0.5"
                style={{
                  borderColor: "var(--intro-border)",
                  backgroundColor: "var(--intro-bg)",
                  color: "var(--intro-text)",
                }}
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-500/12 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                  <Monitor className="w-7 h-7" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-semibold">Windows</div>
                  <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--intro-text-muted)" }}>
                    x64 · NSIS 安装程序；可选完整版（内置 OpenClaw）或 Core 版等。
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 dark:text-brand-400 group-hover:underline">
                    前往选择安装包
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
              <Link
                to="/download"
                className="group flex gap-4 md:gap-5 rounded-2xl border p-5 md:p-6 text-left transition-all hover:shadow-xl hover:-translate-y-0.5"
                style={{
                  borderColor: "var(--intro-border)",
                  backgroundColor: "var(--intro-bg)",
                  color: "var(--intro-text)",
                }}
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-500/12 text-slate-700 dark:bg-slate-400/25 dark:text-slate-200">
                  <Apple className="w-7 h-7" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-semibold">macOS</div>
                  <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--intro-text-muted)" }}>
                    Intel 与 Apple Silicon（M 系列）DMG；与下载页环境变量配置一致。
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 dark:text-brand-400 group-hover:underline">
                    前往选择架构
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            </div>
          </div>
        </section>

        <section
          className="relative border-y overflow-hidden transition-colors duration-200"
          style={{ borderColor: "var(--intro-border-soft)" }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-40"
            style={{
              background: `linear-gradient(105deg, rgba(16,185,129,0.08) 0%, transparent 32%),
                linear-gradient(-15deg, rgba(139,92,246,0.07) 20%, transparent 45%),
                linear-gradient(180deg, rgba(251,191,36,0.06), transparent 55%)`,
            }}
          />
          <div className="relative max-w-6xl mx-auto px-4 py-16 md:py-24">
            <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700/80 dark:text-emerald-400/90">
                Why ClawHeart
              </p>
              <h2 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight">不是又一层网关，而是可演进的策略平面</h2>
              <p className="mt-4 text-sm md:text-base leading-relaxed" style={{ color: "var(--intro-text-muted)" }}>
                当 Agent 能读写系统与数据，安全就不能只靠模型自觉。我们把规则、画像与证据沉淀为平台能力，随业务一起迭代。
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-5 md:gap-6">
              {PILLARS.map((p, i) => (
                <div
                  key={p.title}
                  className={`group relative p-6 md:p-8 transition-all hover:shadow-xl hover:-translate-y-1 ${PILLAR_STYLES[i].surface} ${PILLAR_STYLES[i].offset}`}
                  style={{ clipPath: PILLAR_STYLES[i].clipPath }}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70 dark:bg-slate-950/45 text-slate-800 dark:text-slate-200 group-hover:scale-105 transition-transform">
                    <p.icon className="w-5 h-5" strokeWidth={2} />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-slate-900 dark:text-white">{p.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 三步：随主题切换背景（原固定 slate-900 在浅色下过硬） */}
        <section
          className="border-y transition-colors duration-200"
          style={{
            backgroundColor: "var(--intro-band-bg)",
            borderColor: "var(--intro-band-border)",
            color: "var(--intro-band-text)",
          }}
        >
          <div className="max-w-6xl mx-auto px-4 py-12 md:py-14">
            <div className="grid md:grid-cols-3 gap-8 md:gap-0">
              {[
                {
                  step: "01",
                  title: "接入",
                  body: "配置 Base URL、API Key 或本地 19111，对接 OpenClaw / SDK。",
                  tintVar: "--intro-band-accent-cyan",
                },
                {
                  step: "02",
                  title: "策略",
                  body: "危险指令与 Skills 在网关与桌面侧统一评估，命中即拦截留痕。",
                  tintVar: "--intro-band-accent-violet",
                },
                {
                  step: "03",
                  title: "观测",
                  body: "拦截日志、Token 账单与看板多维对齐，满足审计与容量规划。",
                  tintVar: "--intro-band-accent-amber",
                },
              ].map((row, i) => (
                <div
                  key={row.step}
                  className={`md:px-8 ${i > 0 ? "md:border-l" : ""}`}
                  style={{ borderColor: "var(--intro-band-border)" }}
                >
                  <span className="text-4xl font-black tabular-nums opacity-95" style={{ color: `var(${row.tintVar})` }}>
                    {row.step}
                  </span>
                  <h3 className="mt-2 text-lg font-semibold">{row.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--intro-band-muted)" }}>
                    {row.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-indigo-50 dark:bg-indigo-950/25 border-y border-slate-200/60 dark:border-slate-800/60">
          <div
            className="pointer-events-none absolute -right-1/4 top-0 h-full w-1/2 skew-x-12 bg-gradient-to-b from-fuchsia-200/25 to-transparent dark:from-fuchsia-900/20"
            aria-hidden
          />
          <div className="relative max-w-6xl mx-auto px-4 py-16 md:py-24">
            <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
              <div className="lg:col-span-5 space-y-4">
                <div
                  className="bg-white/90 dark:bg-slate-900/75 p-7 md:p-8"
                  style={{ clipPath: "polygon(0 0, 92% 0, 100% 14%, 100% 100%, 10% 100%, 0 86%)" }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700 dark:text-indigo-300">ClawHeart Desktop</p>
                  <h2 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                    桌面端：本地网关 · 内置或外置 OpenClaw
                  </h2>
                  <p className="mt-4 text-sm md:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                    Electron 客户端把策略执行点放在本机：OpenAI 兼容代理、拦截与技能、看板与云端同步。支持
                    <strong className="text-slate-800 dark:text-slate-200"> 安装包内置 </strong>
                    与
                    <strong className="text-slate-800 dark:text-slate-200"> 外置 npm 前缀 </strong>
                    两种 OpenClaw 形态；外置场景下可搭配专用 Node 目录与本机 PATH。详见{" "}
                    <Link to="/download" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
                      下载页
                    </Link>{" "}
                    各平台与变体说明。
                  </p>
                </div>
                <div
                  className="bg-indigo-50/85 dark:bg-indigo-950/30 p-5"
                  style={{ clipPath: "polygon(0 12%, 8% 0, 100% 0, 100% 88%, 92% 100%, 0 100%)" }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">本机入口</p>
                  <code className="mt-2 block text-sm font-mono text-slate-800 dark:text-slate-200">127.0.0.1:19111/v1</code>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">OpenAI 兼容 Base URL，SDK 一行切换即可。</p>
                </div>
              </div>
              <div className="lg:col-span-7 grid grid-rows-[auto_auto] gap-4">
                <div
                  className="bg-white/90 dark:bg-slate-900/75 p-6 md:p-8"
                  style={{ clipPath: "polygon(0 10%, 8% 0, 100% 0, 100% 90%, 92% 100%, 0 100%)" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-800 text-white dark:bg-slate-700">
                      <Monitor className="w-5 h-5" strokeWidth={2} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">客户端能力（当前版本）</h3>
                  </div>
                  <ul className="mt-6 space-y-3.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {DESKTOP_FEATURES.map((line, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div
                  className="bg-gradient-to-br from-fuchsia-500/[0.12] via-white to-violet-500/[0.08] dark:from-fuchsia-950/40 dark:via-slate-900 dark:to-violet-950/30 p-6 md:p-8"
                  style={{ clipPath: "polygon(0 0, 94% 0, 100% 16%, 100% 100%, 6% 100%, 0 84%)" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-fuchsia-600 text-white dark:bg-fuchsia-500">
                      <Package className="w-5 h-5" strokeWidth={2} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">OpenClaw 集成要点</h3>
                  </div>
                  <p className="mt-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    在应用内完成安装、配置、Gateway 启停与打开控制台；与上游{" "}
                    <a
                      href="https://docs.openclaw.ai/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-fuchsia-700 dark:text-fuchsia-400 font-medium hover:underline"
                    >
                      OpenClaw 文档
                    </a>{" "}
                    对齐工作流。
                  </p>
                  <ul className="mt-5 space-y-3.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {OPENCLAW_HIGHLIGHTS.map((line, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-500 dark:bg-fuchsia-400" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-6 text-xs text-slate-500 dark:text-slate-500 leading-relaxed">
                    Gateway CLI 说明见{" "}
                    <a
                      href="https://docs.openclaw.ai/cli/gateway"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-fuchsia-700 dark:text-fuchsia-400 hover:underline"
                    >
                      docs.openclaw.ai/cli/gateway
                    </a>
                    。将上游指向 ClawHeart 时请携带控制台创建的{" "}
                    <code className="rounded bg-fuchsia-100/90 dark:bg-fuchsia-950/50 px-1 py-0.5 text-[10px]">X-OC-API-KEY</code>。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200/80 dark:border-slate-800/80 bg-slate-100/80 dark:bg-[#0c1222]">
          <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10 md:mb-12">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 dark:text-sky-400/90">User Console</p>
                <h2 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  用户工作台 · 能力矩阵
                </h2>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 max-w-xl">
                  登录后使用侧栏全部能力：大屏概览与功能卡片交错排布，便于扫读。
                </p>
              </div>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 dark:text-sky-400 hover:underline shrink-0"
              >
                进入控制台
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 auto-rows-min">
              {USER_MODULES.map((m, i) => {
                const L = USER_BENTO_LAYOUT[i]!;
                return (
                  <div
                    key={m.title}
                    className={`flex gap-4 p-5 transition-all hover:shadow-lg hover:-translate-y-0.5 ${L.span} ${L.tint}`}
                    style={{ clipPath: L.clipPath }}
                  >
                    <div className={`shrink-0 flex h-10 w-10 items-center justify-center rounded-xl ${L.iconWrap}`}>
                      <m.icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 dark:text-white text-sm">{m.title}</h3>
                      <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{m.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-gradient-to-b from-amber-50/95 via-orange-50/40 to-white dark:from-amber-950/25 dark:via-slate-950 dark:to-slate-950 border-y border-slate-200/50 dark:border-slate-800/60">
          <div
            className="pointer-events-none absolute left-0 bottom-0 w-full h-1/2 bg-gradient-to-t from-rose-100/30 to-transparent dark:from-rose-950/15"
            aria-hidden
          />
          <div className="relative max-w-6xl mx-auto px-4 py-16 md:py-24">
            <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
              <div className="lg:col-span-5">
                <div
                  className="h-full bg-white/85 dark:bg-slate-900/70 p-7 md:p-8"
                  style={{ clipPath: "polygon(0 0, 92% 0, 100% 14%, 100% 100%, 10% 100%, 0 86%)" }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-700 dark:text-orange-400">Administration</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">平台运营与全局治理</h2>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    管理员维护跨用户资源：全局技能与危险指令、系统配置、全站拦截日志与埋点查询，支撑规模化运营与审计。
                  </p>
                  <ul className="mt-7 space-y-3.5">
                    {ADMIN_MODULES.map((a) => (
                      <li key={a.title} className="flex gap-3 px-0.5 py-1">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                        <div>
                          <div className="font-medium text-slate-900 dark:text-white text-sm">{a.title}</div>
                          <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{a.desc}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="lg:col-span-7 grid grid-rows-[auto_auto] gap-4">
                <div
                  className="bg-slate-900/95 text-slate-100 p-6 md:p-8"
                  style={{ clipPath: "polygon(0 10%, 8% 0, 100% 0, 100% 88%, 92% 100%, 0 100%)" }}
                >
                  <div className="flex items-center gap-2 text-cyan-400/90">
                    <Cpu className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase tracking-[0.2em]">Stack & Integration</span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-white">技术栈与集成</h3>
                  <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                    后端 Spring Boot、JWT、JPA；前端 React、Vite、Tailwind。LLM 经网关中转时使用{" "}
                    <code className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[11px] text-cyan-300">X-OC-API-KEY</code>{" "}
                    或 Bearer。主题在网页与官网通过 <code className="text-cyan-200/90">clawheart-theme</code> 与{" "}
                    <code className="text-cyan-200/90">html.dark</code> 同步切换。
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {["Spring Boot", "React", "MySQL", "REST", "明 / 暗主题"].map((t) => (
                      <span key={t} className="inline-flex items-center rounded-full bg-slate-800/80 px-3 py-1 text-[11px] font-medium text-slate-300">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div
                  className="bg-slate-800/85 dark:bg-slate-900/80 p-4 md:p-5"
                  style={{ clipPath: "polygon(0 0, 96% 0, 100% 28%, 100% 100%, 4% 100%, 0 72%)" }}
                >
                  <div className="flex items-start gap-3">
                    <Eye className="w-5 h-5 text-cyan-500/90 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-300 dark:text-slate-400 leading-relaxed">
                      桌面端在 <code className="rounded bg-slate-950 px-1 text-cyan-200/90">127.0.0.1:19111</code>{" "}
                      提供本地代理；拦截与用量可同步云端，与「我的拦截日志 / Token 账单 / 全站拦截日志」同源。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative border-t border-slate-200/80 dark:border-slate-800/80 overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-45"
            style={{
              background:
                "radial-gradient(900px 280px at 20% 20%, rgba(139,92,246,0.12), transparent 48%), radial-gradient(700px 240px at 85% 75%, rgba(6,182,212,0.1), transparent 46%)",
            }}
            aria-hidden
          />
          <div className="relative max-w-6xl mx-auto px-4 py-14 md:py-18">
            <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-start">
              <div className="lg:col-span-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-600 dark:text-violet-400">
                  <Users className="w-6 h-6" strokeWidth={1.6} />
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-violet-700/85 dark:text-violet-300/90">
                  Our Belief
                </p>
              </div>
              <div className="lg:col-span-9">
                <blockquote className="text-xl md:text-[1.9rem] font-semibold text-slate-900 dark:text-slate-100 leading-tight tracking-tight">
                  我们相信，下一代软件将由人机协作编写；
                  <span className="text-violet-700/90 dark:text-violet-300/90">
                    而信任来自可验证的策略、可回放的决策与可持续演进的治理。
                  </span>
                </blockquote>
                <p className="mt-5 text-sm md:text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
                  ClawHeart 持续扩展规则引擎与更细粒度策略编排，在模型能力快速演进的时代，为自动化链路保留清晰边界。
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 py-14 md:py-16">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-end">
            <div className="lg:col-span-8">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-600 dark:text-brand-400">
                <Server className="w-5 h-5" strokeWidth={1.35} />
              </div>
              <h2 className="mt-4 text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                准备好接入你的第一条受控链路了吗？
              </h2>
              <p className="mt-3 text-sm md:text-base leading-relaxed max-w-3xl" style={{ color: "var(--intro-text-muted)" }}>
                注册并创建 API Key，或将 OpenClaw / SDK 指到 ClawHeart 网关与本地 19111；下载桌面端获得完整 Gateway 体验。
              </p>
            </div>
            <div className="lg:col-span-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-brand-600 text-white text-sm font-semibold hover:bg-brand-500 transition-colors"
                >
                  创建账号
                </Link>
                <Link
                  to="/download"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-brand-600/10 text-brand-700 dark:text-brand-300 text-sm font-semibold hover:bg-brand-600/15 dark:hover:bg-brand-500/20 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  下载客户端
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border text-sm font-medium transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
                  style={{ borderColor: "var(--intro-border)", color: "var(--intro-text)" }}
                >
                  已有账号登录
                </Link>
                <Link
                  to="/docs"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-500/10 transition-colors"
                >
                  <BookOpen className="w-4 h-4" />
                  阅读文档
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer
        className="shrink-0 border-t transition-colors duration-200 bg-gradient-to-br from-sky-100/70 via-white to-violet-100/65 dark:from-sky-950/30 dark:via-slate-950/90 dark:to-violet-950/30"
        style={{ borderColor: "var(--intro-border)" }}
      >
        <div className="max-w-6xl mx-auto px-4 pt-8 pb-6">
          <SocialMediaModule
            title="社媒矩阵"
            subtitle="在各平台关注 ClawHeart，第一时间获取新版本、能力发布与活动动态。"
            items={socialItems}
          />
        </div>
        <div className="border-t py-6 text-center text-[11px]" style={{ borderColor: "var(--intro-border-soft)", color: "var(--intro-text-subtle)" }}>
          <a href="#intro-top" className="hover:opacity-80 underline-offset-2 hover:underline" style={{ color: "var(--intro-text-muted)" }}>
            回到顶部
          </a>
          <span className="mx-2 opacity-50">·</span>
          <span>ClawHeart — Agent 安全与治理</span>
        </div>
      </footer>
    </div>
  );
};
