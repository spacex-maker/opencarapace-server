import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { CSSProperties } from "react";
import { useClawMgmt } from "./context";
import {
  compareOpenClawLocalToNpmLatest,
  extractOpenClawSemverLike,
  type OpenClawVersionCompare,
} from "./openclawVersionCompare";

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

function OpenClawModeDetails() {
  const c = useClawMgmt();
  return (
    <>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12 }}>页签与记录</div>
      <div style={{ color: "var(--muted)", marginBottom: 14 }}>
        在下方两张并排卡片中点击<strong>标题区</strong>选用 <strong>内置 OpenClaw</strong> 或 <strong>外置 OpenClaw</strong>；配置目录与{" "}
        <code style={{ fontSize: 10 }}>OPENCLAW_*</code> 随所选卡片切换。
        {c.isRunning ? (
          <span style={{ color: "#fbbf24", fontWeight: 600 }}> 首次请配 LLM。</span>
        ) : null}
      </div>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12 }}>记录模式</div>
      <div style={{ color: "var(--muted)", marginBottom: 14 }}>
        当前持久化：
        <strong style={{ color: "#93c5fd" }}>
          {c.gatewayOpenclawBinary === "external" ? "外置 OpenClaw" : "内置 OpenClaw"}
        </strong>
        · 启动 Gateway 时与当前所选卡片对齐
      </div>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12 }}>内置 OpenClaw（总览）</div>
      <div style={{ color: "var(--muted)", marginBottom: 14 }}>
        OpenClaw 与 <code style={{ fontSize: 10 }}>openclaw.json</code> 在<strong>应用内隔离目录</strong>，与{" "}
        <code style={{ fontSize: 10 }}>~/.openclaw</code> 分离；Node 由安装包或面板提供，不依赖 PATH 上的全局{" "}
        <code style={{ fontSize: 10 }}>openclaw</code>。
      </div>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12 }}>外置 OpenClaw（总览）</div>
      <div style={{ color: "var(--muted)", marginBottom: 14 }}>
        在用户环境按惯例使用 <code style={{ fontSize: 10 }}>~/.openclaw</code>；需本机 Node/npm。CLI 安装在{" "}
        <code style={{ fontSize: 10 }}>.opencarapace/external-openclaw</code>（仅二进制前缀，不是第二套配置根）。
        点卡片「配置」弹窗编辑与 Gateway 的 <code style={{ fontSize: 10 }}>OPENCLAW_*</code> 随所选卡片在应用内目录与{" "}
        <code style={{ fontSize: 10 }}>~/.openclaw</code> 之间切换。
      </div>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12 }}>内置卡片 · Gateway</div>
      <div style={{ color: "var(--muted)", marginBottom: 12 }}>
        只使用应用包或工程内的 OpenClaw，<strong>不会</strong>用 PATH 上的全局{" "}
        <code style={{ fontSize: 10 }}>openclaw</code>。若「CLI 来源」显示全局，表示本机另有安装，与内置启动无关；要用用户环境 CLI
        请选外置卡片。
      </div>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12 }}>内置卡片 · openclaw.json</div>
      <div style={{ color: "var(--muted)", marginBottom: 14 }}>
        应用内隔离目录，与 <code style={{ fontSize: 10 }}>~/.openclaw</code> 不混用；与 Gateway 注入的{" "}
        <code style={{ fontSize: 10 }}>OPENCLAW_CONFIG_PATH</code> 一致。
      </div>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12 }}>外置卡片 · Gateway</div>
      <div style={{ color: "var(--muted)", marginBottom: 12 }}>
        使用用户环境 Node/npm；CLI 在 prefix，<code style={{ fontSize: 10 }}>openclaw.json</code> 在{" "}
        <code style={{ fontSize: 10 }}>~/.openclaw</code>。子进程日志见底部「Gateway 诊断」（内置 / 外置 Tab 与上方卡片同步）。
        {c.userEnvironmentOpenClaw ? (
          <>
            <br />
            <br />
            本机另有探测到的 <code style={{ fontSize: 10 }}>openclaw</code>：
            <br />
            <code style={{ fontSize: 9, wordBreak: "break-all" }}>{c.userEnvironmentOpenClaw.binPath}</code>
            {c.userEnvironmentOpenClaw.version ? `（${c.userEnvironmentOpenClaw.version}）` : ""}
            <br />
            外置 Gateway 仍使用 prefix 下二进制；未装入 prefix 时需点「安装到 prefix」。
          </>
        ) : null}
      </div>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12 }}>外置卡片 · openclaw.json</div>
      <div style={{ color: "var(--muted)" }}>
        标准 <code style={{ fontSize: 10 }}>~/.openclaw</code>；{" "}
        <code style={{ fontSize: 10 }}>.opencarapace/external-openclaw</code> 仅为 npm 安装前缀。
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
          width: "min(480px, 94vw)",
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
            <div style={{ fontWeight: 700, fontSize: 14, color: accent, marginBottom: 4 }}>
              {bundled ? "内置 OpenClaw · Node" : "外置 OpenClaw · Node"}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted2)", lineHeight: 1.45 }}>
              推荐版本系列 · Node v{targetVer}（与 OpenClaw 要求一致）
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
                  状态：{hasDl ? `已安装（v${targetVer} 发行包）` : "未安装"}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {!hasDl ? (
                    <button
                      type="button"
                      onClick={() => void c.installRuntimeNode("bundled")}
                      disabled={c.nodeInstalling}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 999,
                        border: "1px solid rgba(34,197,94,0.4)",
                        background: "rgba(34,197,94,0.12)",
                        color: "#bbf7d0",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: c.nodeInstalling ? "not-allowed" : "pointer",
                      }}
                    >
                      {c.nodeInstalling ? "安装中…" : "下载并安装"}
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
            <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.55, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6, color: accent }}>本机 PATH（系统）</div>
              Node：{sysNode || "—"} · npm：{sysNpmOk ? "可用" : "不可用"}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>外置专用下载目录</div>
            <div style={{ fontSize: 10, color: "var(--muted2)", marginBottom: 8, lineHeight: 1.5 }}>{dirHint}</div>
            <div style={{ fontSize: 11, color: hasDl ? "#86efac" : "var(--muted)", marginBottom: 10 }}>
              状态：{hasDl ? `已安装（v${targetVer} 发行包）` : "未安装"}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {!hasDl ? (
                <button
                  type="button"
                  onClick={() => void c.installRuntimeNode("external")}
                  disabled={c.nodeInstalling}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: "1px solid rgba(34,197,94,0.4)",
                    background: "rgba(34,197,94,0.12)",
                    color: "#bbf7d0",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: c.nodeInstalling ? "not-allowed" : "pointer",
                  }}
                >
                  {c.nodeInstalling ? "安装中…" : "下载并安装"}
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
            <div style={{ fontSize: 10, color: "var(--muted2)", marginTop: 12, lineHeight: 1.5 }}>
              外置 npm / Gateway 会优先使用此目录下的 Node；否则依次尝试内置卡已下载 Node、系统 npm。
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

