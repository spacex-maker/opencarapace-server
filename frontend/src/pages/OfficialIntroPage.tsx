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
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";

/** 与当前路由/侧栏一致的能力清单，用于官网结构化展示 */
const USER_MODULES = [
  {
    icon: LayoutDashboard,
    title: "数据概览",
    desc: "技能、危险指令、拦截与 Token 等多维统计与趋势图，一眼掌握运行健康度。",
  },
  {
    icon: BookOpen,
    title: "我的技能",
    desc: "工具/Skill 画像、启用与偏好，与全局技能库联动。",
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
    desc: "用量与成本维度可查，便于配额与预算治理。",
  },
  {
    icon: Settings,
    title: "用户设置",
    desc: "含 LLM 路由模式等偏好，贴合直连与网关两种形态。",
  },
];

const ADMIN_MODULES = [
  { title: "全局技能", desc: "跨用户技能元数据与同步策略（如 ClawHub 等来源）。" },
  { title: "全局危险指令", desc: "系统级规则库、分类与风险等级，支撑全站拦截。" },
  { title: "系统配置", desc: "键值与分组配置，驱动同步、网关与安全参数。" },
  { title: "全站拦截日志", desc: "跨用户审计与高级筛选：用户、时间、类型、关键词。" },
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
    body: "拦截、用量与配置变更均可追溯，满足审计与排障。",
  },
];

/** 官网文案：与 local-desktop 文档一致的能力摘要 */
const DESKTOP_FEATURES = [
  "本地 HTTP 服务（默认 127.0.0.1:19111），对外提供 OpenAI 兼容路径，SDK 只需改 Base URL 即可接入。",
  "危险指令与 Skills 仓库：系统规则 + 用户偏好、启用开关与安全打标，命中后本地拦截并写拦截日志。",
  "可视化概览：技能与风险分布、拦截与 Token 时间线，与云端控制台数据可联动同步。",
  "设置中心：云端基地址与 OC API Key、LLM 路由模式（经 ClawHeart 网关 / 直连上游）及前缀映射，对接多厂商。",
];

const OPENCLAW_HIGHLIGHTS = [
  "安装包集成 OpenClaw 运行时与依赖；可按需使用内置 Node.js，降低本机环境门槛。",
  "提供 Gateway 启停、配置编辑与状态检测；支持在独立窗口打开 OpenClaw 控制台（Web UI）。",
  "可将 OpenClaw 侧模型/上游指向 ClawHeart 网关或本地 19111 前缀，使 Agent 对话与工具调用走同一套安全策略。",
];

/** Hero 下方能力数字卡：每块独立色面 */
const HERO_STATS = [
  {
    k: "8+",
    v: "用户侧功能模块",
    sub: "概览 · 技能 · 危险指令 · 密钥等",
    className:
      "bg-sky-50/90 border-sky-200/70 dark:bg-sky-950/35 dark:border-sky-800/60 text-sky-950 dark:text-sky-100",
    accentClass: "text-sky-600 dark:text-sky-400",
  },
  {
    k: "4",
    v: "管理员治理入口",
    sub: "全局库 · 配置 · 全站日志",
    className:
      "bg-violet-50/90 border-violet-200/70 dark:bg-violet-950/35 dark:border-violet-800/60 text-violet-950 dark:text-violet-100",
    accentClass: "text-violet-600 dark:text-violet-400",
  },
  {
    k: "双通道",
    v: "鉴权与接入",
    sub: "JWT 用户态 + API Key 机机调用",
    className:
      "bg-emerald-50/90 border-emerald-200/70 dark:bg-emerald-950/35 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-100",
    accentClass: "text-emerald-600 dark:text-emerald-400",
  },
  {
    k: "全链路",
    v: "拦截与用量",
    sub: "日志 · Token 账单 · 可审计",
    className:
      "bg-amber-50/90 border-amber-200/70 dark:bg-amber-950/40 dark:border-amber-800/60 text-amber-950 dark:text-amber-100",
    accentClass: "text-amber-700 dark:text-amber-400",
  },
  {
    k: "Desktop",
    v: "本地网关 + OpenClaw",
    sub: "19111 兼容入口 · 内置 Gateway",
    className:
      "bg-rose-50/90 border-rose-200/70 dark:bg-rose-950/35 dark:border-rose-800/60 text-rose-950 dark:text-rose-100",
    accentClass: "text-rose-600 dark:text-rose-400",
  },
] as const;

