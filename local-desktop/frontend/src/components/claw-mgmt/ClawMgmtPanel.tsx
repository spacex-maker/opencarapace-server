import type { CSSProperties } from "react";
import { useClawMgmtCore } from "./useClawMgmtCore";
import { ClawMgmtProvider } from "./context";
import { ClawHeartBuiltInTab } from "./ClawHeartBuiltInTab";
import { OtherClawsTab } from "./OtherClawsTab";

const consoleTextareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 160,
  maxHeight: 360,
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--panel-border)",
  background: "var(--panel-bg)",
  color: "var(--fg)",
  fontSize: 10,
  fontFamily: "Consolas, Monaco, 'Courier New', monospace",
  lineHeight: 1.45,
  outline: "none",
  resize: "vertical",
};

/** Claw 管理：顶栏两大 Tab；Gateway 诊断仅在内置 ClawHeart 支持 Tab 展示 */
export function ClawMgmtPanel() {
  const core = useClawMgmtCore();

  return (
    <ClawMgmtProvider value={core}>
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          background: "var(--panel-bg)",
          borderRadius: 16,
          padding: "24px 28px",
          border: "1px solid var(--panel-border)",
          boxShadow: "none",
          fontSize: 12,
        }}
      >
        <h1 style={{ fontSize: 20, margin: "0 0 12px", color: "var(--fg)" }}>Claw 管理</h1>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", borderBottom: "1px solid var(--panel-border)", paddingBottom: 10 }}>
          <button
            type="button"
            onClick={() => core.setMainTab("builtin")}
            style={{
              padding: "8px 18px",
              borderRadius: 999,
              border: core.mainTab === "builtin" ? "1px solid #38bdf8" : "1px solid var(--panel-border)",
              background: core.mainTab === "builtin" ? "rgba(56,189,248,0.12)" : "transparent",
              color: core.mainTab === "builtin" ? "#bae6fd" : "var(--muted)",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ClawHeart 支持
          </button>
          <button
            type="button"
            onClick={() => core.setMainTab("other")}
            style={{
              padding: "8px 18px",
              borderRadius: 999,
              border: core.mainTab === "other" ? "1px solid #a78bfa" : "1px solid var(--panel-border)",
              background: core.mainTab === "other" ? "rgba(167,139,250,0.12)" : "transparent",
              color: core.mainTab === "other" ? "#ddd6fe" : "var(--muted)",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            扫描到的其它 Claw
          </button>
        </div>

        {core.mainTab === "builtin" ? <ClawHeartBuiltInTab /> : <OtherClawsTab />}

        {core.mainTab === "builtin"
          ? (() => {
              const gc =
                core.builtInBinaryTab === "bundled"
                  ? core.gatewayPortConflictBundled
                  : core.gatewayPortConflictExternal;
              if (!gc) return null;
              return (
                <div
                  style={{
                    marginTop: 14,
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid rgba(251,191,36,0.45)",
                    background: "rgba(251,191,36,0.08)",
                    fontSize: 11,
                    lineHeight: 1.55,
                    color: "#fde68a",
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 6, color: "#fcd34d" }}>Gateway 端口被占用</div>
                  <div>
                    端口 <strong>{gc.port}</strong>
                    {gc.bindAddress ? (
                      <>
                        {" "}
                        · 绑定 <code style={{ fontSize: 10 }}>{gc.bindAddress}</code>
                      </>
                    ) : null}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    占用进程名称：<strong>{gc.processName}</strong>
                    {gc.pid != null ? (
                      <>
                        {" "}
                        · PID <strong>{gc.pid}</strong>
                      </>
                    ) : null}
                  </div>
                  {gc.commandLineHint ? (
                    <div style={{ marginTop: 4, fontSize: 10, color: "var(--muted2)", wordBreak: "break-all" }}>
                      系统识别命令名：{gc.commandLineHint}
                    </div>
                  ) : null}
                  {typeof gc.ambiguousListenerCount === "number" && gc.ambiguousListenerCount > 1 ? (
                    <div style={{ marginTop: 6, color: "#fca5a5" }}>
                      该端口上有 {gc.ambiguousListenerCount}{" "}
                      个监听进程，无法自动判断要结束哪一个；请用系统工具确认后再操作，或逐个结束。
                    </div>
                  ) : null}
                  {gc.pid != null && gc.pid > 0 ? (
                    <div style={{ marginTop: 10 }}>
                      <button
                        type="button"
                        disabled={core.killingGatewayPortPid === gc.pid}
                        onClick={() => {
                          if (
                            !window.confirm(
                              `确定结束进程 PID ${gc.pid}（${gc.processName}）？\n该进程须为当前占用 Gateway 端口的监听者；误杀可能影响其它程序。`
                            )
                          ) {
                            return;
                          }
                          void core.killGatewayPortListener(gc.pid!, gc.port);
                        }}
                        style={{
                          padding: "8px 14px",
                          borderRadius: 999,
                          border: "1px solid rgba(239,68,68,0.5)",
                          background: "rgba(239,68,68,0.12)",
                          color: "#fca5a5",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: core.killingGatewayPortPid === gc.pid ? "not-allowed" : "pointer",
                        }}
                      >
                        {core.killingGatewayPortPid === gc.pid ? "正在结束…" : `一键结束进程 PID ${gc.pid}`}
                      </button>
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, fontSize: 10, color: "var(--muted2)" }}>
                      正在从系统查询占用 PID… 可点「刷新环境与清单」或稍候再试；完整信息见下方 Gateway 诊断日志。
                    </div>
                  )}
                </div>
              );
            })()
          : null}

        {core.message ? (
          <div style={{ marginTop: 12, fontSize: 11, color: "#4ade80", lineHeight: 1.5 }}>{core.message}</div>
        ) : null}

        {core.mainTab === "builtin" ? (
          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: "1px solid var(--panel-border)",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg)", marginBottom: 10 }}>Gateway 诊断</div>

            <div style={{ fontSize: 9, color: "var(--muted2)", marginBottom: 12, lineHeight: 1.45 }}>
              与上方<strong>内置 / 外置</strong>卡片同一状态：点卡片或下方 Tab 均可切换；当前 Tab 对应该侧 Gateway 日志。安装 / 卸载 / Node 任务输出单独在再下方。
            </div>

            <div
              style={{
                display: "flex",
                gap: 6,
                marginBottom: 10,
                flexWrap: "wrap",
                borderBottom: "1px solid var(--panel-border)",
                paddingBottom: 10,
              }}
            >
              <button
                type="button"
                onClick={() => core.setBuiltInBinaryTab("bundled")}
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  border:
                    core.builtInBinaryTab === "bundled"
                      ? "1px solid rgba(167,139,250,0.55)"
                      : "1px solid var(--panel-border)",
                  background:
                    core.builtInBinaryTab === "bundled" ? "rgba(167,139,250,0.14)" : "transparent",
                  color: core.builtInBinaryTab === "bundled" ? "#ddd6fe" : "var(--muted)",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                内置 Gateway
              </button>
              <button
                type="button"
                onClick={() => core.setBuiltInBinaryTab("external")}
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  border:
                    core.builtInBinaryTab === "external"
                      ? "1px solid rgba(56,189,248,0.5)"
                      : "1px solid var(--panel-border)",
                  background:
                    core.builtInBinaryTab === "external" ? "rgba(56,189,248,0.12)" : "transparent",
                  color: core.builtInBinaryTab === "external" ? "#bae6fd" : "var(--muted)",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                外置 Gateway
              </button>
            </div>

            <div style={{ marginBottom: 4 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  marginBottom: 4,
                  color: core.builtInBinaryTab === "bundled" ? "#ddd6fe" : "#bae6fd",
                }}
              >
                {core.builtInBinaryTab === "bundled" ? "内置 · bundled / ClawHeart 管理目录" : "外置 · prefix CLI / 用户目录"}
              </div>
              {core.builtInBinaryTab === "bundled" && core.gatewayLogFileBundled ? (
                <div style={{ fontSize: 9, color: "var(--muted2)", marginBottom: 4, wordBreak: "break-all", lineHeight: 1.4 }}>
                  文件：{core.gatewayLogFileBundled}
                </div>
              ) : null}
              {core.builtInBinaryTab === "external" && core.gatewayLogFileExternal ? (
                <div style={{ fontSize: 9, color: "var(--muted2)", marginBottom: 4, wordBreak: "break-all", lineHeight: 1.4 }}>
                  文件：{core.gatewayLogFileExternal}
                </div>
              ) : null}
              <textarea
                ref={core.gatewayDiagnosticConsoleRef}
                readOnly
                value={core.builtInBinaryTab === "bundled" ? core.gatewayBundledLog : core.gatewayExternalLog}
                placeholder={
                  core.builtInBinaryTab === "bundled"
                    ? "以内置模式启动 / 停止 Gateway 时的诊断与子进程输出。"
                    : "以外置（prefix）模式启动 / 停止 Gateway 时的诊断与子进程输出。"
                }
                spellCheck={false}
                style={{ ...consoleTextareaStyle, minHeight: 180 }}
              />
            </div>

            {core.taskLog.trim() ? (
              <div style={{ marginTop: 14, marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>安装 / 卸载 / Node 任务</div>
                <textarea
                  ref={core.taskLogConsoleRef}
                  readOnly
                  value={core.taskLog}
                  spellCheck={false}
                  style={{ ...consoleTextareaStyle, minHeight: 120 }}
                />
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => void core.copyGatewayLog()}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid var(--btn-border)",
                  background: "rgba(59,130,246,0.15)",
                  color: "#93c5fd",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                复制全部日志
              </button>
              <button
                type="button"
                onClick={() => void core.refresh()}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid var(--btn-border)",
                  background: "var(--panel-bg2)",
                  color: "var(--fg)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                刷新环境与清单
              </button>
              <span style={{ fontSize: 10, color: "var(--muted2)" }}>
                复制含任务与内/外置两份 Gateway 日志 · 系统 npm：{core.hasSystemNpm ? "有" : "无"} · 客户端运行时 Node：
                {core.hasEmbeddedNode ? "有" : "无"}
              </span>
            </div>
          </div>
        ) : null}

        {core.loading && <div style={{ marginTop: 10, fontSize: 11, color: "var(--muted2)" }}>加载中…</div>}
        {core.error && <div style={{ marginTop: 6, fontSize: 11, color: "#f97373" }}>{core.error}</div>}
      </div>
    </ClawMgmtProvider>
  );
}
