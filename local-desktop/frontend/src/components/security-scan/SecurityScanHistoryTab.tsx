import { MdRefresh } from "react-icons/md";
import { securityScanCardBase as cardBase } from "./securityScanShared";

type Props = {
  scanHistory: unknown[];
  historyLoading: boolean;
  onRefresh: () => void;
  onOpenRun: (id: number) => void;
  historyModalOpen: boolean;
  historyModalRunId: number | null;
};

export function SecurityScanHistoryTab({
  scanHistory,
  historyLoading,
  onRefresh,
  onOpenRun,
  historyModalOpen,
  historyModalRunId,
}: Props) {
  return (
    <div style={{ ...cardBase, padding: "16px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--fg)" }}>历史扫描任务</div>
        <button
          className="ui-btn-hover"
          type="button"
          onClick={() => void onRefresh()}
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
            const row = r as Record<string, unknown>;
            const idRaw = row?.id;
            const id =
              typeof idRaw === "number"
                ? idRaw
                : (() => {
                    const n = parseInt(String(idRaw ?? ""), 10);
                    return Number.isFinite(n) ? n : NaN;
                  })();
            const st = String(row?.status || "");
            const done = Number(row?.doneItems ?? 0);
            const total = Number(row?.totalItems ?? 0);
            const countsObj = row?.counts as Record<string, unknown> | undefined;
            const totalFindings = countsObj?.total ?? null;
            const canOpen = Number.isFinite(id);
            const isActive = historyModalOpen && historyModalRunId != null && canOpen && historyModalRunId === id;
            return (
              <button
                key={String(row?.id)}
                type="button"
                onClick={() => canOpen && onOpenRun(id)}
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
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    #{id} · {st}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                      marginTop: 4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {String(row?.phase || "") || "—"} {total > 0 ? `· ${Math.min(done, total)}/${total}` : ""}
                    {totalFindings != null ? ` · 结果 ${totalFindings}` : ""}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: "var(--muted2)",
                    border: "1px solid var(--panel-border)",
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "var(--panel-bg)",
                  }}
                >
                  {isActive ? "已打开" : "打开"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
