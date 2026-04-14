import type { CSSProperties } from "react";
import { useState } from "react";
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
  /** 底部仅区分：OpenClaw Gateway 子进程诊断 vs 面板安装/卸载/Node 任务；内置/外置由上方卡片决定 */
  const [clawBottomLogTab, setClawBottomLogTab] = useState<"gateway" | "tasks">("gateway");

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
              border: core.mainTab === "builtin" ? "1px solid var(--claw-cyan-fg)" : "1px solid var(--panel-border)",
              background: core.mainTab === "builtin" ? "rgba(56,189,248,0.12)" : "transparent",
              color: core.mainTab === "builtin" ? "var(--claw-cyan-fg)" : "var(--muted)",
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
              border: core.mainTab === "other" ? "1px solid var(--claw-purple-fg)" : "1px solid var(--panel-border)",
              background: core.mainTab === "other" ? "rgba(167,139,250,0.12)" : "transparent",
              color: core.mainTab === "other" ? "var(--claw-purple-fg)" : "var(--muted)",
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
                    color: "var(--claw-amber-fg-muted)",
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 6, color: "var(--claw-amber-strong)" }}>Gateway 端口被占用</div>
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
                    <div style={{ marginTop: 6, color: "var(--claw-danger-fg)" }}>
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
                          color: "var(--claw-danger-fg)",
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
          <div style={{ marginTop: 12, fontSize: 11, color: "var(--claw-success-toast)", lineHeight: 1.5 }}>{core.message}</div>
        ) : null}

        {core.mainTab === "builtin" ? (
          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: "1px solid var(--panel-border)",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg)", marginBottom: 8 }}>Gateway 诊断</div>

            <div style={{ fontSize: 9, color: "var(--muted2)", marginBottom: 10, lineHeight: 1.4 }}>
              卡片选内置/外置侧；Tab 在 Gateway 输出与安装·Node 任务之间切换。
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
                onClick={() => setClawBottomLogTab("gateway")}
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  border:
                    clawBottomLogTab === "gateway"
                      ? "1px solid rgba(129,140,248,0.55)"
                      : "1px solid var(--panel-border)",
                  background: clawBottomLogTab === "gateway" ? "rgba(129,140,248,0.14)" : "transparent",
                  color: clawBottomLogTab === "gateway" ? "var(--claw-violet-muted)" : "var(--muted)",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Gateway 输出
              </button>
              <button
                type="button"
                onClick={() => setClawBottomLogTab("tasks")}
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  border:
                    clawBottomLogTab === "tasks"
                      ? "1px solid rgba(52,211,153,0.45)"
                      : "1px solid var(--panel-border)",
                  background: clawBottomLogTab === "tasks" ? "rgba(52,211,153,0.1)" : "transparent",
                  color: clawBottomLogTab === "tasks" ? "var(--claw-mint-muted)" : "var(--muted)",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                安装 · Node 任务
              </button>
            </div>

            {clawBottomLogTab === "gateway" ? (
              <div style={{ marginBottom: 4 }}>
                <div
                  style={{
                    fontSize: 9,
                    color: "var(--muted2)",
                    marginBottom: 6,
                    wordBreak: "break-all",
                    lineHeight: 1.45,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      color: core.builtInBinaryTab === "bundled" ? "var(--claw-purple-fg)" : "var(--claw-cyan-fg)",
                      marginRight: 6,
                    }}
                  >
                    {core.builtInBinaryTab === "bundled" ? "内置" : "外置"}
                  </span>
                  {core.builtInBinaryTab === "bundled" && core.gatewayLogFileBundled ? (
                    <span>{core.gatewayLogFileBundled}</span>
                  ) : null}
                  {core.builtInBinaryTab === "external" && core.gatewayLogFileExternal ? (
                    <span>{core.gatewayLogFileExternal}</span>
                  ) : null}
                </div>
                <textarea
                  ref={core.gatewayDiagnosticConsoleRef}
                  readOnly
                  value={core.builtInBinaryTab === "bundled" ? core.gatewayBundledLog : core.gatewayExternalLog}
                  placeholder={
                    core.builtInBinaryTab === "bundled"
                      ? "内置侧 Gateway 启动/停止与子进程输出。"
                      : "外置 prefix 侧 Gateway 输出。"
                  }
                  spellCheck={false}
                  style={{ ...consoleTextareaStyle, minHeight: 180 }}
                />
              </div>
            ) : (
              <div style={{ marginBottom: 4 }}>
                <textarea
                  ref={core.taskLogConsoleRef}
                  readOnly
                  value={core.taskLog}
                  placeholder="暂无；安装/卸载 OpenClaw 或下载 Node 后出现。"
                  spellCheck={false}
                  style={{ ...consoleTextareaStyle, minHeight: 180 }}
                />
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => void core.copyGatewayLog()}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid var(--btn-border)",
                  background: "rgba(59,130,246,0.15)",
                  color: "var(--claw-code-fg)",
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
                复制含任务与两侧 Gateway · 本机 npm {core.hasSystemNpm ? "有" : "无"} · 面板 Node {core.hasEmbeddedNode ? "有" : "无"}
              </span>
            </div>
          </div>
        ) : null}

        {core.loading && <div style={{ marginTop: 10, fontSize: 11, color: "var(--muted2)" }}>加载中…</div>}
        {core.error && <div style={{ marginTop: 6, fontSize: 11, color: "var(--claw-danger-fg)" }}>{core.error}</div>}
      </div>
    </ClawMgmtProvider>
  );
}
