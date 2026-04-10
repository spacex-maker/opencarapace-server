import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { CSSProperties } from "react";
import { useClawMgmt } from "./context";
import {
  compareOpenClawLocalToNpmLatest,
  extractOpenClawSemverLike,
  type OpenClawVersionCompare,
} from "./openclawVersionCompare";

/** 卡片内展示长路径：保留末尾若干字符，悬停可看完整 title */
function shortenFsPath(p: string, maxLen = 54): string {
  const s = String(p || "").trim();
  if (!s) return "";
  if (s.length <= maxLen) return s;
  return `…${s.slice(-(maxLen - 1))}`;
}

/** 点击「详情」弹出说明（非原生下拉） */
function DetailsButton({
  label,
  children,
  popoverAlign = "start",
  buttonMarginLeft = 8,
}: {
  label: string;
  children: ReactNode;
  /** start：弹层左对齐按钮；end：右对齐（适合放在容器右上角） */
  popoverAlign?: "start" | "end";
  buttonMarginLeft?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", verticalAlign: "middle" }}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        style={{
          marginLeft: buttonMarginLeft,
          padding: "3px 10px",
          borderRadius: 999,
          border: "1px solid var(--panel-border)",
          background: "var(--panel-bg2)",
          color: "var(--muted)",
          fontSize: 10,
          fontWeight: 600,
          cursor: "pointer",
          lineHeight: 1.35,
          flexShrink: 0,
        }}
      >
        详情
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-label="关闭"
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1040,
              border: "none",
              background: "rgba(0,0,0,0.25)",
              cursor: "default",
            }}
          />
          <div
            role="dialog"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              ...(popoverAlign === "end" ? { right: 0, left: "auto" as const } : { left: 0, right: "auto" as const }),
              top: "calc(100% + 6px)",
              zIndex: 1050,
              width: "min(440px, 92vw)",
              maxHeight: "min(75vh, 560px)",
              overflowY: "auto",
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid var(--panel-border)",
              background: "var(--panel-bg)",
              color: "var(--fg)",
              fontSize: 11,
              lineHeight: 1.6,
              boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
            }}
          >
            {children}
          </div>
        </>
      ) : null}
    </span>
  );
}

/** 右下角 Web UI 说明：问号标签，向上弹出（非原生下拉） */
function WebUiHelpTag({ accent }: { accent: "purple" | "cyan" }) {
  const [open, setOpen] = useState(false);
  const line =
    accent === "purple" ? "rgba(167,139,250,0.45)" : "rgba(56,189,248,0.45)";
  const fg = accent === "purple" ? "#ddd6fe" : "#bae6fd";

  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", verticalAlign: "middle" }}>
      <button
        type="button"
        aria-label="为什么 Web UI 在浏览器打开"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        style={{
          width: 24,
          height: 24,
          borderRadius: 999,
          border: `1px solid ${line}`,
          background: open ? (accent === "purple" ? "rgba(167,139,250,0.12)" : "rgba(56,189,248,0.12)") : "var(--panel-bg2)",
          color: fg,
          fontSize: 13,
          fontWeight: 800,
          cursor: "pointer",
          lineHeight: 1,
          padding: 0,
          flexShrink: 0,
        }}
      >
        ?
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-label="关闭"
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1040,
              border: "none",
              background: "rgba(0,0,0,0.25)",
              cursor: "default",
            }}
          />
          <div
            role="dialog"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              right: 0,
              left: "auto",
              bottom: "calc(100% + 6px)",
              top: "auto",
              zIndex: 1050,
              width: "min(360px, 90vw)",
              maxHeight: "min(70vh, 480px)",
              overflowY: "auto",
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid var(--panel-border)",
              background: "var(--panel-bg)",
              color: "var(--fg)",
              fontSize: 11,
              lineHeight: 1.6,
              boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
            }}
          >
            <UiOpenExplainer />
          </div>
        </>
      ) : null}
    </span>
  );
}

function OpenClawModeDetails() {
  const c = useClawMgmt();
  return (
    <>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12 }}>页签与记录</div>
      <div style={{ color: "var(--muted)", marginBottom: 14 }}>
        在下方两张并排卡片中点击<strong>标题区</strong>切换<strong>查看中</strong>的一侧；「配置」与底部诊断里看的{" "}
        <code style={{ fontSize: 10 }}>openclaw.json</code> / Gateway 日志随查看侧切换。
        {c.isRunning ? (
          <span style={{ color: "#fbbf24", fontWeight: 600 }}> 首次请配 LLM。</span>
        ) : null}
      </div>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12 }}>记录模式</div>
      <div style={{ color: "var(--muted)", marginBottom: 14 }}>
        服务端记录的「最近一次成功启动 Gateway」侧：
        <strong style={{ color: "#93c5fd" }}>
          {c.gatewayOpenclawBinary === "external" ? "外置 OpenClaw" : "内置 OpenClaw"}
        </strong>
        。仅切换查看卡片<strong>不会</strong>改此项；在某侧点「启动 Gateway」成功后才会写入。
      </div>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12 }}>内置 OpenClaw（总览）</div>
      <div style={{ color: "var(--muted)", marginBottom: 14 }}>
        OpenClaw 与 <code style={{ fontSize: 10 }}>openclaw.json</code> 在<strong>应用内隔离目录</strong>，与用户主目录下的标准配置分离；Node
        由安装包或面板提供，不依赖 PATH 上的全局 <code style={{ fontSize: 10 }}>openclaw</code>。
      </div>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12 }}>外置 OpenClaw（总览）</div>
      <div style={{ color: "var(--muted)", marginBottom: 14 }}>
        外置 Gateway 使用本机解析到的 <code style={{ fontSize: 10 }}>OPENCLAW_STATE_DIR</code> /{" "}
        <code style={{ fontSize: 10 }}>OPENCLAW_CONFIG_PATH</code>（见下方卡片与接口返回的绝对路径）。CLI 优先使用 ClawHeart npm
        前缀内的 <code style={{ fontSize: 10 }}>openclaw</code>，若无则使用「扫描本机」在 PATH / npm 全局等位置发现的二进制。可选将 openclaw 安装到客户端管理的前缀目录。
      </div>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12 }}>内置卡片 · Gateway</div>
      <div style={{ color: "var(--muted)", marginBottom: 12 }}>
        只使用应用包或工程内的 OpenClaw，<strong>不会</strong>用 PATH 上的全局{" "}
        <code style={{ fontSize: 10 }}>openclaw</code>。若「CLI 来源」显示全局，表示本机另有安装，与内置启动无关；要用用户环境 CLI
        请选外置卡片。
      </div>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12 }}>内置卡片 · openclaw.json</div>
      <div style={{ color: "var(--muted)", marginBottom: 14 }}>
        应用内隔离目录，与用户主目录标准配置不混用；与 Gateway 注入的{" "}
        <code style={{ fontSize: 10 }}>OPENCLAW_CONFIG_PATH</code> 一致。
      </div>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12 }}>外置卡片 · Gateway</div>
      <div style={{ color: "var(--muted)", marginBottom: 12 }}>
        使用用户环境 Node/npm。卡片上展示的路径来自服务端扫描当前用户主目录与文件系统，非写死字符串。Gateway 子进程日志在底部「Gateway
        诊断」；另有 Tab 查看安装/卸载/Node 任务输出。
        {c.userEnvironmentOpenClaw && c.hasExternalManagedOpenClaw ? (
          <>
            <br />
            <br />
            本机另有探测到的 <code style={{ fontSize: 10 }}>openclaw</code>（与 ClawHeart 前缀并列）：
            <br />
            <code style={{ fontSize: 9, wordBreak: "break-all" }}>{c.userEnvironmentOpenClaw.binPath}</code>
            {c.userEnvironmentOpenClaw.version ? `（${c.userEnvironmentOpenClaw.version}）` : ""}
          </>
        ) : null}
      </div>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12 }}>外置卡片 · openclaw.json</div>
      <div style={{ color: "var(--muted)" }}>
        {c.openClawDiscovery ? (
          <>
            当前解析的配置文件：
            <br />
            <code style={{ fontSize: 9, wordBreak: "break-all" }}>{c.openClawDiscovery.userProfile.configPath}</code>
          </>
        ) : (
          <>路径由服务端按当前用户解析后显示在卡片上。</>
        )}
      </div>
    </>
  );
}

