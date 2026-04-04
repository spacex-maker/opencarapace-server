import { useEffect, useState } from "react";
import { DocsPanel } from "./DocsPanel";
import { useI18n } from "../i18n";

type LlmRouteMode = "DIRECT" | "GATEWAY";

type LlmMapping = {
  id: number;
  prefix: string;
  target_base?: string;  // 本地 API 返回
  targetBase?: string;   // 云端 API 返回
};

interface Props {
  onApiBaseChanged?: () => void | Promise<void>;
  /** 已登录时在设置页底部展示「退出」并触发父级确认弹窗 */
  onRequestLogout?: () => void;
  status?: {
    auth?: {
      email: string;
      token: string;
      displayName?: string | null;
    } | null;
  } | null;
}

export function SettingsPanel(props: Props) {
  const { onApiBaseChanged, onRequestLogout, status } = props;
  const { t } = useI18n();
  const [mode, setMode] = useState<LlmRouteMode>("GATEWAY");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [apiBase, setApiBase] = useState<string>("https://api.clawheart.live");
  const [apiBaseLoading, setApiBaseLoading] = useState(false);

  const [mappings, setMappings] = useState<LlmMapping[]>([]);
  const [mappingPrefix, setMappingPrefix] = useState("");
  const [mappingTarget, setMappingTarget] = useState("");
  const [mappingLoading, setMappingLoading] = useState(false);
  const [syncingMappings, setSyncingMappings] = useState(false);

  const [syncUserSkillsToCloud, setSyncUserSkillsToCloud] = useState(true);
  const [syncUserDangersToCloud, setSyncUserDangersToCloud] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);

  const [syncMappingsToCloud, setSyncMappingsToCloud] = useState(false);

  const [settingsTab, setSettingsTab] = useState<"general" | "docs">("general");

  useEffect(() => {
    const loadMode = async () => {
      try {
        setLoading(true);
        const res = await fetch("http://127.0.0.1:19111/api/user-settings/llm-route-mode");
        const data = await res.json();
        if (res.ok && data?.llmRouteMode && (data.llmRouteMode === "DIRECT" || data.llmRouteMode === "GATEWAY")) {
          setMode(data.llmRouteMode);
        } else {
          setMode("GATEWAY");
        }
      } catch (e: any) {
        setError(e?.message ?? t("settingsPage.err.loadRoute"));
      } finally {
        setLoading(false);
      }
    };

    const loadApiBase = async () => {
      try {
        setApiBaseLoading(true);
        const res = await fetch("http://127.0.0.1:19111/api/status");
        const data = await res.json();
        if (res.ok && data?.settings?.apiBase) {
          setApiBase(String(data.settings.apiBase));
        } else {
          setApiBase("https://api.clawheart.live");
        }
      } catch {
        setApiBase("https://api.clawheart.live");
      } finally {
        setApiBaseLoading(false);
      }
    };

    const loadMappings = async () => {
      try {
        setMappingLoading(true);
        const res = await fetch("http://127.0.0.1:19111/api/llm-mappings");
        const data = await res.json();
        if (res.ok && Array.isArray(data?.items)) {
          setMappings(data.items);
        }
      } catch {
        // ignore
      } finally {
        setMappingLoading(false);
      }
    };

    const loadSyncSetting = async () => {
      try {
        const [skillsRes, dangersRes] = await Promise.all([
          fetch("http://127.0.0.1:19111/api/user-settings/sync-user-skills-to-cloud"),
          fetch("http://127.0.0.1:19111/api/user-settings/sync-user-dangers-to-cloud"),
        ]);
        const skillsData = await skillsRes.json();
        const dangersData = await dangersRes.json();
        if (skillsRes.ok && typeof skillsData?.syncUserSkillsToCloud === "boolean") {
          setSyncUserSkillsToCloud(skillsData.syncUserSkillsToCloud);
        }
        if (dangersRes.ok && typeof dangersData?.syncUserDangersToCloud === "boolean") {
          setSyncUserDangersToCloud(dangersData.syncUserDangersToCloud);
        }
      } catch {
        // ignore
      }
    };

    loadMode();
    loadApiBase();
    loadMappings();
    loadSyncSetting();
  }, []);

  const isLocalBackend = apiBase.trim().toLowerCase().includes("localhost:8080") || apiBase.trim().includes("127.0.0.1:8080");
  const effectiveApiBase = isLocalBackend ? "http://localhost:8080" : "https://api.clawheart.live";

  const handleToggleTestMode = async () => {
    const nextApiBase = isLocalBackend ? "https://api.clawheart.live" : "http://localhost:8080";
    setApiBaseLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("http://127.0.0.1:19111/api/settings/api-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiBase: nextApiBase }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || t("settingsPage.err.toggleTest"));
        return;
      }
      setApiBase(nextApiBase);
      setMessage(
        nextApiBase.includes("localhost:8080") ? t("settingsPage.toast.testOn") : t("settingsPage.toast.testOff")
      );
      if (onApiBaseChanged) {
        await onApiBaseChanged();
      }
    } catch (e: any) {
      setError(e?.message ?? t("settingsPage.err.toggleTest"));
    } finally {
      setApiBaseLoading(false);
    }
  };

  const handleSave = async (next: LlmRouteMode) => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("http://127.0.0.1:19111/api/user-settings/llm-route-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ llmRouteMode: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || t("settingsPage.err.save"));
      } else {
        setMode(next);
        setMessage(t("settingsPage.toast.routeOk"));
      }
    } catch (e: any) {
      setError(e?.message ?? t("settingsPage.err.save"));
    } finally {
      setSaving(false);
    }
  };

  const handleAddMapping = async () => {
    const prefix = mappingPrefix.trim();
    const targetBase = mappingTarget.trim();
    if (!prefix || !targetBase) {
      setError(t("settingsPage.err.prefixTarget"));
      return;
    }
    setError(null);
    setMessage(null);
    setMappingLoading(true);
    try {
      // 1. 本地保存
      const localRes = await fetch("http://127.0.0.1:19111/api/llm-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, targetBase }),
      });
      const localData = await localRes.json();
      if (!localRes.ok) {
        setError(localData?.error?.message || t("settingsPage.err.saveMapping"));
        return;
      }
      if (Array.isArray(localData?.items)) {
        setMappings(localData.items);
      }

      // 2. 如果开启云端同步，也保存到云端
      if (syncMappingsToCloud && status?.auth?.token) {
        try {
          const cloudRes = await fetch(`${effectiveApiBase}/api/user-llm-mappings/me`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${status.auth.token}`,
            },
            body: JSON.stringify({ prefix, targetBase }),
          });
          if (!cloudRes.ok) {
            console.warn("云端同步映射失败:", await cloudRes.text());
            setMessage(t("settingsPage.toast.mapLocalCloudFail"));
          } else {
            setMessage(t("settingsPage.toast.mapCloudOk"));
          }
        } catch (e) {
          console.warn("云端同步映射失败:", e);
          setMessage(t("settingsPage.toast.mapLocalCloudFail"));
        }
      } else {
        setMessage(t("settingsPage.toast.mapLocalOk"));
      }

      setMappingPrefix("");
      setMappingTarget("");
    } catch (e: any) {
      setError(e?.message ?? t("settingsPage.err.saveMapping"));
    } finally {
      setMappingLoading(false);
    }
  };

  const handleDeleteMapping = async (id: number) => {
    setError(null);
    setMessage(null);
    setMappingLoading(true);
    try {
      // 1. 获取要删除的映射信息（用于云端同步）
      const mapping = mappings.find(m => m.id === id);
      
      // 2. 本地删除
      const localRes = await fetch(`http://127.0.0.1:19111/api/llm-mappings/${id}`, {
        method: "DELETE",
      });
      const localData = await localRes.json();
      if (!localRes.ok) {
        setError(localData?.error?.message || t("settingsPage.err.delMapping"));
        return;
      }
      if (Array.isArray(localData?.items)) {
        setMappings(localData.items);
      }

      // 3. 如果开启云端同步，也删除云端记录（通过 prefix 查找）
      if (syncMappingsToCloud && mapping && status?.auth?.token) {
        try {
          // 先查询云端映射列表，找到对应的云端 ID
          const listRes = await fetch(`${effectiveApiBase}/api/user-llm-mappings/me`, {
            headers: { Authorization: `Bearer ${status.auth.token}` },
          });
          if (listRes.ok) {
            const listData = await listRes.json();
            const cloudMapping = Array.isArray(listData) 
              ? listData.find((m: any) => m.prefix === mapping.prefix)
              : null;
            
            if (cloudMapping?.id) {
              await fetch(`${effectiveApiBase}/api/user-llm-mappings/me/${cloudMapping.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${status.auth.token}` },
              });
            }
          }
        } catch (e) {
          console.warn("云端同步删除失败:", e);
        }
      }

      setMessage(t("settingsPage.toast.mapDeleted"));
    } catch (e: any) {
      setError(e?.message ?? t("settingsPage.err.delMapping"));
    } finally {
      setMappingLoading(false);
    }
  };

  const handleToggleSyncUserSkills = async () => {
    const nextValue = !syncUserSkillsToCloud;
    setSyncLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("http://127.0.0.1:19111/api/user-settings/sync-user-skills-to-cloud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncUserSkillsToCloud: nextValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || t("settingsPage.err.syncToggle"));
      } else {
        setSyncUserSkillsToCloud(nextValue);
        setMessage(nextValue ? t("settingsPage.toast.skillsOn") : t("settingsPage.toast.skillsOff"));
      }
    } catch (e: any) {
      setError(e?.message ?? t("settingsPage.err.syncToggle"));
    } finally {
      setSyncLoading(false);
    }
  };

  const handleToggleSyncUserDangers = async () => {
    const nextValue = !syncUserDangersToCloud;
    setSyncLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("http://127.0.0.1:19111/api/user-settings/sync-user-dangers-to-cloud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncUserDangersToCloud: nextValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || t("settingsPage.err.syncToggle"));
      } else {
        setSyncUserDangersToCloud(nextValue);
        setMessage(nextValue ? t("settingsPage.toast.dangersOn") : t("settingsPage.toast.dangersOff"));
      }
    } catch (e: any) {
      setError(e?.message ?? t("settingsPage.err.syncToggle"));
    } finally {
      setSyncLoading(false);
    }
  };

  const handleToggleSyncMappings = () => {
    setSyncMappingsToCloud(!syncMappingsToCloud);
    setMessage(syncMappingsToCloud ? t("settingsPage.toast.mapSyncOff") : t("settingsPage.toast.mapSyncOn"));
  };

  const handleSyncFromCloud = async () => {
    if (!status?.auth?.token) {
      setError(t("settingsPage.err.loginFirst"));
      return;
    }

    setError(null);
    setMessage(null);
    setSyncingMappings(true);
    try {
      // 1. 获取云端映射列表
      const cloudRes = await fetch(`${effectiveApiBase}/api/user-llm-mappings/me`, {
        headers: { Authorization: `Bearer ${status.auth.token}` },
      });
      
      console.log("[SettingsPanel] 云端映射响应状态:", cloudRes.status);
      console.log("[SettingsPanel] 云端映射响应 Content-Type:", cloudRes.headers.get("content-type"));
      
      if (!cloudRes.ok) {
        const text = await cloudRes.text();
        console.error("[SettingsPanel] 云端映射响应内容:", text);
        setError(`${t("settingsPage.err.cloudFetch")} (${cloudRes.status}): ${text.substring(0, 100)}`);
        return;
      }
      
      const contentType = cloudRes.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await cloudRes.text();
        console.error("[SettingsPanel] 云端返回非 JSON:", text);
        setError(t("settingsPage.err.cloudNotJson"));
        return;
      }
      
      const cloudMappings = await cloudRes.json();
      console.log("[SettingsPanel] 云端映射数据:", cloudMappings);
      
      if (!Array.isArray(cloudMappings)) {
        setError(t("settingsPage.err.cloudBadShape"));
        return;
      }
      
      // 2. 同步到本地：逐个保存
      for (const m of cloudMappings) {
        if (m.prefix && m.targetBase) {
          await fetch("http://127.0.0.1:19111/api/llm-mappings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prefix: m.prefix, targetBase: m.targetBase }),
          });
        }
      }
      
      // 3. 重新加载本地映射列表
      const localRes = await fetch("http://127.0.0.1:19111/api/llm-mappings");
      const localData = await localRes.json();
      if (localRes.ok && Array.isArray(localData?.items)) {
        setMappings(localData.items);
      }
      
      setMessage(t("settingsPage.toast.syncedFromCloud").replace("{count}", String(cloudMappings.length)));
    } catch (e: any) {
      console.error("[SettingsPanel] 同步失败:", e);
      setError(e?.message ?? t("settingsPage.err.cloudFetch"));
    } finally {
      setSyncingMappings(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 920,
        margin: "0 auto",
        background: "var(--panel-bg)",
        borderRadius: 16,
        padding: "24px 28px",
        border: "1px solid var(--panel-border)",
        boxShadow: "0 20px 40px rgba(0,0,0,0.16)",
        fontSize: 12,
      }}
    >
      <h1 style={{ fontSize: 20, margin: "0 0 4px", color: "var(--fg)" }}>{t("header.settings.title")}</h1>
      <p style={{ margin: "4px 0 12px", fontSize: 13, color: "var(--muted)" }}>{t("settingsPage.intro")}</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        {(
          [
            { key: "general" as const, label: t("settingsPage.tabs.general") },
            { key: "docs" as const, label: t("settingsPage.tabs.docs") },
          ] as const
        ).map((tab) => {
          const active = settingsTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSettingsTab(tab.key)}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: active ? "1px solid rgba(34,197,94,0.45)" : "1px solid rgba(51,65,85,0.7)",
                background: active ? "rgba(34,197,94,0.12)" : "var(--panel-bg2)",
                color: active ? "#86efac" : "var(--fg)",
                fontSize: 12,
                fontWeight: active ? 700 : 600,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {settingsTab === "docs" && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 14,
            borderTop: "1px solid var(--panel-border)",
            maxHeight: "min(70vh, 720px)",
            overflowY: "auto",
            paddingRight: 4,
          }}
        >
          <DocsPanel embedded />
        </div>
      )}

      {settingsTab === "general" && (
      <>
      <div
        style={{
          marginTop: 8,
          paddingTop: 12,
          borderTop: "1px solid var(--panel-border)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", marginBottom: 6 }}>
          {t("settingsPage.llm.sectionTitle")}
        </div>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted2)", lineHeight: 1.5 }}>
          {t("settingsPage.llm.sectionDesc")}
        </p>

        <div style={{ display: "grid", gap: 10 }}>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave("GATEWAY")}
            style={{
              textAlign: "left",
              padding: "10px 12px",
              borderRadius: 12,
              border: mode === "GATEWAY" ? "1px solid rgba(34,197,94,0.6)" : "1px solid var(--panel-border)",
              background: mode === "GATEWAY" ? "rgba(34,197,94,0.10)" : "var(--panel-bg2)",
              boxShadow: mode === "GATEWAY" ? "0 8px 18px rgba(34,197,94,0.10)" : "none",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--fg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>{t("settingsPage.llm.gatewayTitle")}</span>
              {mode === "GATEWAY" && (
                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 6px",
                    borderRadius: 999,
                    background: "rgba(34,197,94,0.14)",
                    color: "rgba(21,128,61,1)",
                    border: "1px solid rgba(34,197,94,0.45)",
                  }}
                >
                  {t("settingsPage.llm.badgeCurrent")}
                </span>
              )}
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
              {t("settingsPage.llm.gatewayDesc")}
            </div>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave("DIRECT")}
            style={{
              textAlign: "left",
              padding: "10px 12px",
              borderRadius: 12,
              border: mode === "DIRECT" ? "1px solid rgba(56,189,248,0.65)" : "1px solid var(--panel-border)",
              background: mode === "DIRECT" ? "rgba(56,189,248,0.10)" : "var(--panel-bg2)",
              boxShadow: mode === "DIRECT" ? "0 8px 18px rgba(56,189,248,0.10)" : "none",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--fg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>{t("settingsPage.llm.directTitle")}</span>
              {mode === "DIRECT" && (
                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 6px",
                    borderRadius: 999,
                    background: "rgba(56,189,248,0.14)",
                    color: "rgba(3,105,161,1)",
                    border: "1px solid rgba(56,189,248,0.45)",
                  }}
                >
                  {t("settingsPage.llm.badgeCurrent")}
                </span>
              )}
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
              {t("settingsPage.llm.directDesc")}
            </div>
          </button>
        </div>

        {loading && (
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted2)" }}>{t("settingsPage.loadingConfig")}</div>
        )}
      </div>

      <div
        style={{
          marginTop: 18,
          paddingTop: 12,
          borderTop: "1px solid var(--panel-border)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", marginBottom: 6 }}>
          {t("settingsPage.skills.title")}
        </div>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted2)", lineHeight: 1.5 }}>
          {t("settingsPage.skills.desc")}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            disabled={syncLoading}
            onClick={handleToggleSyncUserSkills}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: syncUserSkillsToCloud ? "1px solid #22c55e" : "1px solid var(--panel-border)",
              background: syncUserSkillsToCloud
                ? "linear-gradient(135deg, #064e3b, #022c22)"
                : "var(--panel-bg2)",
              cursor: syncLoading ? "not-allowed" : "pointer",
              fontSize: 11,
              fontWeight: 600,
              color: syncUserSkillsToCloud ? "#bbf7d0" : "var(--fg)",
            }}
          >
            {syncUserSkillsToCloud ? t("settingsPage.state.on") : t("settingsPage.state.off")}
          </button>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            {syncUserSkillsToCloud ? t("settingsPage.skills.detailOn") : t("settingsPage.skills.detailOff")}
          </span>
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          paddingTop: 12,
          borderTop: "1px solid var(--panel-border)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", marginBottom: 6 }}>
          {t("settingsPage.dangers.title")}
        </div>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted2)", lineHeight: 1.5 }}>
          {t("settingsPage.dangers.desc")}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            disabled={syncLoading}
            onClick={handleToggleSyncUserDangers}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: syncUserDangersToCloud ? "1px solid #22c55e" : "1px solid var(--panel-border)",
              background: syncUserDangersToCloud
                ? "linear-gradient(135deg, #064e3b, #022c22)"
                : "var(--panel-bg2)",
              cursor: syncLoading ? "not-allowed" : "pointer",
              fontSize: 11,
              fontWeight: 600,
              color: syncUserDangersToCloud ? "#bbf7d0" : "var(--fg)",
            }}
          >
            {syncUserDangersToCloud ? t("settingsPage.state.on") : t("settingsPage.state.off")}
          </button>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            {syncUserDangersToCloud ? t("settingsPage.dangers.detailOn") : t("settingsPage.dangers.detailOff")}
          </span>
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          paddingTop: 12,
          borderTop: "1px solid var(--panel-border)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", marginBottom: 6 }}>
          {t("settingsPage.mappingSync.title")}
        </div>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted2)", lineHeight: 1.5 }}>
          {t("settingsPage.mappingSync.desc")}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <button
            type="button"
            onClick={handleToggleSyncMappings}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: syncMappingsToCloud ? "1px solid #22c55e" : "1px solid var(--panel-border)",
              background: syncMappingsToCloud
                ? "linear-gradient(135deg, #064e3b, #022c22)"
                : "var(--panel-bg2)",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              color: syncMappingsToCloud ? "#bbf7d0" : "var(--fg)",
            }}
          >
            {syncMappingsToCloud ? t("settingsPage.state.on") : t("settingsPage.state.off")}
          </button>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            {syncMappingsToCloud ? t("settingsPage.mappingSync.detailOn") : t("settingsPage.mappingSync.detailOff")}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={handleSyncFromCloud}
            disabled={syncingMappings}
            style={{
              padding: "6px 12px",
              fontSize: 11,
              borderRadius: 999,
              border: "1px solid #3b82f6",
              background: syncingMappings ? "#1e3a8a" : "linear-gradient(135deg,#2563eb,#3b82f6)",
              color: "#dbeafe",
              cursor: syncingMappings ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {syncingMappings ? t("settingsPage.mappingSync.pulling") : t("settingsPage.mappingSync.pull")}
          </button>
          <span style={{ fontSize: 11, color: "var(--muted2)", lineHeight: "28px" }}>
            {t("settingsPage.mappingSync.pullHint")}
          </span>
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          paddingTop: 12,
          borderTop: "1px solid var(--panel-border)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", marginBottom: 6 }}>
          {t("settingsPage.networkMap.title")}
        </div>
        <p
          style={{
            margin: "0 0 10px",
            fontSize: 12,
            color: "var(--muted2)",
            lineHeight: 1.5,
            whiteSpace: "pre-line",
          }}
        >
          {t("settingsPage.networkMap.body")}
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input
            value={mappingPrefix}
            onChange={(e) => setMappingPrefix(e.target.value)}
            placeholder={t("settingsPage.mappingForm.phPrefix")}
            style={{
              flex: 0.5,
              background: "var(--panel-bg)",
              borderRadius: 999,
              border: "1px solid var(--panel-border)",
              padding: "6px 10px",
              fontSize: 11,
              color: "var(--fg)",
              outline: "none",
            }}
          />
          <input
            value={mappingTarget}
            onChange={(e) => setMappingTarget(e.target.value)}
            placeholder={t("settingsPage.mappingForm.phTarget")}
            style={{
              flex: 1.2,
              background: "var(--panel-bg)",
              borderRadius: 999,
              border: "1px solid var(--panel-border)",
              padding: "6px 10px",
              fontSize: 11,
              color: "var(--fg)",
              outline: "none",
            }}
          />
          <button
            type="button"
            disabled={mappingLoading}
            onClick={handleAddMapping}
            style={{
              padding: "6px 12px",
              fontSize: 11,
              borderRadius: 999,
              border: "1px solid #22c55e",
              background: mappingLoading ? "#064e3b" : "linear-gradient(135deg,#16a34a,#22c55e)",
              color: "#ecfdf5",
              cursor: mappingLoading ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {t("settingsPage.mappingForm.addOrUpdate")}
          </button>
        </div>

        <div
          style={{
            borderRadius: 10,
            border: "1px solid var(--panel-border)",
            background: "var(--panel-bg2)",
            maxHeight: 180,
            overflowY: "auto",
          }}
        >
          {mappingLoading && mappings.length === 0 ? (
            <div style={{ padding: "8px 10px", fontSize: 11, color: "var(--muted2)" }}>
              {t("settingsPage.mappingTable.loading")}
            </div>
          ) : mappings.length === 0 ? (
            <div style={{ padding: "8px 10px", fontSize: 11, color: "var(--muted2)" }}>
              {t("settingsPage.mappingTable.empty")}
            </div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 11,
              }}
            >
              <thead>
                <tr style={{ background: "var(--panel-bg)" }}>
                  <th style={{ textAlign: "left", padding: "6px 10px", color: "var(--muted)", fontWeight: 500 }}>
                    {t("settingsPage.mappingTable.colPrefix")}
                  </th>
                  <th style={{ textAlign: "left", padding: "6px 10px", color: "var(--muted)", fontWeight: 500 }}>
                    {t("settingsPage.mappingTable.colTarget")}
                  </th>
                  <th style={{ textAlign: "left", padding: "6px 10px", color: "var(--muted)", fontWeight: 500 }}>
                    {t("settingsPage.mappingTable.colGw")}
                  </th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.id}>
                    <td style={{ padding: "6px 10px", color: "var(--fg)", borderTop: "1px solid var(--panel-border)" }}>
                      {m.prefix}
                    </td>
                    <td style={{ padding: "6px 10px", color: "var(--muted)", borderTop: "1px solid var(--panel-border)" }}>
                      {m.target_base || m.targetBase}
                    </td>
                    <td style={{ padding: "6px 10px", color: "var(--fg)", borderTop: "1px solid var(--panel-border)" }}>
                      <div style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                        http://127.0.0.1:19111/{m.prefix}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--muted2)", marginTop: 2 }}>
                        {t("settingsPage.mappingTable.gwHint")}
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "6px 10px",
                        borderTop: "1px solid var(--panel-border)",
                        textAlign: "right",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleDeleteMapping(m.id)}
                        disabled={mappingLoading}
                        style={{
                          fontSize: 11,
                          padding: "3px 8px",
                          borderRadius: 999,
                          border: "1px solid #4b5563",
                          background: "transparent",
                          color: "#f97373",
                          cursor: mappingLoading ? "not-allowed" : "pointer",
                        }}
                      >
                        {t("settingsPage.mappingTable.delete")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>


      <div
        style={{
          marginTop: 18,
          paddingTop: 12,
          borderTop: "1px solid var(--panel-border)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", marginBottom: 6 }}>
          {t("settingsPage.advanced.title")}
        </div>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted2)", lineHeight: 1.5 }}>
          {t("settingsPage.advanced.desc")}
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid var(--panel-border)",
            background: "var(--panel-bg2)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg)" }}>
              {t("settingsPage.advanced.testTitle")}
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>
              {t("settingsPage.advanced.currentApi")}{" "}
              <span
                style={{
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  color: "var(--fg)",
                }}
              >
                {apiBaseLoading ? "…" : effectiveApiBase}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={handleToggleTestMode}
              aria-pressed={isLocalBackend}
              disabled={apiBaseLoading}
              style={{
                width: 44,
                height: 24,
                borderRadius: 999,
                border: isLocalBackend ? "1px solid rgba(34,197,94,0.6)" : "1px solid var(--btn-border)",
                background: isLocalBackend ? "rgba(34,197,94,0.25)" : "var(--panel-bg)",
                padding: 2,
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                cursor: apiBaseLoading ? "not-allowed" : "pointer",
                opacity: apiBaseLoading ? 0.7 : 1,
                flexShrink: 0,
              }}
              title={isLocalBackend ? t("settingsPage.advanced.toggleOn") : t("settingsPage.advanced.toggleOff")}
            >
              <span
                style={{
                  display: "block",
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  background: isLocalBackend ? "#22c55e" : "#94a3b8",
                  transform: isLocalBackend ? "translateX(20px)" : "translateX(0px)",
                  transition: "transform 160ms ease, background 160ms ease",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
                }}
              />
            </button>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              {isLocalBackend ? t("settingsPage.state.on") : t("settingsPage.state.off")}
            </span>
          </div>
        </div>
      </div>

      {status?.auth?.email && onRequestLogout && (
        <div
          style={{
            marginTop: 22,
            paddingTop: 18,
            borderTop: "1px solid var(--panel-border)",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", marginBottom: 6 }}>
            {t("settingsPage.account.title")}
          </div>
          <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--muted2)", lineHeight: 1.55, maxWidth: 560 }}>
            {t("settingsPage.account.hint")}
          </p>
          <button
            type="button"
            onClick={onRequestLogout}
            title={t("header.logout.title")}
            style={{
              padding: "10px 18px",
              borderRadius: 12,
              border: "1px solid rgba(248,113,113,0.45)",
              background: "rgba(239,68,68,0.08)",
              color: "#f87171",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              transition: "background 0.15s, border-color 0.15s, transform 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239,68,68,0.14)";
              e.currentTarget.style.borderColor = "rgba(248,113,113,0.65)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(239,68,68,0.08)";
              e.currentTarget.style.borderColor = "rgba(248,113,113,0.45)";
            }}
          >
            {t("header.logout.label")}
          </button>
        </div>
      )}
      </>
      )}

      {message && (
        <div style={{ marginTop: 10, fontSize: 11, color: "#4ade80" }}>{message}</div>
      )}
      {error && (
        <div style={{ marginTop: 4, fontSize: 11, color: "#f97373" }}>{error}</div>
      )}
    </div>
  );
}

