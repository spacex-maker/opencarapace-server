import { useEffect, useState } from "react";

type LlmRouteMode = "DIRECT" | "GATEWAY";

type LlmMapping = {
  id: number;
  prefix: string;
  target_base: string;
};

export function SettingsPanel() {
  const [mode, setMode] = useState<LlmRouteMode>("GATEWAY");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mappings, setMappings] = useState<LlmMapping[]>([]);
  const [mappingPrefix, setMappingPrefix] = useState("");
  const [mappingTarget, setMappingTarget] = useState("");
  const [mappingLoading, setMappingLoading] = useState(false);

  const [syncUserSkillsToCloud, setSyncUserSkillsToCloud] = useState(true);
  const [syncUserDangersToCloud, setSyncUserDangersToCloud] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);

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
    loadMappings();
    loadSyncSetting();
  }, []);

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
      const res = await fetch("http://127.0.0.1:19111/api/llm-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, targetBase }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "保存映射失败");
      } else if (Array.isArray(data?.items)) {
        setMappings(data.items);
        setMappingPrefix("");
        setMappingTarget("");
        setMessage("已更新 LLM 映射配置。");
      }
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
      const res = await fetch(`http://127.0.0.1:19111/api/llm-mappings/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "删除映射失败");
      } else if (Array.isArray(data?.items)) {
        setMappings(data.items);
        setMessage("已删除一条映射。");
      }
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

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        background: "#020617",
        borderRadius: 16,
        padding: "24px 28px",
        border: "1px solid #1f2937",
        boxShadow: "0 20px 40px rgba(15,23,42,0.6)",
        fontSize: 12,
      }}
    >
      <h1 style={{ fontSize: 20, margin: "0 0 4px", color: "#f9fafb" }}>设置</h1>
      <p style={{ margin: "4px 0 16px", fontSize: 13, color: "#9ca3af" }}>
        在这里选择本地客户端调用 LLM 时的路由模式，并配置自定义转发映射。
      </p>

      <div
        style={{
          marginTop: 8,
          paddingTop: 12,
          borderTop: "1px solid #1f2937",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 500, color: "#e5e7eb", marginBottom: 6 }}>LLM 路由模式</div>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
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
              border: mode === "GATEWAY" ? "1px solid #22c55e" : "1px solid #1f2937",
              background:
                mode === "GATEWAY" ? "linear-gradient(135deg, #064e3b, #022c22)" : "rgba(15,23,42,0.85)",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: mode === "GATEWAY" ? "#bbf7d0" : "#e5e7eb",
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
                    background: "rgba(16,185,129,0.2)",
                    color: "#6ee7b7",
                    border: "1px solid rgba(16,185,129,0.6)",
                  }}
                >
                  当前
                </span>
              )}
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: "#9ca3af", lineHeight: 1.6 }}>
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
              border: mode === "DIRECT" ? "1px solid #38bdf8" : "1px solid #1f2937",
              background:
                mode === "DIRECT" ? "linear-gradient(135deg, #0c4a6e, #020617)" : "rgba(15,23,42,0.85)",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: mode === "DIRECT" ? "#bae6fd" : "#e5e7eb",
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
                    background: "rgba(56,189,248,0.18)",
                    color: "#7dd3fc",
                    border: "1px solid rgba(56,189,248,0.6)",
                  }}
                >
                  当前
                </span>
              )}
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: "#9ca3af", lineHeight: 1.6 }}>
              本地客户端直接调用上游 LLM，仅使用本地危险指令库做拦截。适合内网环境或对延迟更敏感的场景。
            </div>
          </button>
        </div>

        {loading && (
          <div style={{ marginTop: 8, fontSize: 11, color: "#6b7280" }}>正在加载当前配置…</div>
        )}
      </div>

      <div
        style={{
          marginTop: 18,
          paddingTop: 12,
          borderTop: "1px solid #1f2937",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 500, color: "#e5e7eb", marginBottom: 6 }}>Skills 用户设置同步</div>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
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
              border: syncUserSkillsToCloud ? "1px solid #22c55e" : "1px solid #1f2937",
              background: syncUserSkillsToCloud
                ? "linear-gradient(135deg, #064e3b, #022c22)"
                : "rgba(15,23,42,0.85)",
              cursor: syncLoading ? "not-allowed" : "pointer",
              fontSize: 11,
              fontWeight: 600,
              color: syncUserSkillsToCloud ? "#bbf7d0" : "#e5e7eb",
            }}
          >
            {syncUserSkillsToCloud ? "已开启" : "已关闭"}
          </button>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>
            {syncUserSkillsToCloud ? "修改 Skill 启用状态时会同步到云端" : "修改 Skill 启用状态时仅保存在本地"}
          </span>
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          paddingTop: 12,
          borderTop: "1px solid #1f2937",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 500, color: "#e5e7eb", marginBottom: 6 }}>危险指令用户设置同步</div>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
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
              border: syncUserDangersToCloud ? "1px solid #22c55e" : "1px solid #1f2937",
              background: syncUserDangersToCloud
                ? "linear-gradient(135deg, #064e3b, #022c22)"
                : "rgba(15,23,42,0.85)",
              cursor: syncLoading ? "not-allowed" : "pointer",
              fontSize: 11,
              fontWeight: 600,
              color: syncUserDangersToCloud ? "#bbf7d0" : "#e5e7eb",
            }}
          >
            {syncUserDangersToCloud ? "已开启" : "已关闭"}
          </button>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>
            {syncUserDangersToCloud ? "修改危险指令启用状态时会同步到云端" : "修改危险指令启用状态时仅保存在本地"}
          </span>
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          paddingTop: 12,
          borderTop: "1px solid #1f2937",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 500, color: "#e5e7eb", marginBottom: 6 }}>LLM 映射配置</div>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
          你可以为本地网关配置自定义前缀，将{" "}
          <span style={{ color: "#e5e7eb" }}>http://127.0.0.1:19111/&lt;前缀&gt;/…</span> 转发到任意
          LLM 基地址（例如 <span style={{ color: "#e5e7eb" }}>https://api.openai.com</span>）。目标基地址一般建议只写
          域名和固定前缀，由第三方 SDK 再拼自己的 path，避免出现 <code>/v1/v1/…</code> 这类重复路径。
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input
            value={mappingPrefix}
            onChange={(e) => setMappingPrefix(e.target.value)}
            placeholder="前缀，例如 deepseek"
            style={{
              flex: 0.5,
              background: "#020617",
              borderRadius: 999,
              border: "1px solid #1f2937",
              padding: "6px 10px",
              fontSize: 11,
              color: "#e5e7eb",
              outline: "none",
            }}
          />
          <input
            value={mappingTarget}
            onChange={(e) => setMappingTarget(e.target.value)}
            placeholder="目标基地址，例如 https://api.openai.com"
            style={{
              flex: 1.2,
              background: "#020617",
              borderRadius: 999,
              border: "1px solid #1f2937",
              padding: "6px 10px",
              fontSize: 11,
              color: "#e5e7eb",
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
            border: "1px solid #1f2937",
            background: "rgba(15,23,42,0.85)",
            maxHeight: 180,
            overflowY: "auto",
          }}
        >
          {mappingLoading && mappings.length === 0 ? (
            <div style={{ padding: "8px 10px", fontSize: 11, color: "#6b7280" }}>正在加载映射配置…</div>
          ) : mappings.length === 0 ? (
            <div style={{ padding: "8px 10px", fontSize: 11, color: "#6b7280" }}>暂无映射配置。</div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 11,
              }}
            >
              <thead>
                <tr style={{ background: "#020617" }}>
                  <th style={{ textAlign: "left", padding: "6px 10px", color: "#9ca3af", fontWeight: 500 }}>前缀</th>
                  <th style={{ textAlign: "left", padding: "6px 10px", color: "#9ca3af", fontWeight: 500 }}>
                    目标基地址
                  </th>
                  <th style={{ textAlign: "left", padding: "6px 10px", color: "#9ca3af", fontWeight: 500 }}>
                    本地网关地址（可复制）
                  </th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.id}>
                    <td style={{ padding: "6px 10px", color: "#e5e7eb", borderTop: "1px solid #111827" }}>
                      {m.prefix}
                    </td>
                    <td style={{ padding: "6px 10px", color: "#9ca3af", borderTop: "1px solid #111827" }}>
                      {m.target_base}
                    </td>
                    <td style={{ padding: "6px 10px", color: "#e5e7eb", borderTop: "1px solid #111827" }}>
                      <div style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                        http://127.0.0.1:19111/{m.prefix}
                      </div>
                      <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>
                        可作为第三方应用的 Base URL
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "6px 10px",
                        borderTop: "1px solid #111827",
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

      {message && (
        <div style={{ marginTop: 10, fontSize: 11, color: "#4ade80" }}>{message}</div>
      )}
      {error && (
        <div style={{ marginTop: 4, fontSize: 11, color: "#f97373" }}>{error}</div>
      )}
    </div>
  );
}

