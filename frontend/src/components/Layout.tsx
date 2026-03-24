import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Shield, KeyRound, FileText, LogOut, ShieldAlert, Settings, Moon, Sun, BookOpen, ReceiptText, LayoutDashboard } from "lucide-react";
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
    <div className="h-screen flex overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* 左侧边栏：固定视口高度，底部用户名/退出始终在视口底部 */}
      <aside className="w-48 h-full flex flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/95 shrink-0">
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <Link to="/" className="flex items-center gap-2 text-slate-900 dark:text-white">
            <Shield className="w-6 h-6 text-brand-500" />
            <span className="font-semibold tracking-tight">ClawHeart</span>
          </Link>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">
          <nav className="space-y-0.5">
            <Link to="/dashboard" className={navItemClass("/dashboard")}>
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              概览
            </Link>
            {isAuthenticated && (
              <>
                <Link to="/settings" className={navItemClass("/settings")}>
                  <Settings className="w-4 h-4 shrink-0" />
                  用户设置
                </Link>
                <Link to="/skills" className={navItemClass("/skills")}>
                  <Shield className="w-4 h-4 shrink-0" />
                  Skills 仓库
                </Link>
                <Link to="/danger-commands" className={navItemClass("/danger-commands")}>
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  危险指令库
                </Link>
                <Link to="/api-keys" className={navItemClass("/api-keys")}>
                  <KeyRound className="w-4 h-4 shrink-0" />
                  API Keys
                </Link>
                <Link to="/my/intercept-logs" className={navItemClass("/my/intercept-logs")}>
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  拦截日志
                </Link>
                <Link to="/my/token-usages" className={navItemClass("/my/token-usages")}>
                  <ReceiptText className="w-4 h-4 shrink-0" />
                  Token 账单
                </Link>
              </>
            )}
            <Link to="/docs" className={navItemClass("/docs")}>
              <FileText className="w-4 h-4 shrink-0" />
              文档 / 使用说明
            </Link>
            {/* 未登录时不显示登录/注册菜单，访问需登录页面时会自动跳转到登录页 */}
          </nav>
        </div>
        {/* 管理员菜单：紧贴在用户信息上方，不随主导航滚动 */}
        {isAuthenticated && user?.role === "ADMIN" && (
          <div className="p-2 border-t border-slate-200 dark:border-slate-800 space-y-1 shrink-0">
            <div className="px-1 pt-1 text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
              管理员
            </div>
            <Link to="/admin/skills" className={navItemClass("/admin/skills")}>
              <Shield className="w-4 h-4 shrink-0" />
              技能管理
            </Link>
            <Link to="/admin/danger-commands" className={navItemClass("/admin/danger-commands")}>
              <ShieldAlert className="w-4 h-4 shrink-0" />
              危险指令库
            </Link>
            <Link to="/admin/system-config" className={navItemClass("/admin/system-config")}>
              <Settings className="w-4 h-4 shrink-0" />
              系统配置
            </Link>
            <Link to="/admin/intercept-logs" className={navItemClass("/admin/intercept-logs")}>
              <ShieldAlert className="w-4 h-4 shrink-0" />
              拦截日志
            </Link>
          </div>
        )}
        {/* 用户名与退出登录：始终贴在视口底部，不随滚动 */}
        {isAuthenticated && user && (
          <div className="p-2 border-t border-slate-200 dark:border-slate-800 space-y-1 shrink-0">
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
      {/* 主内容区：Header 顶、Footer 底固定，仅 main 滚动 */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
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
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 py-8">{children}</div>
        </main>
        <footer className="shrink-0 border-t border-slate-200 dark:border-slate-800 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
          © {new Date().getFullYear()} ClawHeart · 安全层 for Agent / Tools
        </footer>
      </div>
    </div>
  );
};

