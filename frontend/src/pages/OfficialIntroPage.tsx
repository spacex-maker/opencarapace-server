import { Link } from "react-router-dom";
import {
  Shield,
  KeyRound,
  FileSearch,
  Cpu,
  Lock,
  Layers,
  ArrowRight,
  BookOpen,
  Moon,
  Sun,
  LogOut,
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";

export const OfficialIntroPage = () => {
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* 官网单页顶栏：Logo + 登录/注册 或 昵称·登出 + 主题切换 */}
      <header className="shrink-0 h-12 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur flex items-center justify-between px-4">
        <Link
          to="/"
          className="flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white"
        >
          <Shield className="w-5 h-5 text-brand-500" />
          <span className="font-semibold tracking-tight">ClawHeart</span>
        </Link>
        <div className="flex items-center gap-1">
          {isAuthenticated && user ? (
            <>
              <Link
                to="/dashboard"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <KeyRound className="w-4 h-4" />
                控制台
              </Link>
              <span className="px-2 text-sm text-slate-600 dark:text-slate-400 max-w-[140px] truncate" title={user.email}>
                {user.displayName || user.email}
              </span>
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                title="退出登录"
              >
                <LogOut className="w-4 h-4" />
                登出
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="px-3 py-1.5 rounded-md text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                登录
              </Link>
              <Link
                to="/register"
                className="px-3 py-1.5 rounded-md text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                注册
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
            title={theme === "dark" ? "切换为明亮模式" : "切换为暗黑模式"}
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* 单页正文 */}
      <div className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-16 pb-12">
      {/* Hero */}
      <section className="text-center pt-4">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 px-3 py-1 text-xs font-medium border border-brand-500/20 mb-6">
          <Shield className="w-3.5 h-3.5" />
          Agent 安全层
        </p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
          ClawHeart
        </h1>
        <p className="mt-3 text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
          为自主 Agent、工具与函数调用提供统一的安全评估与策略治理，
          保护业务系统免受越权调用、数据外泄与危险命令的影响。
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium"
          >
            进入用户后台
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/docs"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <BookOpen className="w-4 h-4" />
            API 文档
          </Link>
        </div>
      </section>

      {/* 核心能力 */}
      <section>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6">
          核心能力
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-5">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center mb-3">
              <FileSearch className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="font-medium text-slate-900 dark:text-white">工具 / Skill 安全画像</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              结构化记录每个工具的权限、风险等级、来源与策略提示，支持危险指令库查询与审计。
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-5">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-3">
              <Cpu className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="font-medium text-slate-900 dark:text-white">对话 / 命令安全审计</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              对对话上下文与执行命令做 LLM 级判定与日志留存，可扩展策略引擎与人工审核流程。
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-5">
            <div className="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center mb-3">
              <KeyRound className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            </div>
            <h3 className="font-medium text-slate-900 dark:text-white">API Key 与身份</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              邮箱密码登录、JWT 鉴权，用户后台管理 API Key，对接 Agent 网关与第三方调用。
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-5">
            <div className="w-10 h-10 rounded-lg bg-slate-500/20 flex items-center justify-center mb-3">
              <Lock className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </div>
            <h3 className="font-medium text-slate-900 dark:text-white">策略与治理</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              系统配置、危险指令库与 AI 同步能力，支持零信任权限、花费上限等策略扩展。
            </p>
          </div>
        </div>
      </section>

      {/* 产品定位 */}
      <section>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6">
          产品定位
        </h2>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-6">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            ClawHeart 作为<strong className="text-slate-900 dark:text-white">独立安全层</strong>，
            接管 Agent / LLM 对工具、技能、函数的调用。在请求到达具体执行前，
            结合工具注册信息、危险指令库与可选的 LLM 审计，给出
            <span className="font-medium text-slate-800 dark:text-slate-200"> 可执行 / 阻断 / 需人工审核 </span>
            等分级决策，适用于 OpenClaw、自研 Agent 平台及各类需要「安全外壳」的自动化场景。
          </p>
        </div>
      </section>

      {/* 技术架构简述 */}
      <section>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6">
          技术架构
        </h2>
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-5">
          <Layers className="w-6 h-6 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
          <div className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
            <p>
              <strong className="text-slate-800 dark:text-slate-200">后端：</strong>
              Spring Boot、Spring Security（JWT + BCrypt）、Spring Data JPA、MySQL；
              危险指令库支持多系统类型与 AI 同步（Tavily + DeepSeek）。
            </p>
            <p>
              <strong className="text-slate-800 dark:text-slate-200">前端：</strong>
              React、Vite、Tailwind CSS，支持明亮 / 暗黑主题；用户后台、API 文档、管理员配置与危险指令库查询。
            </p>
            <p>
              <strong className="text-slate-800 dark:text-slate-200">集成：</strong>
              通过 <code className="rounded px-1 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">X-OC-API-KEY</code> 或
              <code className="rounded px-1 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 ml-1">Authorization: Bearer</code> 调用
              安全检查等 API，便于与网关、Agent 运行时对接。
            </p>
          </div>
        </div>
      </section>

      {/* CTA：使用普通 a 标签确保部署后跳转可靠（SPA 路由可能受 base 影响） */}
      <section className="text-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          立即开始
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          注册账号并创建 API Key，即可在 Agent 或网关中接入安全校验。
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <a
            href="/register"
            className="inline-block px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
          >
            注册
          </a>
          <a
            href="/login"
            className="inline-block px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            登录
          </a>
        </div>
      </section>
      </div>
    </div>
  );
};
