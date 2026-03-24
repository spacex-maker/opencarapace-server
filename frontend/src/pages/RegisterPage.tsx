import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Loader2, Lock, Mail, UserRound } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { AuthPageShell } from "../components/AuthPageShell";

const fieldClass =
  "w-full rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950/50 px-4 py-2.5 pl-11 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/35 focus:border-brand-500/40 transition-shadow";

export const RegisterPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { register, isAuthenticated } = useAuth();
  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    navigate(from, { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("密码至少 6 位");
      return;
    }
    setSubmitting(true);
    try {
      await register(email.trim(), password, displayName.trim() || undefined);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setError(msg || "注册失败，该邮箱可能已被使用");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPageShell
      title="创建你的账号"
      subtitle="几分钟内完成注册，即可使用安全评估、危险指令库与 API Key 管理。"
    >
      {error && (
        <div
          role="alert"
          className="mb-6 rounded-full border border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300 text-sm px-4 py-2.5"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="reg-email" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 ml-1">
            邮箱 <span className="text-red-500 dark:text-red-400 font-normal">*</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              id="reg-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
              placeholder="you@company.com"
            />
          </div>
        </div>
        <div>
          <label htmlFor="reg-password" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 ml-1">
            密码 <span className="text-red-500 dark:text-red-400 font-normal">*</span>
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              id="reg-password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={fieldClass}
              placeholder="至少 6 位"
            />
          </div>
          <p className="mt-1.5 ml-1 text-[11px] text-slate-500 dark:text-slate-500">建议使用字母与数字组合</p>
        </div>
        <div>
          <label htmlFor="reg-name" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 ml-1">
            昵称 <span className="text-slate-400 font-normal">（选填）</span>
          </label>
          <div className="relative">
            <UserRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={fieldClass}
              placeholder="在控制台中显示的名称"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full mt-2 flex items-center justify-center gap-2 rounded-full py-3 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold shadow-lg shadow-brand-600/25 disabled:opacity-50 disabled:pointer-events-none transition-colors"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              注册中…
            </>
          ) : (
            "注册并进入控制台"
          )}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
        已有账号？{" "}
        <Link
          to="/login"
          state={location.state}
          className="font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-500 dark:hover:text-brand-300"
        >
          去登录
        </Link>
      </p>
    </AuthPageShell>
  );
};
