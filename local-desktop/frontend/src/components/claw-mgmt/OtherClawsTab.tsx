import { clawTableCellStyle, clawTableHeadStyle } from "./tableStyles";
import { useClawMgmt } from "./context";

/** 系统扫描到的其它 Claw CLI（不含 OpenClaw 官方 CLI 行，避免与内置 Tab 重复） */
export function OtherClawsTab() {
  const c = useClawMgmt();

  return (
    <div>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--muted)", lineHeight: 1.55 }}>
        展示 PATH、npm 全局等位置探测到的<strong>其它厂商</strong> Claw 命令行。OpenClaw 本体请在「ClawHeart 支持」Tab 管理。
      </p>

      {c.clawEnvironment && (
        <div
          style={{
            marginBottom: 16,
            padding: "14px 16px",
            borderRadius: 12,
            border: "1px solid var(--panel-border)",
            background: "var(--panel-bg2)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg)", marginBottom: 10 }}>用户环境</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "10px 16px",
              fontSize: 11,
              color: "var(--muted)",
              lineHeight: 1.55,
            }}
          >
            <div>
              <div style={{ fontSize: 10, color: "var(--muted2)" }}>操作系统</div>
              <div>
                {c.clawEnvironment.platform} / {c.clawEnvironment.arch}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--muted2)" }}>用户目录</div>
              <code style={{ fontSize: 9, wordBreak: "break-all", color: "#93c5fd" }}>
                {c.clawEnvironment.homedir}
              </code>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--muted2)" }}>本地服务 Node</div>
              <div>{c.clawEnvironment.serviceNodeVersion}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--muted2)" }}>系统 node（PATH）</div>
              <div>{c.clawEnvironment.systemNodeVersion ?? "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--muted2)" }}>系统 npm</div>
              <div>
                {c.clawEnvironment.hasSystemNpm
                  ? c.clawEnvironment.systemNpmVersion ?? "已检测到"
                  : "无"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--muted2)" }}>客户端运行时 Node</div>
              <div>
                {c.clawEnvironment.hasEmbeddedNode ? "已下载" : "未下载"}
                {c.clawEnvironment.clientNodeRuntimeTarget
                  ? `（目标 ${c.clawEnvironment.clientNodeRuntimeTarget}）`
                  : ""}
              </div>
            </div>
          </div>
          {c.openClawDiscovery?.electronUserData ? (
            <div style={{ marginTop: 10, fontSize: 10, color: "var(--muted2)" }}>
              应用数据根：<code style={{ fontSize: 9 }}>{c.openClawDiscovery.electronUserData}</code>
            </div>
          ) : null}
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg)", marginBottom: 8 }}>
        已扫描到的其它 Claw CLI
        {c.clawScannedAt ? (
          <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 400, color: "var(--muted2)" }}>
            最近扫描：{c.clawScannedAt}
          </span>
        ) : null}
      </div>
      <div style={{ fontSize: 10, color: "var(--muted2)", marginBottom: 8, lineHeight: 1.55 }}>
        已在客户端注册探测规则的厂商（如腾讯系命令名示例）。未识别到的 CLI 可在后续版本扩展规则。
      </div>
      <div
        style={{
          border: "1px solid var(--panel-border)",
          borderRadius: 10,
          overflow: "hidden",
          overflowX: "auto",
        }}
      >
        <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", background: "var(--panel-bg)" }}>
          <thead>
            <tr>
              <th style={clawTableHeadStyle}>名称</th>
              <th style={clawTableHeadStyle}>可执行文件</th>
              <th style={clawTableHeadStyle}>版本</th>
              <th style={clawTableHeadStyle}>探测来源</th>
              <th style={{ ...clawTableHeadStyle, minWidth: 220 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {c.otherClawInstallations.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ ...clawTableCellStyle, color: "var(--muted2)", textAlign: "center" }}>
                  未发现其它厂商 Claw CLI（或尚未安装 / 未命中探测规则）。
                </td>
              </tr>
            ) : (
              c.otherClawInstallations.map((row) => (
                <tr key={row.id}>
                  <td style={clawTableCellStyle}>
                    <strong style={{ color: "var(--fg)" }}>{row.label}</strong>
                    <div style={{ fontSize: 10, color: "var(--muted2)" }}>{row.productId}</div>
                  </td>
                  <td style={clawTableCellStyle}>
                    <code style={{ fontSize: 9, wordBreak: "break-all", color: "#e2e8f0" }}>{row.executable}</code>
                  </td>
                  <td style={clawTableCellStyle}>{row.version ?? "—"}</td>
                  <td style={clawTableCellStyle}>{row.source}</td>
                  <td style={clawTableCellStyle}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => c.openClawConfigForRow(row)}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 999,
                          border: "1px solid var(--btn-border)",
                          background: "rgba(59,130,246,0.12)",
                          color: "#93c5fd",
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        配置
                      </button>
                      <button
                        type="button"
                        disabled={!row.npmPackage || c.uninstalling}
                        title={
                          !row.npmPackage
                            ? "未登记 npm 包名，请手动卸载"
                            : `npm uninstall -g ${row.npmPackage}`
                        }
                        onClick={() => row.npmPackage && void c.uninstallNpmClaw(row.npmPackage, row.label)}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 999,
                          border: "1px solid rgba(251,146,60,0.4)",
                          background: "rgba(251,146,60,0.08)",
                          color: "#fdba74",
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: !row.npmPackage || c.uninstalling ? "not-allowed" : "pointer",
                          opacity: !row.npmPackage || c.uninstalling ? 0.55 : 1,
                        }}
                      >
                        卸载
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 12, fontSize: 10, color: "var(--muted2)", lineHeight: 1.55 }}>
        npm 卸载与安装日志见页面底部控制台。若需编辑 OpenClaw 的 <code style={{ fontSize: 9 }}>openclaw.json</code>，请切换到「系统内置
        OpenClaw」Tab。
      </p>
    </div>
  );
}