type NodeRuntimeProfile = "bundled" | "external";

function NodeRuntimeModal({
  profile,
  open,
  onClose,
}: {
  profile: NodeRuntimeProfile;
  open: boolean;
  onClose: () => void;
}) {
  const c = useClawMgmt();
  const targetVer = c.clawEnvironment?.clientNodeRuntimeTarget ?? "—";
  const bundled = profile === "bundled";
  const hasPkg = !!c.packagedNodePath;
  const hasDl = bundled ? c.hasEmbeddedNode : c.hasExternalGatewayNode;
  const sysNode = c.clawEnvironment?.systemNodeVersion;
  const sysNpmOk = c.clawEnvironment?.hasSystemNpm;
  /** 外置 npm / 多数安装流程已可直接用 PATH，专用目录变为可选 */
  const systemNodeReady = Boolean(sysNode && String(sysNode).trim()) && sysNpmOk;

  const [nodeSource, setNodeSource] = useState<"packaged" | "downloaded">("downloaded");

  useEffect(() => {
    if (!open) return;
    setNodeSource(bundled && hasPkg ? "packaged" : "downloaded");
  }, [open, bundled, hasPkg]);

  if (!open) return null;

  const accent = bundled ? "#ddd6fe" : "#bae6fd";
  const dirHint = bundled
    ? "~/.opencarapace/embedded-node（与外置专用目录不同）"
    : "~/.opencarapace/external-gateway-node（仅外置 npm / Gateway PATH）";
  const home = c.clawEnvironment?.homedir?.trim();
  const externalGatewayDirAbs =
    home && home.length > 0 ? `${home}/.opencarapace/external-gateway-node` : null;
  const embeddedDirAbs = home && home.length > 0 ? `${home}/.opencarapace/embedded-node` : null;

  return (
    <>
      <button
        type="button"
        aria-label="关闭"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 2000,
          border: "none",
          background: "rgba(0,0,0,0.35)",
          cursor: "default",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 2010,
          width: bundled ? "min(480px, 94vw)" : "min(520px, 94vw)",
          maxHeight: "88vh",
          overflowY: "auto",
          boxSizing: "border-box",
          padding: "18px 20px 20px",
          borderRadius: 14,
          border: bundled ? "1px solid var(--panel-border)" : "1px solid rgba(56,189,248,0.28)",
          background: "var(--panel-bg)",
          color: "var(--fg)",
          fontSize: 12,
          boxShadow: bundled
            ? "0 12px 40px rgba(0,0,0,0.45)"
            : "0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(56,189,248,0.06) inset",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 14,
            marginBottom: 16,
            paddingBottom: 14,
            borderBottom: bundled ? "1px solid rgba(167,139,250,0.2)" : "1px solid rgba(56,189,248,0.22)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: accent, marginBottom: 6, letterSpacing: "-0.02em" }}>
              {bundled ? "内置 OpenClaw · Node" : "外置 OpenClaw · Node"}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--muted2)",
                lineHeight: 1.5,
                padding: "6px 10px",
                borderRadius: 8,
                background: bundled ? "rgba(167,139,250,0.08)" : "rgba(56,189,248,0.07)",
                border: bundled ? "1px solid rgba(167,139,250,0.15)" : "1px solid rgba(56,189,248,0.12)",
              }}
            >
              推荐 <strong style={{ color: "var(--muted)" }}>Node v{targetVer}</strong> 系列（与 OpenClaw 要求一致）
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid var(--panel-border)",
              background: "var(--panel-bg2)",
              color: "var(--muted)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            关闭
          </button>
        </div>

        {bundled ? (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>选用哪一种 Node</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => setNodeSource("packaged")}
                disabled={!hasPkg}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: nodeSource === "packaged" ? `1px solid ${accent}` : "1px solid var(--panel-border)",
                  background: nodeSource === "packaged" ? "rgba(167,139,250,0.12)" : "transparent",
                  color: hasPkg ? "var(--fg)" : "var(--muted2)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: hasPkg ? "pointer" : "not-allowed",
                }}
              >
                安装包 / 开发资源
              </button>
              <button
                type="button"
                onClick={() => setNodeSource("downloaded")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: nodeSource === "downloaded" ? `1px solid ${accent}` : "1px solid var(--panel-border)",
                  background: nodeSource === "downloaded" ? "rgba(167,139,250,0.12)" : "transparent",
                  color: "var(--fg)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                下载到用户目录
              </button>
            </div>
            {nodeSource === "packaged" ? (
              <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.55, marginBottom: 12 }}>
                {hasPkg ? (
                  <>
                    已检测到打包或工程内的 Node，内置 Gateway 会优先使用：
                    <br />
                    <code style={{ fontSize: 9, color: "#93c5fd", wordBreak: "break-all" }}>{c.packagedNodePath}</code>
                    <div style={{ marginTop: 8, color: "var(--muted2)", fontSize: 10 }}>
                      无需再下载；若启动仍失败，可改用「下载到用户目录」作为后备。
                    </div>
                  </>
                ) : (
                  <span style={{ color: "#fbbf24" }}>当前环境未检测到安装包 / 开发目录内的 Node，请改用「下载到用户目录」。</span>
                )}
              </div>
            ) : (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: "var(--muted2)", marginBottom: 8, lineHeight: 1.5 }}>
        {dirHint}
                </div>
                <div style={{ fontSize: 11, color: hasDl ? "#86efac" : "var(--muted)", marginBottom: 10 }}>
                  状态：{hasDl ? `已安装（v${targetVer} 发行包）` : systemNodeReady ? "专用目录为空（本机 Node 已可用）" : "未安装"}
                </div>
                {systemNodeReady && !hasDl ? (
                  <div
                    style={{
                      fontSize: 10,
                      color: "#86efac",
                      lineHeight: 1.5,
                      marginBottom: 10,
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "rgba(34,197,94,0.08)",
                      border: "1px solid rgba(34,197,94,0.2)",
                    }}
                  >
                    本机已有 Node 与 npm 时，内置卡多数流程可直接使用，无需下载到{" "}
                    <code style={{ fontSize: 9, color: "#93c5fd" }}>embedded-node</code>。
                  </div>
                ) : null}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {!hasDl ? (
                    <button
                      type="button"
                      onClick={() => void c.installRuntimeNode("bundled")}
                      disabled={c.nodeInstalling}
                      style={{
                        padding: systemNodeReady ? "6px 12px" : "8px 14px",
                        borderRadius: 999,
                        border: systemNodeReady
                          ? "1px solid var(--panel-border)"
                          : "1px solid rgba(34,197,94,0.4)",
                        background: systemNodeReady ? "transparent" : "rgba(34,197,94,0.12)",
                        color: systemNodeReady ? "var(--muted)" : "#bbf7d0",
                        fontSize: systemNodeReady ? 11 : 12,
                        fontWeight: systemNodeReady ? 600 : 700,
                        cursor: c.nodeInstalling ? "not-allowed" : "pointer",
                      }}
                    >
                      {c.nodeInstalling ? "安装中…" : systemNodeReady ? "仍下载到用户目录（可选）" : "下载并安装"}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => void c.installRuntimeNode("bundled", { force: true })}
                        disabled={c.nodeInstalling || c.isRunning}
                        style={{
                          padding: "8px 14px",
                          borderRadius: 999,
                          border: "1px solid rgba(56,189,248,0.45)",
                          background: "rgba(56,189,248,0.1)",
                          color: "#bae6fd",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: c.nodeInstalling || c.isRunning ? "not-allowed" : "pointer",
                        }}
                      >
                        升级（重装）
                      </button>
                      <button
                        type="button"
                        onClick={() => void c.uninstallRuntimeNode("bundled")}
                        disabled={c.nodeInstalling || c.isRunning}
                        style={{
                          padding: "8px 14px",
                          borderRadius: 999,
                          border: "1px solid rgba(239,68,68,0.4)",
                          background: "rgba(239,68,68,0.08)",
                          color: "#fca5a5",
                          fontSize: 12,
                          cursor: c.nodeInstalling || c.isRunning ? "not-allowed" : "pointer",
                        }}
                      >
                        卸载
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div
              style={{
                borderRadius: 11,
                border: "1px solid rgba(56,189,248,0.2)",
                background: "rgba(56,189,248,0.05)",
                padding: "12px 14px",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  color: "rgba(186,230,253,0.85)",
                  marginBottom: 10,
                }}
              >
                本机环境
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
                <div>
                  <div style={{ fontSize: 9, color: "var(--muted2)", marginBottom: 3 }}>PATH 中的 Node</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>{sysNode || "—"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "var(--muted2)", marginBottom: 3 }}>系统 npm</div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: sysNpmOk ? "#86efac" : "#fca5a5",
                    }}
                  >
                    {sysNpmOk ? "可用" : "不可用"}
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                borderRadius: 11,
                border: "1px solid rgba(56,189,248,0.35)",
                background: "linear-gradient(165deg, rgba(56,189,248,0.1) 0%, rgba(56,189,248,0.04) 100%)",
                padding: "14px 14px 12px",
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    color: "rgba(186,230,253,0.9)",
                  }}
                >
                  外置专用 Node
                </div>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 999,
                    border: hasDl ? "1px solid rgba(34,197,94,0.35)" : "1px solid rgba(148,163,184,0.35)",
                    background: hasDl ? "rgba(34,197,94,0.12)" : "rgba(148,163,184,0.1)",
                    color: hasDl ? "#86efac" : "var(--muted2)",
                  }}
                >
                  {hasDl ? `已安装 · v${targetVer}` : systemNodeReady ? "专用目录未使用" : "未安装"}
                </span>
              </div>
              <p style={{ fontSize: 10, color: "var(--muted2)", margin: "0 0 10px", lineHeight: 1.5 }}>
                仅此目录供<strong style={{ color: "var(--muted)" }}>外置卡</strong>的 npm 安装与 Gateway 子进程优先使用；与内置卡目录{" "}
                <code style={{ fontSize: 9, color: "#93c5fd" }}>embedded-node</code> 互不共用。
                {systemNodeReady && !hasDl ? (
                  <>
                    {" "}
                    本机已有 Node/npm 时，<strong style={{ color: "var(--muted)" }}>可不下载</strong>此副本。
                  </>
                ) : null}
              </p>
              <div
                style={{
                  fontSize: 9,
                  color: "var(--muted2)",
                  marginBottom: 6,
                }}
              >
                安装目录
              </div>
              <code
                style={{
                  display: "block",
                  fontSize: 10,
                  color: "#93c5fd",
                  wordBreak: "break-all",
                  lineHeight: 1.45,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "rgba(0,0,0,0.22)",
                  border: "1px solid rgba(56,189,248,0.15)",
                  marginBottom: 4,
                }}
              >
                {externalGatewayDirAbs || "~/.opencarapace/external-gateway-node"}
              </code>
              {externalGatewayDirAbs ? (
                <div style={{ fontSize: 9, color: "var(--muted2)", marginBottom: 12 }}>等价路径：{dirHint}</div>
              ) : (
                <div style={{ fontSize: 9, color: "var(--muted2)", marginBottom: 12 }}>{dirHint}</div>
              )}
              {systemNodeReady && !hasDl ? (
                <div
                  style={{
                    fontSize: 10,
                    color: "#86efac",
                    lineHeight: 1.5,
                    marginBottom: 10,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "rgba(34,197,94,0.08)",
                    border: "1px solid rgba(34,197,94,0.22)",
                  }}
                >
                  本机 PATH 已提供 Node 与 npm，外置「安装到 prefix」与 Gateway 会优先用它们，<strong>不必</strong>再下载专用目录。
                </div>
              ) : null}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {!hasDl ? (
                  <button
                    type="button"
                    onClick={() => void c.installRuntimeNode("external")}
                    disabled={c.nodeInstalling}
                    style={{
                      padding: systemNodeReady ? "6px 12px" : "9px 16px",
                      borderRadius: 999,
                      border: systemNodeReady
                        ? "1px solid rgba(56,189,248,0.35)"
                        : "1px solid rgba(34,197,94,0.45)",
                      background: systemNodeReady ? "transparent" : "rgba(34,197,94,0.16)",
                      color: systemNodeReady ? "#bae6fd" : "#bbf7d0",
                      fontSize: systemNodeReady ? 11 : 12,
                      fontWeight: systemNodeReady ? 600 : 700,
                      cursor: c.nodeInstalling ? "not-allowed" : "pointer",
                    }}
                  >
                    {c.nodeInstalling ? "安装中…" : systemNodeReady ? "仍下载 Node 到专用目录（可选）" : "下载并安装到此目录"}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void c.installRuntimeNode("external", { force: true })}
                      disabled={c.nodeInstalling || c.isRunning}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 999,
                        border: "1px solid rgba(56,189,248,0.45)",
                        background: "rgba(56,189,248,0.12)",
                        color: "#bae6fd",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: c.nodeInstalling || c.isRunning ? "not-allowed" : "pointer",
                      }}
                    >
                      升级（重装）
                    </button>
                    <button
                      type="button"
                      onClick={() => void c.uninstallRuntimeNode("external")}
                      disabled={c.nodeInstalling || c.isRunning}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 999,
                        border: "1px solid rgba(239,68,68,0.4)",
                        background: "rgba(239,68,68,0.08)",
                        color: "#fca5a5",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: c.nodeInstalling || c.isRunning ? "not-allowed" : "pointer",
                      }}
                    >
                      卸载
                    </button>
                  </>
                )}
              </div>
            </div>

            <div
              style={{
                fontSize: 10,
                color: "var(--muted2)",
                lineHeight: 1.55,
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(148,163,184,0.06)",
                border: "1px solid var(--panel-border)",
              }}
            >
              <span style={{ fontWeight: 700, color: "var(--muted)" }}>使用顺序</span>
              ：若已下载专用副本则优先用该目录；否则依次尝试本机 PATH、内置卡已下载 Node（
              <code
                title={embeddedDirAbs || undefined}
                style={{ fontSize: 9, color: "#93c5fd" }}
              >
                {embeddedDirAbs ? shortenFsPath(embeddedDirAbs, 40) : "~/.opencarapace/embedded-node"}
              </code>
              ）、系统 npm。
            </div>
          </>
        )}
        {c.isRunning ? (
          <div style={{ fontSize: 10, color: "#fbbf24", marginTop: 12 }}>Gateway 运行中时建议先停止再卸载 Node。</div>
        ) : null}
      </div>
    </>
  );
}

