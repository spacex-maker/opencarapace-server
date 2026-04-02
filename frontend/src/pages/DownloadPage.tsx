import { Link } from "react-router-dom";
import { Apple, ChevronDown, Download, ExternalLink, Monitor, Shield, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";

type DownloadTarget = {
  id: "windows" | "mac";
  title: string;
  subtitle: string;
  badge: string;
  icon: any;
  href?: string;
  secondaryHref?: string;
};

function isNonEmptyUrl(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeMaybeUrl(v: unknown): string | undefined {
  if (!isNonEmptyUrl(v)) return undefined;
  return v.trim();
}

/** 默认 Windows x64 安装包（可被环境变量覆盖） */
const DEFAULT_WIN_DOWNLOAD_URL =
  "https://public-1258150206.cos.ap-nanjing.myqcloud.com/ClawHeart%20Desktop%20Setup%200.1.0.exe";

export function DownloadPage() {
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, user, logout } = useAuth();

  const winUrlFromEnv = normalizeMaybeUrl((import.meta as any).env?.VITE_DESKTOP_DOWNLOAD_WIN_URL);
  const winUrl = winUrlFromEnv || DEFAULT_WIN_DOWNLOAD_URL;
  const releaseNotesUrl = normalizeMaybeUrl((import.meta as any).env?.VITE_DESKTOP_RELEASE_NOTES_URL);

  const targets: DownloadTarget[] = useMemo(
    () => [
      {
        id: "windows",
        title: "Windows",
        subtitle: "Windows 10/11（x64）",
        badge: "推荐版本",
        icon: Monitor,
        href: winUrl,
      },
      {
        id: "mac",
        title: "macOS",
        subtitle: "Intel / Apple Silicon（筹备中）",
        badge: "敬请期待",
        icon: Apple,
        href: undefined,
      },
    ],
    [winUrl],
  );

  const [openFaq, setOpenFaq] = useState<null | "gate" | "openclaw" | "trust">("gate");

  return (
    <div className="min-h-screen bg-[#fafbfc] dark:bg-[#030712] flex flex-col text-slate-900 dark:text-slate-100 selection:bg-brand-500/30">
      {/* 顶栏 */}
      <header className="shrink-0 sticky top-0 z-50 h-16 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-[#030712]/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-3 text-slate-800 dark:text-white hover:opacity-80 transition-opacity group"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-500/25 group-hover:shadow-brand-500/40 transition-shadow">
              <Shield className="w-[18px] h-[18px] text-white" strokeWidth={2.2} />
            </div>
            <div className="leading-tight">
              <span className="font-bold tracking-tight text-[16px]">ClawHeart</span>
              <span className="hidden sm:block text-[10px] uppercase tracking-[0.2em] font-medium text-slate-500 dark:text-slate-400">
                Agent Security
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              to="/download"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm hover:scale-105 transition-transform"
              aria-current="page"
            >
              <Download className="w-4 h-4" />
              客户端下载
            </Link>

            <div className="w-px h-5 bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block"></div>

            {isAuthenticated && user ? (
              <>
                <Link
                  to="/dashboard"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                >
                  控制台
                </Link>
                <span
                  className="max-w-[120px] sm:max-w-[150px] truncate px-2 text-sm font-medium text-slate-500 dark:text-slate-400"
                  title={user.email}
                >
                  {user.displayName || user.email}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                >
                  登出
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-full text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                >
                  登录
                </Link>
                <Link
                  to="/register"
                  className="px-5 py-2 rounded-full text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  注册
                </Link>
              </>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 ml-1 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={theme === "dark" ? "切换至明亮模式" : "切换至暗黑模式"}
            >
              {theme === "dark" ? "☀" : "🌙"}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full relative">
        {/* 背景光晕装饰 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-brand-500/10 dark:bg-brand-500/5 blur-[120px]" />
          <div className="absolute top-[20%] -right-[10%] w-[40%] h-[40%] rounded-full bg-violet-500/10 dark:bg-violet-500/5 blur-[100px]" />
        </div>

        {/* Hero 区域 */}
        <section className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* 左侧文案 */}
            <div className="lg:col-span-5 flex flex-col items-start text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-50/50 dark:bg-brand-500/10 px-4 py-1.5 text-[12px] font-semibold tracking-widest text-brand-600 dark:text-brand-400 backdrop-blur-md mb-6 shadow-sm">
                <Monitor className="w-3.5 h-3.5" />
                CLAWHEART DESKTOP
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.15] text-slate-900 dark:text-white">
                立即下载<br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-600 to-violet-600 dark:from-brand-400 dark:to-violet-400">
                  本地安全网关
                </span>
              </h1>
              <p className="mt-6 text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg">
                在本地暴露 19111 端口，内置 OpenClaw。让你的 AI Agent 调用无缝接入云端统一的安全策略与审计体系。
              </p>
              
              <div className="mt-10 flex flex-wrap items-center gap-4">
                {releaseNotesUrl ? (
                  <a
                    href={releaseNotesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-white dark:hover:bg-slate-800 transition-all hover:shadow-sm"
                  >
                    <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-brand-500 transition-colors" />
                    查看版本更新日志
                  </a>
                ) : (
                  <span className="text-sm font-medium text-slate-400 dark:text-slate-500 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    版本说明即将上线
                  </span>
                )}
              </div>
            </div>

            {/* 右侧下载卡片 */}
            <div className="lg:col-span-7 lg:pl-10">
              <div className="grid sm:grid-cols-2 gap-5 relative">
                
                {/* 推荐下载 (Windows) */}
                {targets.map((t) => {
                  const Icon = t.icon;
                  const isAvailable = !!t.href;
                  
                  return (
                    <div
                      key={t.id}
                      className={`relative group rounded-3xl border p-6 flex flex-col justify-between transition-all duration-300
                        ${isAvailable 
                          ? "bg-white dark:bg-slate-900 border-brand-500/30 dark:border-brand-500/20 shadow-xl shadow-brand-500/5 hover:shadow-brand-500/15 hover:-translate-y-1" 
                          : "bg-slate-50/50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800/50 opacity-80"}
                      `}
                    >
                      {/* 可用时的辉光背景 */}
                      {isAvailable && (
                        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-transparent rounded-3xl pointer-events-none" />
                      )}

                      <div>
                        <div className="flex items-start justify-between gap-3 mb-6 relative z-10">
                          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-sm
                            ${isAvailable ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500"}
                          `}>
                            <Icon className="w-6 h-6" />
                          </div>
                          <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full border 
                            ${isAvailable 
                              ? "bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-200 dark:border-brand-500/20" 
                              : "bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"}
                          `}>
                            {t.badge}
                          </span>
                        </div>

                        <div className="relative z-10">
                          <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t.title}</h3>
                          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">{t.subtitle}</p>
                        </div>

                        <ul className="mt-6 space-y-3 relative z-10">
                          <li className="flex items-start gap-2.5 text-[13px] font-medium text-slate-600 dark:text-slate-400">
                            <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${isAvailable ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-300 dark:bg-slate-600"}`} />
                            提供本地 OpenAI 兼容接口
                          </li>
                          <li className="flex items-start gap-2.5 text-[13px] font-medium text-slate-600 dark:text-slate-400">
                            <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${isAvailable ? "bg-violet-500" : "bg-slate-300 dark:bg-slate-600"}`} />
                            内置 OpenClaw 网关引擎
                          </li>
                          <li className="flex items-start gap-2.5 text-[13px] font-medium text-slate-600 dark:text-slate-400">
                            <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${isAvailable ? "bg-sky-500" : "bg-slate-300 dark:bg-slate-600"}`} />
                            云端策略实时联动与拦截
                          </li>
                        </ul>
                      </div>

                      <div className="mt-8 relative z-10">
                        {isAvailable ? (
                          <a
                            href={t.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-brand-600 text-white dark:bg-brand-500 text-sm font-bold shadow-md shadow-brand-500/20 hover:bg-brand-700 dark:hover:bg-brand-400 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            立即下载 {t.title} 版
                          </a>
                        ) : (
                          <button
                            disabled
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800/50 dark:text-slate-500 text-sm font-bold cursor-not-allowed"
                          >
                            <Apple className="w-4 h-4" />
                            macOS 版本筹备中
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* 底部功能区 (Quick Start & FAQ) */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-20 border-t border-slate-200/60 dark:border-slate-800/60">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            
            {/* Quick Start 卡片 */}
            <div className="bg-white dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-[2rem] p-8 sm:p-10 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-brand-100 dark:bg-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
                  <Zap className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">快速安装指引</h2>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-8 font-medium">
                ClawHeart 采用无感式本地代理架构。启动后即可作为你本地 Agent 开发的统一入口。
              </p>
              
              <div className="space-y-6">
                {[
                  { title: "下载并安装", desc: "双击运行下载好的 ClawHeart Desktop 安装程序。" },
                  { title: "账号同步", desc: "在控制台中登录你的云端账号，自动拉取最新的技能与拦截规则库。" },
                  { title: "配置 SDK", desc: <>在你的 Agent 框架或 OpenAI SDK 中，将 Base URL 替换为 <code className="px-2 py-1 mx-1 rounded-md bg-slate-100 dark:bg-slate-800 text-brand-600 dark:text-brand-400 text-xs font-mono font-bold">http://127.0.0.1:19111/v1</code></> },
                ].map((step, idx) => (
                  <div key={idx} className="flex gap-4 group">
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-sm flex items-center justify-center group-hover:bg-brand-500 group-hover:text-white transition-colors shrink-0">
                        {idx + 1}
                      </div>
                      {idx !== 2 && <div className="w-px h-full bg-slate-200 dark:bg-slate-800 mt-2" />}
                    </div>
                    <div className="pb-6">
                      <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">{step.title}</h4>
                      <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* FAQ 区域 */}
            <div>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">常见问题答疑</h2>
                <p className="mt-2 text-slate-600 dark:text-slate-400 font-medium">了解更多关于架构设计与安全原理</p>
              </div>
              
              <div className="space-y-4">
                {[
                  {
                    id: "gate" as const,
                    q: "为什么需要桌面端？直接用云端不行吗？",
                    a: "桌面端把策略执行点放在本机环境，这更贴近真实代码执行的上下文。它能在工具（Tools）实际调用前直接进行校验、拦截与留痕，避免了频繁的云端往返延迟。同时提供了兼容 OpenAI 的 API 入口，你的代码只需修改一行 Base URL 即可无缝接入安全体系。",
                  },
                  {
                    id: "openclaw" as const,
                    q: "OpenClaw 和 ClawHeart 的关系是什么？",
                    a: "OpenClaw 是强大的 Agent 框架与底层网关生态。ClawHeart Desktop 在内部集成了 OpenClaw 作为核心执行引擎。这使得 OpenClaw 的所有上游请求都可以自动经过 ClawHeart 的安全策略层，实现了灵活开发与严格审计的统一。",
                  },
                  {
                    id: "trust" as const,
                    q: "如何验证下载包的可信度与安全性？",
                    a: "所有的正式发行版都会附带数字签名与版本说明。你可以在本页点击「查看版本更新日志」获取完整的 SHA256 校验码和改动说明。我们建议在企业环境部署前进行基础的哈希校验。",
                  },
                ].map((row) => {
                  const active = openFaq === row.id;
                  return (
                    <div
                      key={row.id}
                      className={`rounded-2xl border transition-colors duration-200 overflow-hidden
                        ${active 
                          ? "bg-white dark:bg-slate-900 border-brand-500/30 dark:border-brand-500/30 shadow-md shadow-brand-500/5" 
                          : "bg-white/50 dark:bg-slate-900/30 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"}
                      `}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaq((v) => (v === row.id ? null : row.id))}
                        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left focus:outline-none"
                      >
                        <div className={`font-bold text-sm ${active ? "text-brand-600 dark:text-brand-400" : "text-slate-900 dark:text-white"}`}>
                          {row.q}
                        </div>
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center transition-transform duration-200 ${active ? "rotate-180 bg-brand-50 dark:bg-brand-500/10 text-brand-500" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      </button>
                      
                      <div 
                        className={`grid transition-all duration-200 ease-in-out ${active ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                      >
                        <div className="overflow-hidden">
                          <div className="px-6 pb-6 text-sm text-slate-600 dark:text-slate-400 leading-relaxed pt-1 border-t border-slate-100 dark:border-slate-800/50 mt-1">
                            {row.a}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 页脚 */}
      <footer className="shrink-0 border-t border-slate-200/80 dark:border-slate-800/80 py-8 text-center bg-white/50 dark:bg-[#030712]/50">
        <div className="text-sm font-medium text-slate-500 dark:text-slate-500 flex items-center justify-center gap-3">
          <Link to="/" className="hover:text-slate-900 dark:hover:text-white transition-colors">
            返回官网首页
          </Link>
          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
          <span>© {new Date().getFullYear()} ClawHeart. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}