import { useCallback, useEffect, useMemo, useState } from "react";
import { LocalStatus } from "../types";
import {
  MdManageSearch,
  MdWarning,
  MdErrorOutline,
  MdCheckCircle,
  MdPlayArrow,
  MdRefresh,
} from "react-icons/md";

type ScanItem = {
  id: number;
  code: string;
  title: string;
  description: string | null;
  category: string | null;
  defaultSeverity: string | null;
  scannerType: string;
};

type Finding = {
  itemCode: string;
  severity: string;
  title: string;
  detail: string;
  remediation: string;
  location: string;
};

const card: React.CSSProperties = {
  background: "var(--panel-bg)",
  border: "1px solid var(--panel-border)",
  borderRadius: 12,
  padding: "14px 16px",
  boxShadow:
    "0 0 0 1px rgba(255,255,255,0.03) inset, 0 8px 24px rgba(0,0,0,0.12)",
};

function ToggleSwitch({
  checked,
  disabled,
  onChange,
  accent,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  accent: "green" | "blue";
}) {
  const accentTrack = accent === "green" ? "rgba(34,197,94,0.25)" : "rgba(14,165,233,0.22)";
  const accentBorder = accent === "green" ? "rgba(34,197,94,0.6)" : "rgba(14,165,233,0.55)";
  const accentKnob = accent === "green" ? "#22c55e" : "#0ea5e9";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 999,
        border: `1px solid ${checked ? accentBorder : "var(--panel-border)"}`,
        background: checked ? accentTrack : "transparent",
        padding: 2,
        cursor: disabled ? "not-allowed" : "pointer",
        position: "relative",
        transition: "background 0.15s, border-color 0.15s, opacity 0.15s",
        opacity: disabled ? 0.6 : 1,
        flexShrink: 0,
        outline: "none",
      }}
    >
      <span
        style={{
          display: "block",
          width: 20,
          height: 20,
          borderRadius: 999,
          background: checked ? accentKnob : "var(--panel-bg2)",
          transform: checked ? "translateX(20px)" : "translateX(0px)",
          transition: "transform 0.18s ease, background 0.15s",
          boxShadow: checked ? "0 6px 16px rgba(0,0,0,0.25)" : "0 0 0 1px rgba(255,255,255,0.02) inset",
        }}
      />
    </button>
  );
}

