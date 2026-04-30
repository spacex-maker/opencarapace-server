import { useEffect, useState } from "react";
import { useClawMgmt } from "./context";
import type { GatewayReadinessPayload } from "./useClawMgmtCore";

const API = "http://127.0.0.1:19111";
const DEFAULT_MINIMAX_BASE = "https://api.minimaxi.com/anthropic";

/**
 * Gateway 启动被配置校验拦截（400 + readiness）时展示：列出缺口、快捷填写 MiniMax、一键官方 Key、可选生成 token。
 */
export function GatewayConfigGateModal() {
  const c = useClawMgmt();
  const gate = c.gatewayConfigGate;
  const [liveReadiness, setLiveReadiness] = useState<GatewayReadinessPayload | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(DEFAULT_MINIMAX_BASE);
  const [generateGatewayToken, setGenerateGatewayToken] = useState(false);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [officialBusy, setOfficialBusy] = useState(false);
  const [inlineErr, setInlineErr] = useState<string | null>(null);

  useEffect(() => {
    if (!gate) {
      setLiveReadiness(null);
      setInlineErr(null);
      return;
    }
    setLiveReadiness(gate.readiness);
    setInlineErr(null);
    const target = gate.mode === "bundled" ? "clawheart-managed" : "user-profile";
    void fetch(`${API}/api/openclaw/config?target=${encodeURIComponent(target)}`)
      .then((r) => r.json())
      .then((d) => {
        const m = d?.config?.models?.providers?.minimax;
        setApiKey(typeof m?.apiKey === "string" ? m.apiKey : "");
        setBaseUrl(
          typeof m?.baseUrl === "string" && String(m.baseUrl).trim() ? String(m.baseUrl).trim() : DEFAULT_MINIMAX_BASE
        );
      })
      .catch(() => {});
    const needTok = gate.readiness.issues.some((i) => i.code === "gateway_token_empty");
    setGenerateGatewayToken(needTok);
  }, [gate]);

  if (!gate) return null;

  const readiness = liveReadiness ?? gate.readiness;
  const issues = readiness.issues ?? [];

  const handleOfficial = async () => {
    setOfficialBusy(true);
    setInlineErr(null);
    try {
      const res = await fetch(`${API}/api/openclaw/apply-official-minimax-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gatewayOpenclawBinary: gate.mode }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        readiness?: GatewayReadinessPayload;
        error?: { message?: string };
      };
      // 服务端成功常为 { ok: true }；若仅有 readiness 未带 ok，不能用 !data.ok（undefined 会被误判为失败）
      const failed = !res.ok || data.ok === false;
      if (failed) {
        setInlineErr(
          (typeof data.message === "string" && data.message) ||
            (typeof data.error?.message === "string" && data.error.message) ||
            (!res.ok ? `请求失败（HTTP ${res.status}）` : "拉取官方 Key 失败")
        );
        return;
      }
      if (data.readiness) setLiveReadiness(data.readiness);
      // 先关模态，避免 refresh / 状态异步导致仍显示 gate
      c.dismissGatewayConfigGate();
      try {
        await c.refresh();
      } catch {
        /* refresh 不应挡住已成功的关闭 */
      }
    } catch (e) {
      setInlineErr(e instanceof Error ? e.message : "请求失败");
    } finally {
      setOfficialBusy(false);
    }
  };

  const handleSaveAndStart = async () => {
    setMergeBusy(true);
    setInlineErr(null);
    try {
      const res = await fetch(`${API}/api/openclaw/merge-gateway-prereqs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gatewayOpenclawBinary: gate.mode,
          minimaxApiKey: apiKey.trim(),
          minimaxBaseUrl: baseUrl.trim(),
          generateGatewayTokenIfEmpty: generateGatewayToken,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        readiness?: GatewayReadinessPayload;
        error?: { message?: string };
      };
      const failed = !res.ok || data.ok === false;
      if (failed) {
        setInlineErr(
          (typeof data.message === "string" && data.message) ||
            (typeof data.error?.message === "string" && data.error.message) ||
            (!res.ok ? `保存失败（HTTP ${res.status}）` : "保存失败")
        );
        return;
      }
      if (data.readiness) setLiveReadiness(data.readiness);
      if (data.readiness?.blocking) {
        setInlineErr("仍有必填项未满足，请根据下方列表继续填写。");
        return;
      }
      c.dismissGatewayConfigGate();
      await c.startGateway(gate.mode);
    } catch (e) {
      setInlineErr(e instanceof Error ? e.message : "保存失败");
    } finally {
      setMergeBusy(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 20000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(0,0,0,0.55)",
      }}
      role="presentation"
      onClick={() => c.dismissGatewayConfigGate()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gw-gate-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(480px, 100%)",
          maxHeight: "min(90vh, 640px)",
          overflow: "auto",
          borderRadius: 12,
          border: "1px solid var(--panel-border)",
          background: "var(--panel-bg)",
          color: "var(--fg)",
          padding: "18px 20px",
          boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
        }}
      >
        <div id="gw-gate-title" style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
          无法启动 Gateway：请补全配置
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5, marginBottom: 12 }}>
          {gate.message}
        </div>
        <div style={{ fontSize: 10, color: "var(--muted2)", wordBreak: "break-all", marginBottom: 12 }}>
          配置文件：<code>{readiness.configPath}</code>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8, color: "var(--fg)" }}>待处理项</div>
        <ul style={{ margin: "0 0 14px", paddingLeft: 18, fontSize: 11, lineHeight: 1.55 }}>
          {issues.map((it, idx) => (
            <li
              key={`${it.code}-${idx}`}
              style={{
                marginBottom: 4,
                color: it.severity === "error" ? "var(--claw-danger-fg)" : "var(--claw-amber-fg)",
              }}
            >
              <span style={{ fontWeight: 700 }}>{it.severity === "error" ? "[必需]" : "[建议]"}</span> {it.message}
            </li>
          ))}
        </ul>

        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>快捷填写</div>
        <label style={{ display: "block", fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          MiniMax API Key
        </label>
        <input
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-api-…"
          style={{
            width: "100%",
            boxSizing: "border-box",
            marginBottom: 10,
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--panel-border)",
            background: "var(--panel-bg2)",
            color: "var(--fg)",
            fontSize: 11,
          }}
        />
        <label style={{ display: "block", fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>MiniMax Base URL</label>
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder={DEFAULT_MINIMAX_BASE}
          style={{
            width: "100%",
            boxSizing: "border-box",
            marginBottom: 12,
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid var(--panel-border)",
            background: "var(--panel-bg2)",
            color: "var(--fg)",
            fontSize: 11,
          }}
        />

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11,
            marginBottom: 14,
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={generateGatewayToken}
            onChange={(e) => setGenerateGatewayToken(e.target.checked)}
          />
          Gateway 鉴权 token 为空时，自动生成并写入（本地随机 hex）
        </label>

        {inlineErr ? (
          <div
            style={{
              fontSize: 11,
              color: "var(--claw-danger-fg)",
              marginBottom: 12,
              lineHeight: 1.45,
            }}
          >
            {inlineErr}
          </div>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {readiness.canApplyOfficialMinimaxKey ? (
            <button
              type="button"
              disabled={officialBusy || mergeBusy}
              onClick={() => void handleOfficial()}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid rgba(56,189,248,0.55)",
                background: "rgba(56,189,248,0.14)",
                color: "var(--claw-cyan-fg)",
                fontSize: 12,
                fontWeight: 700,
                cursor: officialBusy || mergeBusy ? "not-allowed" : "pointer",
              }}
            >
              {officialBusy ? "正在写入官方默认 Key 并重启…" : "使用云端官方默认 MiniMax Key（并重启 Gateway）"}
            </button>
          ) : null}
          <button
            type="button"
            disabled={mergeBusy || officialBusy}
            onClick={() => void handleSaveAndStart()}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid rgba(34,197,94,0.45)",
              background: "rgba(34,197,94,0.14)",
              color: "var(--claw-green-fg-soft)",
              fontSize: 12,
              fontWeight: 700,
              cursor: mergeBusy || officialBusy ? "not-allowed" : "pointer",
            }}
          >
            {mergeBusy ? "保存中…" : "保存以上配置并启动 Gateway"}
          </button>
          <button
            type="button"
            disabled={mergeBusy || officialBusy}
            onClick={() => c.dismissGatewayConfigGate()}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: "var(--muted2)",
              fontSize: 11,
              cursor: mergeBusy || officialBusy ? "not-allowed" : "pointer",
            }}
          >
            稍后处理
          </button>
        </div>
      </div>
    </div>
  );
}
