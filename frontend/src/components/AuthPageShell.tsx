import { Link } from "react-router-dom";
import { Shield, Moon, Sun } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import type { ReactNode } from "react";

interface AuthPageShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

/** 登录 / 注册页共用：全屏背景、顶栏、与官网一致的视觉语言 */
export function AuthPageShell({ title, subtitle, children }: AuthPageShellProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col bg-[#fafbfc] dark:bg-[#030712] text-slate-900 dark:text-slate-100">
      <div
        className="pointer-events-none fixed inset-0 opacity-35 dark:opacity-25"
        aria-hidden
        style={{
          backgroundImage: `radial-gradient(at 20% 30%, rgba(59,130,246,0.2) 0px, transparent 45%),
            radial-gradient(at 85% 15%, rgba(168,85,247,0.15) 0px, transparent 40%),
            radial-gradient(at 50% 90%, rgba(34,197,94,0.08) 0px, transparent 45%)`,
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,#e2e8f006_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f006_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1e293b18_1px,transparent_1px),linear-gradient(to_bottom,#1e293b18_1px,transparent_1px)] bg-[size:56px_56px]"
        aria-hidden
      />

      <header className="relative z-10 shrink-0 h-14 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl">
        <div className="max-w-lg mx-auto h-full px-4 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2.5 text-slate-800 dark:text-white hover:opacity-90 transition-opacity"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-md shadow-brand-500/20">
              <Shield className="w-[18px] h-[18px] text-white" strokeWidth={2.2} />
            </div>
            <span className="font-semibold tracking-tight text-[15px]">ClawHeart</span>
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2.5 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={theme === "dark" ? "明亮模式" : "暗黑模式"}
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-[420px] space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-[1.65rem] font-semibold tracking-tight text-slate-950 dark:text-white">
              {title}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
              {subtitle}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white/85 dark:bg-slate-900/55 backdrop-blur-xl p-8 shadow-[0_24px_48px_-12px_rgba(15,23,42,0.12)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)]">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
