import { useEffect, useState } from "react";
import { LocalStatus } from "./types";
import { NavButton } from "./components/Common";
import { OverviewPanel } from "./components/OverviewPanel";
import { LocalManagePanel } from "./components/LocalManagePanel";
import { DangerPanel } from "./components/DangerPanel";
import { SkillsPanel } from "./components/SkillsPanel";
import { AuthPanel } from "./components/AuthPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { DocsPanel } from "./components/DocsPanel";
import { OpenClawPanel } from "./components/OpenClawPanel";

export function App() {
  const [status, setStatus] = useState<LocalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "local" | "danger" | "skills" | "openclaw" | "settings" | "docs" | "auth"
  >("overview");

  const [apiBase, setApiBase] = useState("https://api.clawheart.live");
  const [ocApiKey, setOcApiKey] = useState("");
  const [llmKey, setLlmKey] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("http://127.0.0.1:19111/api/status");
        const data = await res.json();
        setStatus(data);
        if (data?.settings) {
          setApiBase(data.settings.apiBase ?? "https://api.clawheart.live");
          setOcApiKey(data.settings.ocApiKey ?? "");
          setLlmKey(data.settings.llmKey ?? "");
        }
      } catch (e: any) {
        setError(e?.message ?? "加载本地状态失败");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    let isActive = true;

    const checkAndSync = async () => {
      if (!isActive) return;
      try {
        const res = await fetch("http://127.0.0.1:19111/api/user-settings/check-version");
        if (!res.ok) return;
        const data = await res.json();
        if (data?.needSync && data?.cloudVersion) {
          await fetch("http://127.0.0.1:19111/api/user-settings/sync", { method: "POST" });
        }
      } catch {
        // ignore
      }
    };

    checkAndSync();
    const timer = setInterval(checkAndSync, 30000);

    return () => {
      isActive = false;
      clearInterval(timer);
    };
  }, []);

  const refreshStatus = async () => {
    const res = await fetch("http://127.0.0.1:19111/api/status");
    const data = await res.json();
    setStatus(data);
    if (data?.settings) {
      setApiBase(data.settings.apiBase ?? "https://api.clawheart.live");
      setOcApiKey(data.settings.ocApiKey ?? "");
      setLlmKey(data.settings.llmKey ?? "");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("http://127.0.0.1:19111/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiBase: apiBase.trim(), ocApiKey: ocApiKey.trim(), llmKey: llmKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "保存失败");
      } else {
        setMessage("保存成功，已在后台触发规则同步。");
      }
    } catch (e: any) {
      setError(e?.message ?? "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleLoggedIn = (s: LocalStatus) => {
    setStatus(s);
    setActiveTab("overview");
  };

  const handleLogout = async () => {
    try {
      setError(null);
      setMessage(null);
      await fetch("http://127.0.0.1:19111/api/auth/logout", { method: "POST" });
      await refreshStatus();
      setActiveTab("overview");
      setMessage("已退出登录。");
    } catch (e: any) {
      setError(e?.message ?? "退出登录失败");
    }
  };

  const isConnected = !loading && !error && !!status?.settings?.apiBase;
  const connectionLabel = isConnected ? "已连接服务器" : loading ? "正在连接服务器…" : "服务器连接异常";
  const connectionDotColor = isConnected ? "#22c55e" : loading ? "#fbbf24" : "#f97373";

  return (
    <div
      style={{
        height: "100%",
        background: "#020617",
        color: "#e5e7eb",
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        display: "flex",
        overflow: "hidden",
      }}
    >
      {/* 左侧菜单 */}
      <div
        style={{
          width: 220,
          borderRight: "1px solid #1f2937",
          padding: "16px 12px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>ClawHeart</div>
          <NavButton label="概览 / 连接配置" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
          <NavButton label="本地管理" active={activeTab === "local"} onClick={() => setActiveTab("local")} />
          <NavButton label="危险指令库" active={activeTab === "danger"} onClick={() => setActiveTab("danger")} />
          <NavButton label="Skills 仓库" active={activeTab === "skills"} onClick={() => setActiveTab("skills")} />
          <NavButton label="OpenClaw" active={activeTab === "openclaw"} onClick={() => setActiveTab("openclaw")} />
          <NavButton label="设置" active={activeTab === "settings"} onClick={() => setActiveTab("settings")} />
          <NavButton label="文档 / 使用说明" active={activeTab === "docs"} onClick={() => setActiveTab("docs")} />
        </div>

        {/* 左下角账户信息 + 登录入口 */}
        <div style={{ marginTop: 16, fontSize: 11 }}>
          <div style={{ color: "#6b7280", marginBottom: 4 }}>账户</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "999px",
                background: "linear-gradient(135deg, #22c55e, #0ea5e9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#022c22",
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {(status?.auth?.email || "U").charAt(0).toUpperCase()}
            </div>
            {status?.auth?.email ? (
              <div
                style={{
                  fontSize: 11,
                  color: "#9ca3af",
                  wordBreak: "break-all",
                }}
              >
                已登录：{status.auth.email}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: "#6b7280" }}>未登录</div>
            )}
          </div>
          {!status?.auth?.email && (
            <button
              type="button"
              onClick={() => setActiveTab("auth")}
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: 999,
                border: "none",
                background: "#22c55e",
                color: "#022c22",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              登录
            </button>
          )}
          {!!status?.auth?.email && (
            <button
              type="button"
              onClick={handleLogout}
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #374151",
                background: "transparent",
                color: "#e5e7eb",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                marginTop: 6,
              }}
            >
              退出登录
            </button>
          )}
        </div>
      </div>

      {/* 右侧内容 */}
      <div
        style={{
          flex: 1,
          padding: 32,
          boxSizing: "border-box",
          overflowY: "auto",
        }}
      >
        {activeTab === "overview" && (
          <OverviewPanel
            status={status}
            loading={loading}
            apiBase={apiBase}
            ocApiKey={ocApiKey}
            llmKey={llmKey}
            setApiBase={setApiBase}
            setOcApiKey={setOcApiKey}
            setLlmKey={setLlmKey}
            saving={saving}
            message={message}
            error={error}
            onSave={handleSave}
          />
        )}
        {activeTab === "local" && <LocalManagePanel status={status} />}
        {activeTab === "danger" && <DangerPanel />}
        {activeTab === "skills" && <SkillsPanel />}
        {activeTab === "openclaw" && <OpenClawPanel />}
        {activeTab === "settings" && <SettingsPanel />}
        {activeTab === "docs" && <DocsPanel />}
        {activeTab === "auth" && <AuthPanel onLoggedIn={handleLoggedIn} />}
      </div>

      {/* 右下角服务器连接状态 */}
      <div
        style={{
          position: "fixed",
          right: 18,
          bottom: 16,
          padding: "6px 10px",
          borderRadius: 999,
          background: "rgba(15,23,42,0.96)",
          border: "1px solid #111827",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          color: "#9ca3af",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background: connectionDotColor,
            boxShadow: isConnected ? "0 0 0 4px rgba(34,197,94,0.18)" : "none",
          }}
        />
        <span>{connectionLabel}</span>
        {status?.settings?.apiBase && (
          <span
            style={{
              maxWidth: 180,
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              overflow: "hidden",
              color: "#6b7280",
            }}
            title={status.settings.apiBase}
          >
            {status.settings.apiBase}
          </span>
        )}
      </div>
    </div>
  );
}

