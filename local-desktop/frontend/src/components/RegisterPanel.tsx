import { useState } from "react";
import { useI18n } from "../i18n";
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
  const { t } = useI18n();
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
      setError(t("authPage.register.errPasswordMin"));
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
        setError(text.substring(0, 120) || t("authPage.register.errBadJson"));
        return;
      }

      if (!res.ok) {
        setError(data?.error?.message || data?.message || t("authPage.register.errEmailTaken"));
        return;
      }

      const shown = (data?.displayName && String(data.displayName).trim()) || data?.email || email;
      setMessage(t("authPage.register.successWithName").replace("{name}", String(shown)));
      const statusRes = await fetch("http://127.0.0.1:19111/api/status");
      const statusData = await statusRes.json();
      onRegistered(statusData);
      setPassword("");
    } catch (e: any) {
      setError(e?.message ?? t("authPage.register.errFailed"));
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
          <h1 style={th.title}>{t("authPage.register.title")}</h1>
          <p style={th.subtitle}>{t("authPage.register.subtitle")}</p>
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
                placeholder={t("authPage.register.emailPlaceholder")}
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
                placeholder={t("authPage.register.passwordPlaceholder")}
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
                placeholder={t("authPage.register.nicknamePlaceholder")}
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
            {loading ? t("authPage.register.submitting") : t("authPage.register.submit")}
          </button>
        </form>

        <p
          style={{
            marginTop: 22,
            textAlign: "center",
            ...th.footerMuted,
          }}
        >
          {t("authPage.register.hasAccount")}{" "}
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
            {t("authPage.register.goLogin")}
          </button>
        </p>

      {message && <div style={th.messageSuccess}>{message}</div>}
      {error && <div style={th.messageError}>{error}</div>}
    </div>
  );
}