function UiOpenExplainer() {
  return (
    <div style={{ color: "var(--muted)" }}>
      OpenClaw Web UI 受安全策略限制无法在应用内嵌或 iframe，请在系统浏览器新窗口打开（链接可带登录 token）。
    </div>
  );
}

/** 外置卡：prefix 安装来源 + 是否另有 PATH 下的 openclaw */
function ExternalOpenClawInstallPills() {
  const c = useClawMgmt();
  const pills: ReactNode[] = [];
  const pill = (key: string, label: string, s: CSSProperties) => (
    <span
      key={key}
      style={{
        fontSize: 9,
        fontWeight: 700,
        padding: "3px 8px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        ...s,
      }}
    >
      {label}
    </span>
  );
  if (c.hasExternalManagedOpenClaw) {
    if (c.externalOpenClawInstallTag === "client") {
      pills.push(
        pill("client", "客户端安装", {
          background: "rgba(34,197,94,0.18)",
          color: "#86efac",
          border: "1px solid rgba(34,197,94,0.35)",
        })
      );
    } else if (c.externalOpenClawInstallTag === "user") {
      pills.push(
        pill("user", "用户安装", {
          background: "rgba(251,191,36,0.12)",
          color: "#fcd34d",
          border: "1px solid rgba(251,191,36,0.35)",
        })
      );
    } else if (c.externalOpenClawInstallTag === "unknown") {
      pills.push(
        pill("unk", "来源未记录", {
          background: "rgba(148,163,184,0.12)",
          color: "var(--muted2)",
          border: "1px solid var(--panel-border)",
        })
      );
    }
  }
  if (c.hasUserEnvironmentOpenClawAside) {
    if (c.hasExternalManagedOpenClaw) {
      pills.push(
        pill("env", "另有用户环境", {
          background: "rgba(56,189,248,0.12)",
          color: "#bae6fd",
          border: "1px solid rgba(56,189,248,0.35)",
        })
      );
    } else {
      pills.push(
        pill("env-only", "用户安装", {
          background: "rgba(251,191,36,0.12)",
          color: "#fcd34d",
          border: "1px solid rgba(251,191,36,0.35)",
        })
      );
    }
  }
  if (pills.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 0, alignItems: "center" }}>{pills}</div>
  );
}

