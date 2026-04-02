import { useEffect, useMemo, useRef, useState } from "react";
import { DangerPanel } from "./DangerPanel";
import { BudgetMonitorPanel } from "./BudgetMonitorPanel";
import { RealtimeOverviewPanel } from "./RealtimeOverviewPanel";
import { ProxyRequestLogsPanel } from "./ProxyRequestLogsPanel";

function FilterSelect(props: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  placeholder: string;
  height?: number;
  width?: number;
}) {
  const controlHeight = props.height ?? 36;
  const [open, setOpen] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as any)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const current = props.options.find((o) => o.value === props.value)?.label || props.placeholder;
  const safeWidth = props.width ?? 220;

  return (
    <div ref={ref} style={{ position: "relative", width: safeWidth, flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          height: controlHeight,
          padding: "0 12px",
          borderRadius: 999,
          border: "1px solid var(--panel-border)",
          background: "var(--panel-bg)",
          color: props.value ? "var(--fg)" : "var(--muted2)",
          fontSize: 12,
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxSizing: "border-box",
          cursor: "pointer",
        }}
      >
        <span style={{ lineHeight: 1 }}>{current}</span>
        <span style={{ color: "var(--muted2)", lineHeight: 1 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 20,
            top: `calc(${controlHeight}px + 6px)`,
            left: 0,
            right: 0,
            maxHeight: 220,
            overflowY: "auto",
            borderRadius: 12,
            border: "1px solid var(--panel-border)",
            background: "var(--panel-bg)",
            boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
          }}
        >
          {props.options.map((o, idx) => {
            const active = o.value === props.value;
            const hovered = hoverIndex === idx;
            return (
              <button
                key={o.value || "__all"}
                type="button"
                onMouseEnter={() => setHoverIndex(idx)}
                onMouseLeave={() => setHoverIndex(null)}
                onClick={() => {
                  props.onChange(o.value);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "none",
                  background: active
                    ? "rgba(59,130,246,0.12)"
                    : hovered
                      ? "rgba(148,163,184,0.08)"
                      : "transparent",
                  color: active ? "#93c5fd" : "var(--fg)",
                  fontSize: 12,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type BlockLog = {
  id: number;
  createdAt: string;
  blockType: string | null;
  riskLevel: string | null;
  reasons: string | null;
  promptSnippet: string | null;
};

type BlockLogDetail = {
  id: number;
  createdAt: string;
  blockType: string | null;
  riskLevel: string | null;
  reasons: string | null;
  rawInput: string | null;
};

function formatLocalDateTime(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("zh-CN", { hour12: false });
}

function formatBlockType(t: string | null) {
  if (!t) return "-";
  if (t === "danger_command") return "危险指令";
  if (t === "skill_disabled") return "技能禁用";
  if (t === "budget_exceeded") return "预算拦截";
  return t;
}

function riskTagStyle(riskLevel: string | null): React.CSSProperties {
  const r = String(riskLevel || "").toUpperCase();
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 10,
    padding: "2px 6px",
    borderRadius: 999,
    border: "1px solid var(--panel-border)",
    color: "var(--muted)",
    background: "var(--chip-bg)",
    width: "fit-content",
  };
  if (r === "CRITICAL") return { ...base, color: "#fecaca", border: "1px solid rgba(239,68,68,0.55)", background: "rgba(239,68,68,0.14)" };
  if (r === "HIGH") return { ...base, color: "#fed7aa", border: "1px solid rgba(249,115,22,0.55)", background: "rgba(249,115,22,0.14)" };
  if (r === "MEDIUM") return { ...base, color: "#fde68a", border: "1px solid rgba(234,179,8,0.55)", background: "rgba(234,179,8,0.14)" };
  if (r === "LOW") return { ...base, color: "#bbf7d0", border: "1px solid rgba(34,197,94,0.55)", background: "rgba(34,197,94,0.14)" };
  return base;
}

export function InterceptLogsPanel({
  showAccountSwitchPlaceholder = false,
}: {
  showAccountSwitchPlaceholder?: boolean;
}) {
  const [panelTab, setPanelTab] = useState<"overview" | "alerts" | "rules" | "requests" | "budget">("overview");
  const [items, setItems] = useState<BlockLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<BlockLogDetail | null>(null);

  const [page, setPage] = useState(1);
  const [size] = useState(50);
  const [total, setTotal] = useState(0);

  const [blockType, setBlockType] = useState<string>(""); // ""=all

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / size)), [total, size]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("page", String(page));
      qs.set("size", String(size));
      if (blockType.trim()) qs.set("blockType", blockType.trim());

      const res = await fetch(`http://127.0.0.1:19111/api/intercept-logs?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "加载失败");
        setItems([]);
        setTotal(0);
        return;
      }
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotal(typeof data?.total === "number" ? data.total : 0);
    } catch (e: any) {
      setError(e?.message ?? "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (panelTab !== "alerts") return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelTab, page, blockType]);

  const openDetail = async (id: number) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    try {
      const res = await fetch(`http://127.0.0.1:19111/api/intercept-logs/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setDetailError(data?.error?.message || "加载详情失败");
        return;
      }
      setDetail(data);
    } catch (e: any) {
      setDetailError(e?.message ?? "加载详情失败");
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 980,
        margin: "0 auto",
        background: "var(--panel-bg)",
        borderRadius: 16,
        padding: "24px 28px",
        border: "1px solid var(--panel-border)",
        boxShadow: "none",
      }}
    >
      <h1 style={{ fontSize: 20, margin: "0 0 6px", color: "var(--fg)" }}>拦截监控</h1>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
        查看云端记录的拦截事件，并在此管理「拦截项目」——即参与本地匹配的危险指令规则库（原独立「危险指令库」已并入本页）。
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {(
          [
            { id: "overview" as const, label: "实时概览" },
            { id: "alerts" as const, label: "告警记录" },
            { id: "rules" as const, label: "拦截项目" },
            { id: "requests" as const, label: "请求日志" },
            { id: "budget" as const, label: "预算设置" },
          ]
        ).map((t) => {
          const active = panelTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setPanelTab(t.id)}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                border: active ? "1px solid rgba(34,197,94,0.5)" : "1px solid var(--panel-border)",
                background: active ? "rgba(34,197,94,0.12)" : "var(--panel-bg2)",
                color: active ? "#86efac" : "var(--muted)",
                fontSize: 13,
                fontWeight: active ? 700 : 600,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {panelTab === "rules" && (
        <DangerPanel embedded showAccountSwitchPlaceholder={showAccountSwitchPlaceholder} />
      )}

      {panelTab === "budget" && <BudgetMonitorPanel />}

      {panelTab === "overview" && <RealtimeOverviewPanel />}

      {panelTab === "requests" && <ProxyRequestLogsPanel />}

      {panelTab === "alerts" && (
        <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>类型</div>
        <FilterSelect
          value={blockType}
          onChange={(v) => {
            setPage(1);
            setBlockType(v);
          }}
          placeholder="全部"
          width={240}
          options={[
            { label: "全部", value: "" },
            { label: "危险指令", value: "danger_command" },
            { label: "技能禁用", value: "skill_disabled" },
            { label: "预算拦截", value: "budget_exceeded" },
          ]}
        />

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          style={{
            marginLeft: "auto",
            padding: "6px 12px",
            fontSize: 12,
            borderRadius: 999,
            border: "1px solid var(--panel-border)",
            background: "var(--panel-bg)",
            color: "var(--fg)",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "加载中…" : "刷新"}
        </button>
      </div>

      {error && <div style={{ marginTop: 10, fontSize: 12, color: "#f97373" }}>{error}</div>}

      <div
        style={{
          marginTop: 12,
          borderRadius: 12,
          border: "1px solid var(--panel-border)",
          background: "var(--panel-bg)",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--panel-bg)" }}>
              <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--muted)", fontWeight: 500, width: 170 }}>
                类型 / 风险
              </th>
              <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--muted)", fontWeight: 500 }}>
                触发原因
              </th>
              <th style={{ width: 84 }} />
              <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--muted)", fontWeight: 500, width: 170 }}>
                时间
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: "10px", color: "var(--muted2)" }}>
                  {loading ? "正在加载…" : "暂无拦截记录。"}
                </td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.id} style={{ borderTop: "1px solid var(--panel-border)" }}>
                  <td style={{ padding: "8px 10px", color: "var(--fg)" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ fontWeight: 600, color: "var(--fg)" }}>{formatBlockType(it.blockType)}</div>
                      <div style={riskTagStyle(it.riskLevel)}>{String(it.riskLevel || "-").toUpperCase()}</div>
                    </div>
                  </td>
                  <td style={{ padding: "8px 10px", color: "var(--muted)" }}>{it.reasons || "-"}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => void openDetail(it.id)}
                      style={{
                        fontSize: 11,
                        padding: "4px 10px",
                        borderRadius: 999,
                        border: "1px solid var(--panel-border)",
                        background: "transparent",
                        color: "var(--fg)",
                        cursor: "pointer",
                      }}
                    >
                      详情
                    </button>
                  </td>
                  <td style={{ padding: "8px 10px", color: "var(--fg)", whiteSpace: "nowrap" }}>
                    {formatLocalDateTime(it.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--muted)" }}>
        <button
          type="button"
          disabled={loading || page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid var(--panel-border)",
            background: "transparent",
            color: "var(--fg)",
            cursor: loading || page <= 1 ? "not-allowed" : "pointer",
            opacity: loading || page <= 1 ? 0.5 : 1,
          }}
        >
          上一页
        </button>
        <div>
          第 <span style={{ color: "var(--fg)" }}>{page}</span> / {totalPages} 页（共 {total} 条）
        </div>
        <button
          type="button"
          disabled={loading || page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid var(--panel-border)",
            background: "transparent",
            color: "var(--fg)",
            cursor: loading || page >= totalPages ? "not-allowed" : "pointer",
            opacity: loading || page >= totalPages ? 0.5 : 1,
          }}
        >
          下一页
        </button>
      </div>
        </>
      )}

      {detailOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setDetailOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2,6,23,0.58)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(920px, 96vw)",
              maxHeight: "86vh",
              overflow: "auto",
              borderRadius: 16,
              border: "1px solid var(--panel-border)",
              background: "var(--panel-bg)",
              boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
              padding: "18px 18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--fg)" }}>拦截详情</div>
                <div style={{ marginTop: 6, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ fontSize: 12, color: "var(--fg)", fontWeight: 600 }}>
                    {formatBlockType(detail?.blockType || null)}
                  </div>
                  <div style={riskTagStyle(detail?.riskLevel || null)}>{String(detail?.riskLevel || "-").toUpperCase()}</div>
                  <div style={{ fontSize: 11, color: "var(--muted2)" }}>ID: {detail?.id ?? "-"}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid var(--panel-border)",
                  background: "transparent",
                  color: "var(--fg)",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                关闭
              </button>
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div
                style={{
                  borderRadius: 12,
                  border: "1px solid var(--panel-border)",
                  background: "var(--panel-bg2)",
                  padding: "10px 12px",
                }}
              >
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>时间</div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--fg)",
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  }}
                >
                  {formatLocalDateTime(detail?.createdAt)}
                </div>
              </div>

              <div
                style={{
                  borderRadius: 12,
                  border: "1px solid var(--panel-border)",
                  background: "var(--panel-bg2)",
                  padding: "10px 12px",
                }}
              >
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>触发原因</div>
                <div style={{ fontSize: 12, color: "var(--fg)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {detailLoading ? "加载中…" : detailError ? detailError : detail?.reasons || "-"}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                borderRadius: 12,
                border: "1px solid var(--panel-border)",
                background: "var(--panel-bg2)",
                padding: "10px 12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>完整内容</div>
                <button
                  type="button"
                  disabled={!detail?.rawInput}
                  onClick={async () => {
                    if (!detail?.rawInput) return;
                    try {
                      await navigator.clipboard.writeText(detail.rawInput);
                    } catch {
                      // ignore
                    }
                  }}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid var(--panel-border)",
                    background: "transparent",
                    color: "var(--fg)",
                    cursor: detail?.rawInput ? "pointer" : "not-allowed",
                    opacity: detail?.rawInput ? 1 : 0.5,
                    fontSize: 11,
                  }}
                >
                  复制
                </button>
              </div>

              <pre
                style={{
                  marginTop: 8,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "var(--panel-bg)",
                  border: "1px solid var(--panel-border)",
                  color: "var(--fg)",
                  fontSize: 11,
                  lineHeight: 1.6,
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: 320,
                  overflowY: "auto",
                }}
              >
                {detailLoading ? "加载中…" : detailError ? "" : detail?.rawInput || "-"}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

