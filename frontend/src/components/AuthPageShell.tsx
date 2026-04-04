import { Link } from "react-router-dom";
import { Shield, Moon, Sun, Sparkles } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import type { ReactNode } from "react";

interface AuthPageShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

/** 登录 / 注册页：全屏氛围背景、顶栏、大标题与玻璃表单区 */
export function AuthPageShell({ title, subtitle, children }: AuthPageShellProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-[#f4f6fb] text-slate-900 dark:bg-[#030712] dark:text-slate-100">
      {/* 底层渐变流动 */}
      <div
        className="pointer-events-none fixed inset-0 auth-gradient-sheen opacity-90 dark:opacity-100"
        aria-hidden
      />
      {/* 光斑 */}
      <div
        className="pointer-events-none fixed -left-32 top-1/4 h-[min(520px,80vw)] w-[min(520px,80vw)] rounded-full bg-brand-500/25 blur-[100px] dark:bg-brand-500/20 auth-blob"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed -right-24 top-1/3 h-[min(440px,70vw)] w-[min(440px,70vw)] rounded-full bg-violet-500/20 blur-[100px] dark:bg-violet-500/25 auth-blob-delayed"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed bottom-0 left-1/2 h-64 w-[min(900px,120%)] -translate-x-1/2 translate-y-1/3 rounded-full bg-cyan-500/15 blur-[90px] dark:bg-cyan-400/10"
        aria-hidden
      />
      {/* 细网格 */}
      <div
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,#64748b0a_1px,transparent_1px),linear-gradient(to_bottom,#64748b0a_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_75%_65%_at_50%_35%,black,transparent)]"
        aria-hidden
      />
      {/* 底部暗角 */}
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_100%,transparent_40%,rgba(15,23,42,0.06)_100%)] dark:bg-[radial-gradient(ellipse_120%_80%_at_50%_100%,transparent_35%,rgba(0,0,0,0.45)_100%)]"
        aria-hidden
      />

      <header className="relative z-20 shrink-0 border-b border-slate-200/70 bg-white/65 backdrop-blur-xl dark:border-white/[0.06] dark:bg-slate-950/40">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            to="/"
            className="group flex items-center gap-2.5 text-slate-800 transition-opacity hover:opacity-90 dark:text-white"
          >
            <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-600/30 ring-1 ring-white/25">
              <Shield className="relative z-[1] h-[18px] w-[18px] text-white" strokeWidth={2.2} />
              <span className="absolute inset-0 bg-gradient-to-tr from-white/25 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">ClawHeart</span>
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full p-2.5 text-slate-500 transition-colors hover:bg-slate-900/5 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
            title={theme === "dark" ? "明亮模式" : "暗黑模式"}
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center px-4 pb-16 pt-8 sm:px-6 sm:pb-20 sm:pt-10 md:pt-14">
        <div className="w-full max-w-[440px] space-y-8">
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/15 via-violet-500/10 to-cyan-500/10 shadow-[0_0_0_1px_rgba(255,255,255,0.12)_inset,0_20px_50px_-20px_rgba(59,130,246,0.35)] ring-1 ring-slate-900/5 backdrop-blur-md dark:from-brand-400/20 dark:via-violet-400/15 dark:to-cyan-400/10 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_24px_64px_-24px_rgba(59,130,246,0.45)] dark:ring-white/10">
              <Shield
                className="h-10 w-10 text-brand-600 dark:text-brand-400"
                strokeWidth={1.5}
              />
            </div>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/60 px-3 py-1 text-[11px] font-medium tracking-wide text-slate-500 backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
              <Sparkles className="h-3 w-3 shrink-0 text-brand-500 dark:text-brand-400" strokeWidth={2} />
              账户中心
            </div>
            <h1 className="bg-gradient-to-b from-slate-900 to-slate-700 bg-clip-text text-3xl font-bold tracking-tight text-transparent dark:from-white dark:to-slate-300 sm:text-[2rem] sm:leading-tight">
              {title}
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {subtitle}
            </p>
            <div
              className="mx-auto mt-5 h-px w-24 bg-gradient-to-r from-transparent via-brand-500/50 to-transparent dark:via-brand-400/40"
              aria-hidden
            />
          </div>

          <div className="rounded-3xl border border-slate-200/60 bg-white/70 p-8 shadow-[0_32px_64px_-24px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-slate-950/50 dark:shadow-[0_32px_64px_-28px_rgba(0,0,0,0.55)]">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