/** 外置卡：完整路径与 CLI 说明（主卡片仅保留摘要） */
function ExternalOpenClawPathsDetail() {
  const c = useClawMgmt();
  if (!c.openClawDiscovery) {
    return <div style={{ fontSize: 11, color: "var(--muted2)" }}>载入中…</div>;
  }
  const up = c.openClawDiscovery.userProfile;
  const row = (label: string, path: string, hint?: string) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted2)", marginBottom: 4 }}>
        {label}
        {hint ? (
          <span style={{ fontWeight: 400, color: "var(--muted)", marginLeft: 6 }}>{hint}</span>
        ) : null}
      </div>
      <code style={{ fontSize: 10, color: "#93c5fd", wordBreak: "break-all", lineHeight: 1.5 }}>{path}</code>
    </div>
  );
  const diskHint = (exists: boolean | null) =>
    exists === true ? "（磁盘存在）" : exists === false ? "（磁盘上已无此目录）" : "";
  return (
    <div style={{ fontSize: 11, color: "var(--muted)", maxWidth: 420, lineHeight: 1.55 }}>
      <div
        style={{
          fontSize: 10,
          color: "var(--muted2)",
          marginBottom: 12,
          padding: "8px 10px",
          borderRadius: 8,
          background: "rgba(56,189,248,0.08)",
          border: "1px solid rgba(56,189,248,0.22)",
        }}
      >
        <strong style={{ color: "#bae6fd" }}>与「卸载 ClawHeart 外置」的关系：</strong>
        卸载只会删掉 <code style={{ fontSize: 9 }}>.opencarapace/external-openclaw</code> 与{" "}
        <code style={{ fontSize: 9 }}>external-openclaw-runtime</code>。
        下方的 <code style={{ fontSize: 9 }}>~/.openclaw</code> 是 OpenClaw 的<strong>标准用户数据</strong>，按设计<strong>不会</strong>
        随卸载删除。若仍看到 CLI，多为<strong>本机扫描</strong>到的其它安装（例如当前仓库的{" "}
        <code style={{ fontSize: 9 }}>node_modules/.bin/openclaw</code>），与是否装过前缀无关。
      </div>
      <div style={{ fontWeight: 700, marginBottom: 8, color: "#bae6fd" }}>标准用户环境（外置 Gateway 注入）</div>
      {row("OPENCLAW_STATE_DIR", up.stateDir, "· 非 ClawHeart 专有")}
      {row("OPENCLAW_CONFIG_PATH", up.configPath, "· 卸载外置不删此文件")}
      <div style={{ fontWeight: 700, marginBottom: 8, marginTop: 4, color: "#bae6fd" }}>ClawHeart 管理的 npm 前缀</div>
      {row("prefix 目录", c.externalOpenClawNpmPrefix || "—", diskHint(c.externalOpenClawPrefixDirExists))}
      {c.openClawDiscovery.externalManaged ? (
        row(
          "external-openclaw-runtime",
          c.openClawDiscovery.externalManaged.stateDir,
          diskHint(c.externalOpenClawRuntimeDirExists)
        )
      ) : null}
      {c.externalManagedOpenClawBinPath
        ? row("前缀内 openclaw", c.externalManagedOpenClawBinPath)
        : null}
      <div style={{ fontWeight: 700, marginBottom: 8, marginTop: 4, color: "#bae6fd" }}>实际启动的 CLI</div>
      {c.externalOpenClawBinPath ? (
        row(
          c.externalOpenClawBinSource === "managed-prefix"
            ? "来源：ClawHeart 前缀"
            : c.externalOpenClawBinSource === "user-environment"
              ? "来源：本机扫描"
              : "来源：已解析",
          c.externalOpenClawBinPath
        )
      ) : (
        <div style={{ fontSize: 10, color: "var(--muted2)" }}>当前未解析到可执行文件。</div>
      )}
    </div>
  );
}

type AdvancedMenuChildren = ReactNode | ((close: () => void) => ReactNode);

/** 卡片左下角：高级功能菜单（向上展开，非原生下拉） */
function CardAdvancedMenu({ accent, children }: { accent: "purple" | "cyan"; children: AdvancedMenuChildren }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const line =
    accent === "purple" ? "rgba(167,139,250,0.45)" : "rgba(56,189,248,0.45)";
  const bgOpen =
    accent === "purple" ? "rgba(167,139,250,0.14)" : "rgba(56,189,248,0.12)";
  const fg = accent === "purple" ? "#ddd6fe" : "#bae6fd";

  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        style={{
          padding: "5px 11px",
          borderRadius: 999,
          border: `1px solid ${line}`,
          background: open ? bgOpen : "transparent",
          color: fg,
          fontSize: 10,
          fontWeight: 700,
          cursor: "pointer",
          lineHeight: 1.35,
        }}
      >
        高级功能{open ? " ▴" : " ▾"}
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-label="关闭菜单"
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1040,
              border: "none",
              background: "rgba(0,0,0,0.2)",
              cursor: "default",
            }}
          />
          <div
            role="dialog"
            aria-label="高级功能"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              bottom: "calc(100% + 8px)",
              left: 0,
              zIndex: 1050,
              width: "min(300px, 86vw)",
              maxHeight: "min(70vh, 420px)",
              overflowY: "auto",
              padding: "10px 10px 12px",
              borderRadius: 10,
              border: "1px solid var(--panel-border)",
              background: "var(--panel-bg)",
              color: "var(--fg)",
              fontSize: 11,
              lineHeight: 1.5,
              boxShadow: "0 8px 28px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ fontSize: 9, fontWeight: 700, color: "var(--muted2)", marginBottom: 8, letterSpacing: "0.04em" }}>
              高级功能
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {typeof children === "function" ? children(close) : children}
            </div>
          </div>
        </>
      ) : null}
    </span>
  );
}

