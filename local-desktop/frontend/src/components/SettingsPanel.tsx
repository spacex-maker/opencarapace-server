import { useEffect, useState } from "react";
import { DocsPanel } from "./DocsPanel";

type LlmRouteMode = "DIRECT" | "GATEWAY";

type LlmMapping = {
  id: number;
  prefix: string;
  target_base?: string;  // 本地 API 返回
  targetBase?: string;   // 云端 API 返回
};

interface Props {
  onApiBaseChanged?: () => void | Promise<void>;
  status?: {
    auth?: {
      email: string;
      token: string;
      displayName?: string | null;
    } | null;
  } | null;
}

export function SettingsPanel(props: Props) {
  const { onApiBaseChanged, status } = props;
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
        setError(e?.message ?? "加载路由模式失败");
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
        setError(data?.error?.message || "切换测试模式失败");
        return;
      }
      setApiBase(nextApiBase);
      setMessage(nextApiBase.includes("localhost:8080") ? "已开启测试模式（使用本地后端 8080）。" : "已关闭测试模式（使用线上后端）。");
      if (onApiBaseChanged) {
        await onApiBaseChanged();
      }
    } catch (e: any) {
      setError(e?.message ?? "切换测试模式失败");
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
        setError(data?.error?.message || "保存失败");
      } else {
        setMode(next);
        setMessage("已更新 LLM 路由模式。");
      }
    } catch (e: any) {
      setError(e?.message ?? "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleAddMapping = async () => {
    const prefix = mappingPrefix.trim();
    const targetBase = mappingTarget.trim();
    if (!prefix || !targetBase) {
      setError("请填写前缀与目标地址");
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
        setError(localData?.error?.message || "保存映射失败");
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
            setMessage("已保存到本地，但云端同步失败（请检查登录状态）。");
          } else {
            setMessage("已更新映射配置并同步到云端。");
          }
        } catch (e) {
          console.warn("云端同步映射失败:", e);
          setMessage("已保存到本地，但云端同步失败。");
        }
      } else {
        setMessage("已更新映射配置（仅本地）。");
      }

      setMappingPrefix("");
      setMappingTarget("");
    } catch (e: any) {
      setError(e?.message ?? "保存映射失败");
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
        setError(localData?.error?.message || "删除映射失败");
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

      setMessage("已删除一条映射。");
    } catch (e: any) {
      setError(e?.message ?? "删除映射失败");
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
        setError(data?.error?.message || "更新同步开关失败");
      } else {
        setSyncUserSkillsToCloud(nextValue);
        setMessage(`已${nextValue ? "开启" : "关闭"} Skills 用户设置云端同步。`);
      }
    } catch (e: any) {
      setError(e?.message ?? "更新同步开关失败");
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
        setError(data?.error?.message || "更新同步开关失败");
      } else {
        setSyncUserDangersToCloud(nextValue);
        setMessage(`已${nextValue ? "开启" : "关闭"}危险指令用户设置云端同步。`);
      }
    } catch (e: any) {
      setError(e?.message ?? "更新同步开关失败");
    } finally {
      setSyncLoading(false);
    }
  };

  const handleToggleSyncMappings = () => {
    setSyncMappingsToCloud(!syncMappingsToCloud);
    setMessage(syncMappingsToCloud ? "已关闭映射同步到云端。" : "已开启映射同步到云端。");
  };

  const handleSyncFromCloud = async () => {
    if (!status?.auth?.token) {
      setError("请先登录");
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
        setError(`获取云端映射失败 (${cloudRes.status}): ${text.substring(0, 100)}`);
        return;
      }
      
      const contentType = cloudRes.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await cloudRes.text();
        console.error("[SettingsPanel] 云端返回非 JSON:", text);
        setError("云端返回格式错误（非 JSON），请检查后端配置");
        return;
      }
      
      const cloudMappings = await cloudRes.json();
      console.log("[SettingsPanel] 云端映射数据:", cloudMappings);
      
      if (!Array.isArray(cloudMappings)) {
        setError("云端映射数据格式错误（不是数组）");
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
      
      setMessage(`已从云端同步 ${cloudMappings.length} 条映射配置。`);
    } catch (e: any) {
      console.error("[SettingsPanel] 同步失败:", e);
      setError(e?.message ?? "从云端同步失败");
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
      <h1 style={{ fontSize: 20, margin: "0 0 4px", color: "var(--fg)" }}>设置</h1>
      <p style={{ margin: "4px 0 12px", fontSize: 13, color: "var(--muted)" }}>
        在这里选择本地客户端调用 LLM 时的路由模式，并配置自定义转发映射。使用说明请切换到「文档与使用说明」。
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        {(
          [
            { key: "general" as const, label: "常规设置" },
            { key: "docs" as const, label: "文档与使用说明" },
          ] as const
        ).map((t) => {
          const active = settingsTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setSettingsTab(t.key)}
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
              {t.label}
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
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", marginBottom: 6 }}>LLM 路由模式</div>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted2)", lineHeight: 1.5 }}>
          你可以选择直接连接上游 LLM，或通过 ClawHeart 云端网关转发（带危险指令监管与意图识别能力）。
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
              <span>通过 ClawHeart 网关（推荐）</span>
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
                  当前
                </span>
              )}
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
              请求先发到云端网关，由网关执行危险指令拦截与意图识别，再转发到上游 LLM。便于统一审计与策略配置。
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
              <span>直接连接 LLM（仅本地校验）</span>
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
                  当前
                </span>
              )}
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
              本地客户端直接调用上游 LLM，仅使用本地危险指令库做拦截。适合内网环境或对延迟更敏感的场景。
            </div>
          </button>
        </div>

        {loading && (
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted2)" }}>正在加载当前配置…</div>
        )}
      </div>

      <div
        style={{
          marginTop: 18,
          paddingTop: 12,
          borderTop: "1px solid var(--panel-border)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", marginBottom: 6 }}>Skills 用户设置同步</div>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted2)", lineHeight: 1.5 }}>
          当你在本地客户端修改 Skill 的启用状态时，是否同步到云端。开启后，你的偏好设置将在多设备间保持一致。
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
            {syncUserSkillsToCloud ? "已开启" : "已关闭"}
          </button>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            {syncUserSkillsToCloud ? "修改 Skill 启用状态时会同步到云端" : "修改 Skill 启用状态时仅保存在本地"}
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
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", marginBottom: 6 }}>危险指令用户设置同步</div>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted2)", lineHeight: 1.5 }}>
          当你在本地客户端修改危险指令的启用状态时，是否同步到云端。开启后，你的偏好设置将在多设备间保持一致。
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
            {syncUserDangersToCloud ? "已开启" : "已关闭"}
          </button>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            {syncUserDangersToCloud ? "修改危险指令启用状态时会同步到云端" : "修改危险指令启用状态时仅保存在本地"}
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
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", marginBottom: 6 }}>映射配置云端同步</div>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted2)", lineHeight: 1.5 }}>
          开启后，添加/删除映射时会自动同步到云端。GATEWAY 模式需要云端映射才能正常工作。
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
            {syncMappingsToCloud ? "已开启" : "已关闭"}
          </button>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            {syncMappingsToCloud ? "映射会同步到云端（推荐）" : "映射仅保存在本地"}
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
            {syncingMappings ? "同步中..." : "从云端拉取映射"}
          </button>
          <span style={{ fontSize: 11, color: "var(--muted2)", lineHeight: "28px" }}>
            将云端映射配置同步到本地（会覆盖本地同名映射）
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
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", marginBottom: 6 }}>网络映射配置</div>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted2)", lineHeight: 1.5 }}>
          配置自定义前缀，将 <span style={{ color: "var(--fg)" }}>http://127.0.0.1:19111/&lt;前缀&gt;/…</span> 转发到任意上游网络基地址（不限于纯文本 LLM，亦可对接多模态等 HTTP API）。
          <br/>
          • <span style={{ color: "var(--fg)" }}>DIRECT 模式</span>：本地直接转发到目标基地址
          <br/>
          • <span style={{ color: "var(--fg)" }}>GATEWAY 模式</span>：转发到云端，云端查映射表并执行监管（需开启云端同步）
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input
            value={mappingPrefix}
            onChange={(e) => setMappingPrefix(e.target.value)}
            placeholder="前缀，例如 deepseek"
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
            placeholder="目标基地址，例如 https://api.openai.com"
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
            新增 / 更新
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
            <div style={{ padding: "8px 10px", fontSize: 11, color: "var(--muted2)" }}>正在加载映射配置…</div>
          ) : mappings.length === 0 ? (
            <div style={{ padding: "8px 10px", fontSize: 11, color: "var(--muted2)" }}>暂无映射配置。</div>
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
                  <th style={{ textAlign: "left", padding: "6px 10px", color: "var(--muted)", fontWeight: 500 }}>前缀</th>
                  <th style={{ textAlign: "left", padding: "6px 10px", color: "var(--muted)", fontWeight: 500 }}>
                    目标基地址
                  </th>
                  <th style={{ textAlign: "left", padding: "6px 10px", color: "var(--muted)", fontWeight: 500 }}>
                    本地网关地址（可复制）
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
                        可作为第三方应用的 Base URL
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
                        删除
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
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", marginBottom: 6 }}>高级系统设置</div>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted2)", lineHeight: 1.5 }}>
          用于本地联调/测试。开启后，云端 API Base 将切换为 <code style={{ color: "var(--fg)" }}>http://localhost:8080</code>。
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
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg)" }}>测试模式（本地后端 8080）</div>
            <div style={{ marginTop: 4, fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>
              当前：{" "}
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
              title={isLocalBackend ? "已开启：使用 http://localhost:8080" : "已关闭：使用 https://api.clawheart.live"}
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
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{isLocalBackend ? "已开启" : "已关闭"}</span>
          </div>
        </div>
      </div>
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

