import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";

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

function FilterSelect(props: {
  value: string;
  onChange: (v: "" | "skill_disabled" | "danger_command") => void;
  options: { label: string; value: "" | "skill_disabled" | "danger_command" }[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const isDark =
    typeof document !== "undefined" &&
    (document.documentElement.classList.contains("dark") || document.body.classList.contains("dark"));

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const current = props.options.find((o) => o.value === props.value)?.label || props.placeholder;

  return (
    <div ref={ref} style={{ position: "relative", width: 220, flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          height: 36,
          padding: "0 12px",
          borderRadius: 999,
          border: isDark ? "1px solid #334155" : "1px solid #cbd5e1",
          background: isDark ? "rgba(2,6,23,0.86)" : "#f8fafc",
          color: props.value ? (isDark ? "#e5e7eb" : "#0f172a") : "#6b7280",
          fontSize: 12,
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxSizing: "border-box",
          cursor: "pointer",
        }}
      >
        <span>{current}</span>
        <span style={{ color: isDark ? "#6b7280" : "#64748b" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 20,
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            borderRadius: 12,
            border: isDark ? "1px solid #1f2937" : "1px solid #cbd5e1",
            background: isDark ? "rgba(2,6,23,0.98)" : "#ffffff",
            boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
            overflow: "hidden",
          }}
        >
          {props.options.map((o) => (
            <button
              key={o.value || "__all"}
              type="button"
              onClick={() => {
                props.onChange(o.value);
                setOpen(false);
              }}
              style={{
                width: "100%",
                border: "none",
                background: o.value === props.value ? (isDark ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.10)") : "transparent",
                color: o.value === props.value ? (isDark ? "#93c5fd" : "#2563eb") : (isDark ? "#e5e7eb" : "#0f172a"),
                textAlign: "left",
                fontSize: 12,
                padding: "8px 12px",
                cursor: "pointer",
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatBlockType(value?: string | null): string {
  if (!value) return "-";
  if (value === "danger_command") return "危险指令";
  if (value === "skill_disabled") return "技能禁用";
  return value;
}

function formatLocalDateTime(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("zh-CN", { hour12: false });
}

function riskTagStyle(level?: string | null): React.CSSProperties {
  const r = String(level || "").toUpperCase();
  const isDark =
    typeof document !== "undefined" &&
    (document.documentElement.classList.contains("dark") || document.body.classList.contains("dark"));
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 10,
    padding: "2px 6px",
    borderRadius: 999,
    border: "1px solid #334155",
    color: "#9ca3af",
    background: "rgba(148,163,184,0.12)",
    width: "fit-content",
  };
  if (r === "CRITICAL") {
    return isDark
      ? { ...base, color: "#fecaca", border: "1px solid rgba(239,68,68,0.55)", background: "rgba(239,68,68,0.14)" }
      : { ...base, color: "#b91c1c", border: "1px solid rgba(239,68,68,0.45)", background: "rgba(239,68,68,0.10)" };
  }
  if (r === "HIGH") {
    return isDark
      ? { ...base, color: "#fed7aa", border: "1px solid rgba(249,115,22,0.55)", background: "rgba(249,115,22,0.14)" }
      : { ...base, color: "#c2410c", border: "1px solid rgba(249,115,22,0.45)", background: "rgba(249,115,22,0.10)" };
  }
  if (r === "MEDIUM") {
    return isDark
      ? { ...base, color: "#fde68a", border: "1px solid rgba(234,179,8,0.55)", background: "rgba(234,179,8,0.14)" }
      : { ...base, color: "#a16207", border: "1px solid rgba(234,179,8,0.45)", background: "rgba(234,179,8,0.10)" };
  }
  if (r === "LOW") {
    return isDark
      ? { ...base, color: "#bbf7d0", border: "1px solid rgba(34,197,94,0.55)", background: "rgba(34,197,94,0.14)" }
      : { ...base, color: "#166534", border: "1px solid rgba(34,197,94,0.45)", background: "rgba(34,197,94,0.10)" };
  }
  return base;
}

export const MyInterceptLogsPage = () => {
  const [items, setItems] = useState<BlockLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blockType, setBlockType] = useState<"" | "skill_disabled" | "danger_command">("");
  const [page, setPage] = useState(1);
  const [size] = useState(50);
  const [total, setTotal] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<BlockLogDetail | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / size)), [total, size]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("size", String(size));
      if (blockType) params.set("blockType", blockType);
      const { data } = await api.get<{ page: number; size: number; total: number; items: BlockLog[] }>(
        `/api/safety/block-logs?${params.toString()}`
      );
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotal(typeof data?.total === "number" ? data.total : 0);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setError(msg || "加载拦截日志失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page, size, blockType]);

  const openDetail = async (id: number) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const { data } = await api.get<BlockLogDetail>(`/api/safety/block-logs/${id}`);
      setDetail(data || null);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setDetailError(msg || "加载详情失败");
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div
      className="max-w-[1100px] mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6"
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 m-0">拦截日志</h2>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: loading ? "#64748b" : "var(--refresh-fg)",
            background: loading ? "var(--refresh-bg-disabled)" : "var(--refresh-bg)",
            border: "1px solid var(--refresh-border)",
            borderRadius: 999,
            padding: "6px 12px",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.8 : 1,
          }}
        >
          {loading ? "刷新中…" : "刷新"}
        </button>
      </div>

      <div style={{ marginBottom: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <label className="text-xs text-slate-500 dark:text-slate-400">拦截类型</label>
        <FilterSelect
          value={blockType}
          onChange={(v) => {
            setPage(1);
            setBlockType(v);
          }}
          placeholder="拦截类型（全部）"
          options={[
            { label: "拦截类型（全部）", value: "" },
            { label: "技能拦截", value: "skill_disabled" },
            { label: "危险指令拦截", value: "danger_command" },
          ]}
        />
      </div>

      {error && <div className="mb-2.5 text-red-500 text-xs">{error}</div>}

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead className="bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400">
            <tr>
              <th style={{ textAlign: "left", padding: "8px 10px", color: "#9ca3af", fontWeight: 500, width: 170 }}>类型 / 风险</th>
              <th style={{ textAlign: "left", padding: "8px 10px", color: "#9ca3af", fontWeight: 500 }}>触发原因</th>
              <th style={{ width: 84 }} />
              <th style={{ textAlign: "left", padding: "8px 10px", color: "#9ca3af", fontWeight: 500, width: 170 }}>时间</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-2.5 text-slate-500 dark:text-slate-500">
                  {loading ? "正在加载…" : "暂无日志。"}
                </td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="px-2.5 py-2 text-slate-800 dark:text-slate-200">
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ fontWeight: 600 }}>{formatBlockType(it.blockType)}</div>
                      <div style={riskTagStyle(it.riskLevel)}>{String(it.riskLevel || "-").toUpperCase()}</div>
                    </div>
                  </td>
                  <td className="px-2.5 py-2 text-slate-500 dark:text-slate-400">{it.reasons || "-"}</td>
                  <td className="px-2.5 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => void openDetail(it.id)}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-slate-300 dark:border-slate-700 bg-transparent text-slate-800 dark:text-slate-200"
                    >
                      详情
                    </button>
                  </td>
                  <td className="px-2.5 py-2 text-slate-800 dark:text-slate-200 whitespace-nowrap">{formatLocalDateTime(it.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
        <button type="button" disabled={loading || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-2.5 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 bg-transparent text-slate-800 dark:text-slate-200 disabled:opacity-50">
          上一页
        </button>
        <div>第 <span className="text-slate-900 dark:text-slate-200">{page}</span> / {totalPages} 页（共 {total} 条）</div>
        <button type="button" disabled={loading || page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="px-2.5 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 bg-transparent text-slate-800 dark:text-slate-200 disabled:opacity-50">
          下一页
        </button>
      </div>

      {detailOpen && (
        <div role="dialog" aria-modal="true" onClick={() => setDetailOpen(false)} className="fixed inset-0 z-50 bg-black/60 dark:bg-black/70 flex items-center justify-center p-[18px]">
          <div onClick={(e) => e.stopPropagation()} className="w-[min(920px,96vw)] max-h-[86vh] overflow-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl p-[18px]">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div className="text-base font-bold text-slate-900 dark:text-slate-100">拦截详情</div>
                <div style={{ marginTop: 6, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div className="text-xs text-slate-800 dark:text-slate-200 font-semibold">{formatBlockType(detail?.blockType || null)}</div>
                  <div style={riskTagStyle(detail?.riskLevel || null)}>{String(detail?.riskLevel || "-").toUpperCase()}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-500">ID: {detail?.id ?? "-"}</div>
                </div>
              </div>
              <button type="button" onClick={() => setDetailOpen(false)} className="px-2.5 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 bg-transparent text-slate-800 dark:text-slate-200 shrink-0">
                关闭
              </button>
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-2.5">
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">时间</div>
                <div style={{ fontSize: 12, color: "inherit", fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }} className="text-slate-800 dark:text-slate-200">
                  {formatLocalDateTime(detail?.createdAt)}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-2.5">
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">触发原因</div>
                <div className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
                  {detailLoading ? "加载中…" : detailError ? detailError : detail?.reasons || "-"}
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-2.5">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">完整内容</div>
              <pre className="m-0 max-h-[42vh] overflow-auto whitespace-pre-wrap break-words text-xs text-slate-800 dark:text-slate-200" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}>
                {detailLoading ? "加载中…" : detail?.rawInput || "-"}
              </pre>
            </div>
          </div>
        </div>
      )}
      <style>{`
        .dark {
          --refresh-fg: #e5e7eb;
          --refresh-bg: rgba(15,23,42,0.85);
          --refresh-bg-disabled: rgba(15,23,42,0.65);
          --refresh-border: #334155;
        }
        :root {
          --refresh-fg: #0f172a;
          --refresh-bg: #f8fafc;
          --refresh-bg-disabled: #f1f5f9;
          --refresh-border: #cbd5e1;
        }
      `}</style>
    </div>
  );
};

