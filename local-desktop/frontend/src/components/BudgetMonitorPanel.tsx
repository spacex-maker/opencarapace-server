import { useCallback, useEffect, useMemo, useState } from "react";
import { BudgetRuleModal } from "./BudgetRuleModal";

type BudgetRow = {
  id: number;
  provider_key: string;
  model_id: string;
  input_usd_per_1k: number;
  output_usd_per_1k: number;
  budget_day_usd: number | null;
  budget_week_usd: number | null;
  budget_month_usd: number | null;
  enabled: number;
};

type BudgetProgress = BudgetRow & {
  spentDay: number;
  spentWeek: number;
  spentMonth: number;
  pctDay: number | null;
  pctWeek: number | null;
  pctMonth: number | null;
};

type UsageEvent = {
  id: number;
  createdAt: string;
  providerKey: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  costUsd: number;
  routeMode: string | null;
  requestPath: string | null;
  cloudId: number | null;
};

type Summary = {
  today: { costUsd: number; totalTokens: number; requestCount: number };
  week: { costUsd: number; totalTokens: number; requestCount: number };
  month: { costUsd: number; totalTokens: number; requestCount: number };
  budgetProgress: BudgetProgress[];
  recentEvents: UsageEvent[];
};

function fmtUsd(n: number | undefined) {
  if (n == null || !Number.isFinite(n)) return "$0.0000";
  return `$${n.toFixed(4)}`;
}

function fmtKTokens(n: number | undefined) {
  if (n == null || !Number.isFinite(n)) return "0";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}

function barColor(pct: number | null) {
  if (pct == null) return "#10b981"; // emerald-500
  if (pct >= 100) return "#ef4444"; // red-500
  if (pct >= 80) return "#f59e0b"; // amber-500
  return "#10b981";
}

