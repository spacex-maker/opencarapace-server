import { useEffect, useRef, useState } from "react";
import { LocalStatus } from "./types";
import { NavButton } from "./components/Common";
import { OverviewPanel } from "./components/OverviewPanel";
import { DangerPanel } from "./components/DangerPanel";
import { SkillsPanel } from "./components/SkillsPanel";
import { AuthPanel } from "./components/AuthPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { DocsPanel } from "./components/DocsPanel";
import { OpenClawPanel } from "./components/OpenClawPanel";
import { InterceptLogsPanel } from "./components/InterceptLogsPanel";
import { TokenBillPanel } from "./components/TokenBillPanel";
import { 
  MdDashboard, 
  MdWarning, 
  MdExtension, 
  MdBlock, 
  MdAttachMoney, 
  MdSettings, 
  MdDescription,
  MdApps
} from "react-icons/md";

export function App() {
  const [status, setStatus] = useState<LocalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "danger" | "skills" | "interceptLogs" | "tokenBill" | "openclaw" | "settings" | "docs" | "auth"
  >("overview");

  const [apiBase, setApiBase] = useState("https://api.clawheart.live");
  const [ocApiKey, setOcApiKey] = useState("");
  const [latency, setLatency] = useState<number | null>(null);
  const [accountSwitchSyncing, setAccountSwitchSyncing] = useState(false);
  const [accountSwitchStartedAt, setAccountSwitchStartedAt] = useState<number>(0);
  const lastAuthEmailRef = useRef<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const start = performance.now();
        const res = await fetch("http://127.0.0.1:19111/api/status");
        const data = await res.json();
        const elapsed = Math.round(performance.now() - start);
        setLatency(elapsed);
        setStatus(data);
        if (data?.settings) {
          setApiBase(data.settings.apiBase ?? "https://api.clawheart.live");
          setOcApiKey(data.settings.ocApiKey ?? "");
        }
      } catch (e: any) {
        setError(e?.message ?? "加载本地状态失败");
        setLatency(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const currentEmail = status?.auth?.email ? String(status.auth.email).trim().toLowerCase() : null;
    if (lastAuthEmailRef.current === null) {
      lastAuthEmailRef.current = currentEmail;
      return;
    }
    if (currentEmail !== lastAuthEmailRef.current) {
      if (currentEmail) {
        setAccountSwitchStartedAt(Date.now());
        setAccountSwitchSyncing(true);
      } else {
        setAccountSwitchSyncing(false);
        setAccountSwitchStartedAt(0);
      }
      lastAuthEmailRef.current = currentEmail;
    }
  }, [status?.auth?.email]);

  useEffect(() => {
    if (!accountSwitchSyncing) return;
    let active = true;
    const minPlaceholderMs = 1200;
    const maxPlaceholderMs = 20000;
    const startedAt = accountSwitchStartedAt || Date.now();
    const timer = setInterval(async () => {
      if (!active) return;
      const elapsed = Date.now() - startedAt;
      if (elapsed >= maxPlaceholderMs) {
        setAccountSwitchSyncing(false);
        return;
      }
      try {
        const [dangerRes, skillsRes] = await Promise.all([
          fetch("http://127.0.0.1:19111/api/sync-status?type=danger"),
          fetch("http://127.0.0.1:19111/api/sync-status?type=skills"),
        ]);
        const [dangerJson, skillsJson] = await Promise.all([dangerRes.json(), skillsRes.json()]);
        const running = !!dangerJson?.running || !!skillsJson?.running;
        if (!running && elapsed >= minPlaceholderMs) {
          setAccountSwitchSyncing(false);
        }
      } catch {
        // ignore polling errors
      }
    }, 1200);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [accountSwitchSyncing, accountSwitchStartedAt]);

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
    const start = performance.now();
    const res = await fetch("http://127.0.0.1:19111/api/status");
    const data = await res.json();
    const elapsed = Math.round(performance.now() - start);
    setLatency(elapsed);
    setStatus(data);
    if (data?.settings) {
      setApiBase(data.settings.apiBase ?? "https://api.clawheart.live");
      setOcApiKey(data.settings.ocApiKey ?? "");
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
        body: JSON.stringify({ apiBase: apiBase.trim(), ocApiKey: ocApiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "保存失败");
      } else {
        setMessage("保存成功，已在后台触发规则同步。");
        // 刷新状态以更新连接状态显示
        await refreshStatus();
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
          <NavButton label="概览" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} icon={<MdDashboard />} />
          <NavButton label="危险指令库" active={activeTab === "danger"} onClick={() => setActiveTab("danger")} icon={<MdWarning />} />
          <NavButton label="Skills 仓库" active={activeTab === "skills"} onClick={() => setActiveTab("skills")} icon={<MdExtension />} />
          <NavButton label="拦截日志" active={activeTab === "interceptLogs"} onClick={() => setActiveTab("interceptLogs")} icon={<MdBlock />} />
          <NavButton label="Token 账单" active={activeTab === "tokenBill"} onClick={() => setActiveTab("tokenBill")} icon={<MdAttachMoney />} />
          <NavButton label="OpenClaw" active={activeTab === "openclaw"} onClick={() => setActiveTab("openclaw")} icon={<MdApps />} />
          <NavButton label="设置" active={activeTab === "settings"} onClick={() => setActiveTab("settings")} icon={<MdSettings />} />
          <NavButton label="文档 / 使用说明" active={activeTab === "docs"} onClick={() => setActiveTab("docs")} icon={<MdDescription />} />
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
          />
        )}
        {activeTab === "danger" && <DangerPanel showAccountSwitchPlaceholder={accountSwitchSyncing} />}
        {activeTab === "skills" && <SkillsPanel showAccountSwitchPlaceholder={accountSwitchSyncing} />}
        {activeTab === "interceptLogs" && <InterceptLogsPanel />}
        {activeTab === "tokenBill" && <TokenBillPanel />}
        {activeTab === "openclaw" && <OpenClawPanel />}
        {activeTab === "settings" && <SettingsPanel onApiBaseChanged={refreshStatus} status={status} />}
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
        {latency !== null && isConnected && (
          <span style={{ color: "#6b7280", fontSize: 10 }}>
            {latency}ms
          </span>
        )}
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