/** 卡片右下角：Web UI 在浏览器打开；仅当本卡 Gateway 在跑时可点 */
function CardWebUiCorner({
  accent,
  engineReady,
  gatewayRunning,
}: {
  accent: "purple" | "cyan";
  engineReady: boolean;
  gatewayRunning: boolean;
}) {
  const c = useClawMgmt();
  const topBorder =
    accent === "purple" ? "1px solid rgba(167,139,250,0.35)" : "1px solid rgba(56,189,248,0.35)";

  return (
    <div style={{ marginTop: "auto", paddingTop: 12, borderTop: topBorder }}>
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
            点本卡「配置」填写提供商，否则 Web UI 聊天可能 401。
          </div>
        </div>
      ) : null}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {gatewayRunning ? (
          <a
            href={c.uiUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "none",
              background: "#3b82f6",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            浏览器打开 Web UI
          </a>
        ) : (
          <span style={{ fontSize: 10, color: "var(--muted2)" }}>
            {engineReady ? "先启动本卡 Gateway" : "引擎未就绪"}
          </span>
        )}
        <DetailsButton label="为什么在浏览器打开" popoverAlign="end" buttonMarginLeft={0}>
          <UiOpenExplainer />
        </DetailsButton>
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
  /** 同一 Gateway 实例；就绪以进程命令行（openclaw + gateway run）为准；与「记录模式」对齐后才视为该侧在跑 */
  const gwBundled = c.gatewayOpenclawBinary === "bundled";
  const gwExternal = c.gatewayOpenclawBinary === "external";
  const bundledGatewayRunning = c.isRunning && gwBundled;
  const externalGatewayRunning = c.isRunning && gwExternal;

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

  const headerBar = (accent: "purple" | "cyan", active: boolean, title: string, statusLine: string) => (
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
        gap: 8,
        padding: "10px 12px",
        cursor: "pointer",
        borderBottom:
          accent === "purple" ? "1px solid rgba(167,139,250,0.35)" : "1px solid rgba(56,189,248,0.35)",
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
              当前
            </span>
          ) : (
            <span style={{ fontSize: 9, color: "var(--muted2)" }}>点击标题区选用</span>
          )}
        </div>
        <div style={{ fontSize: 10, color: "#86efac" }}>{statusLine}</div>
      </div>
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
              padding: "10px 12px 12px",
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>openclaw.json</div>
              {c.openClawDiscovery ? (
                <code style={{ fontSize: 9, color: "#93c5fd", wordBreak: "break-all", lineHeight: 1.5 }}>
                  {c.openClawDiscovery.managed.configPath}
                </code>
              ) : (
                <span style={{ fontSize: 10, color: "var(--muted2)" }}>载入中…</span>
              )}
            </div>
            <div
              style={{
                borderTop: "1px solid rgba(167,139,250,0.35)",
                paddingTop: 12,
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 600, color: "#ddd6fe", marginBottom: 8 }}>Gateway</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 8 }}>
                CLI：{c.hasBundledOpenClaw ? "可用" : "不可用"} · {c.cliSourceLabel}
                {c.openClawDiscovery?.openClawMacApp ? (
                  <span style={{ color: "var(--muted2)" }}> · App: {c.openClawDiscovery.openClawMacApp}</span>
                ) : null}
              </div>
              <div
                style={{
                  fontSize: 10,
                  marginBottom: 10,
                  lineHeight: 1.5,
                  color: bundledGatewayRunning ? "#86efac" : c.isRunning ? "#fbbf24" : "var(--muted2)",
                }}
              >
                {bundledGatewayRunning
                  ? "本卡：Gateway 运行中（已检测到 gateway run 进程）"
                  : c.isRunning
                    ? "本卡：未由本侧启动（当前为外置模式；请在外置卡停止后再用内置启动）"
                    : "本卡：Gateway 未运行"}
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <button
                type="button"
                onClick={() => setNodeModalProfile("bundled")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(167,139,250,0.45)",
                  background: "rgba(167,139,250,0.10)",
                  color: "#ddd6fe",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Node
              </button>
              {c.hasBundledOpenClaw || c.hasEmbeddedNode || c.hasSystemNpm ? (
                <button
                  type="button"
                  onClick={() => setNpmUpgradeModalKind("bundled")}
                  disabled={c.installing || c.uninstalling || c.nodeInstalling}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(167,139,250,0.45)",
                    background: "rgba(167,139,250,0.12)",
                    color: "#ddd6fe",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: c.installing || c.uninstalling || c.nodeInstalling ? "not-allowed" : "pointer",
                  }}
                >
                  版本与升级
                </button>
              ) : null}
              {c.hasBundledOpenClaw && !c.isRunning ? (
                <button
                  type="button"
                  onClick={() => void c.startGateway("bundled")}
                  disabled={c.startingGatewayMode != null}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(34,197,94,0.35)",
                    background: "rgba(34,197,94,0.10)",
                    color: "#bbf7d0",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: c.startingGatewayMode != null ? "not-allowed" : "pointer",
                  }}
                >
                  {c.startingGatewayMode === "bundled" ? "启动中…" : "启动 Gateway"}
                </button>
              ) : null}
              {c.hasBundledOpenClaw && bundledGatewayRunning ? (
                <button
                  type="button"
                  onClick={() => void c.stopGateway("bundled")}
                  disabled={c.stoppingGatewayMode != null}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(239,68,68,0.35)",
                    background: "rgba(239,68,68,0.08)",
                    color: "#fca5a5",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: c.stoppingGatewayMode != null ? "not-allowed" : "pointer",
                  }}
                >
                  {c.stoppingGatewayMode === "bundled" ? "停止中…" : "停止"}
                </button>
              ) : null}
              {c.cliSource === "global" ? (
                <button
                  type="button"
                  onClick={() => void c.uninstallNpmClaw("openclaw", "OpenClaw")}
                  disabled={c.uninstalling || c.installing || c.isRunning}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(251,146,60,0.4)",
                    background: "rgba(251,146,60,0.08)",
                    color: "#fdba74",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: c.uninstalling || c.installing || c.isRunning ? "not-allowed" : "pointer",
                  }}
                >
                  清理全局 openclaw
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  c.openBuiltInConfigTab("bundled");
                  setConfigModalOpen(true);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid var(--btn-border)",
                  background: "rgba(59,130,246,0.12)",
                  color: "#93c5fd",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                配置
              </button>
            </div>
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
                  marginTop: 6,
                  lineHeight: 1.45,
                }}
              >
                {bundledNpmHintLive.cmp === "same"
                  ? `npm latest ${bundledNpmHintLive.latest} · 与当前解析版本一致（可在弹窗内重新查询）`
                  : bundledNpmHintLive.cmp === "upgradeAvailable"
                    ? `npm latest ${bundledNpmHintLive.latest} · 可升级，请打开「版本与升级」确认`
                    : bundledNpmHintLive.cmp === "localNewer"
                      ? `npm latest ${bundledNpmHintLive.latest} · 本地版本号不低于 registry`
                      : `npm latest ${bundledNpmHintLive.latest} · 版本号对比不确定，请以弹窗内原文为准`}
              </div>
            ) : null}
            <CardWebUiCorner
              accent="purple"
              engineReady={c.hasBundledOpenClaw}
              gatewayRunning={bundledGatewayRunning}
            />
          </div>
        </div>

        <div style={cardShell(externalActive, "cyan")}>
          {headerBar(
            "cyan",
            externalActive,
            "外置 OpenClaw",
            c.hasExternalManagedOpenClaw
              ? `prefix${c.externalOpenClawVersion ? ` · ${c.externalOpenClawVersion}` : ""}`
              : c.userEnvironmentOpenClaw
                ? "本机已有 · 未进 prefix"
                : "未安装"
          )}
          <div
            style={{
              padding: "10px 12px 12px",
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>openclaw.json</div>
              {c.openClawDiscovery ? (
                <code style={{ fontSize: 9, color: "#93c5fd", wordBreak: "break-all", lineHeight: 1.5 }}>
                  {c.openClawDiscovery.userProfile.configPath}
                </code>
              ) : (
                <span style={{ fontSize: 10, color: "var(--muted2)" }}>载入中…</span>
              )}
            </div>
            <div
              style={{
                borderTop: "1px solid rgba(56,189,248,0.35)",
                paddingTop: 12,
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 600, color: "#bae6fd", marginBottom: 8 }}>CLI 与 Gateway</div>
              <div style={{ fontSize: 10, color: "var(--muted2)", lineHeight: 1.55, marginBottom: 8 }}>
                prefix:{" "}
                <code style={{ fontSize: 9, color: "#93c5fd", wordBreak: "break-all" }}>
                  {c.externalOpenClawNpmPrefix || "…"}
                </code>
                {c.externalOpenClawBinPath ? (
                  <>
                    <br />
                    bin: <code style={{ fontSize: 9, color: "#93c5fd", wordBreak: "break-all" }}>{c.externalOpenClawBinPath}</code>
                  </>
                ) : null}
                {c.userEnvironmentOpenClaw && !c.hasExternalManagedOpenClaw ? (
                  <div style={{ marginTop: 6, color: "var(--muted)" }}>
                    探测到其它安装{c.userEnvironmentOpenClaw.version ? ` · ${c.userEnvironmentOpenClaw.version}` : ""}
                    （见「详情」）
                  </div>
                ) : null}
              </div>
              <div
                style={{
                  fontSize: 10,
                  marginBottom: 10,
                  lineHeight: 1.5,
                  color: externalGatewayRunning ? "#86efac" : c.isRunning ? "#fbbf24" : "var(--muted2)",
                }}
              >
                {externalGatewayRunning
                  ? "本卡：Gateway 运行中（已检测到 gateway run 进程）"
                  : c.isRunning
                    ? "本卡：未由本侧启动（当前为内置模式；请在内置卡停止后再用外置启动）"
                    : "本卡：Gateway 未运行"}
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <button
                type="button"
                onClick={() => setNodeModalProfile("external")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(56,189,248,0.45)",
                  background: "rgba(56,189,248,0.10)",
                  color: "#bae6fd",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Node
              </button>
              {!c.hasExternalManagedOpenClaw ? (
                <>
                  <button
                    type="button"
                    onClick={() => void c.installOpenClawExternal()}
                    disabled={
                      c.installing ||
                      c.uninstalling ||
                      c.nodeInstalling ||
                      (!c.hasEmbeddedNode && !c.hasExternalGatewayNode && !c.hasSystemNpm)
                    }
                    style={{
                      padding: "6px 12px",
                      borderRadius: 999,
                      border: "1px solid rgba(34,197,94,0.35)",
                      background: "rgba(34,197,94,0.12)",
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
                    }}
                  >
                    {c.installing ? "安装中…" : "安装到 prefix"}
                  </button>
                </>
              ) : null}
              {c.hasExternalManagedOpenClaw ? (
                <button
                  type="button"
                  onClick={() => setNpmUpgradeModalKind("external")}
                  disabled={c.installing || c.uninstalling || c.nodeInstalling}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(56,189,248,0.45)",
                    background: "rgba(56,189,248,0.12)",
                    color: "#bae6fd",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: c.installing || c.uninstalling || c.nodeInstalling ? "not-allowed" : "pointer",
                  }}
                >
                  版本与升级
                </button>
              ) : null}
              {c.hasExternalManagedOpenClaw && !c.isRunning ? (
                <button
                  type="button"
                  onClick={() => void c.startGateway("external")}
                  disabled={c.startingGatewayMode != null}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(34,197,94,0.35)",
                    background: "rgba(34,197,94,0.10)",
                    color: "#bbf7d0",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: c.startingGatewayMode != null ? "not-allowed" : "pointer",
                  }}
                >
                  {c.startingGatewayMode === "external" ? "启动中…" : "启动 Gateway"}
                </button>
              ) : null}
              {c.hasExternalManagedOpenClaw && externalGatewayRunning ? (
                <button
                  type="button"
                  onClick={() => void c.stopGateway("external")}
                  disabled={c.stoppingGatewayMode != null}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(239,68,68,0.35)",
                    background: "rgba(239,68,68,0.08)",
                    color: "#fca5a5",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: c.stoppingGatewayMode != null ? "not-allowed" : "pointer",
                  }}
                >
                  {c.stoppingGatewayMode === "external" ? "停止中…" : "停止"}
                </button>
              ) : null}
              {c.hasExternalManagedOpenClaw ? (
                <button
                  type="button"
                  onClick={() =>
                    void c.uninstallNpmClaw("openclaw", "OpenClaw 外置", { uninstallTarget: "clawheart-external" })
                  }
                  disabled={c.uninstalling || c.installing || c.isRunning}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(251,146,60,0.4)",
                    background: "rgba(251,146,60,0.08)",
                    color: "#fdba74",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: c.uninstalling || c.installing || c.isRunning ? "not-allowed" : "pointer",
                  }}
                >
                  卸载
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  c.openBuiltInConfigTab("external");
                  setConfigModalOpen(true);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid var(--btn-border)",
                  background: "rgba(59,130,246,0.12)",
                  color: "#93c5fd",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                配置
              </button>
            </div>
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
                  marginTop: 6,
                  lineHeight: 1.45,
                }}
              >
                {extNpmHintLive.cmp === "same"
                  ? `npm latest ${extNpmHintLive.latest} · 与当前解析版本一致（可在弹窗内重新查询）`
                  : extNpmHintLive.cmp === "upgradeAvailable"
                    ? `npm latest ${extNpmHintLive.latest} · 可升级，请打开「版本与升级」确认`
                    : extNpmHintLive.cmp === "localNewer"
                      ? `npm latest ${extNpmHintLive.latest} · 本地版本号不低于 registry`
                      : `npm latest ${extNpmHintLive.latest} · 版本号对比不确定，请以弹窗内原文为准`}
              </div>
            ) : null}
            <CardWebUiCorner
              accent="cyan"
              engineReady={c.hasExternalManagedOpenClaw}
              gatewayRunning={externalGatewayRunning}
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