/** 卡片底栏：左下角高级功能 + 右下 Gateway / Web UI / 帮助 */
function CardWebUiCorner({
  accent,
  engineReady,
  gatewayRunning,
  advancedPanel,
  gatewayShowStart,
  gatewayShowStop,
  onGatewayStart,
  onGatewayStop,
  gatewayStartPending,
  gatewayStopPending,
  gatewayActionHint,
}: {
  accent: "purple" | "cyan";
  engineReady: boolean;
  gatewayRunning: boolean;
  advancedPanel: AdvancedMenuChildren;
  gatewayShowStart: boolean;
  gatewayShowStop: boolean;
  onGatewayStart: () => void;
  onGatewayStop: () => void;
  gatewayStartPending: boolean;
  gatewayStopPending: boolean;
  /** 启动/停止 Gateway 等本卡操作反馈，贴在卡片底栏下方 */
  gatewayActionHint?: string | null;
}) {
  const c = useClawMgmt();

  const webUiDisabledStyle: CSSProperties = {
    padding: "7px 14px",
    borderRadius: 999,
    border: "1px solid var(--panel-border)",
    background: "var(--panel-bg2)",
    color: "var(--muted2)",
    fontSize: 11,
    fontWeight: 700,
    cursor: "not-allowed",
    whiteSpace: "nowrap",
    opacity: 0.65,
  };

  return (
    <div style={{ marginTop: "auto", paddingTop: 10 }}>
      {engineReady && gatewayRunning ? (
        <div
          style={{
            marginBottom: 8,
            border: "1px solid rgba(251,191,36,0.35)",
            borderRadius: 10,
            padding: "8px 10px",
            background: "rgba(251,191,36,0.10)",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: "#fbbf24", marginBottom: 2 }}>需配置 LLM</div>
          <div style={{ fontSize: 10, color: "#fde68a", lineHeight: 1.5 }}>
            点左下「高级功能」→「配置」填写提供商，否则 Web UI 聊天可能 401。
          </div>
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "0 0 auto" }}>
          <CardAdvancedMenu accent={accent}>{advancedPanel}</CardAdvancedMenu>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginLeft: "auto",
          }}
        >
          {gatewayShowStart ? (
            <button
              type="button"
              onClick={onGatewayStart}
              disabled={gatewayStartPending}
              style={{
                padding: "7px 14px",
                borderRadius: 999,
                border: "1px solid rgba(34,197,94,0.45)",
                background: "rgba(34,197,94,0.14)",
                color: "#bbf7d0",
                fontSize: 11,
                fontWeight: 700,
                cursor: gatewayStartPending ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {gatewayStartPending ? "启动中…" : "启动 Gateway"}
            </button>
          ) : null}
          {gatewayShowStop ? (
            <button
              type="button"
              onClick={onGatewayStop}
              disabled={gatewayStopPending}
              style={{
                padding: "7px 14px",
                borderRadius: 999,
                border: "1px solid rgba(239,68,68,0.4)",
                background: "rgba(239,68,68,0.1)",
                color: "#fca5a5",
                fontSize: 11,
                fontWeight: 700,
                cursor: gatewayStopPending ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {gatewayStopPending ? "停止中…" : "停止 Gateway"}
            </button>
          ) : null}
          {gatewayRunning ? (
            <a
              href={c.uiUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "7px 14px",
                borderRadius: 999,
                border: "none",
                background: "#3b82f6",
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
                textDecoration: "none",
                whiteSpace: "nowrap",
                display: "inline-block",
              }}
            >
              启动 Web UI
            </a>
          ) : (
            <button type="button" disabled style={webUiDisabledStyle}>
              启动 Web UI
            </button>
          )}
          <WebUiHelpTag accent={accent} />
        </div>
      </div>
      {gatewayRunning ? (
        <div
          style={{
            marginTop: 6,
            textAlign: "right",
            fontSize: 9,
            color: "var(--muted)",
            wordBreak: "break-all",
            lineHeight: 1.45,
          }}
        >
          <code style={{ fontSize: 9, color: "#93c5fd" }}>{c.uiUrl}</code>
          {c.uiUrl.includes("token=") ? (
            <span style={{ marginLeft: 6, color: "#4ade80", fontWeight: 600 }}>token ✓</span>
          ) : null}
        </div>
      ) : null}
      {gatewayActionHint ? (
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: "#4ade80",
            lineHeight: 1.5,
            textAlign: "right",
          }}
        >
          {gatewayActionHint}
        </div>
      ) : null}
    </div>
  );
}

function ConfigWorkspaceExplainer() {
  return (
    <div style={{ color: "var(--muted)" }}>
      与当前选中的内置 / 外置卡片一致；保存的即 Gateway 进程{" "}
      <code style={{ fontSize: 10 }}>OPENCLAW_CONFIG_PATH</code> 指向的文件。
    </div>
  );
}

type NpmOpenClawUpgradeKind = "bundled" | "external";

