import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useI18n } from "../i18n";
import "./DangerPanel.css";

function FilterSelect(props: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  placeholder: string;
}) {
  const controlHeight = 34;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as any)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const current = props.options.find((o) => o.value === props.value)?.label || props.placeholder;

  return (
    <div ref={ref} style={{ position: "relative", minWidth: 140 }}>
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
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxSizing: "border-box",
        }}
      >
        <span style={{ lineHeight: 1 }}>{current}</span>
        <span style={{ color: "var(--muted2)", lineHeight: 1 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div
          className="danger-filter-dropdown-scroll"
          style={{
            position: "absolute",
            zIndex: 10,
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            maxHeight: 260,
            overflowY: "auto",
            borderRadius: 10,
            border: "1px solid var(--panel-border)",
            background: "var(--panel-bg)",
            boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
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
                padding: "10px 12px",
                border: "none",
                background: o.value === props.value ? "rgba(34,197,94,0.12)" : "transparent",
                color: o.value === props.value ? "#bbf7d0" : "var(--fg)",
                fontSize: 12,
                textAlign: "left",
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

export function DangerPanel({
  showAccountSwitchPlaceholder = false,
  embedded = false,
}: {
  showAccountSwitchPlaceholder?: boolean;
  /** 嵌入「拦截监控」内作为「拦截项目」时，去掉外层卡片样式与独立页标题 */
  embedded?: boolean;
}) {
  const { t } = useI18n();
  const ir = (key: string) => t(`interceptMonitorPage.interceptRules.${key}`);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dangerCommands, setDangerCommands] = useState<
    {
      id: number;
      command_pattern: string;
      system_type: string;
      category: string;
      risk_level: string;
      enabled: number;
      user_enabled: number | null;
    }[]
  >([]);
  const [sync, setSync] = useState<{ running: boolean; total: number; synced: number }>({
    running: false,
    total: 0,
    synced: 0,
  });

  const [keyword, setKeyword] = useState("");
  const [systemType, setSystemType] = useState("");
  const [category, setCategory] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [systemEnabled, setSystemEnabled] = useState("");
  /** UI 语义：是否启用拦截（1=拦截，0=不拦截）；后端参数仍沿用 userEnabled */
  const [interceptEnabled, setInterceptEnabled] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [batchUpdating, setBatchUpdating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [meta, setMeta] = useState<{ systemTypes: string[]; categories: string[]; riskLevels: string[] }>({
    systemTypes: [],
    categories: [],
    riskLevels: [],
  });

  const loadMeta = async () => {
    try {
      const res = await fetch("http://127.0.0.1:19111/api/danger-commands/meta");
      const json = await res.json();
      if (res.ok) {
        setMeta({
          systemTypes: Array.isArray(json?.systemTypes) ? json.systemTypes : [],
          categories: Array.isArray(json?.categories) ? json.categories : [],
          riskLevels: Array.isArray(json?.riskLevels) ? json.riskLevels : [],
        });
      }
    } catch {
      // ignore
    }
  };

  const loadData = async (withFilters = false) => {
    try {
      setLoading(true);
      setError(null);
      const qs = new URLSearchParams();
      if (withFilters) {
        if (keyword.trim()) qs.set("keyword", keyword.trim());
        if (systemType) qs.set("systemType", systemType);
        if (category) qs.set("category", category);
        if (riskLevel) qs.set("riskLevel", riskLevel);
        if (systemEnabled) qs.set("systemEnabled", systemEnabled);
        if (interceptEnabled) {
          // 后端旧语义：userEnabled=1 表示用户启用（不拦截）；UI 语义取反
          qs.set("userEnabled", interceptEnabled === "1" ? "0" : "1");
        }
      }
      const url = `http://127.0.0.1:19111/api/danger-commands${qs.toString() ? `?${qs.toString()}` : ""}`;
      const [dataRes, syncRes] = await Promise.all([
        fetch(url),
        fetch("http://127.0.0.1:19111/api/sync-status?type=danger"),
      ]);
      const dataJson = await dataRes.json();
      const syncJson = await syncRes.json();
      setDangerCommands(dataJson.items || []);
      setSync(syncJson || { running: false, total: 0, synced: 0 });
    } catch (e: any) {
      setError(e?.message ?? ir("errLoadLocal"));
    } finally {
      setLoading(false);
    }
  };

  const runQuery = () => loadData(true);

  const isRowBatchActionable = (row: { enabled: number }) => row.enabled !== 0;
  const actionableIds = dangerCommands.filter(isRowBatchActionable).map((r) => r.id);
  const selectedActionableIds = selectedIds.filter((id) => actionableIds.includes(id));
  const allSelected = actionableIds.length > 0 && selectedActionableIds.length === actionableIds.length;

  const toggleSelectAllActionable = () => {
    setSelectedIds((prev) => {
      if (allSelected) return prev.filter((id) => !actionableIds.includes(id));
      return Array.from(new Set([...prev, ...actionableIds]));
    });
  };

  const toggleSelectRow = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleUserEnabled = async (id: number, currentUserEnabled: number | null, systemEnabled: number) => {
    if (systemEnabled === 0) {
      setError(ir("errSystemDisabled"));
      setTimeout(() => setError(null), 3000);
      return;
    }
    if (updatingId !== null || batchUpdating) return;

    const nextEnabled = currentUserEnabled === 0 ? true : false;
    setUpdatingId(id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`http://127.0.0.1:19111/api/user-danger-commands/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data?.error?.message || ir("errUpdateUser"));
        setTimeout(() => setError(null), 3000);
        return;
      }
      setDangerCommands((prev) =>
        prev.map((d) => (d.id === id ? { ...d, user_enabled: nextEnabled ? 1 : 0 } : d))
      );
      // nextEnabled=true 表示不拦截；拦截状态提示需反向
      setMessage(nextEnabled ? ir("toastDisabled") : ir("toastEnabled"));
      setTimeout(() => setMessage(null), 2000);
    } catch (e: any) {
      setError(e?.message ?? ir("errUpdateUser"));
      setTimeout(() => setError(null), 3000);
    } finally {
      setUpdatingId(null);
    }
  };

  const batchSetIntercept = async (intercept: boolean) => {
    const targetIds = selectedActionableIds;
    if (targetIds.length === 0 || updatingId !== null || batchUpdating) return;
    setBatchUpdating(true);
    setError(null);
    setMessage(null);
    const enabled = !intercept; // 旧协议：enabled=true 表示不拦截
    try {
      const res = await fetch("http://127.0.0.1:19111/api/user-danger-commands/batch", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: targetIds, enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error?.message || "批量更新失败");
        return;
      }
      setDangerCommands((prev) =>
        prev.map((d) => (targetIds.includes(d.id) ? { ...d, user_enabled: enabled ? 1 : 0 } : d))
      );
      setSelectedIds((prev) => prev.filter((id) => !targetIds.includes(id)));
      const n = Number(data?.updatedCount) > 0 ? Number(data.updatedCount) : targetIds.length;
      setMessage(intercept ? `已批量启用拦截（${n} 条）` : `已批量取消拦截（${n} 条）`);
      setTimeout(() => setMessage(null), 2200);
    } catch (e: any) {
      setError(e?.message ?? ir("errUpdateUser"));
    } finally {
      setBatchUpdating(false);
    }
  };

  useEffect(() => {
    loadMeta();
    loadData(false);
  }, []);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => dangerCommands.some((r) => r.id === id)));
  }, [dangerCommands]);

  // 轮询同步进度
  useEffect(() => {
    if (!sync.running) return;
    
    let pollCount = 0;
    const maxPolls = 60; // 最多轮询 60 次（2 分钟）
    
    const timer = setInterval(async () => {
      pollCount++;
      
      // 超时保护：避免无限轮询
      if (pollCount > maxPolls) {
        clearInterval(timer);
        setSync((s) => ({ ...s, running: false }));
        console.warn("[DangerPanel] 同步轮询超时，已停止");
        return;
      }
      
      try {
        const res = await fetch("http://127.0.0.1:19111/api/sync-status?type=danger");
        const json = await res.json();
        setSync(json);
        if (!json.running) {
          clearInterval(timer);
          loadData();
        }
      } catch {
        // ignore
      }
    }, 2000); // 改为 2 秒轮询一次
    
    return () => clearInterval(timer);
  }, [sync.running]);

  const triggerSync = async () => {
    try {
      setError(null);
      const res = await fetch("http://127.0.0.1:19111/api/danger-commands/sync", { method: "POST" });
      if (!res.ok) {
        let msg = ir("errSyncHttp").replace("{status}", String(res.status));
        try {
          const j = await res.json();
          if (j?.error?.message) msg = j.error.message;
        } catch {
          /* ignore */
        }
        setError(msg);
        setTimeout(() => setError(null), 5000);
        return;
      }
      setSync((s) => ({ ...s, running: true }));
    } catch (e: any) {
      setError(e?.message ?? ir("errTriggerSync"));
      setTimeout(() => setError(null), 5000);
    }
  };

  const percent =
    sync.total > 0 ? Math.min(100, Math.round((sync.synced / sync.total) * 100)) : sync.running ? 0 : 100;

  const shellStyle: CSSProperties = embedded
    ? {
        maxWidth: "100%",
        margin: 0,
        background: "transparent",
        borderRadius: 0,
        padding: "8px 0 0",
        border: "none",
        boxShadow: "none",
        fontSize: 12,
      }
    : {
        maxWidth: 960,
        margin: "0 auto",
        background: "var(--panel-bg)",
        borderRadius: 16,
        padding: "24px 28px",
        border: "1px solid var(--panel-border)",
        boxShadow: "0 20px 40px rgba(15,23,42,0.6)",
        fontSize: 12,
      };
  const stickyHeadCellStyle: CSSProperties = {
    padding: "6px 8px",
    borderBottom: "1px solid var(--panel-border)",
    background: "var(--panel-solid)",
    position: "sticky",
    top: 0,
    zIndex: 3,
  };

  /** 多选列：横向滚动时固定在左侧，不与内容一起滑动 */
  const stickySelectColumnHeadStyle: CSSProperties = {
    ...stickyHeadCellStyle,
    left: 0,
    zIndex: 4,
    width: 34,
    minWidth: 34,
    maxWidth: 34,
    borderRight: "1px solid var(--panel-border)",
    boxSizing: "border-box",
  };

  const stickySelectColumnCellStyle: CSSProperties = {
    position: "sticky",
    left: 0,
    zIndex: 2,
    background: "var(--panel-bg)",
    borderRight: "1px solid var(--panel-border)",
    boxSizing: "border-box",
  };

  /** 拦截操作列：横向滚动时固定在右侧 */
  const stickyActionColumnHeadStyle: CSSProperties = {
    ...stickyHeadCellStyle,
    right: 0,
    zIndex: 4,
    whiteSpace: "nowrap",
    minWidth: 72,
    borderLeft: "1px solid var(--panel-border)",
    boxSizing: "border-box",
  };

  const stickyActionColumnCellStyle: CSSProperties = {
    position: "sticky",
    right: 0,
    zIndex: 2,
    background: "var(--panel-bg)",
    whiteSpace: "nowrap",
    minWidth: 72,
    borderLeft: "1px solid var(--panel-border)",
    boxSizing: "border-box",
  };

  return (
    <div style={shellStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div>
          <h1
            style={{
              fontSize: embedded ? 16 : 20,
              margin: "0 0 4px",
              color: "var(--fg)",
              fontWeight: 700,
            }}
          >
            {embedded ? ir("titleEmbedded") : ir("titleStandalone")}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: embedded ? 12 : 13, color: "var(--muted)", lineHeight: 1.45 }}>
            {embedded ? ir("descEmbedded") : ir("descStandalone")}
          </p>
        </div>
        <button
          type="button"
          onClick={triggerSync}
          disabled={sync.running}
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            border: "none",
            background: "#22c55e",
            color: "#022c22",
            fontSize: 12,
            fontWeight: 600,
            cursor: sync.running ? "not-allowed" : "pointer",
            opacity: sync.running ? 0.7 : 1,
          }}
        >
          {sync.running ? ir("syncRunning") : ir("syncManual")}
        </button>
      </div>

      {/* 进度条 */}
      <div style={{ margin: "6px 0 14px" }}>
        <div
          style={{
            height: 6,
            borderRadius: 999,
            background: "var(--panel-bg2)",
            border: "1px solid var(--panel-border)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${percent}%`,
              background: "#22c55e",
              transition: "width 0.3s ease-out",
            }}
          />
        </div>
        <div style={{ marginTop: 4, fontSize: 11, color: "var(--muted2)" }}>
          {sync.running
            ? ir("syncProgressRunning")
                .replace("{synced}", String(sync.synced))
                .replace("{total}", String(sync.total || "?"))
            : ir("syncProgressDone")
                .replace("{synced}", String(sync.synced))
                .replace("{total}", String(sync.total || dangerCommands.length))}
        </div>
      </div>

      {loading && (
        <div style={{ color: "var(--muted)", marginBottom: 8 }}>{ir("loading")}</div>
      )}
      {error && (
        <div
          style={{
            marginBottom: 8,
            padding: "8px 12px",
            borderRadius: 10,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#fca5a5",
            fontSize: 11,
          }}
        >
          {error}
        </div>
      )}
      {message && (
        <div
          style={{
            marginBottom: 8,
            padding: "8px 12px",
            borderRadius: 10,
            background: "rgba(34,197,94,0.1)",
            border: "1px solid rgba(34,197,94,0.3)",
            color: "#bbf7d0",
            fontSize: 11,
          }}
        >
          {message}
        </div>
      )}

      {showAccountSwitchPlaceholder && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(59,130,246,0.12)",
            border: "1px solid rgba(59,130,246,0.3)",
            color: "#bfdbfe",
            fontSize: 12,
          }}
        >
          {ir("accountSwitching")}
        </div>
      )}

      {/* 高级搜索 */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runQuery();
            }
          }}
          placeholder={ir("keywordPh")}
          style={{
            flex: "1 1 220px",
            minWidth: 220,
            background: "var(--panel-bg)",
            borderRadius: 999,
            border: "1px solid var(--panel-border)",
            height: 34,
            padding: "0 12px",
            fontSize: 12,
            color: "var(--fg)",
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        <FilterSelect
          value={systemType}
          onChange={setSystemType}
          placeholder={ir("filterSystemAll")}
          options={[
            { label: ir("filterSystemAll"), value: "" },
            ...meta.systemTypes.map((v) => ({ label: v, value: v })),
          ]}
        />
        <FilterSelect
          value={category}
          onChange={setCategory}
          placeholder={ir("filterCategoryAll")}
          options={[
            { label: ir("filterCategoryAll"), value: "" },
            ...meta.categories.map((v) => ({ label: v, value: v })),
          ]}
        />
        <FilterSelect
          value={riskLevel}
          onChange={setRiskLevel}
          placeholder={ir("filterRiskAll")}
          options={[
            { label: ir("filterRiskAll"), value: "" },
            ...meta.riskLevels.map((v) => ({ label: v, value: v })),
          ]}
        />
        <FilterSelect
          value={systemEnabled}
          onChange={setSystemEnabled}
          placeholder={ir("filterOfficialAll")}
          options={[
            { label: ir("filterOfficialAll"), value: "" },
            { label: ir("filterOfficialOn"), value: "1" },
            { label: ir("filterOfficialOff"), value: "0" },
          ]}
        />
        <FilterSelect
          value={interceptEnabled}
          onChange={setInterceptEnabled}
          placeholder="全部拦截状态"
          options={[
            { label: "全部拦截状态", value: "" },
            { label: "已启用拦截", value: "1" },
            { label: "未启用拦截", value: "0" },
          ]}
        />

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void batchSetIntercept(true)}
            disabled={batchUpdating || updatingId !== null || selectedActionableIds.length === 0}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid rgba(239,68,68,0.38)",
              background: "rgba(239,68,68,0.10)",
              color: "#fca5a5",
              fontSize: 11,
              fontWeight: 700,
              cursor: batchUpdating || updatingId !== null || selectedActionableIds.length === 0 ? "not-allowed" : "pointer",
              opacity: batchUpdating || updatingId !== null || selectedActionableIds.length === 0 ? 0.55 : 1,
            }}
          >
            {batchUpdating ? "批量处理中…" : `批量启用拦截 (${selectedActionableIds.length})`}
          </button>
          <button
            type="button"
            onClick={() => void batchSetIntercept(false)}
            disabled={batchUpdating || updatingId !== null || selectedActionableIds.length === 0}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid rgba(34,197,94,0.40)",
              background: "rgba(34,197,94,0.12)",
              color: "#bbf7d0",
              fontSize: 11,
              fontWeight: 700,
              cursor: batchUpdating || updatingId !== null || selectedActionableIds.length === 0 ? "not-allowed" : "pointer",
              opacity: batchUpdating || updatingId !== null || selectedActionableIds.length === 0 ? 0.55 : 1,
            }}
          >
            {batchUpdating ? "批量处理中…" : `批量取消拦截 (${selectedActionableIds.length})`}
          </button>
          <button
            type="button"
            onClick={runQuery}
            disabled={loading}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid var(--panel-border)",
              background: loading ? "var(--panel-bg2)" : "var(--panel-bg)",
              color: "var(--fg)",
              fontSize: 11,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? ir("queryRunning") : ir("query")}
          </button>
        </div>
      </div>

      <div
        style={{
          borderRadius: 10,
          border: "1px solid var(--panel-border)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            maxHeight: "calc(100vh - 300px)",
            minHeight: 320,
            overflowY: "auto",
            overflowX: "auto",
          }}
        >
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 980 }}>
          <thead>
            <tr>
              <th style={{ ...stickySelectColumnHeadStyle, textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAllActionable}
                  title="全选当前可批量项"
                  style={{ cursor: "pointer" }}
                />
              </th>
              <th style={{ ...stickyHeadCellStyle, textAlign: "left", color: "var(--muted)" }}>{ir("colId")}</th>
              <th style={{ ...stickyHeadCellStyle, textAlign: "left", color: "var(--muted)" }}>{ir("colPattern")}</th>
              <th style={{ ...stickyHeadCellStyle, textAlign: "left", color: "var(--muted)" }}>{ir("colSystem")}</th>
              <th style={{ ...stickyHeadCellStyle, textAlign: "left", color: "var(--muted)" }}>{ir("colCategory")}</th>
              <th style={{ ...stickyHeadCellStyle, textAlign: "left", color: "var(--muted)" }}>{ir("colRisk")}</th>
              <th style={{ ...stickyHeadCellStyle, textAlign: "left", color: "var(--muted)" }}>{ir("colOfficial")}</th>
              <th style={{ ...stickyActionColumnHeadStyle, textAlign: "left", color: "var(--muted)" }}>拦截</th>
            </tr>
          </thead>
          <tbody>
            {dangerCommands.map((r) => (
              <tr key={r.id} style={{ background: "var(--panel-bg)" }}>
                <td
                  style={{
                    ...stickySelectColumnCellStyle,
                    padding: "6px 8px",
                    borderBottom: "1px solid var(--panel-border)",
                    textAlign: "center",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(r.id)}
                    onChange={() => toggleSelectRow(r.id)}
                    disabled={!isRowBatchActionable(r) || batchUpdating}
                    title={!isRowBatchActionable(r) ? "系统禁用项不可批量修改" : "选择此项"}
                    style={{ cursor: !isRowBatchActionable(r) || batchUpdating ? "not-allowed" : "pointer" }}
                  />
                </td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--panel-border)", color: "var(--muted)" }}>{r.id}</td>
                <td
                  style={{
                    padding: "6px 8px",
                    borderBottom: "1px solid var(--panel-border)",
                    color: "var(--fg)",
                    maxWidth: 420,
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  }}
                  title={r.command_pattern}
                >
                  {r.command_pattern}
                </td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--panel-border)", color: "var(--muted)" }}>{r.system_type}</td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--panel-border)", color: "var(--muted)" }}>{r.category}</td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--panel-border)", color: "#fbbf24" }}>{r.risk_level}</td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--panel-border)", whiteSpace: "nowrap" }}>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: r.enabled ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                      color: r.enabled ? "#bbf7d0" : "#fca5a5",
                      border: r.enabled ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(239,68,68,0.3)",
                    }}
                  >
                    {r.enabled ? ir("officialNormal") : ir("officialDisabled")}
                  </span>
                </td>
                <td
                  style={{
                    ...stickyActionColumnCellStyle,
                    padding: "6px 8px",
                    borderBottom: "1px solid var(--panel-border)",
                  }}
                >
                  {r.enabled === 0 ? (
                    <div style={{ fontSize: 10, color: "var(--muted2)" }}>{ir("systemDisabledHint")}</div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleUserEnabled(r.id, r.user_enabled, r.enabled)}
                      disabled={updatingId === r.id || batchUpdating}
                      title={r.user_enabled === 0 ? "已启用拦截" : "未启用拦截"}
                      style={{
                        position: "relative",
                        width: 42,
                        height: 20,
                        borderRadius: 999,
                        border: "none",
                        background: r.user_enabled === 0 ? "#22c55e" : "#374151",
                        cursor: updatingId === r.id || batchUpdating ? "not-allowed" : "pointer",
                        opacity: updatingId === r.id || batchUpdating ? 0.6 : 1,
                        transition: "background 0.2s, opacity 0.2s",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: 2,
                          left: r.user_enabled === 0 ? 24 : 2,
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background: "#fff",
                          transition: "left 0.2s",
                        }}
                      />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {dangerCommands.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={8}
                  style={{ padding: "8px 10px", textAlign: "center", color: "var(--muted2)", background: "var(--panel-bg)" }}
                >
                  {ir("emptyLocal")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

