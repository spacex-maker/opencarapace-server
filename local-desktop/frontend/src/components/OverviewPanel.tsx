import { Field, StatCard, LocalStatus } from "./Common";

interface Props {
  status: LocalStatus | null;
  loading: boolean;
  apiBase: string;
  ocApiKey: string;
  llmKey: string;
  setApiBase: (v: string) => void;
  setOcApiKey: (v: string) => void;
  setLlmKey: (v: string) => void;
  saving: boolean;
  message: string | null;
  error: string | null;
  onSave: () => void;
}

export function OverviewPanel(props: Props) {
  const {
    status,
    loading,
    apiBase,
    ocApiKey,
    llmKey,
    setApiBase,
    setOcApiKey,
    setLlmKey,
    saving,
    message,
    error,
    onSave,
  } = props;

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
      }}
    >
      <h1 style={{ fontSize: 20, margin: "0 0 4px", color: "#f9fafb" }}>ClawHeart 本地客户端</h1>
      <p style={{ margin: "4px 0 16px", fontSize: 13, color: "#9ca3af" }}>
        本地已同步的安全规则，可用于离线危险指令拦截与技能启用控制。
      </p>

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          padding: "4px 9px",
          borderRadius: 999,
          background: "#0f172a",
          border: "1px solid #1f2937",
          color: "#9ca3af",
          marginTop: 4,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background: "#22c55e",
            boxShadow: "0 0 0 4px rgba(34,197,94,0.15)",
          }}
        />
        本地代理运行中
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0,1fr))",
          gap: 12,
          marginTop: 16,
        }}
      >
        <StatCard label="危险指令规则" value={loading ? "…" : status?.danger ?? 0} />
        <StatCard label="禁用技能（系统）" value={loading ? "…" : status?.disabled ?? 0} />
        <StatCard label="不推荐技能（系统）" value={loading ? "…" : status?.deprecated ?? 0} />
      </div>

      <div
        style={{
          marginTop: 20,
          paddingTop: 16,
          borderTop: "1px solid #1f2937",
        }}
      >
        <h2 style={{ fontSize: 14, margin: "0 0 6px", color: "#e5e7eb" }}>连接配置</h2>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "#6b7280" }}>
          在这里配置云端服务地址与密钥，本地代理会使用这些配置进行规则同步与 LLM 调用。
        </p>
        <Field
          label="API Base（后端地址，如 https://api.clawheart.live 或 http://localhost:8080）"
          value={apiBase}
          onChange={setApiBase}
        />
        <Field
          label="ClawHeart API Key（用于访问危险指令库与技能状态）"
          value={ocApiKey}
          onChange={setOcApiKey}
        />
        <Field
          label="上游 LLM Key（用于实际模型调用）"
          value={llmKey}
          onChange={setLlmKey}
        />
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          style={{
            marginTop: 6,
            padding: "8px 14px",
            borderRadius: 999,
            border: "none",
            background: "#22c55e",
            color: "#022c22",
            fontSize: 13,
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "保存中…" : "保存并同步规则"}
        </button>
        {message && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#4ade80" }}>{message}</div>
        )}
        {error && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#f97373" }}>{error}</div>
        )}
      </div>

      <p style={{ marginTop: 18, fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
        提示：保存配置后，本地会自动从云端同步危险指令库、系统级技能状态以及你的个人技能偏好。 稍后你可以直接将
        OpenAI 兼容客户端指向{" "}
        <code
          style={{
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: 12,
            background: "#020617",
            padding: "2px 5px",
            borderRadius: 4,
            border: "1px solid #111827",
            color: "#e5e7eb",
          }}
        >
          http://127.0.0.1:19111/v1/chat/completions
        </code>{" "}
        使用。
      </p>
    </div>
  );
}