const PILLAR_STYLES = [
  "border-emerald-300/80 bg-gradient-to-br from-emerald-50/90 to-white dark:from-emerald-950/30 dark:to-slate-900/80 dark:border-emerald-800/50",
  "border-violet-300/80 bg-gradient-to-br from-violet-50/90 to-white dark:from-violet-950/30 dark:to-slate-900/80 dark:border-violet-800/50",
  "border-amber-300/80 bg-gradient-to-br from-amber-50/90 to-white dark:from-amber-950/25 dark:to-slate-900/80 dark:border-amber-800/50",
] as const;

/** 用户模块 Bento：lg 下不规则占位 + 色面 */
const USER_BENTO_LAYOUT: { span: string; tint: string; iconWrap: string }[] = [
  {
    span: "lg:col-span-5 lg:row-span-2 lg:row-start-1 lg:col-start-1 min-h-[200px]",
    tint: "bg-gradient-to-br from-sky-500/[0.08] via-white to-cyan-500/[0.06] dark:from-sky-500/15 dark:via-slate-900 dark:to-cyan-950/20 border-sky-200/70 dark:border-sky-800/50",
    iconWrap: "bg-sky-500/15 text-sky-700 dark:bg-sky-500/25 dark:text-sky-300",
  },
  {
    span: "lg:col-span-3 lg:row-start-1 lg:col-start-6",
    tint: "bg-indigo-50/80 dark:bg-indigo-950/25 border-indigo-200/70 dark:border-indigo-800/50",
    iconWrap: "bg-indigo-500/15 text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-300",
  },
  {
    span: "lg:col-span-4 lg:row-start-1 lg:col-start-9",
    tint: "bg-orange-50/85 dark:bg-orange-950/20 border-orange-200/70 dark:border-orange-900/40",
    iconWrap: "bg-orange-500/15 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300",
  },
  {
    span: "lg:col-span-3 lg:row-start-2 lg:col-start-6",
    tint: "bg-fuchsia-50/80 dark:bg-fuchsia-950/20 border-fuchsia-200/70 dark:border-fuchsia-900/40",
    iconWrap: "bg-fuchsia-500/15 text-fuchsia-800 dark:bg-fuchsia-500/20 dark:text-fuchsia-300",
  },
  {
    span: "lg:col-span-4 lg:row-start-2 lg:col-start-9",
    tint: "bg-teal-50/85 dark:bg-teal-950/25 border-teal-200/70 dark:border-teal-800/50",
    iconWrap: "bg-teal-500/15 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300",
  },
  {
    span: "lg:col-span-6 lg:row-start-3 lg:col-start-1",
    tint: "bg-amber-50/80 dark:bg-amber-950/20 border-amber-200/70 dark:border-amber-800/45",
    iconWrap: "bg-amber-500/15 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300",
  },
  {
    span: "lg:col-span-6 lg:row-start-3 lg:col-start-7",
    tint: "bg-slate-100/90 dark:bg-slate-800/40 border-slate-300/70 dark:border-slate-600/50",
    iconWrap: "bg-slate-600/15 text-slate-800 dark:bg-slate-500/20 dark:text-slate-200",
  },
];