function NpmOpenClawUpgradeModal({
  kind,
  open,
  onClose,
  onCompared,
}: {
  kind: NpmOpenClawUpgradeKind | null;
  open: boolean;
  onClose: () => void;
  onCompared: (payload: { latest: string; cmp: OpenClawVersionCompare } | null, k: NpmOpenClawUpgradeKind) => void;
}) {
  const c = useClawMgmt();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [latest, setLatest] = useState<string | null>(null);

  const bundled = kind === "bundled";
  const localRaw = bundled ? c.bundledOpenClawVersion : c.externalOpenClawVersion;

  const loadLatest = async () => {
    if (!kind) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await c.fetchOpenclawNpmLatestVersion();
      if (r.ok && r.latestVersion) {
        setLatest(r.latestVersion);
        const cmp = compareOpenClawLocalToNpmLatest(localRaw, r.latestVersion);
        onCompared({ latest: r.latestVersion, cmp }, kind);
      } else {
        setLatest(null);
        onCompared(null, kind);
        setErr(r.error || "查询失败");
      }
    } catch (e) {
      setLatest(null);
      onCompared(null, kind);
      setErr(e instanceof Error ? e.message : "查询失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !kind) {
      setErr(null);
      setLatest(null);
      return;
    }
    void loadLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !kind) return null;

  const accent = bundled ? "#ddd6fe" : "#bae6fd";
  const titleId = bundled ? "openclaw-npm-upgrade-bundled-title" : "openclaw-npm-upgrade-external-title";

  const localDisp = bundled
    ? c.hasBundledOpenClaw
      ? localRaw?.trim() || "（已检测到 CLI，未能读取 --version）"
      : "（尚未安装内置 CLI · 确认后将执行全局 npm install + onboard）"
    : localRaw?.trim() || "（未能读取 prefix 内 openclaw --version）";

  const localTok = extractOpenClawSemverLike(localRaw);
  const latestTok = latest ? extractOpenClawSemverLike(latest) : null;
  const cmpNow = latest ? compareOpenClawLocalToNpmLatest(localRaw, latest) : null;

  let cmpHint = "打开弹窗后将自动查询 npm registry。";
  if (loading) cmpHint = "正在查询 npm…";
  else if (err) cmpHint = "";
  else if (!c.hasBundledOpenClaw && bundled) {
    cmpHint = "将安装 npm 上的 latest 到本机全局并由 onboard 配置守护进程（与内置卡默认流程一致）。";
  } else if (cmpNow === "upgradeAvailable") {
    cmpHint = "registry 上有更新版本，可确认后执行（npm install @latest + onboard）。";
  } else if (cmpNow === "same") {
    cmpHint = "解析到的版本号与 npm latest 一致；若刚升过级仍显示旧号，可点「重新查询」或关闭后看卡片标题上的版本。";
  } else if (cmpNow === "localNewer") {
    cmpHint = "本地版本号大于 registry（少见）；仍可按需执行重装流程。";
  } else if (cmpNow === "unknown") {
    cmpHint = "无法从输出中解析可比较的版本号，请对照两行原文；仍可按需执行安装/升级。";
  }

  const blockNoNpm = bundled && !c.hasBundledOpenClaw && !c.hasEmbeddedNode && !c.hasSystemNpm;
  const blockUpgrade =
    c.installing || c.uninstalling || c.nodeInstalling || c.isRunning || blockNoNpm;

  const confirmLabel = bundled
    ? c.hasBundledOpenClaw
      ? "确认安装/升级（npm @latest + onboard）"
      : "确认安装（npm @latest + onboard）"
    : "确认升级（npm @latest + onboard）";

  return (
    <>
      <button
        type="button"
        aria-label="关闭"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 2020,
          border: "none",
          background: "rgba(0,0,0,0.4)",
          cursor: "default",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 2030,
          width: "min(500px, 94vw)",
          maxHeight: "88vh",
          overflowY: "auto",
          boxSizing: "border-box",
          padding: "16px 18px",
          borderRadius: 12,
          border: "1px solid var(--panel-border)",
          background: "var(--panel-bg)",
          color: "var(--fg)",
          fontSize: 12,
          boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div>
            <div id={titleId} style={{ fontWeight: 700, fontSize: 14, color: accent, marginBottom: 4 }}>
              {bundled ? "内置 OpenClaw · 版本与升级" : "外置 OpenClaw · 版本与升级"}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted2)", lineHeight: 1.45 }}>
              查询 npm 上 <code style={{ fontSize: 9 }}>openclaw</code> 的 latest，与
              {bundled ? " 工程 / 打包内置 CLI " : " prefix 内 CLI "}
              对比后再确认是否执行安装或升级。
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "4px 10px",
              borderRadius: 8,
              border: "1px solid var(--panel-border)",
              background: "var(--panel-bg2)",
              color: "var(--muted)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            关闭
          </button>
        </div>

        <div
          style={{
            fontSize: 11,
            lineHeight: 1.55,
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 8,
            background: "var(--panel-bg2)",
            border: "1px solid var(--panel-border)",
          }}
        >
          <div style={{ marginBottom: 6 }}>
            <span style={{ color: "var(--muted)", fontWeight: 600 }}>
              {bundled ? "当前（内置 CLI）" : "当前（prefix CLI）"}
            </span>
            <div style={{ wordBreak: "break-all", marginTop: 2 }}>{localDisp}</div>
            {localTok ? (
              <div style={{ fontSize: 10, color: "var(--muted2)", marginTop: 2 }}>解析版本号：{localTok}</div>
            ) : null}
          </div>
          <div>
            <span style={{ color: "var(--muted)", fontWeight: 600 }}>npm registry latest</span>
            <div style={{ wordBreak: "break-all", marginTop: 2 }}>{loading ? "…" : latest || "—"}</div>
            {latestTok ? (
              <div style={{ fontSize: 10, color: "var(--muted2)", marginTop: 2 }}>解析版本号：{latestTok}</div>
            ) : null}
          </div>
        </div>

        {err ? (
          <div style={{ fontSize: 11, color: "#fca5a5", marginBottom: 10, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{err}</div>
        ) : null}
        {cmpHint ? (
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12, lineHeight: 1.55 }}>{cmpHint}</div>
        ) : null}

        {blockNoNpm ? (
          <div style={{ fontSize: 11, color: "#fbbf24", marginBottom: 12, fontWeight: 600 }}>
            需要本机 npm 或面板「Node」已下载的运行时，请先完成后再安装内置 OpenClaw。
          </div>
        ) : null}

        {c.isRunning ? (
          <div style={{ fontSize: 11, color: "#fbbf24", marginBottom: 12, fontWeight: 600 }}>
            请先停止当前 Gateway，再执行安装/升级（避免与运行中实例冲突）。
          </div>
        ) : null}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => void loadLatest()}
            disabled={loading}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: "1px solid var(--panel-border)",
              background: "var(--panel-bg2)",
              color: "var(--fg)",
              fontSize: 11,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "查询中…" : "重新查询"}
          </button>
          <button
            type="button"
            disabled={blockUpgrade}
            onClick={() => {
              void (async () => {
                if (bundled) await c.installOpenClaw();
                else await c.upgradeOpenClawExternal();
                onClose();
              })();
            }}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: bundled ? "1px solid rgba(167,139,250,0.55)" : "1px solid rgba(56,189,248,0.5)",
              background: blockUpgrade ? "var(--panel-bg2)" : bundled ? "rgba(167,139,250,0.14)" : "rgba(56,189,248,0.15)",
              color: blockUpgrade ? "var(--muted2)" : accent,
              fontSize: 11,
              fontWeight: 700,
              cursor: blockUpgrade ? "not-allowed" : "pointer",
            }}
          >
            {c.installing ? "执行中…" : confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}

