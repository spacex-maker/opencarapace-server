import { useEffect, useRef, useState } from "react";
import { LocalStatus } from "./types";
import { OverviewPanel } from "./components/OverviewPanel";
import { SkillsPanel } from "./components/SkillsPanel";
import { AuthPanel } from "./components/AuthPanel";
import { RegisterPanel } from "./components/RegisterPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { OpenClawPanel } from "./components/OpenClawPanel";
import { InterceptLogsPanel } from "./components/InterceptLogsPanel";
import { SecurityScanPanel } from "./components/SecurityScanPanel";
import { AgentMgmtPanel } from "./components/AgentMgmtPanel";
import {
  MdDashboard,
  MdStorefront,
  MdBlock,
  MdSettings,
  MdApps,
  MdShield,
  MdManageSearch,
  MdAccountTree,
  MdLightMode,
  MdDarkMode,
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
  const [authSubView, setAuthSubView] = useState<"login" | "register">("login");
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      const v = localStorage.getItem("oc_theme");
      return v === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("oc_theme", theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    if (activeTab !== "auth") setAuthSubView("login");
  }, [activeTab]);

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
    setAuthSubView("login");
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
        background: "var(--bg)",
        color: "var(--fg)",
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        colorScheme: theme,

        // theme variables
        ["--bg" as any]: theme === "light" ? "#f8fafc" : "#020617",
        ["--fg" as any]: theme === "light" ? "#0f172a" : "#e5e7eb",
        ["--muted" as any]: theme === "light" ? "#475569" : "#94a3b8",
        ["--muted2" as any]: theme === "light" ? "#64748b" : "#64748b",
        ["--border" as any]: theme === "light" ? "rgba(15,23,42,0.12)" : "rgba(31,41,55,1)",
        ["--topbar-bg" as any]: theme === "light" ? "rgba(248,250,252,0.92)" : "rgba(2,6,23,0.92)",
        ["--panel-bg" as any]: theme === "light" ? "rgba(255,255,255,0.9)" : "rgba(15,23,42,0.85)",
        ["--panel-bg2" as any]: theme === "light" ? "rgba(248,250,252,0.9)" : "rgba(15,23,42,0.55)",
        ["--panel-border" as any]: theme === "light" ? "rgba(15,23,42,0.12)" : "rgba(51,65,85,0.9)",
        ["--chip-bg" as any]: theme === "light" ? "rgba(15,23,42,0.04)" : "rgba(51,65,85,0.6)",
        ["--chip-fg" as any]: theme === "light" ? "#475569" : "#94a3b8",
        ["--btn-bg" as any]: theme === "light" ? "rgba(248,250,252,0.85)" : "rgba(15,23,42,0.6)",
        ["--btn-border" as any]: theme === "light" ? "rgba(15,23,42,0.14)" : "rgba(71,85,105,1)",
      }}
    >
      {/* 顶部横向导航栏 */}
      <div
        style={{
          flexShrink: 0,
          height: 66,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "10px 14px",
          boxSizing: "border-box",
          borderBottom: "1px solid var(--border)",
          background: "var(--topbar-bg)",
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
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em", color: theme === "light" ? "#0f172a" : "#f8fafc", lineHeight: 1.1 }}>
              ClawHeart
            </div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.14em",
                color: "var(--muted2)",
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
            overflow: "hidden",
          }}
        >
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              gap: 6,
              overflowX: "auto",
              overflowY: "hidden",
              padding: 4,
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: theme === "light"
                ? "linear-gradient(180deg, rgba(255,255,255,0.65) 0%, rgba(248,250,252,0.88) 100%)"
                : "linear-gradient(180deg, rgba(15,23,42,0.45) 0%, rgba(2,6,23,0.65) 100%)",
              boxShadow: theme === "light"
                ? "0 0 0 1px rgba(15,23,42,0.03) inset"
                : "0 0 0 1px rgba(255,255,255,0.03) inset",
              scrollbarWidth: "none" as any,
              msOverflowStyle: "none",
            }}
          >
            <style>{`
              .oc-topmenu::-webkit-scrollbar { display: none; }
            `}</style>
            {(
              [
                { key: "overview", label: "总览", icon: <MdDashboard /> },
                { key: "securityScan", label: "安全扫描", icon: <MdManageSearch /> },
                { key: "interceptLogs", label: "拦截监控", icon: <MdBlock /> },
                { key: "openclaw", label: "OpenClaw", icon: <MdApps /> },
                { key: "skills", label: "安全市场", icon: <MdStorefront /> },
                { key: "agentMgmt", label: "Agent 管理", icon: <MdAccountTree /> },
              ] as const
            ).map((item) => {
              const isActive = activeTab === (item.key as any);
              const activeBg = theme === "light" ? "rgba(34,197,94,0.12)" : "rgba(34,197,94,0.16)";
              const idleBg = "transparent";
              const activeFg = theme === "light" ? "#15803d" : "#22c55e";
              const idleFg = "var(--fg)";
              const idleIcon = theme === "light" ? "#334155" : "#cbd5e1";
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key as any)}
                  className="oc-topmenu"
                  style={{
                    position: "relative",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "9px 12px",
                    borderRadius: 999,
                    border: "1px solid transparent",
                    background: isActive ? activeBg : idleBg,
                    color: isActive ? activeFg : idleFg,
                    fontSize: 13,
                    fontWeight: isActive ? 800 : 650,
                    cursor: "pointer",
                    flexShrink: 0,
                    transition: "background 0.15s, border-color 0.15s, color 0.15s, transform 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (isActive) return;
                    e.currentTarget.style.background = theme === "light" ? "rgba(15,23,42,0.04)" : "rgba(148,163,184,0.10)";
                  }}
                  onMouseLeave={(e) => {
                    if (isActive) return;
                    e.currentTarget.style.background = idleBg;
                  }}
                >
                  <span style={{ display: "flex", fontSize: 16, color: isActive ? activeFg : idleIcon }}>
                    {item.icon}
                  </span>
                  <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>
                  {isActive && (
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        left: 12,
                        right: 12,
                        bottom: 4,
                        height: 2,
                        borderRadius: 999,
                        background: theme === "light"
                          ? "linear-gradient(90deg, rgba(34,197,94,0) 0%, rgba(34,197,94,0.95) 40%, rgba(34,197,94,0.95) 60%, rgba(34,197,94,0) 100%)"
                          : "linear-gradient(90deg, rgba(34,197,94,0) 0%, rgba(34,197,94,0.9) 40%, rgba(34,197,94,0.9) 60%, rgba(34,197,94,0) 100%)",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 右侧账户区（重新布局） */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "8px 10px",
            borderRadius: 16,
            border: "1px solid var(--border)",
            background: theme === "light"
              ? "linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(248,250,252,0.92) 100%)"
              : "linear-gradient(180deg, rgba(15,23,42,0.62) 0%, rgba(2,6,23,0.92) 100%)",
            boxShadow: theme === "light"
              ? "0 0 0 1px rgba(15,23,42,0.04) inset"
              : "0 0 0 1px rgba(255,255,255,0.03) inset",
            flexShrink: 0,
          }}
        >
          {/* 身份信息 */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                background: "linear-gradient(135deg, #22c55e, #0ea5e9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#022c22",
                fontSize: 12,
                fontWeight: 900,
                flexShrink: 0,
                boxShadow: "0 2px 10px rgba(34,197,94,0.20)",
              }}
              title={status?.auth?.email || "未登录"}
            >
              {(() => {
                const nick = status?.auth?.displayName?.trim();
                const src = nick || status?.auth?.email || "U";
                return src.charAt(0).toUpperCase();
              })()}
            </div>

            <div style={{ minWidth: 0, maxWidth: 220, lineHeight: 1.15 }}>
              {status?.auth?.email ? (
                <>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      minWidth: 0,
                      marginBottom: 2,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: theme === "light" ? "#0f172a" : "#f1f5f9",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={(status.auth.displayName?.trim() || status.auth.email) as any}
                    >
                      {(status.auth.displayName?.trim() || status.auth.email) as any}
                    </div>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: connectionDotColor,
                        boxShadow: isConnected ? "0 0 0 4px rgba(34,197,94,0.16)" : "none",
                        flexShrink: 0,
                      }}
                      title={connectionLabel}
                      aria-hidden
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--muted2)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={status.auth.email}
                  >
                    {status.auth.email}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 12, fontWeight: 800, color: theme === "light" ? "#0f172a" : "#f1f5f9", whiteSpace: "nowrap" }}>
                    未登录
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted2)", whiteSpace: "nowrap" }}>
                    {connectionLabel}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 分隔 */}
          <div
            aria-hidden
            style={{
              width: 1,
              height: 28,
              background: "var(--border)",
              opacity: theme === "light" ? 0.9 : 0.7,
              flexShrink: 0,
            }}
          />

          {/* 操作区 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              title={theme === "light" ? "切换到暗黑主题" : "切换到明亮主题"}
              aria-label="切换主题"
              onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
              style={{
                width: 34,
                height: 34,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                border: "1px solid var(--btn-border)",
                background: "var(--btn-bg)",
                color: "var(--fg)",
                cursor: "pointer",
                transition: "border-color 0.15s, background 0.15s, transform 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0px)")}
            >
              {theme === "light" ? <MdDarkMode style={{ fontSize: 18 }} /> : <MdLightMode style={{ fontSize: 18 }} />}
            </button>

            <button
              type="button"
              title="设置"
              aria-label="设置"
              onClick={() => setActiveTab("settings")}
              style={{
                width: 34,
                height: 34,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                border: activeTab === "settings" ? "1px solid rgba(34,197,94,0.55)" : "1px solid var(--btn-border)",
                background: activeTab === "settings"
                  ? (theme === "light" ? "rgba(34,197,94,0.12)" : "rgba(34,197,94,0.16)")
                  : "var(--btn-bg)",
                color: activeTab === "settings" ? (theme === "light" ? "#15803d" : "#22c55e") : "var(--fg)",
                cursor: "pointer",
                transition: "border-color 0.15s, background 0.15s, transform 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0px)")}
            >
              <MdSettings style={{ fontSize: 18 }} />
            </button>

            {!status?.auth?.email ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  title="登录云端账户"
                  onClick={() => {
                    setAuthSubView("login");
                    setActiveTab("auth");
                  }}
                  style={{
                    height: 34,
                    padding: "0 12px",
                    borderRadius: 12,
                    border: "none",
                    background: "linear-gradient(135deg, #22c55e, #16a34a)",
                    color: "#022c22",
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: "pointer",
                    boxShadow: "0 2px 10px rgba(34,197,94,0.22)",
                  }}
                >
                  登录
                </button>
                <button
                  type="button"
                  title="注册云端账户"
                  onClick={() => {
                    setAuthSubView("register");
                    setActiveTab("auth");
                  }}
                  style={{
                    height: 34,
                    padding: "0 12px",
                    borderRadius: 12,
                    border: "1px solid var(--btn-border)",
                    background: "var(--btn-bg)",
                    color: "var(--fg)",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  注册
                </button>
              </div>
            ) : (
              <button
                type="button"
                title="退出登录"
                onClick={() => setLogoutConfirmOpen(true)}
                style={{
                  height: 34,
                  padding: "0 12px",
                  borderRadius: 12,
                  border: "1px solid var(--btn-border)",
                  background: "var(--btn-bg)",
                  color: "var(--fg)",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  transition: "transform 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0px)")}
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
        {activeTab === "openclaw" && <OpenClawPanel />}
        {activeTab === "agentMgmt" && <AgentMgmtPanel />}
        {activeTab === "settings" && <SettingsPanel onApiBaseChanged={refreshStatus} status={status} />}
        {activeTab === "auth" &&
          (authSubView === "register" ? (
            <RegisterPanel onRegistered={handleLoggedIn} onGoLogin={() => setAuthSubView("login")} />
          ) : (
            <AuthPanel onLoggedIn={handleLoggedIn} onGoRegister={() => setAuthSubView("register")} />
          ))}
      </div>

      {/* 右下角服务器连接状态 */}
      <div
        style={{
          position: "fixed",
          right: 18,
          bottom: 16,
          padding: "6px 10px",
          borderRadius: 999,
          background: theme === "light" ? "rgba(255,255,255,0.9)" : "rgba(15,23,42,0.96)",
          border: "1px solid var(--border)",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          color: theme === "light" ? "#334155" : "#9ca3af",
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
              border: "1px solid var(--panel-border)",
              background: theme === "light"
                ? "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)"
                : "linear-gradient(180deg, #0f172a 0%, #020617 100%)",
              boxShadow: theme === "light"
                ? "0 24px 48px rgba(2,6,23,0.12), 0 0 0 1px rgba(15,23,42,0.04) inset"
                : "0 24px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04) inset",
              padding: "22px 22px 18px",
            }}
          >
            <div
              id="logout-confirm-title"
              style={{ fontSize: 16, fontWeight: 700, color: theme === "light" ? "#0f172a" : "#f1f5f9", marginBottom: 8 }}
            >
              退出登录？
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 20 }}>
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

