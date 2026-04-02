import { useCallback, useEffect, useMemo, useState } from "react";
import { LocalStatus } from "../types";
import {
  MdManageSearch,
  MdWarning,
  MdErrorOutline,
  MdCheckCircle,
  MdPlayArrow,
  MdRefresh,
  MdOutlineSecurity,
  MdOutlinePrivacyTip,
  MdOutlineChatBubbleOutline,
} from "react-icons/md";
import { SecurityScanRunModal } from "./SecurityScanRunModal";

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

// 基础卡片样式提取（全圆弧风格）
const cardBase: React.CSSProperties = {
  background: "var(--panel-bg)",
  border: "1px solid var(--panel-border)",
  borderRadius: 22,
  padding: "20px",
  boxShadow: "0 1px 2px rgba(0,0,0,0.05), 0 0 0 1px rgba(255,255,255,0.02) inset",
  transition: "all 0.2s ease",
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
  const accentTrack = accent === "green" ? "rgba(34,197,94,0.25)" : "rgba(14,165,233,0.25)";
  const accentBorder = accent === "green" ? "rgba(34,197,94,0.5)" : "rgba(14,165,233,0.5)";
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
        background: checked ? accentTrack : "rgba(0,0,0,0.1)",
        padding: 2,
        cursor: disabled ? "not-allowed" : "pointer",
        position: "relative",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        opacity: disabled ? 0.6 : 1,
        flexShrink: 0,
        outline: "none",
      }}
    >
      <span
        style={{
          display: "block",
          width: 18,
          height: 18,
          borderRadius: 999,
          background: checked ? accentKnob : "var(--muted)",
          transform: checked ? "translateX(20px)" : "translateX(0px)",
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: checked ? "0 2px 8px rgba(0,0,0,0.2)" : "0 2px 4px rgba(0,0,0,0.1)",
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
  const [scanRunId, setScanRunId] = useState<number | null>(null);
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number; status: string } | null>(null);
  const [scanHistory, setScanHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyModalRunId, setHistoryModalRunId] = useState<number | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

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

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:19111/api/security-scan/runs");
      const data = await res.json();
      if (!res.ok) return;
      setScanHistory(Array.isArray(data?.runs) ? data.runs : []);
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (subTab === "results") void loadHistory();
  }, [subTab, loadHistory]);

  const openHistoryModal = useCallback((id: number) => {
    setHistoryModalRunId(id);
    setHistoryModalOpen(true);
  }, []);

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
    setScanPhase("正在创建扫描任务…");
    setScanProgress({ done: 0, total: codes.length, status: "RUNNING" });
    try {
      const res = await fetch("http://127.0.0.1:19111/api/security-scan/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemCodes: codes, context: buildAutoContext() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScanError(data?.error?.message || `扫描失败（${res.status}）`);
        return;
      }
      const rid = Number(data?.runId);
      if (!Number.isFinite(rid)) {
        setScanError("扫描任务创建失败（缺少 runId）");
        return;
      }
      setScanRunId(rid);
      setScanPhase(String(data?.phase || "任务已创建，等待执行…"));

      // 轮询进度与结果
      let lastStatus = "RUNNING";
      while (lastStatus === "RUNNING" || lastStatus === "PENDING") {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 900));
        // eslint-disable-next-line no-await-in-loop
        const rres = await fetch(`http://127.0.0.1:19111/api/security-scan/runs/${rid}`);
        // eslint-disable-next-line no-await-in-loop
        const rdata = await rres.json();
        if (!rres.ok) {
          setScanError(rdata?.error?.message || `扫描失败（${rres.status}）`);
          break;
        }
        const status = String(rdata?.status || "RUNNING");
        const done = Number(rdata?.doneItems ?? 0);
        const total = Number(rdata?.totalItems ?? codes.length);
        setScanPhase(String(rdata?.phase || ""));
        setScanProgress({ done: Number.isFinite(done) ? done : 0, total: Number.isFinite(total) ? total : codes.length, status });
        const list = (rdata?.findings || []) as Finding[];
        if (Array.isArray(list) && list.length > 0) setFindings(list);
        lastStatus = status.toUpperCase();
        if (lastStatus === "SUCCESS") {
          setScanPhase("");
          break;
        }
        if (lastStatus === "FAILED") {
          setScanError(String(rdata?.errorMessage || "扫描失败"));
          break;
        }
      }

      void loadHistory();
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
    <div style={{ maxWidth: 1024, margin: "0 auto", padding: "10px", color: "var(--fg)" }}>
      {/* 注入全局小动画与特效类 */}
      <style>{`
        @keyframes pulseScan { 
          0% { opacity: 0.6; transform: translateX(-100%); } 
          50% { opacity: 1; } 
          100% { opacity: 0.6; transform: translateX(200%); } 
        }
        .ui-btn-hover:hover { filter: brightness(1.1); transform: translateY(-1px); }
        .ui-btn-hover:active { transform: translateY(0); }
        .ui-item-card:hover { border-color: rgba(14, 165, 233, 0.3) !important; background: rgba(255,255,255,0.01); }

        /* SecurityScanPanel tabs: theme-adaptive */
        .ss-tabs {
          display: flex;
          background: var(--panel-bg2);
          padding: 4px;
          border-radius: 999px;
          border: 1px solid var(--panel-border);
          box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        }
        .ss-tab {
          appearance: none;
          border: 1px solid transparent;
          background: transparent;
          color: var(--muted);
          padding: 8px 20px;
          border-radius: 999px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, color 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          line-height: 1;
        }
        .ss-tab:hover {
          color: var(--fg);
          background: rgba(14,165,233,0.08);
          border-color: rgba(14,165,233,0.25);
        }
        .ss-tab:active { transform: translateY(0); }
        .ss-tab:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(14,165,233,0.35);
        }
        .ss-tab--active {
          color: var(--fg);
          background: var(--panel-bg);
          border-color: var(--panel-border);
          box-shadow: 0 2px 10px rgba(0,0,0,0.10);
        }
        .ss-tab-badge {
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          border: 1px solid var(--panel-border);
          background: rgba(14,165,233,0.10);
          color: var(--muted2);
        }
        .ss-tab--active .ss-tab-badge {
          background: rgba(14,165,233,0.14);
          color: var(--fg);
        }

        /* Findings blocks: theme-adaptive */
        .ss-finding-loc {
          background: var(--panel-bg2);
          border: 1px solid var(--panel-border);
          color: var(--muted2);
        }
        .ss-finding-remedy {
          background: rgba(14,165,233,0.10);
          border: 1px solid rgba(14,165,233,0.22);
          color: var(--fg);
        }
        .ss-finding-remedy strong {
          color: #38bdf8;
        }
      `}</style>

      {/* 头部信息区 */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 999,
            background: "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(14,165,233,0.1))",
            border: "1px solid rgba(34,197,94,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#4ade80",
            boxShadow: "0 4px 20px rgba(34,197,94,0.1)",
          }}
        >
          <MdOutlineSecurity style={{ fontSize: 32 }} />
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "var(--fg)", letterSpacing: "-0.02em" }}>安全与合规扫描</h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>
            从云端拉取通用扫描项，结合本机环境与你的说明，由 AI（云端 DeepSeek）与静态规则生成检测报告。
            <br />
            需在系统配置中填写{" "}
            <code
              style={{
                fontSize: 12,
                background: "var(--panel-bg2)",
                padding: "2px 10px",
                borderRadius: 999,
                color: "#e2e8f0",
              }}
            >
              deepseek.api_key
            </code>{" "}
            以启用完整 AI 能力。
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginLeft: "auto" }}>
          <button
            className="ui-btn-hover"
            type="button"
            onClick={() => void loadItems()}
            disabled={itemsLoading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 16px",
              borderRadius: 999,
              border: "1px solid var(--panel-border)",
              background: "var(--panel-bg)",
              color: "var(--fg)",
              fontSize: 13,
              fontWeight: 600,
              cursor: itemsLoading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              whiteSpace: "nowrap",
            }}
          >
            <MdRefresh style={{ fontSize: 18, animation: itemsLoading ? "spin 1s linear infinite" : "none" }} />
            刷新配置
          </button>

          <button
            className="ui-btn-hover"
            type="button"
            onClick={() => void runScan()}
            disabled={scanning || itemsLoading || items.length === 0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderRadius: 999,
              border: "none",
              background: scanning ? "var(--panel-bg2)" : "linear-gradient(135deg, #16a34a, #15803d)",
              color: scanning ? "var(--muted)" : "#fff",
              fontSize: 13,
              fontWeight: 800,
              cursor: scanning ? "not-allowed" : "pointer",
              boxShadow: scanning ? "none" : "0 4px 12px rgba(22,163,74,0.28)",
              transition: "all 0.2s",
              whiteSpace: "nowrap",
            }}
            title={items.length === 0 ? "暂无可用扫描项" : undefined}
          >
            {scanning ? (
              <MdRefresh style={{ fontSize: 18, animation: "spin 1s linear infinite" }} />
            ) : (
              <MdPlayArrow style={{ fontSize: 18 }} />
            )}
            {scanning ? "正在扫描..." : "执行深度扫描"}
          </button>
        </div>
      </div>

      {/* 现代化分段控制器 Tabs */}
      <div style={{ display: "flex", marginBottom: 24 }}>
        <div className="ss-tabs">
          {(
            [
              { id: "items" as const, label: "配置与扫描项" },
              { id: "results" as const, label: "扫描结果报告" },
            ]
          ).map((t) => {
            const isActive = subTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubTab(t.id)}
                className={`ss-tab ${isActive ? "ss-tab--active" : ""}`}
              >
                {t.label}
                {t.id === "results" && counts.total > 0 && (
                  <span className="ss-tab-badge">
                    {counts.total}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 扫描进度条 - 优化版 */}
      {(scanning || scanPhase) && (
        <div style={{ ...cardBase, display: "flex", alignItems: "center", gap: 16, marginBottom: 20, borderColor: "rgba(14,165,233,0.3)", background: "linear-gradient(to right, var(--panel-bg), rgba(14,165,233,0.05))" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 999,
              background: "rgba(14,165,233,0.15)",
              color: "#38bdf8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 15px rgba(14,165,233,0.2)"
            }}
          >
            <MdManageSearch style={{ fontSize: 26, animation: scanning ? "pulse 2s infinite" : "none" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--fg)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {scanning ? "正在执行深度扫描" : "扫描就绪"}
              {scanProgress && (
                <span style={{ fontSize: 12, fontWeight: 800, color: "var(--muted2)", border: "1px solid var(--panel-border)", padding: "4px 10px", borderRadius: 999, background: "var(--panel-bg2)" }}>
                  {Math.min(scanProgress.done, scanProgress.total)}/{scanProgress.total}
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{scanPhase || "请在下方选择扫描项后点击「开始扫描」"}</div>
            {scanning && (
              <div style={{ height: 8, background: "rgba(0,0,0,0.2)", borderRadius: 999, marginTop: 12, overflow: "hidden", position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: 0,
                    width: scanProgress && scanProgress.total > 0 ? `${Math.max(6, Math.round((scanProgress.done / scanProgress.total) * 100))}%` : "40%",
                    borderRadius: 999,
                    background: "linear-gradient(90deg, transparent, #38bdf8, #22c55e, transparent)",
                    animation: "pulseScan 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite",
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 顶部统计卡片（仅结果页显示） */}
      {subTab === "results" && findings.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Critical", n: counts.c, color: "#f87171", bg: "rgba(248,113,113,0.05)" },
            { label: "Warning", n: counts.w, color: "#fbbf24", bg: "rgba(251,191,36,0.05)" },
            { label: "Passed", n: counts.p, color: "#4ade80", bg: "rgba(74,222,128,0.05)" },
            { label: "Total", n: counts.total, color: "var(--fg)", bg: "var(--panel-bg2)" },
          ].map((b) => (
            <div key={b.label} style={{ ...cardBase, padding: "16px", textAlign: "center", background: b.bg, border: `1px solid ${b.color}20` }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: b.color, fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>{b.n}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{b.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 错误提示 */}
      {(itemsError || scanError) && (
        <div style={{ ...cardBase, background: "rgba(248,113,113,0.05)", borderColor: "rgba(248,113,113,0.3)", color: "#fca5a5", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <MdErrorOutline style={{ fontSize: 20 }} />
          {itemsError || scanError}
        </div>
      )}

      {/* 配置与扫描项面板 */}
      {subTab === "items" && (
        <div style={{ display: "grid", gap: 20, gridTemplateColumns: "1fr", alignItems: "start" }}>
          
          {/* 设置与上下文区块 (上下结构或左右结构均可，这里用网格) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
            
            {/* 隐私设置卡片 */}
            <div style={{ ...cardBase, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <MdOutlinePrivacyTip style={{ color: "var(--muted)", fontSize: 20 }} />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--fg)" }}>隐私与数据授权</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: privacySaving ? "not-allowed" : "pointer" }}>
                  <div>
                    <div style={{ fontSize: 14, color: "var(--fg)", fontWeight: 600 }}>共享对话历史</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>允许提取历史记录用于安全分析</div>
                  </div>
                  <ToggleSwitch
                    checked={privacy?.shareHistoryEnabled ?? false}
                    disabled={privacyLoading || privacySaving}
                    accent="green"
                    onChange={(next) => void savePrivacy({ shareHistoryEnabled: next })}
                  />
                </label>
                <div style={{ height: 1, background: "var(--panel-border)", borderRadius: 999 }} />
                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: privacySaving ? "not-allowed" : "pointer" }}>
                  <div>
                    <div style={{ fontSize: 14, color: "var(--fg)", fontWeight: 600 }}>系统配置扫描</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>同意读取本机 AI 核心配置参数</div>
                  </div>
                  <ToggleSwitch
                    checked={privacy?.consentSystemConfigEnabled ?? false}
                    disabled={privacyLoading || privacySaving}
                    accent="blue"
                    onChange={(next) => void savePrivacy({ consentSystemConfigEnabled: next })}
                  />
                </label>
              </div>
              {privacyError && <div style={{ marginTop: 12, fontSize: 12, color: "#fca5a5" }}>{privacyError}</div>}
            </div>

            {/* 补充上下文卡片 */}
            <div style={{ ...cardBase, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <MdOutlineChatBubbleOutline style={{ color: "var(--muted)", fontSize: 20 }} />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--fg)" }}>环境补充声明 (可选)</h3>
              </div>
              <textarea
                value={contextExtra}
                onChange={(e) => setContextExtra(e.target.value)}
                placeholder="在此输入您的特定环境说明，例如：使用的 MCP 列表、特定的 Provider 配置、敏感文件存放路径等，AI 将结合此信息更精准地发现问题..."
                style={{
                  flex: 1,
                  width: "100%",
                  minHeight: 100,
                  boxSizing: "border-box",
                  padding: "12px",
                  borderRadius: 18,
                  border: "1px solid var(--panel-border)",
                  background: "rgba(0,0,0,0.15)",
                  color: "var(--fg)",
                  fontSize: 13,
                  lineHeight: 1.6,
                  resize: "vertical",
                  outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => e.target.style.borderColor = "rgba(14,165,233,0.5)"}
                onBlur={(e) => e.target.style.borderColor = "var(--panel-border)"}
              />
            </div>
          </div>

          {/* 扫描项列表容器 */}
          <div style={cardBase}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--fg)" }}>检测规则集</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => selectAll(true)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid var(--panel-border)",
                    background: "var(--panel-bg2)",
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
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid var(--panel-border)",
                    background: "var(--panel-bg2)",
                    color: "var(--fg)",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  反选
                </button>
              </div>
            </div>

            {itemsLoading ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "var(--muted)" }}>获取云端规则中...</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {items.map((it) => (
                  <div
                    key={it.code}
                    className="ui-item-card"
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 16,
                      padding: "16px",
                      borderRadius: 22,
                      border: "1px solid var(--panel-border)",
                      background: "rgba(0,0,0,0.1)",
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--fg)" }}>{it.title}</span>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "var(--panel-bg2)",
                          color: "var(--muted)",
                          border: "1px solid var(--panel-border)"
                        }}>
                          {it.category || "OTHER"}
                        </span>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: it.scannerType === "STATIC_INFO" ? "rgba(34,197,94,0.1)" : "rgba(14,165,233,0.1)",
                          color: it.scannerType === "STATIC_INFO" ? "#4ade80" : "#38bdf8",
                          border: `1px solid ${it.scannerType === "STATIC_INFO" ? "rgba(34,197,94,0.2)" : "rgba(14,165,233,0.2)"}`
                        }}>
                          {it.scannerType === "STATIC_INFO" ? "静态规则" : "AI 推理"}
                        </span>
                      </div>
                      {it.description && (
                        <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{it.description}</div>
                      )}
                      <div style={{ fontSize: 12, color: "var(--muted2)", marginTop: 8, fontFamily: "ui-monospace, monospace", opacity: 0.7 }}>
                        {it.code}
                      </div>
                    </div>
                    <div style={{ paddingTop: 2 }}>
                      <ToggleSwitch
                        checked={!!selected[it.code]}
                        onChange={() => toggle(it.code)}
                        accent="green"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      )}

      {/* 扫描结果面板 */}
      {subTab === "results" && (
        <div>
          {/* 扫描历史 */}
          <div style={{ ...cardBase, marginBottom: 16, padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--fg)" }}>扫描历史</div>
              <button
                className="ui-btn-hover"
                type="button"
                onClick={() => void loadHistory()}
                disabled={historyLoading}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: "1px solid var(--panel-border)",
                  background: "var(--panel-bg2)",
                  color: "var(--fg)",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: historyLoading ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                <MdRefresh style={{ fontSize: 16, animation: historyLoading ? "spin 1s linear infinite" : "none" }} />
                刷新历史
              </button>
            </div>

            {scanHistory.length === 0 ? (
              <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>暂无历史记录</div>
            ) : (
              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                {scanHistory.slice(0, 12).map((r) => {
                  const idRaw = (r as any)?.id;
                  const id =
                    typeof idRaw === "number"
                      ? idRaw
                      : (() => {
                          const n = parseInt(String(idRaw ?? ""), 10);
                          return Number.isFinite(n) ? n : NaN;
                        })();
                  const st = String(r?.status || "");
                  const done = Number(r?.doneItems ?? 0);
                  const total = Number(r?.totalItems ?? 0);
                  const countsObj = r?.counts as any;
                  const totalFindings = countsObj?.total ?? null;
                  const canOpen = Number.isFinite(id);
                  const isActive = historyModalOpen && historyModalRunId != null && canOpen && historyModalRunId === id;
                  return (
                    <button
                      key={String(r?.id)}
                      type="button"
                      onClick={() => canOpen && openHistoryModal(id)}
                      disabled={!canOpen}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 12px",
                        borderRadius: 18,
                        border: `1px solid ${isActive ? "rgba(14,165,233,0.45)" : "var(--panel-border)"}`,
                        background: isActive ? "rgba(14,165,233,0.08)" : "var(--panel-bg2)",
                        color: "var(--fg)",
                        cursor: canOpen ? "pointer" : "not-allowed",
                        opacity: canOpen ? 1 : 0.6,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          #{id} · {st}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {String(r?.phase || "") || "—"} {total > 0 ? `· ${Math.min(done, total)}/${total}` : ""}
                          {totalFindings != null ? ` · 结果 ${totalFindings}` : ""}
                        </div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "var(--muted2)", border: "1px solid var(--panel-border)", padding: "4px 10px", borderRadius: 999, background: "var(--panel-bg)" }}>
                        {isActive ? "已打开" : "打开"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <SecurityScanRunModal
            open={historyModalOpen}
            runId={historyModalRunId}
            onClose={() => setHistoryModalOpen(false)}
            onApplyFindings={(fs) => {
              setFindings(fs as any);
              setFilter("ALL");
              setSubTab("results");
              setHistoryModalOpen(false);
            }}
          />

          {findings.length === 0 && !scanning ? (
            <div style={{ ...cardBase, padding: "60px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: 999, background: "var(--panel-bg2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MdCheckCircle style={{ fontSize: 32, color: "var(--muted)" }} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--fg)" }}>暂无发现项</div>
                <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 6 }}>请在「配置与扫描项」中点击开始扫描以获取报告。</div>
              </div>
            </div>
          ) : (
            <>
              {findings.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                  {(
                    [
                      { id: "ALL" as const, label: "全部结果" },
                      { id: "CRITICAL" as const, label: "严重 (Critical)" },
                      { id: "WARN" as const, label: "警告 (Warning)" },
                      { id: "PASS" as const, label: "通过 (Passed)" },
                    ]
                  ).map((c) => {
                    const active = filter === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setFilter(c.id)}
                        style={{
                          padding: "6px 16px",
                          borderRadius: 999,
                          border: `1px solid ${active ? "rgba(14,165,233,0.5)" : "var(--panel-border)"}`,
                          background: active ? "rgba(14,165,233,0.1)" : "var(--panel-bg)",
                          color: active ? "#38bdf8" : "var(--muted)",
                          fontSize: 13,
                          fontWeight: active ? 700 : 500,
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                      >
                        {c.label}
                      </button>
                    )
                  })}
                </div>
              )}

              <div style={{ display: "grid", gap: 16 }}>
                {filteredFindings.map((f, idx) => {
                  const sev = (f.severity || "").toUpperCase();
                  const isC = sev === "CRITICAL";
                  const isW = sev === "WARN";
                  
                  const icon = isC ? <MdErrorOutline style={{ color: "#f87171", fontSize: 24 }} /> 
                            : isW ? <MdWarning style={{ color: "#fbbf24", fontSize: 24 }} /> 
                            : <MdCheckCircle style={{ color: "#4ade80", fontSize: 24 }} />;
                  
                  const badgeBg = isC ? "rgba(248,113,113,0.1)" : isW ? "rgba(251,191,36,0.1)" : "rgba(74,222,128,0.1)";
                  const badgeColor = isC ? "#fca5a5" : isW ? "#fcd34d" : "#86efac";
                  const borderColor = isC ? "#ef4444" : isW ? "#f59e0b" : "#22c55e";

                  return (
                    <div 
                      key={idx} 
                      className="ui-item-card"
                      style={{ 
                        ...cardBase, 
                        position: "relative",
                        overflow: "hidden",
                        borderLeft: `4px solid ${borderColor}`,
                        paddingLeft: 24
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                        <div style={{ flexShrink: 0, marginTop: 2 }}>{icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--fg)" }}>{f.title}</span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                letterSpacing: "0.05em",
                                padding: "2px 8px",
                                borderRadius: 999,
                                background: badgeBg,
                                color: badgeColor,
                                border: `1px solid ${badgeBg}`
                              }}
                            >
                              {sev || "WARN"}
                            </span>
                          </div>
                          
                          {f.detail && <div style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, marginBottom: 12 }}>{f.detail}</div>}
                          
                          {f.location && (
                            <div
                              className="ss-finding-loc"
                              style={{ 
                              fontSize: 13, 
                              fontFamily: "ui-monospace, SFMono-Regular, monospace", 
                              padding: "6px 12px",
                              borderRadius: 16,
                              marginBottom: 12,
                              wordBreak: "break-all"
                            }}>
                              <span style={{ opacity: 0.5, marginRight: 8 }}>路径/位置:</span>
                              {f.location}
                            </div>
                          )}
                          
                          {f.remediation && (
                            <div
                              className="ss-finding-remedy"
                              style={{ 
                              fontSize: 14, 
                              lineHeight: 1.6,
                              padding: "10px 14px",
                              borderRadius: 18,
                              borderLeft: "2px solid #38bdf8"
                            }}>
                              <strong style={{ marginRight: 8 }}>修复建议:</strong> 
                              {f.remediation}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div style={{ 
                        position: "absolute", 
                        top: 16, 
                        right: 16, 
                        fontSize: 12, 
                        color: "var(--muted2)", 
                        fontFamily: "ui-monospace, monospace",
                        opacity: 0.5
                      }}>
                        #{f.itemCode}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}