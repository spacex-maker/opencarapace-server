import { useEffect, useRef, useState } from "react";
import { LocalStatus } from "./types";
import { OverviewPanel } from "./components/OverviewPanel";
import { SkillsPanel } from "./components/SkillsPanel";
import { AuthPanel } from "./components/AuthPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { OpenClawPanel } from "./components/OpenClawPanel";
import { InterceptLogsPanel } from "./components/InterceptLogsPanel";
import { TokenBillPanel } from "./components/TokenBillPanel";
import { SecurityScanPanel } from "./components/SecurityScanPanel";
import { AgentMgmtPanel } from "./components/AgentMgmtPanel";
import {
  MdDashboard,
  MdStorefront,
  MdBlock,
  MdAttachMoney,
  MdSettings,
  MdApps,
  MdShield,
  MdManageSearch,
  MdAccountTree,
} from "react-icons/md";

export function App() {
  const [status, setStatus] = useState<LocalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "skills"
    | "securityScan"
    | "interceptLogs"
    | "tokenBill"
    | "openclaw"
    | "settings"
    | "auth"
    | "agentMgmt"
  >("overview");

  const [apiBase, setApiBase] = useState("https://api.clawheart.live");
  const [ocApiKey, setOcApiKey] = useState("");
  const [latency, setLatency] = useState<number | null>(null);
  const [accountSwitchSyncing, setAccountSwitchSyncing] = useState(false);
  const [accountSwitchStartedAt, setAccountSwitchStartedAt] = useState<number>(0);
  const lastAuthEmailRef = useRef<string | null>(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [logoutSubmitting, setLogoutSubmitting] = useState(false);

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

  const performLogout = async () => {
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

  const confirmLogout = async () => {
    setLogoutSubmitting(true);
    try {
      await performLogout();
    } finally {
      setLogoutSubmitting(false);
      setLogoutConfirmOpen(false);
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
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* 顶部横向导航栏 */}
      <div
        style={{
          flexShrink: 0,
          height: 64,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "10px 14px",
          boxSizing: "border-box",
          borderBottom: "1px solid #1f2937",
          background: "rgba(2,6,23,0.92)",
          backdropFilter: "blur(10px)",
        }}
      >
        {/* 左侧品牌区 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              flexShrink: 0,
              background: "linear-gradient(145deg, #22c55e 0%, #16a34a 45%, #0d9488 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow:
                "0 4px 16px rgba(34,197,94,0.4), 0 1px 0 rgba(255,255,255,0.2) inset, 0 -1px 0 rgba(0,0,0,0.15) inset",
            }}
            aria-hidden
          >
            <MdShield style={{ fontSize: 22, color: "#ffffff", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))" }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em", color: "#f8fafc", lineHeight: 1.1 }}>
              ClawHeart
            </div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.14em",
                color: "#64748b",
                textTransform: "uppercase",
                marginTop: 2,
                whiteSpace: "nowrap",
              }}
            >
              Desktop · Agent Security
            </div>
          </div>
        </div>

        {/* 中间横向菜单（可横向滚动） */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
            overflowX: "auto",
            overflowY: "hidden",
            padding: "2px 2px",
          }}
        >
          {(
            [
              { key: "overview", label: "总览", icon: <MdDashboard /> },
              { key: "securityScan", label: "安全扫描", icon: <MdManageSearch /> },
              { key: "interceptLogs", label: "拦截监控", icon: <MdBlock /> },
              { key: "tokenBill", label: "Token 账单", icon: <MdAttachMoney /> },
              { key: "openclaw", label: "OpenClaw", icon: <MdApps /> },
              { key: "skills", label: "安全市场", icon: <MdStorefront /> },
              { key: "agentMgmt", label: "Agent 管理", icon: <MdAccountTree /> },
            ] as const
          ).map((item) => {
            const isActive = activeTab === (item.key as any);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key as any)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 12px",
                  borderRadius: 999,
                  border: isActive ? "1px solid rgba(34,197,94,0.45)" : "1px solid rgba(51,65,85,0.7)",
                  background: isActive ? "rgba(34,197,94,0.12)" : "rgba(15,23,42,0.55)",
                  color: isActive ? "#86efac" : "#e5e7eb",
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 600,
                  cursor: "pointer",
                  flexShrink: 0,
                  boxShadow: isActive ? "0 0 0 1px rgba(255,255,255,0.04) inset" : "none",
                }}
              >
                <span style={{ display: "flex", fontSize: 16, color: isActive ? "#86efac" : "#cbd5e1" }}>{item.icon}</span>
                <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* 右侧账户区（紧凑版） */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 10px",
            borderRadius: 14,
            border: "1px solid #1f2937",
            background: "linear-gradient(180deg, rgba(15,23,42,0.62) 0%, rgba(2,6,23,0.92) 100%)",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.03) inset",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              background: "linear-gradient(135deg, #22c55e, #0ea5e9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#022c22",
              fontSize: 12,
              fontWeight: 800,
              flexShrink: 0,
              boxShadow: "0 2px 8px rgba(34,197,94,0.22)",
            }}
            title={status?.auth?.email || "未登录"}
          >
            {(() => {
              const nick = status?.auth?.displayName?.trim();
              const src = nick || status?.auth?.email || "U";
              return src.charAt(0).toUpperCase();
            })()}
          </div>

          <div style={{ minWidth: 0, maxWidth: 210, lineHeight: 1.15 }}>
            {status?.auth?.email ? (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#f1f5f9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {(status.auth.displayName?.trim() || status.auth.email) as any}
                </div>
                <div style={{ fontSize: 10, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={status.auth.email}>
                  {status.auth.email}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap" }}>未登录</div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              title="设置"
              aria-label="设置"
              onClick={() => setActiveTab("settings")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "8px 10px",
                borderRadius: 999,
                border: activeTab === "settings" ? "1px solid rgba(34,197,94,0.55)" : "1px solid rgba(51,65,85,0.75)",
                background: activeTab === "settings" ? "rgba(34,197,94,0.12)" : "rgba(30,41,59,0.5)",
                color: activeTab === "settings" ? "#86efac" : "#cbd5e1",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                transition: "border-color 0.15s, background 0.15s, color 0.15s",
              }}
            >
              <MdSettings style={{ fontSize: 16, flexShrink: 0 }} />
              <span style={{ whiteSpace: "nowrap" }}>设置</span>
            </button>

            {!status?.auth?.email ? (
              <button
                type="button"
                title="登录云端账户"
                onClick={() => setActiveTab("auth")}
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: "none",
                  background: "linear-gradient(135deg, #22c55e, #16a34a)",
                  color: "#022c22",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: "0 2px 10px rgba(34,197,94,0.32)",
                }}
              >
                登录
              </button>
            ) : (
              <button
                type="button"
                title="退出登录"
                onClick={() => setLogoutConfirmOpen(true)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: "1px solid #475569",
                  background: "rgba(15,23,42,0.6)",
                  color: "#e2e8f0",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                退出
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: 24,
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
        {activeTab === "skills" && <SkillsPanel showAccountSwitchPlaceholder={accountSwitchSyncing} />}
        {activeTab === "securityScan" && <SecurityScanPanel status={status} />}
        {activeTab === "interceptLogs" && <InterceptLogsPanel showAccountSwitchPlaceholder={accountSwitchSyncing} />}
        {activeTab === "tokenBill" && <TokenBillPanel />}
        {activeTab === "openclaw" && <OpenClawPanel />}
        {activeTab === "agentMgmt" && <AgentMgmtPanel />}
        {activeTab === "settings" && <SettingsPanel onApiBaseChanged={refreshStatus} status={status} />}
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

      {logoutConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-confirm-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => {
            if (!logoutSubmitting) setLogoutConfirmOpen(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 360,
              borderRadius: 14,
              border: "1px solid #334155",
              background: "linear-gradient(180deg, #0f172a 0%, #020617 100%)",
              boxShadow: "0 24px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04) inset",
              padding: "22px 22px 18px",
            }}
          >
            <div
              id="logout-confirm-title"
              style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}
            >
              退出登录？
            </div>
            <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5, marginBottom: 20 }}>
              确定要退出当前云端账号吗？本地设置不会清除。
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                disabled={logoutSubmitting}
                onClick={() => setLogoutConfirmOpen(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid #475569",
                  background: "rgba(30,41,59,0.6)",
                  color: "#e2e8f0",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: logoutSubmitting ? "not-allowed" : "pointer",
                  opacity: logoutSubmitting ? 0.6 : 1,
                }}
              >
                取消
              </button>
              <button
                type="button"
                disabled={logoutSubmitting}
                onClick={() => void confirmLogout()}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: logoutSubmitting ? "#475569" : "linear-gradient(135deg, #ef4444, #dc2626)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: logoutSubmitting ? "not-allowed" : "pointer",
                  boxShadow: logoutSubmitting ? "none" : "0 2px 12px rgba(239,68,68,0.35)",
                }}
              >
                {logoutSubmitting ? "退出中…" : "确定退出"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

