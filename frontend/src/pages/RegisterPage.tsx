import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Loader2, Lock, Mail, UserRound } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { AuthPageShell } from "../components/AuthPageShell";
import { authErrorClass, authFieldClass, authPrimaryButtonClass } from "../components/authPageStyles";

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
      setError("密码长度至少为 6 位");
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
      setError(msg || "注册未成功，该邮箱可能已存在");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPageShell
      title="注册账户"
      subtitle="开通后与官网控制台共用同一账号，可随时登录管理配置。"
    >
      {error && (
        <div role="alert" className={authErrorClass}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="reg-email" className="mb-2 ml-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            电子邮箱 <span className="font-normal text-red-500 dark:text-red-400">*</span>
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              id="reg-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={authFieldClass}
              placeholder="name@example.com"
            />
          </div>
        </div>
        <div>
          <label htmlFor="reg-password" className="mb-2 ml-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            登录密码 <span className="font-normal text-red-500 dark:text-red-400">*</span>
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              id="reg-password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={authFieldClass}
              placeholder="不少于 6 位"
            />
          </div>
          <p className="mt-1.5 ml-1 text-[11px] text-slate-500 dark:text-slate-500">建议包含字母与数字，勿与其他网站共用同一密码</p>
        </div>
        <div>
          <label htmlFor="reg-name" className="mb-2 ml-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            显示名称 <span className="font-normal text-slate-400">（选填）</span>
          </label>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={authFieldClass}
              placeholder="在控制台中展示，如姓名或团队名"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className={`${authPrimaryButtonClass} mt-1 flex items-center justify-center gap-2`}
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              正在提交…
            </>
          ) : (
            "完成注册"
          )}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
        已有账户？{" "}
        <Link
          to="/login"
          state={location.state}
          className="font-semibold text-brand-600 underline-offset-4 transition-colors hover:text-brand-500 hover:underline dark:text-brand-400 dark:hover:text-brand-300"
        >
          返回登录
        </Link>
      </p>
    </AuthPageShell>
  );
};
