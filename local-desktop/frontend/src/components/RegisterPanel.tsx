import { useState } from "react";
import { LocalStatus } from "./Common";
import { MdEmail, MdLock, MdPerson, MdShield } from "react-icons/md";
import { getAuthFormTheme, type AuthFormTheme } from "./authFormTheme";

export function RegisterPanel({
  theme,
  onRegistered,
  onGoLogin,
}: {
  theme: AuthFormTheme;
  onRegistered: (s: LocalStatus) => void;
  onGoLogin: () => void;
}) {
  const th = getAuthFormTheme(theme);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailFocus, setEmailFocus] = useState(false);
  const [passwordFocus, setPasswordFocus] = useState(false);
  const [nameFocus, setNameFocus] = useState(false);

  const handleRegister = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);
    if (password.length < 6) {
      setError("密码至少 6 位");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("http://127.0.0.1:19111/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName: displayName.trim() || undefined,
        }),
      });
      const text = await res.text();
      let data: any = null;
      try {
        const firstBrace = text.indexOf("{");
        const jsonStr = firstBrace >= 0 ? text.slice(firstBrace) : text;
        data = JSON.parse(jsonStr);
      } catch {
        setError(text.substring(0, 120) || "注册响应不是合法 JSON");
        return;
      }

      if (!res.ok) {
        setError(data?.error?.message || data?.message || "注册失败，该邮箱可能已被使用");
        return;
      }

      const shown = (data?.displayName && String(data.displayName).trim()) || data?.email || email;
      setMessage(`注册成功：${shown}`);
      const statusRes = await fetch("http://127.0.0.1:19111/api/status");
      const statusData = await statusRes.json();
      onRegistered(statusData);
      setPassword("");
    } catch (e: any) {
      setError(e?.message ?? "注册失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 420,
        margin: "0 auto",
        padding: "8px 0 32px",
        ...th.root,
      }}
    >
      <style>{th.placeholderCss}</style>
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
              boxShadow: "none",
              marginBottom: 18,
            }}
            aria-hidden
          >
            <MdShield style={{ fontSize: 34, color: "#ffffff" }} />
          </div>
          <h1 style={th.title}>注册云端账户</h1>
          <p style={th.subtitle}>与网页端使用同一套接口。注册成功后自动登录并同步规则。</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!loading) void handleRegister();
          }}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div>
            <div style={{ ...th.pillRow, ...th.rowFocusStyle(emailFocus) }}>
              <MdEmail style={{ fontSize: 20, color: th.iconMuted, flexShrink: 0 }} aria-hidden />
              <input
                type="email"
                autoComplete="email"
                placeholder="邮箱地址"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setEmailFocus(true)}
                onBlur={() => setEmailFocus(false)}
                className="auth-form-ph"
                style={th.pillInput}
                required
              />
            </div>
          </div>

          <div>
            <div style={{ ...th.pillRow, ...th.rowFocusStyle(passwordFocus) }}>
              <MdLock style={{ fontSize: 20, color: th.iconMuted, flexShrink: 0 }} aria-hidden />
              <input
                type="password"
                autoComplete="new-password"
                placeholder="密码（至少 6 位）"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocus(true)}
                onBlur={() => setPasswordFocus(false)}
                className="auth-form-ph"
                style={th.pillInput}
                minLength={6}
                required
              />
            </div>
          </div>

          <div>
            <div style={{ ...th.pillRow, ...th.rowFocusStyle(nameFocus) }}>
              <MdPerson style={{ fontSize: 20, color: th.iconMuted, flexShrink: 0 }} aria-hidden />
              <input
                type="text"
                autoComplete="nickname"
                placeholder="昵称（选填）"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onFocus={() => setNameFocus(true)}
                onBlur={() => setNameFocus(false)}
                className="auth-form-ph"
                style={th.pillInput}
              />
            </div>
          </div>

          <button type="submit" disabled={loading} style={th.submitButton(loading)}>
            {loading ? "注册中…" : "注册并登录"}
          </button>
        </form>

        <p
          style={{
            marginTop: 22,
            textAlign: "center",
            ...th.footerMuted,
          }}
        >
          已有账号？{" "}
          <button
            type="button"
            onClick={onGoLogin}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              color: th.linkAccent,
              fontWeight: 700,
              cursor: "pointer",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            去登录
          </button>
        </p>

      {message && <div style={th.messageSuccess}>{message}</div>}
      {error && <div style={th.messageError}>{error}</div>}
    </div>
  );
}