/** ClawHeart 内置 OpenClaw：工作区、Gateway 双卡（Web UI 在卡片右下角）；配置编辑仅由卡片「配置」弹窗打开 */
export function ClawHeartBuiltInTab() {
  const c = useClawMgmt();
  const bundledActive = c.builtInBinaryTab === "bundled";
  const externalActive = c.builtInBinaryTab === "external";
  const [nodeModalProfile, setNodeModalProfile] = useState<NodeRuntimeProfile | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [npmUpgradeModalKind, setNpmUpgradeModalKind] = useState<NpmOpenClawUpgradeKind | null>(null);
  const [bundledNpmHint, setBundledNpmHint] = useState<{ latest: string; cmp: OpenClawVersionCompare } | null>(null);
  const [extNpmHint, setExtNpmHint] = useState<{ latest: string; cmp: OpenClawVersionCompare } | null>(null);
  const [externalScanBusy, setExternalScanBusy] = useState(false);
  const bundledNpmHintLive = useMemo(() => {
    if (!bundledNpmHint) return null;
    return {
      latest: bundledNpmHint.latest,
      cmp: compareOpenClawLocalToNpmLatest(c.bundledOpenClawVersion, bundledNpmHint.latest),
    };
  }, [bundledNpmHint, c.bundledOpenClawVersion]);
  const extNpmHintLive = useMemo(() => {
    if (!extNpmHint) return null;
    return {
      latest: extNpmHint.latest,
      cmp: compareOpenClawLocalToNpmLatest(c.externalOpenClawVersion, extNpmHint.latest),
    };
  }, [extNpmHint, c.externalOpenClawVersion]);
  /** 进程级 isRunning 与 DB 记录的启动侧一致时，才视为该卡在跑（切换「查看中」卡片不会改 gatewayOpenclawBinary） */
  const gwBundled = c.gatewayOpenclawBinary === "bundled";
  const gwExternal = c.gatewayOpenclawBinary === "external";
  const bundledGatewayRunning = c.isRunning && gwBundled;
  const externalGatewayRunning = c.isRunning && gwExternal;
  const externalGatewayCliReady = Boolean(c.externalOpenClawBinPath);

  const cardShell = (active: boolean, accent: "purple" | "cyan"): CSSProperties => ({
    borderRadius: 12,
    border:
      active && accent === "purple"
        ? "1px solid rgba(167,139,250,0.65)"
        : active && accent === "cyan"
          ? "1px solid rgba(56,189,248,0.65)"
          : "1px solid var(--panel-border)",
    background: accent === "purple" ? "rgba(167,139,250,0.07)" : "rgba(56,189,248,0.07)",
    opacity: active ? 1 : 0.82,
    minWidth: 0,
    minHeight: 0,
    alignSelf: "stretch",
    display: "flex",
    flexDirection: "column",
  });

  const headerBar = (
    accent: "purple" | "cyan",
    active: boolean,
    title: string,
    statusLine: string,
    headerRight?: ReactNode
  ) => (
    <div
      role="button"
      tabIndex={0}
      onClick={() => c.setBuiltInBinaryTab(accent === "purple" ? "bundled" : "external")}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          c.setBuiltInBinaryTab(accent === "purple" ? "bundled" : "external");
        }
      }}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 12px",
        cursor: "pointer",
        outline: "none",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: accent === "purple" ? (active ? "#ddd6fe" : "var(--fg)") : active ? "#bae6fd" : "var(--fg)",
            }}
          >
            {title}
          </span>
          {active ? (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(34,197,94,0.2)",
                color: "#86efac",
              }}
            >
              查看中
            </span>
          ) : (
            <span style={{ fontSize: 9, color: "var(--muted2)" }}>点击标题区查看此侧</span>
          )}
        </div>
        <div style={{ fontSize: 10, color: "#86efac" }}>{statusLine}</div>
      </div>
      {headerRight != null ? (
        <div
          role="presentation"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          style={{
            flexShrink: 0,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 6,
            maxWidth: "58%",
            cursor: "default",
          }}
        >
          {headerRight}
        </div>
      ) : null}
    </div>
  );

  return (
    <div>
      <ConfigEditorModal open={configModalOpen} onClose={() => setConfigModalOpen(false)} />
      <NpmOpenClawUpgradeModal
        kind={npmUpgradeModalKind}
        open={npmUpgradeModalKind != null}
        onClose={() => setNpmUpgradeModalKind(null)}
        onCompared={(payload, k) => {
          if (k === "bundled") setBundledNpmHint(payload);
          else setExtNpmHint(payload);
        }}
      />
      <NodeRuntimeModal
        profile={nodeModalProfile ?? "bundled"}
        open={nodeModalProfile != null}
        onClose={() => setNodeModalProfile(null)}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <DetailsButton label="内置 / 外置 OpenClaw 详情" popoverAlign="end" buttonMarginLeft={0}>
          <OpenClawModeDetails />
        </DetailsButton>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div style={cardShell(bundledActive, "purple")}>
          {headerBar(
            "purple",
            bundledActive,
            "内置 OpenClaw",
            c.hasBundledOpenClaw
              ? `已就绪${c.bundledOpenClawVersion ? ` · ${c.bundledOpenClawVersion}` : ""}`
              : "未检测到"
          )}
          <div
            style={{
              padding: "8px 12px 12px",
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <CardWebUiCorner
              accent="purple"
              engineReady={c.hasBundledOpenClaw}
              gatewayRunning={bundledGatewayRunning}
              gatewayShowStart={c.hasBundledOpenClaw && !c.isRunning}
              gatewayShowStop={c.hasBundledOpenClaw && bundledGatewayRunning}
              onGatewayStart={() => void c.startGateway("bundled")}
              onGatewayStop={() => void c.stopGateway("bundled")}
              gatewayStartPending={c.startingGatewayMode === "bundled"}
              gatewayStopPending={c.stoppingGatewayMode === "bundled"}
              gatewayActionHint={
                c.gatewayCardMessage?.mode === "bundled" ? c.gatewayCardMessage.text : null
              }
              advancedPanel={(close) => (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      setNodeModalProfile("bundled");
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid rgba(167,139,250,0.4)",
                      background: "rgba(167,139,250,0.08)",
                      color: "#ddd6fe",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    Node 运行时…
                  </button>
                  {c.hasBundledOpenClaw || c.hasEmbeddedNode || c.hasSystemNpm ? (
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        setNpmUpgradeModalKind("bundled");
                      }}
                      disabled={c.installing || c.uninstalling || c.nodeInstalling}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid rgba(167,139,250,0.4)",
                        background: "rgba(167,139,250,0.06)",
                        color: "#ddd6fe",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: c.installing || c.uninstalling || c.nodeInstalling ? "not-allowed" : "pointer",
                        textAlign: "left",
                      }}
                    >
                      版本与升级…
                    </button>
                  ) : null}
                  {c.cliSource === "global" ? (
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        void c.uninstallNpmClaw("openclaw", "OpenClaw");
                      }}
                      disabled={c.uninstalling || c.installing || c.isRunning}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid rgba(251,146,60,0.45)",
                        background: "rgba(251,146,60,0.06)",
                        color: "#fdba74",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: c.uninstalling || c.installing || c.isRunning ? "not-allowed" : "pointer",
                        textAlign: "left",
                      }}
                    >
                      清理全局 openclaw
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      c.openBuiltInConfigTab("bundled");
                      setConfigModalOpen(true);
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--btn-border)",
                      background: "rgba(59,130,246,0.1)",
                      color: "#93c5fd",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    配置 openclaw.json…
                  </button>
                  {(c.hasBundledOpenClaw || c.hasEmbeddedNode || c.hasSystemNpm) && bundledNpmHintLive ? (
                    <div
                      style={{
                        fontSize: 9,
                        color:
                          bundledNpmHintLive.cmp === "upgradeAvailable"
                            ? "#fcd34d"
                            : bundledNpmHintLive.cmp === "same"
                              ? "#86efac"
                              : "var(--muted2)",
                        marginTop: 4,
                        lineHeight: 1.45,
                        padding: "6px 8px",
                        borderRadius: 8,
                        background: "rgba(0,0,0,0.15)",
                      }}
                    >
                      {bundledNpmHintLive.cmp === "same"
                        ? `npm ${bundledNpmHintLive.latest} · 与当前一致`
                        : bundledNpmHintLive.cmp === "upgradeAvailable"
                          ? `npm ${bundledNpmHintLive.latest} · 可升级（见「版本与升级」）`
                          : bundledNpmHintLive.cmp === "localNewer"
                            ? `npm ${bundledNpmHintLive.latest} · 本地不低于 registry`
                            : `npm ${bundledNpmHintLive.latest} · 版本对比见弹窗`}
                    </div>
                  ) : null}
                </>
              )}
            />
          </div>
        </div>

        <div style={cardShell(externalActive, "cyan")}>
          {headerBar(
            "cyan",
            externalActive,
            "外置 OpenClaw",
            !externalGatewayCliReady
              ? "未检测到 CLI"
              : c.hasExternalManagedOpenClaw
                ? `ClawHeart 前缀${c.externalOpenClawVersion ? ` · ${c.externalOpenClawVersion}` : ""}`
                : `本机 OpenClaw${c.externalOpenClawVersion ? ` · ${c.externalOpenClawVersion}` : ""}`,
            <>
              <ExternalOpenClawInstallPills />
              <DetailsButton label="完整路径与 CLI" popoverAlign="end" buttonMarginLeft={0}>
                <ExternalOpenClawPathsDetail />
              </DetailsButton>
            </>
          )}
          <div
            style={{
              padding: "8px 12px 12px",
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <CardWebUiCorner
              accent="cyan"
              engineReady={externalGatewayCliReady}
              gatewayRunning={externalGatewayRunning}
              gatewayShowStart={externalGatewayCliReady && !c.isRunning}
              gatewayShowStop={externalGatewayCliReady && externalGatewayRunning}
              onGatewayStart={() => void c.startGateway("external")}
              onGatewayStop={() => void c.stopGateway("external")}
              gatewayStartPending={c.startingGatewayMode === "external"}
              gatewayStopPending={c.stoppingGatewayMode === "external"}
              gatewayActionHint={
                c.gatewayCardMessage?.mode === "external" ? c.gatewayCardMessage.text : null
              }
              advancedPanel={(close) => (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      setNodeModalProfile("external");
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid rgba(56,189,248,0.4)",
                      background: "rgba(56,189,248,0.08)",
                      color: "#bae6fd",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    Node 运行时…
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      setExternalScanBusy(true);
                      void c.refresh().finally(() => setExternalScanBusy(false));
                    }}
                    disabled={externalScanBusy || c.installing || c.uninstalling || c.nodeInstalling}
                    title="重新扫描 PATH、npm 全局等"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid rgba(56,189,248,0.35)",
                      background: "rgba(56,189,248,0.05)",
                      color: "#bae6fd",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor:
                        externalScanBusy || c.installing || c.uninstalling || c.nodeInstalling ? "not-allowed" : "pointer",
                      textAlign: "left",
                      opacity: externalScanBusy || c.installing || c.uninstalling || c.nodeInstalling ? 0.55 : 1,
                    }}
                  >
                    {externalScanBusy ? "扫描中…" : "扫描本机 OpenClaw"}
                  </button>
                  {!c.hasExternalManagedOpenClaw ? (
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        void c.installOpenClawExternal();
                      }}
                      disabled={
                        c.installing ||
                        c.uninstalling ||
                        c.nodeInstalling ||
                        (!c.hasEmbeddedNode && !c.hasExternalGatewayNode && !c.hasSystemNpm)
                      }
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid rgba(34,197,94,0.4)",
                        background: "rgba(34,197,94,0.08)",
                        color: "#bbf7d0",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor:
                          c.installing ||
                          c.uninstalling ||
                          c.nodeInstalling ||
                          (!c.hasEmbeddedNode && !c.hasExternalGatewayNode && !c.hasSystemNpm)
                            ? "not-allowed"
                            : "pointer",
                        textAlign: "left",
                      }}
                    >
                      {c.installing ? "安装中…" : "安装到 ClawHeart 前缀…"}
                    </button>
                  ) : null}
                  {c.hasExternalManagedOpenClaw ? (
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        setNpmUpgradeModalKind("external");
                      }}
                      disabled={c.installing || c.uninstalling || c.nodeInstalling}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid rgba(56,189,248,0.4)",
                        background: "rgba(56,189,248,0.06)",
                        color: "#bae6fd",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: c.installing || c.uninstalling || c.nodeInstalling ? "not-allowed" : "pointer",
                        textAlign: "left",
                      }}
                    >
                      版本与升级…
                    </button>
                  ) : null}
                  {c.hasExternalManagedOpenClaw ? (
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        void c.uninstallNpmClaw("openclaw", "OpenClaw 外置", { uninstallTarget: "clawheart-external" });
                      }}
                      disabled={c.uninstalling || c.installing || c.isRunning}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid rgba(251,146,60,0.45)",
                        background: "rgba(251,146,60,0.06)",
                        color: "#fdba74",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: c.uninstalling || c.installing || c.isRunning ? "not-allowed" : "pointer",
                        textAlign: "left",
                      }}
                    >
                      卸载 ClawHeart 外置…
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      c.openBuiltInConfigTab("external");
                      setConfigModalOpen(true);
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--btn-border)",
                      background: "rgba(59,130,246,0.1)",
                      color: "#93c5fd",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    配置 openclaw.json…
                  </button>
                  {c.hasExternalManagedOpenClaw && extNpmHintLive ? (
                    <div
                      style={{
                        fontSize: 9,
                        color:
                          extNpmHintLive.cmp === "upgradeAvailable"
                            ? "#fcd34d"
                            : extNpmHintLive.cmp === "same"
                              ? "#86efac"
                              : "var(--muted2)",
                        marginTop: 4,
                        lineHeight: 1.45,
                        padding: "6px 8px",
                        borderRadius: 8,
                        background: "rgba(0,0,0,0.15)",
                      }}
                    >
                      {extNpmHintLive.cmp === "same"
                        ? `npm ${extNpmHintLive.latest} · 与当前一致`
                        : extNpmHintLive.cmp === "upgradeAvailable"
                          ? `npm ${extNpmHintLive.latest} · 可升级（见「版本与升级」）`
                          : extNpmHintLive.cmp === "localNewer"
                            ? `npm ${extNpmHintLive.latest} · 本地不低于 registry`
                            : `npm ${extNpmHintLive.latest} · 版本对比见弹窗`}
                    </div>
                  ) : null}
                </>
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfigEditorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="关闭"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1060,
          border: "none",
          background: "rgba(0,0,0,0.45)",
          cursor: "default",
        }}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="openclaw-config-editor-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1070,
          width: "min(920px, 96vw)",
          maxHeight: "min(92vh, 900px)",
          overflow: "auto",
          padding: "18px 20px 20px",
          borderRadius: 14,
          border: "1px solid var(--panel-border)",
          background: "var(--panel-bg)",
          color: "var(--fg)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 14,
            flexWrap: "wrap",
          }}
        >
          <div id="openclaw-config-editor-title" style={{ fontSize: 15, fontWeight: 700, color: "var(--fg)" }}>
            配置编辑
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid var(--btn-border)",
              background: "var(--panel-bg2)",
              color: "var(--muted)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            关闭
          </button>
        </div>
        <BuiltInConfigSubTab variant="modal" />
      </div>
    </>
  );
}

