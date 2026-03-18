import { useState } from "react";
import { Field, LocalStatus } from "./Common";

export function AuthPanel({ onLoggedIn }: { onLoggedIn: (s: LocalStatus) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      setMessage(`登录成功：${data?.email ?? email}`);
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

  return (
    <div
      style={{
        maxWidth: 520,
        margin: "0 auto",
        background: "#020617",
        borderRadius: 16,
        padding: "24px 28px",
        border: "1px solid #1f2937",
        boxShadow: "0 20px 40px rgba(15,23,42,0.6)",
      }}
    >
      <h1 style={{ fontSize: 20, margin: "0 0 4px", color: "#f9fafb" }}>登录云端账户</h1>
      <p style={{ margin: "4px 0 16px", fontSize: 13, color: "#9ca3af" }}>
        用与你网页端相同的账号登录，桌面客户端会在本地保存 token，用于同步规则和用户偏好。
      </p>

      <Field label="邮箱" value={email} onChange={setEmail} />
      <div style={{ marginBottom: 10 }}>
        <label
          style={{
            display: "block",
            fontSize: 12,
            color: "#9ca3af",
            marginBottom: 4,
          }}
        >
          密码
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: "7px 9px",
            borderRadius: 8,
            border: "1px solid #1f2937",
            background: "#020617",
            color: "#e5e7eb",
            fontSize: 13,
          }}
        />
      </div>
      <button
        type="button"
        onClick={handleLogin}
        disabled={loading}
        style={{
          marginTop: 6,
          padding: "8px 14px",
          borderRadius: 999,
          border: "none",
          background: "#22c55e",
          color: "#022c22",
          fontSize: 13,
          fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "登录中…" : "登录"}
      </button>
      {message && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#4ade80" }}>{message}</div>
      )}
      {error && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#f97373" }}>{error}</div>
      )}
    </div>
  );
}