export function SecurityScanPanel({ status }: { status: LocalStatus | null }) {
  const [items, setItems] = useState<ScanItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [contextExtra, setContextExtra] = useState("");

  type PrivacyState = {
    shareHistoryEnabled: boolean;
    consentSystemConfigEnabled: boolean;
  };
  const [privacy, setPrivacy] = useState<PrivacyState | null>(null);
  const [privacyLoading, setPrivacyLoading] = useState(true);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [privacySaving, setPrivacySaving] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [scanPhase, setScanPhase] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "CRITICAL" | "WARN" | "PASS">("ALL");
  const [subTab, setSubTab] = useState<"results" | "items">("items");

  const loadItems = useCallback(async () => {
    setItemsLoading(true);
    setItemsError(null);
    try {
      const res = await fetch("http://127.0.0.1:19111/api/security-scan/items");
      const data = await res.json();
      if (!res.ok) {
        setItemsError(data?.error?.message || "加载扫描项失败");
        setItems([]);
        return;
      }
      const list = (data?.items || []) as ScanItem[];
      setItems(list);
      const init: Record<string, boolean> = {};
      list.forEach((it) => {
        init[it.code] = true;
      });
      setSelected(init);
    } catch (e: any) {
      setItemsError(e?.message ?? "加载扫描项失败");
      setItems([]);
    } finally {
      setItemsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const loadPrivacy = useCallback(async () => {
    setPrivacyLoading(true);
    setPrivacyError(null);
    try {
      const res = await fetch("http://127.0.0.1:19111/api/security-scan/privacy");
      const data = await res.json();
      if (!res.ok) {
        setPrivacyError(data?.error?.message || "加载隐私配置失败");
        setPrivacy(null);
        return;
      }
      setPrivacy({
        shareHistoryEnabled: !!data?.shareHistoryEnabled,
        consentSystemConfigEnabled: !!data?.consentSystemConfigEnabled,
      });
    } catch (e: any) {
      setPrivacyError(e?.message ?? "加载隐私配置失败");
      setPrivacy(null);
    } finally {
      setPrivacyLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPrivacy();
  }, [loadPrivacy]);

  const savePrivacy = useCallback(
    async (nextPartial: Partial<PrivacyState>) => {
      if (!privacy) return;
      const next: PrivacyState = {
        shareHistoryEnabled: nextPartial.shareHistoryEnabled ?? privacy.shareHistoryEnabled,
        consentSystemConfigEnabled:
          nextPartial.consentSystemConfigEnabled ?? privacy.consentSystemConfigEnabled,
      };
      setPrivacySaving(true);
      setPrivacyError(null);
      try {
        const res = await fetch("http://127.0.0.1:19111/api/security-scan/privacy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        const data = await res.json();
        if (!res.ok) {
          setPrivacyError(data?.error?.message || "保存隐私配置失败");
          return;
        }
        setPrivacy(next);
      } catch (e: any) {
        setPrivacyError(e?.message ?? "保存隐私配置失败");
      } finally {
        setPrivacySaving(false);
      }
    },
    [privacy]
  );

  const buildAutoContext = useCallback(() => {
    const lines: string[] = [];
    lines.push("【ClawHeart Desktop 自动上下文】");
    lines.push(`- 云端基地址: ${status?.settings?.apiBase || "（未配置）"}`);
    lines.push(`- 路由模式: ${status?.llmRouteMode || "（未知）"}`);
    lines.push(
      `- 本地统计参考: 危险指令 ${status?.danger ?? "—"}，禁用技能 ${status?.disabled ?? "—"}，废弃技能 ${status?.deprecated ?? "—"}`
    );
    lines.push(`- 登录邮箱: ${status?.auth?.email || "未登录"}`);
    if (contextExtra.trim()) {
      lines.push("");
      lines.push("【用户补充说明】");
      lines.push(contextExtra.trim());
    }
    return lines.join("\n");
  }, [status, contextExtra]);

  const counts = useMemo(() => {
    let c = 0,
      w = 0,
      p = 0;
    findings.forEach((f) => {
      const s = (f.severity || "").toUpperCase();
      if (s === "CRITICAL") c++;
      else if (s === "WARN") w++;
      else if (s === "PASS") p++;
    });
    return { c, w, p, total: findings.length };
  }, [findings]);

  const filteredFindings = useMemo(() => {
    if (filter === "ALL") return findings;
    return findings.filter((f) => (f.severity || "").toUpperCase() === filter);
  }, [findings, filter]);

  const runScan = async () => {
    const codes = items.filter((it) => selected[it.code]).map((it) => it.code);
    if (codes.length === 0) {
      setScanError("请至少选择一个扫描项");
      return;
    }
    setScanning(true);
    setScanError(null);
    setFindings([]);
    setSubTab("results");
    setScanPhase("正在连接云端并执行扫描…");
    try {
      const res = await fetch("http://127.0.0.1:19111/api/security-scan/ai-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemCodes: codes, context: buildAutoContext() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScanError(data?.error?.message || `扫描失败（${res.status}）`);
        return;
      }
      const list = (data?.findings || []) as Finding[];
      setFindings(Array.isArray(list) ? list : []);
      setScanPhase("");
    } catch (e: any) {
      setScanError(e?.message ?? "扫描失败");
    } finally {
      setScanning(false);
    }
  };

  const toggle = (code: string) => {
    setSelected((s) => ({ ...s, [code]: !s[code] }));
  };

  const selectAll = (on: boolean) => {
    const next: Record<string, boolean> = {};
    items.forEach((it) => {
      next[it.code] = on;
    });
    setSelected(next);
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", color: "var(--fg)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "linear-gradient(135deg, rgba(34,197,94,0.2), rgba(14,165,233,0.15))",
            border: "1px solid rgba(34,197,94,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#86efac",
          }}
        >
          <MdManageSearch style={{ fontSize: 26 }} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--fg)" }}>安全扫描</h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
            从云端拉取通用扫描项，结合本机环境与你的说明，由 AI（云端 DeepSeek）与静态规则生成 findings。请在系统配置中填写{" "}
            <code style={{ fontSize: 11, color: "var(--muted2)" }}>deepseek.api_key</code> 以启用 AI 项。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadItems()}
          disabled={itemsLoading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 14px",
            borderRadius: 999,
            border: "1px solid var(--panel-border)",
            background: "var(--panel-bg2)",
            color: "var(--fg)",
            fontSize: 13,
            fontWeight: 600,
            cursor: itemsLoading ? "not-allowed" : "pointer",
          }}
        >
          <MdRefresh style={{ fontSize: 18 }} />
          刷新扫描项
        </button>
      </div>

      {/* 次级标签 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {(
          [
            { id: "items" as const, label: "扫描项" },
            { id: "results" as const, label: "扫描结果" },
          ]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: subTab === t.id ? "1px solid rgba(34,197,94,0.5)" : "1px solid var(--panel-border)",
              background: subTab === t.id ? "rgba(34,197,94,0.12)" : "transparent",
              color: subTab === t.id ? "#86efac" : "var(--muted)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t.label}
            {t.id === "results" && counts.total > 0 && (
              <span style={{ marginLeft: 8, fontSize: 11, color: "var(--muted2)" }}>({counts.total})</span>
            )}
          </button>
        ))}
      </div>

      {/* 扫描进度条（参考 HTML scan-top） */}
      {(scanning || scanPhase) && (
        <div style={{ ...card, display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "rgba(14,165,233,0.15)",
              color: "#38bdf8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MdManageSearch style={{ fontSize: 22 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
              {scanning ? "正在扫描" : "就绪"}
              {scanning && (
                <span style={{ color: "#38bdf8", fontFamily: "ui-monospace, monospace", marginLeft: 8 }}>···</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{scanPhase || "选择扫描项后点击「开始扫描」"}</div>
            {scanning && (
              <div style={{ height: 4, background: "var(--panel-bg2)", borderRadius: 999, marginTop: 8, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: "70%",
                    borderRadius: 999,
                    background: "linear-gradient(90deg, #22c55e, #0ea5e9)",
                    animation: "pulseScan 1.2s ease-in-out infinite",
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes pulseScan { 0%{opacity:.5;transform:translateX(-20%)} 50%{opacity:1} 100%{opacity:.5;transform:translateX(40%)} }`}</style>

      {/* 统计条 */}
      {findings.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
          {[
            { label: "Critical", n: counts.c, color: "#f87171" },
            { label: "Warning", n: counts.w, color: "#fbbf24" },
            { label: "Passed", n: counts.p, color: "#4ade80" },
            { label: "Total", n: counts.total, color: "var(--muted)" },
          ].map((b) => (
            <div key={b.label} style={{ ...card, textAlign: "center", padding: "12px 10px" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: b.color, fontFamily: "ui-monospace, monospace" }}>{b.n}</div>
              <div style={{ fontSize: 11, color: "var(--muted2)", marginTop: 2 }}>{b.label}</div>
            </div>
          ))}
        </div>
      )}

      {itemsError && (
        <div style={{ ...card, borderColor: "rgba(248,113,113,0.4)", color: "#fca5a5", marginBottom: 14 }}>{itemsError}</div>
      )}
      {scanError && (
        <div style={{ ...card, borderColor: "rgba(248,113,113,0.4)", color: "#fca5a5", marginBottom: 14 }}>{scanError}</div>
      )}

      {subTab === "items" && (
        <>
          <div style={{ ...card, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted2)", marginBottom: 8, letterSpacing: "0.06em" }}>
              隐私与同意
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: privacySaving ? "not-allowed" : "pointer" }}>
                <ToggleSwitch
                  checked={privacy?.shareHistoryEnabled ?? false}
                  disabled={privacyLoading || privacySaving}
                  accent="green"
                  onChange={(next) => void savePrivacy({ shareHistoryEnabled: next })}
                />
                <span style={{ fontSize: 13, color: "var(--fg)", fontWeight: 700 }}>共享对话历史用于安全扫描</span>
              </label>

              <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: privacySaving ? "not-allowed" : "pointer" }}>
                <ToggleSwitch
                  checked={privacy?.consentSystemConfigEnabled ?? false}
                  disabled={privacyLoading || privacySaving}
                  accent="blue"
                  onChange={(next) => void savePrivacy({ consentSystemConfigEnabled: next })}
                />
                <span style={{ fontSize: 13, color: "var(--fg)", fontWeight: 700 }}>同意扫描本机 AI 配置</span>
              </label>
            </div>
            {privacyError && <div style={{ marginTop: 10, fontSize: 12, color: "#fca5a5" }}>{privacyError}</div>}
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
              未开启相应开关时，包含对应数据源的扫描项会被自动跳过（不会上传到云端）。
            </div>
          </div>

          <div style={{ ...card, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted2)", marginBottom: 8, letterSpacing: "0.06em" }}>补充上下文（可选）</div>
            <textarea
              value={contextExtra}
              onChange={(e) => setContextExtra(e.target.value)}
              placeholder="例如：使用的 MCP 列表、OpenClaw provider 名称、是否在某目录存放了 .env…"
              rows={4}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--panel-border)",
                background: "var(--panel-bg)",
                color: "var(--fg)",
                fontSize: 13,
                resize: "vertical",
              }}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => void runScan()}
                disabled={scanning || itemsLoading || items.length === 0}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 20px",
                  borderRadius: 999,
                  border: "none",
                  background: scanning ? "var(--panel-bg2)" : "linear-gradient(135deg, #22c55e, #16a34a)",
                  color: scanning ? "var(--fg)" : "#022c22",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: scanning ? "not-allowed" : "pointer",
                  boxShadow: scanning ? "none" : "0 4px 16px rgba(34,197,94,0.35)",
                }}
              >
                <MdPlayArrow style={{ fontSize: 22 }} />
                开始扫描
              </button>
              <button
                type="button"
                onClick={() => selectAll(true)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: "1px solid var(--panel-border)",
                  background: "transparent",
                  color: "var(--fg)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                全选
              </button>
              <button
                type="button"
                onClick={() => selectAll(false)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: "1px solid var(--panel-border)",
                  background: "transparent",
                  color: "var(--fg)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                全不选
              </button>
            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted2)", marginBottom: 8 }}>扫描项列表</div>
          {itemsLoading ? (
            <div style={{ ...card, color: "var(--muted)" }}>加载中…</div>
          ) : (
            items.map((it) => (
              <div
                key={it.code}
                style={{
                  ...card,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  marginBottom: 10,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--fg)" }}>{it.title}</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: "var(--chip-bg)",
                        color: "var(--chip-fg)",
                      }}
                    >
                      {it.category || "OTHER"}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background:
                          it.scannerType === "STATIC_INFO" ? "rgba(34,197,94,0.15)" : "rgba(14,165,233,0.15)",
                        color: it.scannerType === "STATIC_INFO" ? "#86efac" : "#7dd3fc",
                      }}
                    >
                      {it.scannerType === "STATIC_INFO" ? "静态" : "AI"}
                    </span>
                  </div>
                  {it.description && (
                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6, lineHeight: 1.45 }}>{it.description}</div>
                  )}
                  <div style={{ fontSize: 11, color: "var(--muted2)", marginTop: 6, fontFamily: "ui-monospace, monospace" }}>{it.code}</div>
                </div>
                <div style={{ marginTop: 2, marginLeft: "auto" }}>
                  <ToggleSwitch
                    checked={!!selected[it.code]}
                    onChange={() => toggle(it.code)}
                    accent="green"
                  />
                </div>
              </div>
            ))
          )}
        </>
      )}

      {subTab === "results" && (
        <>
          {findings.length === 0 && !scanning && (
            <div style={{ ...card, color: "var(--muted)", textAlign: "center", padding: 32 }}>
              暂无结果。请在「扫描项」中点击「开始扫描」。
            </div>
          )}

          {findings.length > 0 && (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {(
                  [
                    { id: "ALL" as const, label: "全部" },
                    { id: "CRITICAL" as const, label: "Critical" },
                    { id: "WARN" as const, label: "Warning" },
                    { id: "PASS" as const, label: "Passed" },
                  ]
                ).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setFilter(c.id)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 999,
                      border: filter === c.id ? "1px solid rgba(14,165,233,0.55)" : "1px solid var(--panel-border)",
                      background: filter === c.id ? "rgba(14,165,233,0.12)" : "var(--panel-bg2)",
                      color: filter === c.id ? "#7dd3fc" : "var(--muted)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {filteredFindings.map((f, idx) => {
                const sev = (f.severity || "").toUpperCase();
                const isC = sev === "CRITICAL";
                const isW = sev === "WARN";
                const icon = isC ? (
                  <MdErrorOutline style={{ color: "#f87171", fontSize: 20, flexShrink: 0 }} />
                ) : isW ? (
                  <MdWarning style={{ color: "#fbbf24", fontSize: 20, flexShrink: 0 }} />
                ) : (
                  <MdCheckCircle style={{ color: "#4ade80", fontSize: 20, flexShrink: 0 }} />
                );
                const badgeBg = isC ? "rgba(248,113,113,0.15)" : isW ? "rgba(251,191,36,0.12)" : "rgba(74,222,128,0.12)";
                const badgeColor = isC ? "#f87171" : isW ? "#fbbf24" : "#4ade80";
                return (
                  <div key={idx} style={{ ...card, marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      {icon}
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: "0.08em",
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: badgeBg,
                          color: badgeColor,
                        }}
                      >
                        {sev || "WARN"}
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "var(--fg)" }}>{f.title}</span>
                    </div>
                    {f.detail && <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 6 }}>{f.detail}</div>}
                    {f.location && (
                      <div style={{ fontSize: 12, color: "var(--muted2)", fontFamily: "ui-monospace, monospace", marginBottom: 6 }}>
                        {f.location}
                      </div>
                    )}
                    {f.remediation && (
                      <div style={{ fontSize: 13, color: "#7dd3fc", lineHeight: 1.45 }}>建议：{f.remediation}</div>
                    )}
                    <div style={{ fontSize: 11, color: "var(--muted2)", marginTop: 8, fontFamily: "ui-monospace, monospace" }}>
                      item: {f.itemCode}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}
    </div>
  );
}
