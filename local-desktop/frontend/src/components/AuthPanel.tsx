import { useState } from "react";
import { LocalStatus } from "./Common";
import { MdEmail, MdLock, MdShield } from "react-icons/md";

const pillRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 18px",
  borderRadius: 9999,
  border: "1px solid rgba(51,65,85,0.95)",
  background: "rgba(15,23,42,0.75)",
  boxShadow: "0 0 0 1px rgba(255,255,255,0.04) inset",
  transition: "border-color 0.2s, box-shadow 0.2s",
};

const pillInput: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  color: "#f1f5f9",
  fontSize: 14,
};

export function AuthPanel({ onLoggedIn }: { onLoggedIn: (s: LocalStatus) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailFocus, setEmailFocus] = useState(false);
  const [passwordFocus, setPasswordFocus] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("http://127.0.0.1:19111/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const text = await res.text();
      let data: any = null;
      try {
        const firstBrace = text.indexOf("{");
        const jsonStr = firstBrace >= 0 ? text.slice(firstBrace) : text;
        data = JSON.parse(jsonStr);
      } catch {
        setError(text.substring(0, 120) || "登录响应不是合法 JSON");
        return;
      }

      if (!res.ok) {
        setError(data?.error?.message || "登录失败");
        return;
      }

      const shown = (data?.displayName && String(data.displayName).trim()) || data?.email || email;
      setMessage(`登录成功：${shown}`);
      const statusRes = await fetch("http://127.0.0.1:19111/api/status");
      const statusData = await statusRes.json();
      onLoggedIn(statusData);
      setPassword("");
    } catch (e: any) {
      setError(e?.message ?? "登录失败");
    } finally {
      setLoading(false);
    }
  };

  const rowFocusStyle = (focused: boolean): React.CSSProperties =>
    focused
      ? {
          borderColor: "rgba(34,197,94,0.55)",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.05) inset, 0 0 0 3px rgba(34,197,94,0.18)",
        }
      : {};

  return (
    <div
      style={{
        maxWidth: 420,
        margin: "0 auto",
        padding: "8px 0 32px",
      }}
    >
      <div
        style={{
          borderRadius: 32,
          padding: "36px 32px 32px",
          background: "linear-gradient(165deg, rgba(15,23,42,0.98) 0%, rgba(2,6,23,0.99) 45%, rgba(15,23,42,0.95) 100%)",
          border: "1px solid rgba(51,65,85,0.9)",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.05) inset, 0 28px 56px rgba(0,0,0,0.45), 0 12px 24px rgba(34,197,94,0.06)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(145deg, #22c55e 0%, #16a34a 45%, #0d9488 100%)",
              boxShadow:
                "0 8px 28px rgba(34,197,94,0.4), 0 1px 0 rgba(255,255,255,0.22) inset, 0 -1px 0 rgba(0,0,0,0.12) inset",
              marginBottom: 18,
            }}
            aria-hidden
          >
            <MdShield style={{ fontSize: 34, color: "#ffffff", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))" }} />
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "#f8fafc",
              margin: 0,
              textAlign: "center",
            }}
          >
            登录云端账户
          </h1>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 13,
              lineHeight: 1.55,
              color: "#94a3b8",
              textAlign: "center",
              maxWidth: 320,
            }}
          >
            使用与网页端相同的账号。Token 保存在本机，用于同步规则与偏好设置。
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!loading) void handleLogin();
          }}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div>
            <div
              style={{
                ...pillRow,
                ...rowFocusStyle(emailFocus),
              }}
            >
              <MdEmail style={{ fontSize: 20, color: "#64748b", flexShrink: 0 }} aria-hidden />
              <input
                type="email"
                autoComplete="email"
                placeholder="邮箱地址"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setEmailFocus(true)}
                onBlur={() => setEmailFocus(false)}
                style={pillInput}
              />
            </div>
          </div>

          <div>
            <div
              style={{
                ...pillRow,
                ...rowFocusStyle(passwordFocus),
              }}
            >
              <MdLock style={{ fontSize: 20, color: "#64748b", flexShrink: 0 }} aria-hidden />
              <input
                type="password"
                autoComplete="current-password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocus(true)}
                onBlur={() => setPasswordFocus(false)}
                style={pillInput}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              width: "100%",
              padding: "14px 20px",
              borderRadius: 9999,
              border: "none",
              background: loading
                ? "linear-gradient(135deg, #475569, #334155)"
                : "linear-gradient(135deg, #22c55e, #16a34a)",
              color: loading ? "#cbd5e1" : "#022c22",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "0.02em",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 6px 20px rgba(34,197,94,0.35)",
              transition: "opacity 0.15s, transform 0.15s",
            }}
          >
            {loading ? "登录中…" : "登录"}
          </button>
        </form>

        {message && (
          <div
            style={{
              marginTop: 18,
              padding: "12px 16px",
              borderRadius: 9999,
              fontSize: 13,
              lineHeight: 1.45,
              color: "#86efac",
              background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.28)",
              textAlign: "center",
            }}
          >
            {message}
          </div>
        )}
        {error && (
          <div
            style={{
              marginTop: 18,
              padding: "12px 16px",
              borderRadius: 9999,
              fontSize: 13,
              lineHeight: 1.45,
              color: "#fca5a5",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(248,113,113,0.35)",
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
