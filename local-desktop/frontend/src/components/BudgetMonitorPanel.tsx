import { useCallback, useEffect, useState } from "react";

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

function fmtUsd(n: number) {
  if (!Number.isFinite(n)) return "-";
  return `$${n.toFixed(4)}`;
}

function fmtKTokens(n: number) {
  if (!Number.isFinite(n)) return "-";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}

function barColor(pct: number | null) {
  if (pct == null) return "#22c55e";
  if (pct >= 100) return "#ef4444";
  if (pct >= 80) return "#f59e0b";
  return "#22c55e";
}

export function BudgetMonitorPanel() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [settings, setSettings] = useState<BudgetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    provider_key: "default",
    model_id: "*",
    input_usd_per_1k: "0",
    output_usd_per_1k: "0",
    budget_day_usd: "",
    budget_week_usd: "",
    budget_month_usd: "",
    enabled: true,
  });

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
        today: sData.today,
        week: sData.week,
        month: sData.month,
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
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: "#9ca3af" }}>
          按路径前缀识别 Provider（如 <code style={{ color: "#e5e7eb" }}>/openai/v1/...</code> 为{" "}
          <code style={{ color: "#e5e7eb" }}>openai</code>）；无前缀请求记为 <code style={{ color: "#e5e7eb" }}>default</code>。
          Model 填 <code style={{ color: "#e5e7eb" }}>*</code> 表示该 Provider 下所有模型共用一条规则。
        </div>
        <button
          type="button"
          onClick={() => void loadAll()}
          disabled={loading}
          style={{
            marginLeft: "auto",
            padding: "6px 12px",
            fontSize: 12,
            borderRadius: 999,
            border: "1px solid #334155",
            background: "rgba(15,23,42,0.85)",
            color: "#e5e7eb",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "刷新中…" : "刷新"}
        </button>
      </div>

      {error && <div style={{ marginBottom: 10, fontSize: 12, color: "#f97373" }}>{error}</div>}
      {message && <div style={{ marginBottom: 10, fontSize: 12, color: "#4ade80" }}>{message}</div>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}
      >
        {(
          [
            { label: "今日 Token", val: fmtKTokens(summary?.today?.totalTokens ?? 0), sub: "本地网关记账" },
            { label: "今日费用", val: fmtUsd(summary?.today?.costUsd ?? 0), sub: "按自定义单价估算" },
            { label: "今日请求", val: String(summary?.today?.requestCount ?? 0), sub: "成功响应次数" },
            { label: "本周费用", val: fmtUsd(summary?.week?.costUsd ?? 0), sub: "UTC 周起始" },
          ] as const
        ).map((c) => (
          <div
            key={c.label}
            style={{
              borderRadius: 12,
              border: "1px solid #1f2937",
              background: "rgba(15,23,42,0.85)",
              padding: "12px 14px",
            }}
          >
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>{c.label}</div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#f9fafb",
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              }}
            >
              {loading ? "…" : c.val}
            </div>
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", margin: "14px 0 8px" }}>
        预算进度
      </div>
      <div
        style={{
          borderRadius: 12,
          border: "1px solid #1f2937",
          background: "rgba(15,23,42,0.85)",
          padding: "12px 14px",
          marginBottom: 16,
        }}
      >
        {progress.length === 0 ? (
          <div style={{ fontSize: 12, color: "#6b7280" }}>暂无已启用的预算规则。在下方添加并填写日/周/月上限（美元）后生效。</div>
        ) : (
          progress.map((p) => (
            <div key={p.id} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#e5e7eb", marginBottom: 6 }}>
                {p.provider_key} / {p.model_id}
              </div>
              {[
                { k: "日", spent: p.spentDay, lim: p.budget_day_usd, pct: p.pctDay },
                { k: "周", spent: p.spentWeek, lim: p.budget_week_usd, pct: p.pctWeek },
                { k: "月", spent: p.spentMonth, lim: p.budget_month_usd, pct: p.pctMonth },
              ].map((row) =>
                row.lim != null && row.lim > 0 ? (
                  <div key={row.k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 28, fontSize: 11, color: "#9ca3af" }}>{row.k}</span>
                    <div style={{ flex: 1, height: 6, background: "#111827", borderRadius: 3, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${Math.min(100, row.pct ?? 0)}%`,
                          height: "100%",
                          borderRadius: 3,
                          background: barColor(row.pct),
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 11, color: "#94a3b8", minWidth: 120, textAlign: "right", fontFamily: "monospace" }}>
                      {fmtUsd(row.spent)} / {fmtUsd(row.lim)}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: barColor(row.pct), minWidth: 36, textAlign: "right" }}>
                      {row.pct != null ? `${row.pct}%` : "-"}
                    </span>
                  </div>
                ) : null
              )}
            </div>
          ))
        )}
      </div>

      <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", margin: "14px 0 8px" }}>
        新增或更新规则
      </div>
      <div
        style={{
          borderRadius: 12,
          border: "1px solid #1f2937",
          background: "rgba(15,23,42,0.85)",
          padding: "14px 16px",
          marginBottom: 16,
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        }}
      >
        {(
          [
            ["provider_key", "Provider 键", "text", form.provider_key, (v: string) => setForm((f) => ({ ...f, provider_key: v }))],
            ["model_id", "Model（* 为通配）", "text", form.model_id, (v: string) => setForm((f) => ({ ...f, model_id: v }))],
            ["input_usd_per_1k", "输入 $ / 1K tokens", "text", form.input_usd_per_1k, (v: string) => setForm((f) => ({ ...f, input_usd_per_1k: v }))],
            ["output_usd_per_1k", "输出 $ / 1K tokens", "text", form.output_usd_per_1k, (v: string) => setForm((f) => ({ ...f, output_usd_per_1k: v }))],
            ["budget_day_usd", "日预算上限 ($)", "text", form.budget_day_usd, (v: string) => setForm((f) => ({ ...f, budget_day_usd: v }))],
            ["budget_week_usd", "周预算上限 ($)", "text", form.budget_week_usd, (v: string) => setForm((f) => ({ ...f, budget_week_usd: v }))],
            ["budget_month_usd", "月预算上限 ($)", "text", form.budget_month_usd, (v: string) => setForm((f) => ({ ...f, budget_month_usd: v }))],
          ] as const
        ).map(([key, label, type, val, onChange]) => (
          <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>{label}</span>
            <input
              type={type}
              value={val}
              onChange={(e) => onChange(e.target.value)}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #334155",
                background: "#020617",
                color: "#e5e7eb",
                fontSize: 12,
              }}
            />
          </label>
        ))}
        <label style={{ display: "flex", alignItems: "center", gap: 8, gridColumn: "1 / -1" }}>
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
          />
          <span style={{ fontSize: 12, color: "#e5e7eb" }}>启用此规则（含预算校验与费用单价）</span>
        </label>
        <div style={{ gridColumn: "1 / -1" }}>
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveRule()}
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              border: "1px solid rgba(34,197,94,0.45)",
              background: "rgba(34,197,94,0.12)",
              color: "#86efac",
              fontSize: 12,
              fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "保存中…" : "保存规则"}
          </button>
        </div>
      </div>

      <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", margin: "14px 0 8px" }}>
        已保存的规则
      </div>
      <div style={{ borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden", marginBottom: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: "#020617" }}>
              <th style={{ textAlign: "left", padding: "8px 10px", color: "#9ca3af" }}>Provider</th>
              <th style={{ textAlign: "left", padding: "8px 10px", color: "#9ca3af" }}>Model</th>
              <th style={{ textAlign: "right", padding: "8px 10px", color: "#9ca3af" }}>入/出 $/1K</th>
              <th style={{ textAlign: "right", padding: "8px 10px", color: "#9ca3af" }}>日/周/月</th>
              <th style={{ width: 72 }} />
            </tr>
          </thead>
          <tbody>
            {settings.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 12, color: "#6b7280" }}>
                  暂无规则
                </td>
              </tr>
            ) : (
              settings.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid #111827" }}>
                  <td style={{ padding: "8px 10px", color: "#e5e7eb" }}>{r.provider_key}</td>
                  <td style={{ padding: "8px 10px", color: "#e5e7eb", fontFamily: "monospace" }}>{r.model_id}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", color: "#94a3b8", fontFamily: "monospace" }}>
                    {r.input_usd_per_1k} / {r.output_usd_per_1k}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right", color: "#94a3b8", fontFamily: "monospace", fontSize: 10 }}>
                    {r.budget_day_usd ?? "—"} / {r.budget_week_usd ?? "—"} / {r.budget_month_usd ?? "—"}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => void deleteRule(r.id)}
                      style={{
                        fontSize: 11,
                        padding: "4px 8px",
                        borderRadius: 999,
                        border: "1px solid #475569",
                        background: "transparent",
                        color: "#fca5a5",
                        cursor: "pointer",
                      }}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", margin: "14px 0 8px" }}>
        最近费用流水
      </div>
      <div style={{ borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: "#020617" }}>
              <th style={{ textAlign: "left", padding: "8px 10px", color: "#9ca3af" }}>时间</th>
              <th style={{ textAlign: "left", padding: "8px 10px", color: "#9ca3af" }}>Provider</th>
              <th style={{ textAlign: "left", padding: "8px 10px", color: "#9ca3af" }}>Model</th>
              <th style={{ textAlign: "right", padding: "8px 10px", color: "#9ca3af" }}>Tokens</th>
              <th style={{ textAlign: "right", padding: "8px 10px", color: "#9ca3af" }}>费用</th>
              <th style={{ textAlign: "right", padding: "8px 10px", color: "#9ca3af", width: 64 }}>云端ID</th>
            </tr>
          </thead>
          <tbody>
            {(summary?.recentEvents ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 12, color: "#6b7280" }}>
                  暂无流水（成功走本地代理并完成响应后入账）
                </td>
              </tr>
            ) : (
              (summary?.recentEvents ?? []).map((ev) => (
                <tr key={ev.id} style={{ borderTop: "1px solid #111827" }}>
                  <td style={{ padding: "8px 10px", color: "#94a3b8", whiteSpace: "nowrap", fontFamily: "monospace" }}>
                    {ev.createdAt?.replace("T", " ").slice(0, 19) ?? "-"}
                  </td>
                  <td style={{ padding: "8px 10px", color: "#e5e7eb" }}>{ev.providerKey}</td>
                  <td style={{ padding: "8px 10px", color: "#e5e7eb", fontFamily: "monospace" }}>{ev.model}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", color: "#94a3b8", fontFamily: "monospace" }}>
                    {ev.totalTokens ?? "-"}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right", color: "#86efac", fontFamily: "monospace" }}>
                    {fmtUsd(ev.costUsd)}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right", color: "#64748b", fontSize: 11, fontFamily: "monospace" }}>
                    {ev.cloudId != null ? ev.cloudId : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