export const OfficialIntroPage = () => {
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#fafbfc] dark:bg-[#030712] flex flex-col text-slate-900 dark:text-slate-100">
      {/* 顶栏 */}
      <header className="shrink-0 sticky top-0 z-50 h-14 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/75 dark:bg-slate-950/75 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto h-full px-4 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2.5 text-slate-800 dark:text-white hover:opacity-90 transition-opacity"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-500/25">
              <Shield className="w-[18px] h-[18px] text-white" strokeWidth={2.2} />
            </div>
            <div className="leading-tight">
              <span className="font-semibold tracking-tight text-[15px]">ClawHeart</span>
              <span className="hidden sm:block text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Agent Security
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-0.5 sm:gap-1">
            <Link
              to="/download"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80"
            >
              <Download className="w-4 h-4" />
              下载
            </Link>
            {isAuthenticated && user ? (
              <>
                <Link
                  to="/dashboard"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  控制台
                </Link>
                <span
                  className="max-w-[120px] sm:max-w-[180px] truncate px-2 text-sm text-slate-500 dark:text-slate-400"
                  title={user.email}
                >
                  {user.displayName || user.email}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">登出</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3 py-2 rounded-full text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                >
                  登录
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 rounded-full text-sm font-medium bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90"
                >
                  注册
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              title={theme === "dark" ? "明亮模式" : "暗黑模式"}
            >
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      <main id="intro-top" className="flex-1 w-full scroll-mt-14">
        {/* Hero：渐变光晕 + 栅格 */}
        <section className="relative overflow-hidden border-b border-slate-200/60 dark:border-slate-800/60">
          <div
            className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-30"
            style={{
              backgroundImage: `radial-gradient(at 40% 20%, rgba(59,130,246,0.25) 0px, transparent 50%),
                radial-gradient(at 80% 0%, rgba(168,85,247,0.2) 0px, transparent 45%),
                radial-gradient(at 0% 50%, rgba(34,197,94,0.12) 0px, transparent 40%)`,
            }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f008_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f008_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1e293b20_1px,transparent_1px),linear-gradient(to_bottom,#1e293b20_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />

          <div className="relative max-w-6xl mx-auto px-4 pt-14 pb-20 md:pt-20 md:pb-28">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-start">
              <div className="lg:col-span-7 max-w-3xl">
                <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400 backdrop-blur-sm">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  面向自主 Agent 的安全外壳
                </p>
                <h1 className="mt-6 text-4xl sm:text-5xl md:text-[3.25rem] font-semibold tracking-tight leading-[1.1] text-slate-950 dark:text-white">
                  让每一次
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-violet-600 dark:from-brand-400 dark:to-violet-400">
                    工具调用
                  </span>
                  <br className="hidden sm:block" />
                  都可被看见、被治理、被信任
                </h1>
                <p className="mt-6 text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                  ClawHeart 在 LLM 与执行层之间插入统一策略：危险指令匹配、技能与规则库治理、拦截与用量全链路留痕。
                  提供 <span className="font-semibold text-slate-800 dark:text-slate-200">网页控制台</span> 与{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Windows 桌面客户端</span>
                  （内置 OpenClaw 与本地网关），无论是 OpenClaw、自研 Agent 还是企业自动化，都能完成「接入—策略—观测」闭环。
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
                    to="/docs"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <FileText className="w-4 h-4" />
                    API 与集成文档
                  </Link>
                </div>
              </div>

              {/* Hero 右侧：色块拼贴 */}
              <div className="hidden lg:flex lg:col-span-5 flex-col gap-4">
                <div className="rounded-[1.75rem] border border-brand-200/60 dark:border-brand-500/25 bg-gradient-to-br from-brand-500/15 via-violet-500/10 to-fuchsia-500/10 dark:from-brand-500/20 dark:via-violet-600/15 dark:to-fuchsia-900/20 p-6 shadow-lg shadow-brand-500/5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-700 dark:text-brand-300">策略平面</p>
                  <p className="mt-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    云端控制台与桌面客户端共用同一套账号与策略模型：配置一次，处处生效。
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {["拦截", "Skills", "用量", "审计"].map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-white/70 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-700 px-3 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300"
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
                    <span className="text-[11px] font-medium text-violet-900 dark:text-violet-200 leading-snug">网关 · 直连 · 前缀映射</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 能力速览：五色独立色块 */}
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

        {/* 三大支柱：全宽色带 + 三色渐变卡 */}
        <section className="relative border-y border-slate-200/60 dark:border-slate-800/80 overflow-hidden">
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
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700/80 dark:text-emerald-400/90">Why ClawHeart</p>
              <h2 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                不是又一层网关，而是可演进的策略平面
              </h2>
              <p className="mt-4 text-sm md:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                当 Agent 能读写系统与数据，安全就不能只靠模型自觉。我们把规则、画像与证据沉淀为平台能力，随业务一起迭代。
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-5 md:gap-6">
              {PILLARS.map((p, i) => (
                <div
                  key={p.title}
                  className={`group relative rounded-[1.35rem] border-2 p-6 md:p-8 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5 ${PILLAR_STYLES[i]}`}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200 shadow-sm group-hover:scale-105 transition-transform">
                    <p.icon className="w-5 h-5" strokeWidth={2} />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-slate-900 dark:text-white">{p.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 流程色条：三步横向 */}
        <section className="bg-slate-900 text-slate-100 dark:bg-slate-950">
          <div className="max-w-6xl mx-auto px-4 py-12 md:py-14">
            <div className="grid md:grid-cols-3 gap-8 md:gap-0">
              {[
                { step: "01", title: "接入", body: "配置 Base URL、API Key 或本地 19111，对接 OpenClaw / SDK。", tint: "text-cyan-400" },
                { step: "02", title: "策略", body: "危险指令与 Skills 在网关与桌面侧统一评估，命中即拦截留痕。", tint: "text-violet-400" },
                { step: "03", title: "观测", body: "拦截日志、Token 账单与看板多维对齐，满足审计与容量规划。", tint: "text-amber-400" },
              ].map((row, i) => (
                <div
                  key={row.step}
                  className={`md:px-8 ${i > 0 ? "md:border-l md:border-slate-700/80" : ""}`}
                >
                  <span className={`text-4xl font-black tabular-nums opacity-90 ${row.tint}`}>{row.step}</span>
                  <h3 className="mt-2 text-lg font-semibold text-white">{row.title}</h3>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed">{row.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 桌面客户端：斜向分色 + 错落双栏 */}
        <section className="relative overflow-hidden bg-indigo-50 dark:bg-indigo-950/25">
          <div
            className="pointer-events-none absolute -right-1/4 top-0 h-full w-1/2 skew-x-12 bg-gradient-to-b from-fuchsia-200/25 to-transparent dark:from-fuchsia-900/20"
            aria-hidden
          />
          <div className="relative max-w-6xl mx-auto px-4 py-16 md:py-24">
            <div className="grid lg:grid-cols-12 gap-10 items-start">
              <div className="lg:col-span-5 lg:sticky lg:top-24">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700 dark:text-indigo-300">ClawHeart Desktop</p>
                <h2 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  桌面客户端：本地网关与内置 OpenClaw
                </h2>
                <p className="mt-4 text-sm md:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                  ClawHeart Desktop（Electron）把「策略执行点」放到你的电脑上：本地 OpenAI 兼容代理、危险指令与技能治理、拦截与
                  Token 看板，并与云端账号同步。同一安装包内集成{" "}
                  <a
                    href="https://docs.openclaw.ai/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                  >
                    OpenClaw
                  </a>{" "}
                  运行时与 Gateway 管理能力，便于在熟悉 OpenClaw 工作流的同时，把上游接到 ClawHeart 安全层。
                </p>
                <div className="mt-8 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/50 bg-white/80 dark:bg-slate-900/60 p-5 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">本机入口</p>
                  <code className="mt-2 block text-sm font-mono text-slate-800 dark:text-slate-200">127.0.0.1:19111/v1</code>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">OpenAI 兼容 Base URL，SDK 一行切换即可。</p>
                </div>
              </div>
              <div className="lg:col-span-7 flex flex-col gap-5">
                <div className="rounded-[1.5rem] border-2 border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900/70 p-6 md:p-8 shadow-md md:ml-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-800 text-white dark:bg-slate-700">
                      <Monitor className="w-5 h-5" strokeWidth={2} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">客户端功能概览</h3>
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
                <div className="rounded-[1.5rem] border-2 border-fuchsia-300/60 dark:border-fuchsia-700/50 bg-gradient-to-br from-fuchsia-500/[0.12] via-white to-violet-500/[0.08] dark:from-fuchsia-950/40 dark:via-slate-900 dark:to-violet-950/30 p-6 md:p-8 shadow-md md:-ml-2 md:mr-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-fuchsia-600 text-white dark:bg-fuchsia-500">
                      <Package className="w-5 h-5" strokeWidth={2} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">内置 OpenClaw 能做什么</h3>
                  </div>
                  <p className="mt-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    OpenClaw 是面向 AI Agent 的网关与工具生态；在 ClawHeart Desktop 中，我们把它作为「可选但一等公民」集成：安装、配置、启停
                    Gateway 与打开控制台，均可在本应用内完成，无需单独拼凑命令行环境。
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
                    更多 OpenClaw 配置与 Gateway 说明见官方文档{" "}
                    <a
                      href="https://docs.openclaw.ai/cli/gateway"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-fuchsia-700 dark:text-fuchsia-400 hover:underline"
                    >
                      https://docs.openclaw.ai/cli/gateway
                    </a>
                    ；将 Base URL 指向 ClawHeart 时，请同时携带控制台创建的{" "}
                    <code className="rounded bg-fuchsia-100/90 dark:bg-fuchsia-950/50 px-1 py-0.5 text-[10px]">X-OC-API-KEY</code>{" "}
                    或等价查询参数，与网页端 API 文档一致。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 用户工作台：Bento 色块栅格 */}
        <section className="border-y border-slate-200/80 dark:border-slate-800/80 bg-[#f4f6fb] dark:bg-[#0c1222]">
          <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10 md:mb-12">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 dark:text-sky-400/90">User Console</p>
                <h2 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  用户工作台 · 模块化能力矩阵
                </h2>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 max-w-xl">
                  登录后即可使用侧栏全部能力：大屏概览与小卡片功能交错排布，便于扫读与对比。
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
                    className={`flex gap-4 rounded-2xl border p-5 transition-all hover:shadow-lg hover:-translate-y-0.5 ${L.span} ${L.tint}`}
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

        {/* 管理员 + 技术：橙区运营 + 深色技术卡 */}
        <section className="relative overflow-hidden bg-gradient-to-b from-amber-50/95 via-orange-50/40 to-white dark:from-amber-950/25 dark:via-slate-950 dark:to-slate-950">
          <div
            className="pointer-events-none absolute left-0 bottom-0 w-full h-1/2 bg-gradient-to-t from-rose-100/30 to-transparent dark:from-rose-950/15"
            aria-hidden
          />
          <div className="relative max-w-6xl mx-auto px-4 py-16 md:py-24">
            <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
              <div className="lg:col-span-5 flex flex-col">
                <div className="flex-1 rounded-[1.75rem] border-2 border-orange-200/90 dark:border-orange-900/50 bg-white/95 dark:bg-slate-900/85 p-8 shadow-lg shadow-orange-500/5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-700 dark:text-orange-400">Administration</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">平台运营与全局治理</h2>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    管理员在独立分区中维护跨租户资源：全局技能与危险指令库、系统级配置，以及带高级筛选的全站拦截日志，支撑规模化运营与审计。
                  </p>
                  <ul className="mt-8 space-y-4">
                    {ADMIN_MODULES.map((a) => (
                      <li key={a.title} className="flex gap-3 rounded-xl bg-orange-50/60 dark:bg-orange-950/20 px-3 py-2.5 border border-orange-100/80 dark:border-orange-900/30">
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
              <div className="lg:col-span-7 flex flex-col">
                <div className="flex-1 rounded-[1.75rem] border border-slate-700/80 bg-slate-900 text-slate-100 p-6 md:p-8 shadow-2xl shadow-slate-900/30 ring-1 ring-white/10">
                  <div className="flex items-center gap-2 text-cyan-400/90">
                    <Cpu className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase tracking-[0.2em]">Stack & Integration</span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-white">技术栈与集成方式</h3>
                  <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                    后端 Spring Boot、JWT、JPA；前端 React、Vite、Tailwind。LLM 请求可通过网关路径透明中转，使用{" "}
                    <code className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[11px] text-cyan-300">X-OC-API-KEY</code>{" "}
                    或 Bearer 对接上游模型密钥。安全评估、日志上报与配置 API 均提供文档化入口。
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {["Spring Boot", "React", "MySQL", "REST", "暗黑主题"].map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center rounded-full border border-slate-600/80 bg-slate-800/80 px-3 py-1 text-[11px] font-medium text-slate-300"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="mt-8 flex items-start gap-3 rounded-xl bg-slate-800/80 border border-slate-700/60 p-4">
                    <Eye className="w-5 h-5 text-cyan-500/90 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-400 leading-relaxed">
                      ClawHeart Desktop 在 <code className="rounded bg-slate-950 px-1 text-cyan-200/90">127.0.0.1:19111</code>{" "}
                      提供本地代理，可将拦截与用量同步到云端，与「我的拦截日志 / Token 账单 / 全站拦截日志」同源，便于与内置 OpenClaw
                      联调与排障。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 愿景：紫青渐变底 + 浮起内容卡 */}
        <section className="relative border-t border-slate-200/80 dark:border-slate-800/80 overflow-hidden">
          <div
            className="absolute inset-0 bg-gradient-to-br from-violet-200/35 via-white to-cyan-200/30 dark:from-violet-950/50 dark:via-slate-950 dark:to-cyan-950/35"
            aria-hidden
          />
          <div className="relative max-w-6xl mx-auto px-4 py-16 md:py-24">
            <div className="max-w-3xl mx-auto">
              <div className="rounded-[1.75rem] border border-violet-200/70 dark:border-violet-800/40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-8 py-12 md:px-12 md:py-14 shadow-xl shadow-violet-500/10 text-center">
                <Users className="w-9 h-9 mx-auto text-violet-500 dark:text-violet-400" strokeWidth={1.5} />
                <blockquote className="mt-6 text-xl md:text-2xl font-medium text-slate-800 dark:text-slate-100 leading-snug tracking-tight">
                  我们相信，下一代软件将由人机协作编写；
                  <span className="text-violet-700/85 dark:text-violet-300/90">而信任来自可验证的策略、可回放的决策与可持续演进的治理。</span>
                </blockquote>
                <p className="mt-6 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  ClawHeart 持续扩展规则引擎、多租户与更细粒度策略编排，目标是在模型能力爆炸的时代，为每一条自动化链路保留清晰边界。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-6xl mx-auto px-4 pb-20 pt-4">
          <div className="relative overflow-hidden rounded-3xl bg-slate-900 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-950 px-6 py-12 md:px-14 md:py-16 text-center">
            <div
              className="pointer-events-none absolute inset-0 opacity-30"
              style={{
                backgroundImage: `radial-gradient(circle at 30% 20%, rgba(59,130,246,0.35), transparent 45%),
                  radial-gradient(circle at 70% 80%, rgba(168,85,247,0.25), transparent 40%)`,
              }}
            />
            <div className="relative">
              <Server className="w-9 h-9 mx-auto text-slate-400" strokeWidth={1.25} />
              <h2 className="mt-4 text-2xl md:text-3xl font-semibold text-white tracking-tight">准备好接入你的第一条受控链路了吗？</h2>
              <p className="mt-3 text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
                注册后创建 API Key，将 SDK 或 OpenClaw 的上游指向 ClawHeart 网关，或使用桌面客户端在本地 19111 接入；拦截与用量会在网页控制台与桌面看板中逐步沉淀。
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-white text-slate-900 text-sm font-semibold hover:bg-slate-100"
                >
                  创建账号
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-full border border-slate-600 text-white text-sm font-medium hover:bg-white/10"
                >
                  已有账号登录
                </Link>
                <Link
                  to="/docs"
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-slate-300 text-sm hover:text-white"
                >
                  <BookOpen className="w-4 h-4" />
                  阅读文档
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="shrink-0 border-t border-slate-200 dark:border-slate-800 py-6 text-center text-[11px] text-slate-500 dark:text-slate-600">
        <a href="#intro-top" className="hover:text-slate-800 dark:hover:text-slate-400">
          回到顶部
        </a>
        <span className="mx-2 text-slate-300 dark:text-slate-700">·</span>
        <span>ClawHeart — Agent 安全与治理</span>
      </footer>
    </div>
  );
};
