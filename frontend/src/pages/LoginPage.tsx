import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Loader2, Lock, Mail } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { AuthPageShell } from "../components/AuthPageShell";
import { authErrorClass, authFieldClass, authPrimaryButtonClass } from "../components/authPageStyles";

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();
  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    navigate(from, { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setError(msg || "登录未成功，请确认邮箱与密码是否正确");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPageShell
      title="登录账户"
      subtitle="使用注册时填写的邮箱与密码进入控制台。"
    >
      {error && (
        <div role="alert" className={authErrorClass}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="login-email" className="mb-2 ml-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            电子邮箱
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              id="login-email"
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
          <label htmlFor="login-password" className="mb-2 ml-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            密码
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={authFieldClass}
              placeholder="••••••••"
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
              正在登录…
            </>
          ) : (
            "进入控制台"
          )}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
        尚未注册？{" "}
        <Link
          to="/register"
          state={location.state}
          className="font-semibold text-brand-600 underline-offset-4 transition-colors hover:text-brand-500 hover:underline dark:text-brand-400 dark:hover:text-brand-300"
        >
          前往注册
        </Link>
      </p>
    </AuthPageShell>
  );
};
