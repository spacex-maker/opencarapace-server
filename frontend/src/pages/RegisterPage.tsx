import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Shield } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

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
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : null;
      setError(msg || "注册失败，该邮箱可能已被使用");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12">
      <div className="flex flex-col items-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center mb-4">
          <Shield className="w-6 h-6 text-brand-400" />
        </div>
        <h1 className="text-xl font-semibold text-slate-100">注册 OpenCarapace</h1>
        <p className="text-sm text-slate-400 mt-1">
          创建账号后即可使用安全评估与 API Key 管理
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              邮箱 <span className="text-slate-500">*</span>
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              密码 <span className="text-slate-500">*</span>
            </label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
              placeholder="至少 6 位"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              昵称 <span className="text-slate-500">（选填）</span>
            </label>
            <input
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500"
              placeholder="显示名称"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "注册中…" : "注册"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400">
          已有账号？{" "}
          <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">
            去登录
          </Link>
        </p>
      </div>
    </div>
  );
};
