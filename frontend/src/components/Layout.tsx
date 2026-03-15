import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Shield, KeyRound, FileText, LogOut, ShieldAlert, Settings, Moon, Sun, BookOpen } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";

interface Props {
  children: ReactNode;
}

export const Layout = ({ children }: Props) => {
  const location = useLocation();
  const { isAuthenticated, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const navItemClass = (path: string) =>
    `flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm ${
      location.pathname === path
        ? "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-white"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800"
    }`;

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      {/* 左侧边栏 */}
      <aside className="w-48 flex flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/95 shrink-0">
        <div className="p-3 border-b border-slate-200 dark:border-slate-800">
          <Link to="/" className="flex items-center gap-2 text-slate-900 dark:text-white">
            <Shield className="w-6 h-6 text-brand-500" />
            <span className="font-semibold tracking-tight">ClawHeart</span>
          </Link>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          <Link to="/dashboard" className={navItemClass("/dashboard")}>
            <KeyRound className="w-4 h-4 shrink-0" />
            用户后台
          </Link>
          <Link to="/docs" className={navItemClass("/docs")}>
            <FileText className="w-4 h-4 shrink-0" />
            API 文档
          </Link>
          {isAuthenticated && user?.role === "ADMIN" && (
            <>
              <Link to="/admin/danger-commands" className={navItemClass("/admin/danger-commands")}>
                <ShieldAlert className="w-4 h-4 shrink-0" />
                危险指令库
              </Link>
              <Link to="/admin/system-config" className={navItemClass("/admin/system-config")}>
                <Settings className="w-4 h-4 shrink-0" />
                系统配置
              </Link>
            </>
          )}
          {!isAuthenticated && (
            <>
              <Link to="/login" className={navItemClass("/login")}>
                登录
              </Link>
              <Link to="/register" className={navItemClass("/register")}>
                注册
              </Link>
            </>
          )}
        </nav>
        {isAuthenticated && user && (
          <div className="p-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
            <div className="px-3 py-2 text-slate-500 dark:text-slate-400 text-xs truncate" title={user.email}>
              {user.displayName || user.email}
            </div>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800"
              title="退出登录"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              退出登录
            </button>
          </div>
        )}
      </aside>
      {/* 主内容区：Header + 内容 */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur flex items-center justify-end px-4 gap-2">
          <Link
            to="/intro"
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
          >
            <BookOpen className="w-4 h-4" />
            官网介绍
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
            title={theme === "dark" ? "切换为明亮模式" : "切换为暗黑模式"}
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>
        </header>
        <main className="flex-1">
          <div className="max-w-5xl mx-auto px-4 py-8">{children}</div>
        </main>
        <footer className="border-t border-slate-200 dark:border-slate-800 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
          © {new Date().getFullYear()} ClawHeart · 安全层 for Agent / Tools
        </footer>
      </div>
    </div>
  );
};