// Icons
const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21v-5h5" /></svg>
);
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);
const EditIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
);
const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
);
export function BudgetMonitorPanel() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [settings, setSettings] = useState<BudgetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    // 新增弹窗首次进入：不要自动填充 "default" / "*"，避免用户以为“必须用默认值”
    provider_key: "",
    model_id: "",
    input_usd_per_1k: "0",
    output_usd_per_1k: "0",
    budget_day_usd: "",
    budget_week_usd: "",
    budget_month_usd: "",
    enabled: true,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");

  const providerModelSuggestions: Record<string, string[]> = useMemo(
    () => ({
      // Model ID 的含义是：请求体里的 `body.model`。
      // 这里提供“常见参考值”，不保证覆盖你实际在系统里用到的所有命名；用户仍可自由输入任意 model_id。
      default: ["*"],
      openai: [
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4.1",
        "gpt-4.1-mini",
        "gpt-4-turbo",
        "gpt-4-turbo-preview",
        "gpt-3.5-turbo",
        "o3-mini",
        "text-embedding-3-small",
        "text-embedding-3-large",
        "text-embedding-ada-002",
      ],
      codex: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4o", "gpt-4-turbo"],
      anthropic: [
        "claude-3-5-sonnet",
        "claude-3-5-haiku",
        "claude-3-opus",
        "claude-3-sonnet",
        "claude-3-haiku",
        "claude-2.1",
        "claude-opus-4",
      ],
      claude: [
        "claude-3-5-sonnet",
        "claude-3-5-haiku",
        "claude-3-opus",
        "claude-3-sonnet",
        "claude-3-haiku",
        "claude-2.1",
        "claude-opus-4",
      ],
      minimax: ["MiniMax-M2.5"],
      google: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0-pro", "models/gemini-1.5-pro", "models/gemini-1.5-flash"],
      gemini: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0-pro", "models/gemini-1.5-pro", "models/gemini-1.5-flash"],
      groq: [
        "llama3-70b-8192",
        "llama3-8b-8192",
        "llama-3.3-70b-versatile",
        "mixtral-8x7b-32768",
        "gemma2-9b-it",
        "qwen-2.5-72b",
        "qwen-2.5-32b",
      ],
      openrouter: [
        "openai/gpt-4o-mini",
        "openai/gpt-4o",
        "anthropic/claude-3.5-sonnet",
        "google/gemini-1.5-pro",
        "google/gemini-1.5-flash",
        "groq/llama3-70b-8192",
        "meta-llama/llama-3.1-70b-instruct",
        "mistralai/mistral-large-latest",
      ],
      bedrock: [
        "anthropic.claude-3-5-sonnet-20240620-v1:0",
        "anthropic.claude-3-5-haiku-20241022-v1:0",
        "anthropic.claude-3-opus-20240229-v1:0",
        "anthropic.claude-3-sonnet-20240229-v1:0",
        "meta.llama3-70b-instruct-v1:0",
        "meta.llama3-8b-instruct-v1:0",
        "cohere.command-r-plus-v1:0",
        "cohere.command-r-v1:0",
        "amazon.titan-text-express-v1",
      ],
      ollama: ["llama3.2", "llama3:70b", "llama3.1:8b", "qwen2.5", "qwen2.5-coder", "mistral", "gemma2", "deepseek-coder"],
      openclaw: ["*"],
      opencode: ["gpt-4o-mini", "claude-3-5-sonnet", "gemini-1.5-pro", "llama3-70b-8192", "mixtral-8x7b-32768"],
      // 用于“通配/兜底”的 Provider 仍然允许在 model 输入里手动填自定义值
    }),
    []
  );

  const providerSuggestions = useMemo(() => {
    const common = [
      "default",
      "openai",
      "anthropic",
      "claude",
      "minimax",
      "groq",
      "google",
      "gemini",
      "openrouter",
      "bedrock",
      "azureopenai",
      "together",
      "mistral",
      "cohere",
      "deepseek",
      "qwen",
      "xai",
      "ollama",
      "codex",
      "opencode",
    ];
    const fromSettings = settings.map((s) => s.provider_key).filter(Boolean);
    const merged = Array.from(new Set([...common, ...fromSettings]));
    merged.sort((a, b) => String(a).localeCompare(String(b), "zh-Hans-CN", { sensitivity: "base" }));
    return merged;
  }, [settings]);

  const modelSuggestions = useMemo(() => {
    const providerKey = (form.provider_key || "").trim();

    // Provider 为空：显示全量候选（包含各 provider 的预置模型 + 已保存的模型），避免用户被默认 Provider 锁死。
    if (!providerKey) {
      const fromSettings = settings.map((s) => s.model_id).filter(Boolean);
      const fromKnown = Object.values(providerModelSuggestions).flat();
      const unique = Array.from(new Set(["*", ...fromKnown, ...fromSettings]));
      const withoutStar = unique.filter((m) => m !== "*");
      withoutStar.sort((a, b) => String(a).localeCompare(String(b), "zh-Hans-CN", { sensitivity: "base" }));
      return ["*", ...withoutStar];
    }

    const fromSettings = settings
      .filter((s) => String(s.provider_key || "default").trim() === providerKey)
      .map((s) => s.model_id)
      .filter(Boolean);

    const known = providerModelSuggestions[providerKey] ?? [];

    // 保证 "*" 总是出现在首位，方便用户快速设置“该 Provider 通配规则”。
    const withoutStar = Array.from(new Set([...known, ...fromSettings])).filter((m) => m !== "*");
    withoutStar.sort((a, b) => String(a).localeCompare(String(b), "zh-Hans-CN", { sensitivity: "base" }));

    return ["*", ...withoutStar];
  }, [form.provider_key, providerModelSuggestions, settings]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sRes, stRes] = await Promise.all([
        fetch("http://127.0.0.1:19111/api/llm-budget/summary?recentLimit=40"),
        fetch("http://127.0.0.1:19111/api/llm-budget/settings"),
      ]);
      const sData = await sRes.json();
      const stData = await stRes.json();
      if (!sRes.ok) throw new Error(sData?.error?.message || "加载汇总失败");
      if (!stRes.ok) throw new Error(stData?.error?.message || "加载设置失败");
      setSummary({
        today: sData.today || { costUsd: 0, totalTokens: 0, requestCount: 0 },
        week: sData.week || { costUsd: 0, totalTokens: 0, requestCount: 0 },
        month: sData.month || { costUsd: 0, totalTokens: 0, requestCount: 0 },
        budgetProgress: Array.isArray(sData.budgetProgress) ? sData.budgetProgress : [],
        recentEvents: Array.isArray(sData.recentEvents) ? sData.recentEvents : [],
      });
      setSettings(Array.isArray(stData.items) ? stData.items : []);
    } catch (e: any) {
      setError(e?.message ?? "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const saveRule = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const body = {
        provider_key: form.provider_key.trim() || "default",
        model_id: form.model_id.trim() || "*",
        input_usd_per_1k: Number(form.input_usd_per_1k) || 0,
        output_usd_per_1k: Number(form.output_usd_per_1k) || 0,
        budget_day_usd: form.budget_day_usd.trim() === "" ? null : Number(form.budget_day_usd),
        budget_week_usd: form.budget_week_usd.trim() === "" ? null : Number(form.budget_week_usd),
        budget_month_usd: form.budget_month_usd.trim() === "" ? null : Number(form.budget_month_usd),
        enabled: form.enabled,
      };
      const res = await fetch("http://127.0.0.1:19111/api/llm-budget/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "保存失败");
      setMessage("已保存。相同 Provider + Model 会合并为一条。");
      await loadAll();
      setModalOpen(false);
    } catch (e: any) {
      setError(e?.message ?? "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (id: number) => {
    if (!window.confirm("确定删除该条费率/预算规则？")) return;
    try {
      const res = await fetch(`http://127.0.0.1:19111/api/llm-budget/settings/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "删除失败");
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? "删除失败");
    }
  };

  const progress = summary?.budgetProgress ?? [];

  return (
    <div className="llm-budget-panel" style={{ color: "var(--fg)", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style>{`
        .llm-budget-panel * { box-sizing: border-box; }
        .llm-btn { transition: all 0.2s ease; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
        .llm-btn:hover:not(:disabled) { filter: brightness(1.2); transform: translateY(-1px); }
        .llm-btn:active:not(:disabled) { transform: translateY(0); }
        .llm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .llm-table-row { transition: background 0.15s ease; border-top: 1px solid var(--panel-border); }
        .llm-table-row:hover { background: var(--panel-bg2); }
        .llm-input:focus { outline: none; border-color: #3b82f6 !important; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2); }
        .llm-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .llm-scroll::-webkit-scrollbar-track { background: transparent; }
        .llm-scroll::-webkit-scrollbar-thumb { background: var(--panel-border); border-radius: 4px; }
        .llm-scroll::-webkit-scrollbar-thumb:hover { background: var(--muted2); }
        
        /* Modal Redesign Styles */
        .llm-modal-section { background: var(--panel-bg2); border: 1px solid var(--panel-border); border-radius: 16px; padding: 16px; margin-bottom: 16px; }
        .llm-modal-title { font-size: 12px; font-weight: 600; color: var(--muted2); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 14px; display: flex; align-items: center; gap: 6px; }
        .llm-input-group { display: flex; flex-direction: column; gap: 6px; }
        .llm-input-label { font-size: 12px; color: var(--muted); font-weight: 500; }
      `}</style>

      {/* 头部与操作栏 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: 18, fontWeight: 600, color: "var(--fg)" }}>API 预算与消耗控制台</h2>
          <div style={{ fontSize: 12, color: "var(--muted2)" }}>
            按路径前缀识别 Provider（如 <code style={{ color: "var(--muted)", background: "var(--chip-bg)", padding: "2px 4px", borderRadius: 4 }}>/openai/v1/...</code> 为 openai）；无前缀记为 default。Model 填 <code style={{ color: "var(--muted)", background: "var(--chip-bg)", padding: "2px 4px", borderRadius: 4 }}>*</code> 表示通用规则。
          </div>
        </div>
        <button
          className="llm-btn"
          type="button"
          onClick={() => void loadAll()}
          disabled={loading}
          style={{ padding: "8px 16px", fontSize: 13, fontWeight: 500, borderRadius: 8, border: "1px solid var(--panel-border)", background: "var(--panel-bg)", color: "var(--fg)", cursor: loading ? "not-allowed" : "pointer" }}
        >
          <RefreshIcon />
          {loading ? "刷新中…" : "刷新数据"}
        </button>
      </div>

      {/* 全局消息提示 */}
      {error && <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "#fca5a5", fontSize: 13 }}>{error}</div>}
      {message && <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 8, background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", color: "#6ee7b7", fontSize: 13 }}>{message}</div>}

      {/* 数据大盘 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
        {[
          { label: "今日消耗", data: summary?.today },
          { label: "本周消耗", data: summary?.week },
          { label: "本月消耗", data: summary?.month },
        ].map((stat, idx) => (
          <div key={idx} style={{ background: "var(--panel-bg)", border: "1px solid var(--panel-border)", borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted2)", marginBottom: 8 }}>{stat.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--fg)", fontFamily: "monospace", marginBottom: 4 }}>
              {fmtUsd(stat.data?.costUsd)}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", gap: 12 }}>
              <span>Tokens: {fmtKTokens(stat.data?.totalTokens)}</span>
              <span>请求: {stat.data?.requestCount ?? 0}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 预算进度条 */}
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 4, height: 14, background: "#3b82f6", borderRadius: 2 }}></div>
        各模型预算进度
      </div>
      <div style={{ borderRadius: 12, border: "1px solid var(--panel-border)", background: "var(--panel-bg)", padding: "16px", marginBottom: 24 }}>
        {progress.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--muted2)", textAlign: "center", padding: "20px 0" }}>暂无已启用的预算规则，请在下方添加。</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {progress.map((p) => (
              <div key={p.id} style={{ background: "var(--panel-bg2)", padding: 14, borderRadius: 10, border: "1px solid var(--panel-border)" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", marginBottom: 12, display: "flex", justifyContent: "space-between" }}>
                  <span>{p.provider_key} / <span style={{ color: "var(--muted)", fontFamily: "monospace" }}>{p.model_id}</span></span>
                  {p.enabled === 0 && <span style={{ fontSize: 10, background: "var(--chip-bg)", padding: "2px 6px", borderRadius: 4, color: "var(--chip-fg)" }}>已禁用</span>}
                </div>
                {[
                  { k: "日", spent: p.spentDay, lim: p.budget_day_usd, pct: p.pctDay },
                  { k: "周", spent: p.spentWeek, lim: p.budget_week_usd, pct: p.pctWeek },
                  { k: "月", spent: p.spentMonth, lim: p.budget_month_usd, pct: p.pctMonth },
                ].map((row) =>
                  row.lim != null && row.lim > 0 ? (
                    <div key={row.k} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                        <span style={{ color: "var(--muted)" }}>{row.k}度预算</span>
                        <span style={{ fontFamily: "monospace", color: "var(--fg)" }}>
                          {fmtUsd(row.spent)} / <span style={{ color: "var(--muted2)" }}>{fmtUsd(row.lim)}</span>
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: "var(--panel-bg)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(100, row.pct ?? 0)}%`, height: "100%", borderRadius: 3, background: barColor(row.pct), transition: "width 0.5s ease-out" }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: barColor(row.pct), width: 36, textAlign: "right", fontFamily: "monospace" }}>
                          {row.pct != null ? `${row.pct}%` : "-"}
                        </span>
                      </div>
                    </div>
                  ) : null
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 规则管理列表 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 4, height: 14, background: "#10b981", borderRadius: 2 }}></div>
          费率与预算规则
        </div>
        <button
          className="llm-btn"
          type="button"
          onClick={() => {
            setMessage(null); setError(null);
            setForm({ provider_key: "", model_id: "", input_usd_per_1k: "0", output_usd_per_1k: "0", budget_day_usd: "", budget_week_usd: "", budget_month_usd: "", enabled: true });
            setModalMode("create"); setModalOpen(true);
          }}
          style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(16, 185, 129, 0.3)", background: "rgba(16, 185, 129, 0.1)", color: "#34d399", fontSize: 12, fontWeight: 600 }}
        >
          <PlusIcon /> 新增规则
        </button>
      </div>
      
      <div className="llm-scroll" style={{ borderRadius: 12, border: "1px solid var(--panel-border)", background: "var(--panel-bg)", overflowX: "auto", marginBottom: 24 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left", whiteSpace: "nowrap" }}>
          <thead>
            <tr style={{ background: "var(--panel-bg2)" }}>
              <th style={{ padding: "12px 16px", color: "var(--muted2)", fontWeight: 500 }}>Provider</th>
              <th style={{ padding: "12px 16px", color: "var(--muted2)", fontWeight: 500 }}>Model</th>
              <th style={{ padding: "12px 16px", color: "var(--muted2)", fontWeight: 500, textAlign: "right" }}>单价 ($/1K) 入 / 出</th>
              <th style={{ padding: "12px 16px", color: "var(--muted2)", fontWeight: 500, textAlign: "right" }}>预算上限 日 / 周 / 月</th>
              <th style={{ padding: "12px 16px", color: "var(--muted2)", fontWeight: 500, textAlign: "center", width: 80 }}>状态</th>
              <th style={{ padding: "12px 16px", color: "var(--muted2)", fontWeight: 500, textAlign: "right", width: 140 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {settings.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: "24px", color: "var(--muted2)", textAlign: "center" }}>暂无配置规则</td></tr>
            ) : (
              settings.map((r) => (
                <tr key={r.id} className="llm-table-row">
                  <td style={{ padding: "12px 16px", color: "var(--fg)" }}>{r.provider_key}</td>
                  <td style={{ padding: "12px 16px", color: "var(--muted)", fontFamily: "monospace" }}>{r.model_id}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "var(--fg)", fontFamily: "monospace" }}>
                    <span style={{ color: "#34d399" }}>{r.input_usd_per_1k}</span> <span style={{ color: "var(--muted2)" }}>/</span> <span style={{ color: "#60a5fa" }}>{r.output_usd_per_1k}</span>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "var(--muted)", fontFamily: "monospace" }}>
                    {r.budget_day_usd ?? "—"} <span style={{ color: "var(--muted2)" }}>/</span> {r.budget_week_usd ?? "—"} <span style={{ color: "var(--muted2)" }}>/</span> {r.budget_month_usd ?? "—"}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    {r.enabled ? <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} title="已启用" /> 
                               : <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--muted2)" }} title="未启用" />}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <button
                      className="llm-btn"
                      onClick={() => {
                        setMessage(null); setError(null);
                        setForm({
                          provider_key: r.provider_key, model_id: r.model_id, input_usd_per_1k: String(r.input_usd_per_1k ?? 0), output_usd_per_1k: String(r.output_usd_per_1k ?? 0),
                          budget_day_usd: r.budget_day_usd == null ? "" : String(r.budget_day_usd), budget_week_usd: r.budget_week_usd == null ? "" : String(r.budget_week_usd),
                          budget_month_usd: r.budget_month_usd == null ? "" : String(r.budget_month_usd), enabled: r.enabled === 1,
                        });
                        setModalMode("edit"); setModalOpen(true);
                      }}
                      style={{ padding: "4px 8px", borderRadius: 6, background: "rgba(59, 130, 246, 0.1)", color: "#60a5fa", border: "none", cursor: "pointer", marginRight: 8 }}
                    >
                      <EditIcon /> 编辑
                    </button>
                    <button
                      className="llm-btn"
                      onClick={() => void deleteRule(r.id)}
                      style={{ padding: "4px 8px", borderRadius: 6, background: "rgba(239, 68, 68, 0.1)", color: "#f87171", border: "none", cursor: "pointer" }}
                    >
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 最近费用流水 */}
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 4, height: 14, background: "#8b5cf6", borderRadius: 2 }}></div>
        最近调用流水 (Top 40)
      </div>
      <div className="llm-scroll" style={{ borderRadius: 12, border: "1px solid var(--panel-border)", background: "var(--panel-bg)", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left", whiteSpace: "nowrap" }}>
          <thead>
            <tr style={{ background: "var(--panel-bg2)" }}>
              <th style={{ padding: "12px 16px", color: "var(--muted2)", fontWeight: 500 }}>请求时间</th>
              <th style={{ padding: "12px 16px", color: "var(--muted2)", fontWeight: 500 }}>Provider</th>
              <th style={{ padding: "12px 16px", color: "var(--muted2)", fontWeight: 500 }}>Model</th>
              <th style={{ padding: "12px 16px", color: "var(--muted2)", fontWeight: 500, textAlign: "right" }}>总 Tokens</th>
              <th style={{ padding: "12px 16px", color: "var(--muted2)", fontWeight: 500, textAlign: "right" }}>预估费用</th>
              <th style={{ padding: "12px 16px", color: "var(--muted2)", fontWeight: 500, textAlign: "right" }}>云端ID</th>
            </tr>
          </thead>
          <tbody>
            {(summary?.recentEvents ?? []).length === 0 ? (
              <tr><td colSpan={6} style={{ padding: "24px", color: "var(--muted2)", textAlign: "center" }}>暂无成功响应的本地流水记录</td></tr>
            ) : (
              (summary?.recentEvents ?? []).map((ev) => (
                <tr key={ev.id} className="llm-table-row">
                  <td style={{ padding: "10px 16px", color: "var(--muted)", fontFamily: "monospace" }}>{ev.createdAt?.replace("T", " ").slice(0, 19) ?? "-"}</td>
                  <td style={{ padding: "10px 16px", color: "var(--fg)" }}>{ev.providerKey}</td>
                  <td style={{ padding: "10px 16px", color: "var(--fg)", fontFamily: "monospace" }}>{ev.model}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", color: "var(--muted)", fontFamily: "monospace" }}>{ev.totalTokens ?? "-"}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", color: "#34d399", fontFamily: "monospace", fontWeight: 500 }}>{fmtUsd(ev.costUsd)}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", color: "var(--muted2)", fontFamily: "monospace" }}>{ev.cloudId != null ? ev.cloudId : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <BudgetRuleModal
          modalMode={modalMode}
          saving={saving}
          form={form}
          setForm={setForm}
          providerSuggestions={providerSuggestions}
          modelSuggestions={modelSuggestions}
          onClose={() => setModalOpen(false)}
          onSave={() => void saveRule()}
        />
      )}
    </div>
  );
}