function BuiltInConfigSubTab({ variant = "panel" }: { variant?: "panel" | "modal" }) {
  const c = useClawMgmt();
  const configWorkspaceLabel =
    c.builtInBinaryTab === "bundled" ? "应用内（与 ~/.openclaw 分离）" : "~/.openclaw";

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            当前：<strong style={{ color: "var(--fg)" }}>{configWorkspaceLabel}</strong>
          </span>
          <DetailsButton label="配置与 Gateway 关系">
            <ConfigWorkspaceExplainer />
          </DetailsButton>
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8, wordBreak: "break-all" }}>
          <code style={{ fontSize: 10, color: "#60a5fa" }}>{c.configPath}</code>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => c.saveConfig()}
            disabled={c.configSaving}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "none",
              background: c.configSaving ? "#065f46" : "#22c55e",
              color: "#022c22",
              fontSize: 11,
              fontWeight: 700,
              cursor: c.configSaving ? "not-allowed" : "pointer",
            }}
          >
            {c.configSaving ? "保存中…" : "保存"}
          </button>
          <button
            type="button"
            onClick={() => c.restartGateway()}
            disabled={c.configSaving}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid rgba(251,191,36,0.5)",
              background: "transparent",
              color: "#fbbf24",
              fontSize: 11,
              fontWeight: 600,
              cursor: c.configSaving ? "not-allowed" : "pointer",
            }}
          >
            重启 Gateway
          </button>
          <button
            type="button"
            onClick={() => c.formatJson()}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid var(--btn-border)",
              background: "transparent",
              color: "var(--muted)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            格式化
          </button>
          <button
            type="button"
            onClick={() => c.reloadConfig()}
            disabled={c.configLoading}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: "1px solid var(--btn-border)",
              background: "transparent",
              color: "var(--muted)",
              fontSize: 11,
              fontWeight: 600,
              cursor: c.configLoading ? "not-allowed" : "pointer",
            }}
          >
            {c.configLoading ? "加载…" : "重新加载"}
          </button>
          {c.message ? <span style={{ fontSize: 11, color: "#4ade80" }}>{c.message}</span> : null}
        </div>
      </div>

      <textarea
        value={c.configJson}
        onChange={(e) => c.setConfigJson(e.target.value)}
        spellCheck={false}
        style={{
          width: "100%",
          height: variant === "modal" ? "42vh" : 520,
          maxHeight: variant === "modal" ? 440 : undefined,
          minHeight: variant === "modal" ? 200 : undefined,
          padding: "12px",
          borderRadius: 8,
          border: "1px solid var(--panel-border)",
          background: "var(--panel-bg)",
          color: "var(--fg)",
          fontSize: 11,
          fontFamily: "Consolas, Monaco, 'Courier New', monospace",
          lineHeight: 1.6,
          resize: "vertical",
        }}
      />

      <div
        style={{
          marginTop: 10,
          fontSize: 10,
          color: "#93c5fd",
          lineHeight: 1.55,
        }}
      >
        保存后需重启 Gateway。
        <a
          href="https://docs.openclaw.ai/gateway/configuration-reference"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#60a5fa", marginLeft: 8, textDecoration: "underline" }}
        >
          配置文档
        </a>
      </div>
    </div>
  );
}
