import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  EMBEDDED_STATUS_URL,
  NODE_STATUS_URL,
  INSTALL_PROGRESS_URL,
  INSTALL_NODE_PROGRESS_URL,
} from "./constants";
import { buildOpenClawSharedTaskLogText, formatNodeRuntimeInstallBlock } from "./logMerge";
import type {
  ClawEnvironment,
  ClawInventoryEntry,
  ClawMainTab,
  ClawWorkspaceTarget,
  ExternalOpenClawBinSource,
  ExternalOpenClawInstallTag,
  ExternalWorkspaceTarget,
  GatewayOpenclawBinary,
  OpenClawCliSource,
  OpenClawDiscovery,
  OpenClawInstallDiag,
  GatewayPortConflict,
} from "./types";

function gatewayPortConflictFromServer(raw: unknown): GatewayPortConflict | null {
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const port = typeof o.port === "number" ? o.port : Number(o.port);
  if (!Number.isFinite(port) || port <= 0) return null;
  const pidN = o.pid != null && o.pid !== "" ? Number(o.pid) : NaN;
  const pid = Number.isFinite(pidN) && pidN > 0 ? pidN : undefined;
  const amb =
    typeof o.ambiguousListenerCount === "number" && Number.isFinite(o.ambiguousListenerCount)
      ? o.ambiguousListenerCount
      : undefined;
  return {
    port,
    pid,
    processName: typeof o.processName === "string" ? o.processName : "unknown",
    bindAddress: typeof o.bindAddress === "string" ? o.bindAddress : undefined,
    commandLineHint: typeof o.commandLineHint === "string" ? o.commandLineHint : undefined,
    source: typeof o.source === "string" ? o.source : undefined,
    ambiguousListenerCount: amb,
  };
}

export interface ClawMgmtCoreValue {
  mainTab: ClawMainTab;
  setMainTab: (t: ClawMainTab) => void;
  loading: boolean;
  error: string | null;
  message: string | null;
  hasEmbedded: boolean;
  hasBundledOpenClaw: boolean;
  /** 内置卡 openclaw CLI（工程 / 打包路径）的 --version；非 project-modules·packaged 时为 null */
  bundledOpenClawVersion: string | null;
  hasExternalManagedOpenClaw: boolean;
  externalOpenClawNpmPrefix: string;
  /** 磁盘上是否存在 ClawHeart 外置 prefix 目录（卸载后常为 false）；旧服务端未返回时为 null */
  externalOpenClawPrefixDirExists: boolean | null;
  /** 磁盘上是否存在 external-openclaw-runtime；旧服务端未返回时为 null */
  externalOpenClawRuntimeDirExists: boolean | null;
  /** ClawHeart npm 前缀内的 openclaw；无则为 null */
  externalManagedOpenClawBinPath: string | null;
  /** 外置 Gateway 实际会 spawn 的 openclaw（前缀优先，否则本机扫描） */
  externalOpenClawBinPath: string | null;
  externalOpenClawBinSource: ExternalOpenClawBinSource;
  /** 对应 externalOpenClawBinPath 的 --version */
  externalOpenClawVersion: string | null;
  /** 本机在 prefix 之外探测到的 openclaw（PATH 等） */
  userEnvironmentOpenClaw: { binPath: string; version: string | null; source: string | null } | null;
  /** prefix 内：客户端安装 / 用户标记 / 未记录；无 prefix 时为 null */
  externalOpenClawInstallTag: ExternalOpenClawInstallTag;
  /** 是否另有 PATH/其它路径下的 openclaw（与 prefix 并列） */
  hasUserEnvironmentOpenClawAside: boolean;
  /** 仅 UI：正在查看哪一侧（配置路径、诊断 Tab）；切换卡片不会改 DB，也不改变「哪侧在跑 Gateway」 */
  builtInBinaryTab: GatewayOpenclawBinary;
  setBuiltInBinaryTab: (t: GatewayOpenclawBinary) => void;
  /** 与服务端 DB 一致：最近一次成功 start-gateway 所用的侧；用于判断本卡是否真有 Gateway 在跑 */
  gatewayOpenclawBinary: GatewayOpenclawBinary;
  isRunning: boolean;
  localInstalled: boolean | null;
  localBinaryPath: string | null;
  openClawDiscovery: OpenClawDiscovery | null;
  clawEnvironment: ClawEnvironment | null;
  clawInstallations: ClawInventoryEntry[];
  otherClawInstallations: ClawInventoryEntry[];
  clawScannedAt: string | null;
  gatewayOpenclawTarget: ClawWorkspaceTarget;
  gatewayOpenclawTargetExternal: ExternalWorkspaceTarget;
  /** 当前页签下「配置编辑」：内置 → 应用内隔离；外置 → 标准 ~/.openclaw */
  activeOpenClawConfigTarget: "user-profile" | "clawheart-managed";
  cliSource: OpenClawCliSource;
  cliSourceLabel: string;
  uiUrl: string;
  /** 哪一侧正在启动 Gateway；null 表示未在启动 */
  startingGatewayMode: GatewayOpenclawBinary | null;
  /** 哪一侧正在停止 Gateway；null 表示未在停止 */
  stoppingGatewayMode: GatewayOpenclawBinary | null;
  /** 启动/停止 Gateway 成功等提示，按内置/外置卡片展示（非全局底栏） */
  gatewayCardMessage: { mode: GatewayOpenclawBinary; text: string } | null;
  installing: boolean;
  uninstalling: boolean;
  hasEmbeddedNode: boolean;
  /** 外置卡专用 ~/.opencarapace/external-gateway-node */
  hasExternalGatewayNode: boolean;
  /** 安装包 / 开发资源中的 node 可执行路径；无则为 null */
  packagedNodePath: string | null;
  hasSystemNpm: boolean;
  nodeInstalling: boolean;
  configJson: string;
  setConfigJson: (s: string) => void;
  configPath: string;
  configLoading: boolean;
  configSaving: boolean;
  /** 安装 / 卸载 / Node 下载等任务输出（与 Gateway 子进程诊断分 Tab 展示） */
  taskLog: string;
  /** 内置模式 Gateway 诊断（与服务端 openclaw-gateway-bundled 一致） */
  gatewayBundledLog: string;
  /** 外置模式 Gateway 诊断（与服务端 openclaw-gateway-external 一致） */
  gatewayExternalLog: string;
  gatewayLogFileBundled: string | null;
  gatewayLogFileExternal: string | null;
  /** Gateway 子进程诊断文本框（内容由 builtInBinaryTab 决定内置/外置侧） */
  gatewayDiagnosticConsoleRef: RefObject<HTMLTextAreaElement | null>;
  taskLogConsoleRef: RefObject<HTMLTextAreaElement | null>;
  refresh: () => Promise<void>;
  copyGatewayLog: () => Promise<void>;
  loadConfig: () => Promise<void>;
  saveConfig: () => Promise<void>;
  restartGateway: () => Promise<void>;
  formatJson: () => void;
  reloadConfig: () => Promise<void>;
  installOpenClaw: () => Promise<void>;
  installOpenClawExternal: () => Promise<void>;
  /** 与安装相同流程：npm install openclaw@latest --prefix（升级 prefix 内版本） */
  upgradeOpenClawExternal: () => Promise<void>;
  /** 查询 npm registry 上 openclaw 的 latest 版本（与外置安装同源 npm） */
  fetchOpenclawNpmLatestVersion: () => Promise<{ ok: boolean; latestVersion?: string; error?: string }>;
  installRuntimeNode: (profile: "bundled" | "external", opts?: { force?: boolean }) => Promise<void>;
  uninstallRuntimeNode: (profile: "bundled" | "external") => Promise<void>;
  /** @param mode 从指定卡片启动时传入，会先切换记录模式再请求启动 */
  startGateway: (mode?: GatewayOpenclawBinary) => Promise<void>;
  stopGateway: (mode?: GatewayOpenclawBinary) => Promise<void>;
  gatewayPortConflictBundled: GatewayPortConflict | null;
  gatewayPortConflictExternal: GatewayPortConflict | null;
  killingGatewayPortPid: number | null;
  killGatewayPortListener: (pid: number, conflictPort: number) => Promise<void>;
  uninstallNpmClaw: (
    npmPackage: string,
    label?: string,
    opts?: { uninstallTarget?: "default" | "clawheart-external" }
  ) => Promise<void>;
  openClawConfigForRow: (row: ClawInventoryEntry) => void;
  /** @param mode 从指定卡片打开配置时传入，会切换到对应内置/外置工作区再加载 */
  openBuiltInConfigTab: (mode?: GatewayOpenclawBinary) => void;
}

export function useClawMgmtCore(): ClawMgmtCoreValue {
  const [mainTab, setMainTab] = useState<ClawMainTab>("builtin");
  const [loading, setLoading] = useState(true);
  const [hasEmbedded, setHasEmbedded] = useState(false);
  const [hasBundledOpenClaw, setHasBundledOpenClaw] = useState(false);
  const [bundledOpenClawVersion, setBundledOpenClawVersion] = useState<string | null>(null);
  const [hasExternalManagedOpenClaw, setHasExternalManagedOpenClaw] = useState(false);
  const [externalOpenClawNpmPrefix, setExternalOpenClawNpmPrefix] = useState("");
  const [externalOpenClawPrefixDirExists, setExternalOpenClawPrefixDirExists] = useState<boolean | null>(null);
  const [externalOpenClawRuntimeDirExists, setExternalOpenClawRuntimeDirExists] = useState<boolean | null>(null);
  const [externalManagedOpenClawBinPath, setExternalManagedOpenClawBinPath] = useState<string | null>(null);
  const [externalOpenClawBinPath, setExternalOpenClawBinPath] = useState<string | null>(null);
  const [externalOpenClawBinSource, setExternalOpenClawBinSource] = useState<ExternalOpenClawBinSource>(null);
  const [externalOpenClawVersion, setExternalOpenClawVersion] = useState<string | null>(null);
  const [userEnvironmentOpenClaw, setUserEnvironmentOpenClaw] = useState<{
    binPath: string;
    version: string | null;
    source: string | null;
  } | null>(null);
  const [externalOpenClawInstallTag, setExternalOpenClawInstallTag] = useState<ExternalOpenClawInstallTag>(null);
  const [hasUserEnvironmentOpenClawAside, setHasUserEnvironmentOpenClawAside] = useState(false);
  const [builtInBinaryTab, setBuiltInBinaryTab] = useState<GatewayOpenclawBinary>("bundled");
  const [gatewayOpenclawBinary, setGatewayOpenclawBinary] = useState<GatewayOpenclawBinary>("bundled");
  const builtInTabInitRef = useRef(false);
  const [isRunning, setIsRunning] = useState(false);
  const [localInstalled, setLocalInstalled] = useState<boolean | null>(null);
  const [localBinaryPath, setLocalBinaryPath] = useState<string | null>(null);
  const [openClawDiscovery, setOpenClawDiscovery] = useState<OpenClawDiscovery | null>(null);
  const [clawEnvironment, setClawEnvironment] = useState<ClawEnvironment | null>(null);
  const [clawInstallations, setClawInstallations] = useState<ClawInventoryEntry[]>([]);
  const [clawScannedAt, setClawScannedAt] = useState<string | null>(null);
  const [gatewayOpenclawTarget, setGatewayOpenclawTarget] = useState<ClawWorkspaceTarget>("clawheart-managed");
  const [gatewayOpenclawTargetExternal, setGatewayOpenclawTargetExternal] =
    useState<ExternalWorkspaceTarget>("user-profile");
  const [cliSource, setCliSource] = useState<OpenClawCliSource>("none");
  const [uiUrl, setUiUrl] = useState("http://localhost:18789");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [startingGatewayMode, setStartingGatewayMode] = useState<GatewayOpenclawBinary | null>(null);
  const [stoppingGatewayMode, setStoppingGatewayMode] = useState<GatewayOpenclawBinary | null>(null);
  const [gatewayCardMessage, setGatewayCardMessage] = useState<{
    mode: GatewayOpenclawBinary;
    text: string;
  } | null>(null);
  const gatewayCardMessageClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showGatewayCardMessage = useCallback((mode: GatewayOpenclawBinary, text: string) => {
    if (gatewayCardMessageClearRef.current) {
      clearTimeout(gatewayCardMessageClearRef.current);
      gatewayCardMessageClearRef.current = null;
    }
    setGatewayCardMessage({ mode, text });
    gatewayCardMessageClearRef.current = setTimeout(() => {
      setGatewayCardMessage(null);
      gatewayCardMessageClearRef.current = null;
    }, 4000);
  }, []);

  const dismissGatewayCardMessage = useCallback(() => {
    if (gatewayCardMessageClearRef.current) {
      clearTimeout(gatewayCardMessageClearRef.current);
      gatewayCardMessageClearRef.current = null;
    }
    setGatewayCardMessage(null);
  }, []);

  useEffect(() => {
    return () => {
      if (gatewayCardMessageClearRef.current) {
        clearTimeout(gatewayCardMessageClearRef.current);
      }
    };
  }, []);
  const [installing, setInstalling] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);
  const [hasEmbeddedNode, setHasEmbeddedNode] = useState(false);
  const [hasExternalGatewayNode, setHasExternalGatewayNode] = useState(false);
  const [packagedNodePath, setPackagedNodePath] = useState<string | null>(null);
  const [hasSystemNpm, setHasSystemNpm] = useState(false);
  const [nodeInstalling, setNodeInstalling] = useState(false);

  const [configJson, setConfigJson] = useState("");
  const [configPath, setConfigPath] = useState("");
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [taskLog, setTaskLog] = useState("");
  const [gatewayBundledLog, setGatewayBundledLog] = useState("");
  const [gatewayExternalLog, setGatewayExternalLog] = useState("");
  const [gatewayLogFileBundled, setGatewayLogFileBundled] = useState<string | null>(null);
  const [gatewayLogFileExternal, setGatewayLogFileExternal] = useState<string | null>(null);
  const [gatewayPortConflictBundled, setGatewayPortConflictBundled] = useState<GatewayPortConflict | null>(null);
  const [gatewayPortConflictExternal, setGatewayPortConflictExternal] = useState<GatewayPortConflict | null>(null);
  const [killingGatewayPortPid, setKillingGatewayPortPid] = useState<number | null>(null);

  const installPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uninstallPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nodeInstallPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nodeInstallProfileRef = useRef<"bundled" | "external">("bundled");
  const gatewayLogBeforeNodeRef = useRef<string>("");
  const gatewayDiagnosticConsoleRef = useRef<HTMLTextAreaElement | null>(null);
  const taskLogConsoleRef = useRef<HTMLTextAreaElement | null>(null);
  /** 避免首次加载后用默认 tab 覆盖 DB；仅在用户切换内置/外置页签后把 binary 写入服务端 */
  const panelInstallDiagRef = useRef<OpenClawInstallDiag | undefined>(undefined);
  const panelUninstallDiagRef = useRef<OpenClawInstallDiag | undefined>(undefined);
  const gatewayDiagBundledRef = useRef("");
  const gatewayDiagExternalRef = useRef("");
  /** 跳过首次 effect：挂载时 bootstrap 已 loadConfig；此后仅在配置目标随 tab 变化时拉取 */
  const openClawConfigTargetEffectSkipRef = useRef(true);

  const otherClawInstallations = useMemo(
    () => clawInstallations.filter((r) => r.productId !== "openclaw"),
    [clawInstallations]
  );

  const activeOpenClawConfigTarget = useMemo((): "user-profile" | "clawheart-managed" => {
    return builtInBinaryTab === "bundled" ? "clawheart-managed" : "user-profile";
  }, [builtInBinaryTab]);

  useEffect(() => {
    for (const ref of [taskLogConsoleRef, gatewayDiagnosticConsoleRef]) {
      const el = ref.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [taskLog, gatewayBundledLog, gatewayExternalLog, builtInBinaryTab]);

  const stopInstallLogPoll = () => {
    if (installPollRef.current != null) {
      clearInterval(installPollRef.current);
      installPollRef.current = null;
    }
  };

  const stopUninstallLogPoll = () => {
    if (uninstallPollRef.current != null) {
      clearInterval(uninstallPollRef.current);
      uninstallPollRef.current = null;
    }
  };

  const stopNodeInstallPoll = () => {
    if (nodeInstallPollRef.current != null) {
      clearInterval(nodeInstallPollRef.current);
      nodeInstallPollRef.current = null;
    }
  };

  const ingestGatewayDiagnosticFields = useCallback(
    (
      payload: {
        gatewayDiagnosticLog?: string;
        gatewayDiagnosticLogBundled?: string;
        gatewayDiagnosticLogExternal?: string;
        gatewayOpenclawBinary?: string;
        gatewayPortConflictBundled?: unknown;
        gatewayPortConflictExternal?: unknown;
      } | null
        | undefined
    ) => {
      if (!payload || typeof payload !== "object") return;
      const hasB = Object.prototype.hasOwnProperty.call(payload, "gatewayDiagnosticLogBundled");
      const hasE = Object.prototype.hasOwnProperty.call(payload, "gatewayDiagnosticLogExternal");
      if (typeof payload.gatewayDiagnosticLogBundled === "string") {
        gatewayDiagBundledRef.current = payload.gatewayDiagnosticLogBundled;
      }
      if (typeof payload.gatewayDiagnosticLogExternal === "string") {
        gatewayDiagExternalRef.current = payload.gatewayDiagnosticLogExternal;
      }
      if (typeof payload.gatewayDiagnosticLog === "string" && !hasB && !hasE) {
        const leg = payload.gatewayDiagnosticLog;
        const mode = payload.gatewayOpenclawBinary === "external" ? "external" : "bundled";
        if (mode === "external") gatewayDiagExternalRef.current = leg;
        else gatewayDiagBundledRef.current = leg;
      }
      if (Object.prototype.hasOwnProperty.call(payload, "gatewayPortConflictBundled")) {
        setGatewayPortConflictBundled(gatewayPortConflictFromServer(payload.gatewayPortConflictBundled));
      }
      if (Object.prototype.hasOwnProperty.call(payload, "gatewayPortConflictExternal")) {
        setGatewayPortConflictExternal(gatewayPortConflictFromServer(payload.gatewayPortConflictExternal));
      }
    },
    []
  );

  const mergePanelGatewayLog = useCallback(() => {
    const task = buildOpenClawSharedTaskLogText(panelInstallDiagRef.current, panelUninstallDiagRef.current);
    if (task !== null) {
      setTaskLog(task);
    }
    setGatewayBundledLog(gatewayDiagBundledRef.current);
    setGatewayExternalLog(gatewayDiagExternalRef.current);
  }, []);

  const applyEmbeddedStatus = useCallback((data: {
    hasEmbedded?: boolean;
    isRunning?: boolean;
    localInstall?: { installed?: boolean; binaryPath?: string | null; appPath?: string | null };
    uiUrl?: string;
    gatewayDiagnosticLog?: string;
    openClawDiscovery?: OpenClawDiscovery;
    gatewayOpenclawTarget?: string;
    openclawInstall?: OpenClawInstallDiag;
    openclawUninstall?: OpenClawInstallDiag;
    cliSource?: string;
    hasEmbeddedNode?: boolean;
    hasExternalGatewayNode?: boolean;
    packagedNodePath?: string | null;
    hasSystemNpm?: boolean;
    clawEnvironment?: ClawEnvironment;
    clawInventory?: { scannedAt?: string; installations?: ClawInventoryEntry[] };
    hasBundledOpenClaw?: boolean;
    bundledOpenClawVersion?: string | null;
    hasExternalManagedOpenClaw?: boolean;
    externalOpenClawNpmPrefix?: string;
    externalOpenClawPrefixDirExists?: boolean;
    externalOpenClawRuntimeDirExists?: boolean;
    externalManagedOpenClawBinPath?: string | null;
    externalOpenClawBinPath?: string | null;
    externalOpenClawBinSource?: string | null;
    externalOpenClawVersion?: string | null;
    userEnvironmentOpenClaw?: {
      binPath?: string;
      version?: string | null;
      source?: string | null;
    } | null;
    gatewayOpenclawBinary?: string;
    gatewayOpenclawTargetExternal?: string;
    gatewayDiagnosticLogBundled?: string;
    gatewayDiagnosticLogExternal?: string;
    gatewayDiagnosticLogFileBundled?: string;
    gatewayDiagnosticLogFileExternal?: string;
    gatewayPortConflictBundled?: unknown;
    gatewayPortConflictExternal?: unknown;
    externalOpenClawInstallTag?: string | null;
    hasUserEnvironmentOpenClawAside?: boolean;
  }) => {
    setHasEmbedded(!!data?.hasEmbedded);
    if (typeof data?.hasBundledOpenClaw === "boolean") {
      setHasBundledOpenClaw(data.hasBundledOpenClaw);
    } else {
      const cs = data?.cliSource;
      if (cs === "project-modules" || cs === "packaged") {
        setHasBundledOpenClaw(true);
      } else if (cs === "global" || cs === "none") {
        setHasBundledOpenClaw(false);
      }
    }
    if (data && Object.prototype.hasOwnProperty.call(data, "bundledOpenClawVersion")) {
      const bv = data.bundledOpenClawVersion;
      setBundledOpenClawVersion(typeof bv === "string" && bv.trim() ? bv.trim() : null);
    }
    if (typeof data?.hasExternalManagedOpenClaw === "boolean") {
      setHasExternalManagedOpenClaw(data.hasExternalManagedOpenClaw);
    }
    if (typeof data?.externalOpenClawNpmPrefix === "string") {
      setExternalOpenClawNpmPrefix(data.externalOpenClawNpmPrefix);
    }
    if (typeof data?.externalOpenClawPrefixDirExists === "boolean") {
      setExternalOpenClawPrefixDirExists(data.externalOpenClawPrefixDirExists);
    }
    if (typeof data?.externalOpenClawRuntimeDirExists === "boolean") {
      setExternalOpenClawRuntimeDirExists(data.externalOpenClawRuntimeDirExists);
    }
    if (data?.externalManagedOpenClawBinPath !== undefined) {
      const mb = data.externalManagedOpenClawBinPath;
      setExternalManagedOpenClawBinPath(typeof mb === "string" && mb.trim() ? mb.trim() : null);
    }
    if (data?.externalOpenClawBinPath !== undefined) {
      setExternalOpenClawBinPath(typeof data.externalOpenClawBinPath === "string" ? data.externalOpenClawBinPath : null);
    }
    if (Object.prototype.hasOwnProperty.call(data || {}, "externalOpenClawBinSource")) {
      const src = data?.externalOpenClawBinSource;
      setExternalOpenClawBinSource(
        src === "managed-prefix" || src === "user-environment" ? src : null
      );
    }
    if (data && Object.prototype.hasOwnProperty.call(data, "externalOpenClawVersion")) {
      const v = data.externalOpenClawVersion;
      setExternalOpenClawVersion(typeof v === "string" && v.trim() ? v.trim() : null);
    }
    if (data && Object.prototype.hasOwnProperty.call(data, "userEnvironmentOpenClaw")) {
      const uec = data.userEnvironmentOpenClaw;
      if (uec && typeof uec === "object" && typeof uec.binPath === "string" && uec.binPath.trim()) {
        setUserEnvironmentOpenClaw({
          binPath: uec.binPath.trim(),
          version: typeof uec.version === "string" && uec.version.trim() ? uec.version.trim() : null,
          source: typeof uec.source === "string" && uec.source.trim() ? uec.source.trim() : null,
        });
      } else {
        setUserEnvironmentOpenClaw(null);
      }
    }
    if (Object.prototype.hasOwnProperty.call(data || {}, "externalOpenClawInstallTag")) {
      const tag = data?.externalOpenClawInstallTag;
      setExternalOpenClawInstallTag(
        tag === "client" || tag === "user" || tag === "unknown" ? tag : null
      );
    }
    if (typeof data?.hasUserEnvironmentOpenClawAside === "boolean") {
      setHasUserEnvironmentOpenClawAside(data.hasUserEnvironmentOpenClawAside);
    }
    if (
      data?.externalManagedOpenClawBinPath === undefined &&
      data?.hasExternalManagedOpenClaw === true &&
      typeof data?.externalOpenClawBinPath === "string" &&
      data.externalOpenClawBinPath.trim()
    ) {
      setExternalManagedOpenClawBinPath(data.externalOpenClawBinPath.trim());
    }
    if (
      !Object.prototype.hasOwnProperty.call(data || {}, "externalOpenClawBinSource") &&
      typeof data?.externalOpenClawBinPath === "string" &&
      data.externalOpenClawBinPath.trim() &&
      data?.hasExternalManagedOpenClaw === true
    ) {
      setExternalOpenClawBinSource("managed-prefix");
    }
    const gb = data?.gatewayOpenclawBinary;
    if (gb === "bundled" || gb === "external") {
      setGatewayOpenclawBinary(gb);
      if (!builtInTabInitRef.current) {
        setBuiltInBinaryTab(gb);
        builtInTabInitRef.current = true;
      }
    }
    if (typeof data?.hasEmbeddedNode === "boolean") {
      setHasEmbeddedNode(data.hasEmbeddedNode);
    }
    if (typeof data?.hasExternalGatewayNode === "boolean") {
      setHasExternalGatewayNode(data.hasExternalGatewayNode);
    }
    if (data && Object.prototype.hasOwnProperty.call(data, "packagedNodePath")) {
      const p = (data as { packagedNodePath?: unknown }).packagedNodePath;
      setPackagedNodePath(typeof p === "string" && p.trim() ? p.trim() : null);
    }
    if (typeof data?.hasSystemNpm === "boolean") {
      setHasSystemNpm(data.hasSystemNpm);
    }
    setIsRunning(!!data?.isRunning);
    setLocalInstalled(typeof data?.localInstall?.installed === "boolean" ? data.localInstall.installed : null);
    setLocalBinaryPath(data?.localInstall?.binaryPath || data?.localInstall?.appPath || null);
    setUiUrl(data?.uiUrl || "http://localhost:18789");

    if (Object.prototype.hasOwnProperty.call(data, "gatewayPortConflictBundled")) {
      setGatewayPortConflictBundled(gatewayPortConflictFromServer(data.gatewayPortConflictBundled));
    }
    if (Object.prototype.hasOwnProperty.call(data, "gatewayPortConflictExternal")) {
      setGatewayPortConflictExternal(gatewayPortConflictFromServer(data.gatewayPortConflictExternal));
    }

    const diag = data?.openclawInstall;
    const udiag = data?.openclawUninstall;
    panelInstallDiagRef.current = diag;
    panelUninstallDiagRef.current = udiag;
    ingestGatewayDiagnosticFields(data);
    const cs = data?.cliSource;
    if (cs === "project-modules" || cs === "packaged" || cs === "global" || cs === "none") {
      setCliSource(cs);
    }
    mergePanelGatewayLog();

    if (typeof data?.gatewayDiagnosticLogFileBundled === "string" && data.gatewayDiagnosticLogFileBundled.trim()) {
      setGatewayLogFileBundled(data.gatewayDiagnosticLogFileBundled.trim());
    }
    if (typeof data?.gatewayDiagnosticLogFileExternal === "string" && data.gatewayDiagnosticLogFileExternal.trim()) {
      setGatewayLogFileExternal(data.gatewayDiagnosticLogFileExternal.trim());
    }

    if (data?.clawEnvironment && typeof data.clawEnvironment === "object") {
      const ce = data.clawEnvironment as ClawEnvironment;
      setClawEnvironment(ce);
      if (typeof data?.hasExternalGatewayNode !== "boolean" && typeof ce.hasExternalGatewayNode === "boolean") {
        setHasExternalGatewayNode(ce.hasExternalGatewayNode);
      }
      if (!Object.prototype.hasOwnProperty.call(data, "packagedNodePath")) {
        const pp = ce.packagedNodePath;
        if (typeof pp === "string" && pp.trim()) setPackagedNodePath(pp.trim());
        else if (pp === null) setPackagedNodePath(null);
      }
    }
    const inv = data?.clawInventory;
    if (inv && typeof inv === "object") {
      if (typeof inv.scannedAt === "string") setClawScannedAt(inv.scannedAt);
      if (Array.isArray(inv.installations)) {
        setClawInstallations(inv.installations as ClawInventoryEntry[]);
      }
    }

    if (data?.openClawDiscovery && typeof data.openClawDiscovery === "object") {
      setOpenClawDiscovery(data.openClawDiscovery);
    }
    const gt = data?.gatewayOpenclawTarget;
    if (gt === "clawheart-managed" || gt === "user-profile") {
      setGatewayOpenclawTarget("clawheart-managed");
    }
    const gte = data?.gatewayOpenclawTargetExternal;
    if (gte === "external-managed" || gte === "user-profile") {
      setGatewayOpenclawTargetExternal("user-profile");
    }
  }, [ingestGatewayDiagnosticFields, mergePanelGatewayLog]);

  const fetchEmbeddedStatus = useCallback(async () => {
    const [embRes, nodeRes] = await Promise.all([fetch(EMBEDDED_STATUS_URL), fetch(NODE_STATUS_URL)]);
    const data = await embRes.json();
    if (!embRes.ok) {
      throw new Error(data?.error?.message || "获取 OpenClaw 状态失败");
    }
    let n: { hasEmbeddedNode?: boolean; hasExternalGatewayNode?: boolean; hasSystemNpm?: boolean } = {};
    try {
      if (nodeRes.ok) {
        n = await nodeRes.json();
      }
    } catch {
      /* ignore */
    }
    if (typeof data.hasEmbeddedNode !== "boolean" && typeof n.hasEmbeddedNode === "boolean") {
      data.hasEmbeddedNode = n.hasEmbeddedNode;
    }
    if (typeof data.hasExternalGatewayNode !== "boolean" && typeof n.hasExternalGatewayNode === "boolean") {
      (data as { hasExternalGatewayNode?: boolean }).hasExternalGatewayNode = n.hasExternalGatewayNode;
    }
    if (typeof data.hasSystemNpm !== "boolean" && typeof n.hasSystemNpm === "boolean") {
      data.hasSystemNpm = n.hasSystemNpm;
    }
    return data;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchEmbeddedStatus();
      applyEmbeddedStatus(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }, [applyEmbeddedStatus, fetchEmbeddedStatus]);

  const fetchOpenclawNpmLatestVersion = useCallback(async () => {
    try {
      const res = await fetch("http://127.0.0.1:19111/api/openclaw/openclaw-npm-latest");
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        latestVersion?: string;
        error?: { message?: string };
      };
      if (!res.ok) {
        return { ok: false, error: data?.error?.message || `HTTP ${res.status}` };
      }
      if (data?.ok === true && typeof data.latestVersion === "string" && data.latestVersion.trim()) {
        return { ok: true, latestVersion: data.latestVersion.trim() };
      }
      return { ok: false, error: data?.error?.message || "registry 未返回版本" };
    } catch (e: unknown) {
      return { ok: false, error: e instanceof Error ? e.message : "网络错误" };
    }
  }, []);

  const copyGatewayLog = useCallback(async () => {
    const parts: string[] = [];
    const t = taskLog.trim();
    if (t) parts.push(`=== 安装 / 卸载 / 任务 ===\n${t}`);
    const b = gatewayBundledLog.trim();
    if (b) parts.push(`=== 内置 Gateway 诊断 ===\n${b}`);
    const e = gatewayExternalLog.trim();
    if (e) parts.push(`=== 外置 Gateway 诊断 ===\n${e}`);
    const text = parts.length > 0 ? parts.join("\n\n") : "（无日志）";
    try {
      await navigator.clipboard.writeText(text);
      setMessage("日志已复制到剪贴板");
      setTimeout(() => setMessage(null), 2500);
    } catch {
      setError("复制失败，请手动在日志框内全选复制");
    }
  }, [taskLog, gatewayBundledLog, gatewayExternalLog]);

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const q = new URLSearchParams({ target: activeOpenClawConfigTarget });
      const res = await fetch(`http://127.0.0.1:19111/api/openclaw/config?${q.toString()}`);
      const data = await res.json();

      if (res.ok && data?.ok) {
        setConfigJson(JSON.stringify(data.config, null, 2));
        setConfigPath(data.configPath || "");
      } else {
        setConfigJson("{}");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载配置失败");
      setConfigJson("{}");
    } finally {
      setConfigLoading(false);
    }
  }, [activeOpenClawConfigTarget]);

  const saveConfig = useCallback(async () => {
    setConfigSaving(true);
    setMessage(null);
    setError(null);

    try {
      const config = JSON.parse(configJson);

      const res = await fetch("http://127.0.0.1:19111/api/openclaw/config-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, target: activeOpenClawConfigTarget }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setError(data?.error?.message || "保存失败");
        return;
      }

      setMessage("配置已保存！请重启 Gateway 使配置生效。");
    } catch (e: unknown) {
      if (e instanceof SyntaxError) {
        setError("JSON 格式错误: " + e.message);
      } else {
        setError(e instanceof Error ? e.message : "保存失败");
      }
    } finally {
      setConfigSaving(false);
    }
  }, [activeOpenClawConfigTarget, configJson]);

  const restartGateway = useCallback(async () => {
    setConfigSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("http://127.0.0.1:19111/api/openclaw/restart-gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gatewayOpenclawBinary: gatewayOpenclawBinary }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setError(data?.error?.message || "重启失败");
        return;
      }

      setMessage("Gateway 正在重启，请稍候...");

      setTimeout(() => {
        refresh();
      }, 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "重启失败");
    } finally {
      setConfigSaving(false);
    }
  }, [gatewayOpenclawBinary, refresh]);

  const formatJson = useCallback(() => {
    try {
      const parsed = JSON.parse(configJson);
      setConfigJson(JSON.stringify(parsed, null, 2));
      setMessage("JSON 已格式化");
    } catch (e: unknown) {
      setError("JSON 格式错误: " + (e instanceof Error ? e.message : String(e)));
    }
  }, [configJson]);

  const reloadConfig = useCallback(async () => {
    await loadConfig();
    setMessage("配置已重新加载");
  }, [loadConfig]);

  const installOpenClaw = useCallback(async () => {
    setMessage(null);
    setError(null);
    stopInstallLogPoll();
    stopUninstallLogPoll();
    setInstalling(true);
    setTaskLog("=== OpenClaw 安装（进行中） ===\n正在连接本地服务并拉取实时输出…\n");

    try {
      const res = await fetch("http://127.0.0.1:19111/api/openclaw/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        setMessage("已有安装或卸载任务在进行，以下为实时日志");
      } else if (!res.ok && res.status !== 202) {
        setError(data?.error?.message || "安装请求失败");
        setInstalling(false);
        return;
      } else if (res.status === 202) {
        setMessage(data?.message || "安装已开始…");
      }

      panelInstallDiagRef.current = data?.openclawInstall as OpenClawInstallDiag | undefined;
      panelUninstallDiagRef.current = data?.openclawUninstall as OpenClawInstallDiag | undefined;
      ingestGatewayDiagnosticFields(data);
      mergePanelGatewayLog();

      const pollTick = async () => {
        try {
          const pr = await fetch(INSTALL_PROGRESS_URL);
          const st = await pr.json();
          if (!pr.ok) {
            return;
          }
          panelInstallDiagRef.current = st?.openclawInstall as OpenClawInstallDiag | undefined;
          panelUninstallDiagRef.current = st?.openclawUninstall as OpenClawInstallDiag | undefined;
          ingestGatewayDiagnosticFields(st);
          mergePanelGatewayLog();
          const oc = st?.openclawInstall as OpenClawInstallDiag | undefined;
          if (oc == null) {
            return;
          }
          if (!oc.running) {
            stopInstallLogPoll();
            setInstalling(false);
            if (oc.exitCode === 0) {
              setMessage("OpenClaw 安装成功！正在刷新状态…");
            } else if (oc.exitCode != null && oc.exitCode !== 0) {
              setError(oc.lastError?.trim() || `安装失败（退出码 ${oc.exitCode}）`);
            }
            void refresh();
          }
        } catch {
          /* ignore */
        }
      };

      installPollRef.current = setInterval(() => {
        void pollTick();
      }, 100);
      await pollTick();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "安装失败");
      setInstalling(false);
      stopInstallLogPoll();
    }
  }, [ingestGatewayDiagnosticFields, mergePanelGatewayLog, refresh]);

  const installOrUpgradeOpenClawExternal = useCallback(
    async (mode: "install" | "upgrade") => {
      setMessage(null);
      setError(null);
      stopInstallLogPoll();
      stopUninstallLogPoll();
      setInstalling(true);
      setTaskLog(
        mode === "upgrade"
          ? "=== 升级外置 OpenClaw（prefix）===\n正在连接本地服务并拉取实时输出…\n"
          : "=== OpenClaw 外置安装（prefix）===\n正在连接本地服务并拉取实时输出…\n"
      );

      try {
        const res = await fetch("http://127.0.0.1:19111/api/openclaw/install", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ installTarget: "clawheart-external" }),
        });

        const data = await res.json().catch(() => ({}));

        if (res.status === 409) {
          setMessage("已有安装或卸载任务在进行，以下为实时日志");
        } else if (!res.ok && res.status !== 202) {
          setError(data?.error?.message || (mode === "upgrade" ? "升级请求失败" : "安装请求失败"));
          setInstalling(false);
          return;
        } else if (res.status === 202) {
          setMessage(data?.message || (mode === "upgrade" ? "升级已开始…" : "安装已开始…"));
        }

        panelInstallDiagRef.current = data?.openclawInstall as OpenClawInstallDiag | undefined;
        panelUninstallDiagRef.current = data?.openclawUninstall as OpenClawInstallDiag | undefined;
        ingestGatewayDiagnosticFields(data);
        mergePanelGatewayLog();

        const pollTick = async () => {
          try {
            const pr = await fetch(INSTALL_PROGRESS_URL);
            const st = await pr.json();
            if (!pr.ok) {
              return;
            }
            panelInstallDiagRef.current = st?.openclawInstall as OpenClawInstallDiag | undefined;
            panelUninstallDiagRef.current = st?.openclawUninstall as OpenClawInstallDiag | undefined;
            ingestGatewayDiagnosticFields(st);
            mergePanelGatewayLog();
            const oc = st?.openclawInstall as OpenClawInstallDiag | undefined;
            if (oc == null) {
              return;
            }
            if (!oc.running) {
              stopInstallLogPoll();
              setInstalling(false);
              if (oc.exitCode === 0) {
                setMessage(
                  mode === "upgrade"
                    ? "外置 OpenClaw 已升级到最新，正在刷新状态…"
                    : "外置 OpenClaw 安装完成，正在刷新状态…"
                );
              } else if (oc.exitCode != null && oc.exitCode !== 0) {
                setError(oc.lastError?.trim() || `失败（退出码 ${oc.exitCode}）`);
              }
              void refresh();
            }
          } catch {
            /* ignore */
          }
        };

        installPollRef.current = setInterval(() => {
          void pollTick();
        }, 100);
        await pollTick();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : mode === "upgrade" ? "升级失败" : "安装失败");
        setInstalling(false);
        stopInstallLogPoll();
      }
    },
    [ingestGatewayDiagnosticFields, mergePanelGatewayLog, refresh]
  );

  const installOpenClawExternal = useCallback(async () => {
    await installOrUpgradeOpenClawExternal("install");
  }, [installOrUpgradeOpenClawExternal]);

  const upgradeOpenClawExternal = useCallback(async () => {
    await installOrUpgradeOpenClawExternal("upgrade");
  }, [installOrUpgradeOpenClawExternal]);

  const installRuntimeNode = useCallback(
    async (profile: "bundled" | "external", opts?: { force?: boolean }) => {
      setMessage(null);
      setError(null);
      stopNodeInstallPoll();
      nodeInstallProfileRef.current = profile;
      gatewayLogBeforeNodeRef.current = [
        taskLog.trim(),
        gatewayBundledLog.trim() && `=== 内置 Gateway 诊断 ===\n${gatewayBundledLog}`,
        gatewayExternalLog.trim() && `=== 外置 Gateway 诊断 ===\n${gatewayExternalLog}`,
      ]
        .filter(Boolean)
        .join("\n\n");
      setNodeInstalling(true);
      try {
        const res = await fetch("http://127.0.0.1:19111/api/openclaw/install-node", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile, force: !!opts?.force }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data?.error?.message || "请求下载 Node 失败");
          setNodeInstalling(false);
          return;
        }
        if (data?.message) {
          setMessage(String(data.message));
        }

        const tick = async () => {
          try {
            const pr = await fetch(`${INSTALL_NODE_PROGRESS_URL}?profile=${profile}`);
            const st = await pr.json();
            const block = formatNodeRuntimeInstallBlock(st);
            const rest = gatewayLogBeforeNodeRef.current.trim();
            setTaskLog(rest ? `${block}\n\n${rest}` : block);
            if (!st.installing && (st.completed || st.error)) {
              stopNodeInstallPoll();
              setNodeInstalling(false);
              if (st.completed) {
                setMessage(
                  profile === "external"
                    ? "外置专用 Node 已就绪，可安装 / 升级外置 OpenClaw"
                    : "内置运行时 Node 已就绪，可启动内置 Gateway 或安装 OpenClaw"
                );
              } else if (st.error) {
                setError(String(st.error));
              }
              void refresh();
            }
          } catch {
            /* ignore */
          }
        };

        nodeInstallPollRef.current = setInterval(() => void tick(), 400);
        await tick();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "下载失败");
        setNodeInstalling(false);
        stopNodeInstallPoll();
      }
    },
    [gatewayBundledLog, gatewayExternalLog, refresh, taskLog]
  );

  const uninstallRuntimeNode = useCallback(async (profile: "bundled" | "external") => {
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("http://127.0.0.1:19111/api/openclaw/uninstall-node", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message || "卸载失败");
        return;
      }
      if (data?.message) setMessage(String(data.message));
      void refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "卸载失败");
    }
  }, [refresh]);

  const startGateway = useCallback(async (mode?: GatewayOpenclawBinary) => {
    const bin = mode ?? builtInBinaryTab;
    if (mode != null && mode !== builtInBinaryTab) {
      setBuiltInBinaryTab(mode);
    }
    setStartingGatewayMode(bin);
    dismissGatewayCardMessage();
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("http://127.0.0.1:19111/api/openclaw/start-gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gatewayOpenclawBinary: bin }),
      });

      const data = await res.json();

      try {
        const st = await fetchEmbeddedStatus();
        const merged =
          res.ok && data?.ok ? { ...st, isRunning: true } : st;
        applyEmbeddedStatus(merged);
      } catch {
        ingestGatewayDiagnosticFields(data);
        mergePanelGatewayLog();
        if (res.ok && data?.ok) {
          setIsRunning(true);
        }
      }

      if (!res.ok || !data?.ok) {
        setError(data?.error?.message || "启动失败");
        return;
      }

      showGatewayCardMessage(bin, "Gateway 已启动");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "启动失败");
    } finally {
      setStartingGatewayMode(null);
      void refresh();
    }
  }, [
    applyEmbeddedStatus,
    builtInBinaryTab,
    dismissGatewayCardMessage,
    fetchEmbeddedStatus,
    ingestGatewayDiagnosticFields,
    mergePanelGatewayLog,
    refresh,
    showGatewayCardMessage,
  ]);

  const stopGateway = useCallback(async (mode?: GatewayOpenclawBinary) => {
    const side = mode ?? gatewayOpenclawBinary;
    setStoppingGatewayMode(side);
    dismissGatewayCardMessage();
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("http://127.0.0.1:19111/api/openclaw/stop-gateway", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setError(data?.error?.message || data?.message || "停止失败");
        return;
      }

      showGatewayCardMessage(side, data?.message ?? "Gateway 已停止");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "停止失败");
    } finally {
      setStoppingGatewayMode(null);
      void refresh();
    }
  }, [dismissGatewayCardMessage, gatewayOpenclawBinary, refresh, showGatewayCardMessage]);

  const killGatewayPortListener = useCallback(
    async (pid: number, conflictPort: number) => {
      setKillingGatewayPortPid(pid);
      setError(null);
      setMessage(null);
      try {
        const res = await fetch("http://127.0.0.1:19111/api/openclaw/kill-gateway-port-listener", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pid, conflictPort }),
        });
        const data = await res.json().catch(() => ({}));
        ingestGatewayDiagnosticFields(data);
        mergePanelGatewayLog();
        if (!res.ok || !data?.ok) {
          setError(typeof data?.error?.message === "string" ? data.error.message : "无法结束占用进程");
          return;
        }
        setMessage(typeof data?.message === "string" ? data.message : "已请求结束占用进程");
        await refresh();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "结束进程失败");
      } finally {
        setKillingGatewayPortPid(null);
      }
    },
    [ingestGatewayDiagnosticFields, mergePanelGatewayLog, refresh]
  );

  const uninstallNpmClaw = useCallback(
    async (npmPackage: string, label?: string, opts?: { uninstallTarget?: "default" | "clawheart-external" }) => {
      const pkg = String(npmPackage || "").trim();
      if (!pkg) return;
      const title = label ? `${label}（${pkg}）` : pkg;
      const uTarget = opts?.uninstallTarget === "clawheart-external" ? "clawheart-external" : "default";
      const confirmMsg =
        uTarget === "clawheart-external"
          ? `确定完整卸载 ClawHeart 外置「${title}」？\n\n将执行 npm 卸载并删除 ~/.opencarapace 下的 external-openclaw 与 external-openclaw-runtime；不会删除标准 ~/.openclaw。若当前为外置 Gateway，卸载后会自动切回内置模式。\n\n请先停止外置 Gateway 再确认。`
          : `确定从全局 npm 卸载「${title}」？\n\n不会自动删除各工具的数据目录；若正在使用 Gateway，请先停止相关服务。`;
      if (!window.confirm(confirmMsg)) {
        return;
      }
      setMessage(null);
      setError(null);
      stopUninstallLogPoll();
      stopInstallLogPoll();
      setUninstalling(true);
      setTaskLog(`=== npm 卸载 ${pkg}（进行中） ===\n正在连接本地服务并拉取实时输出…\n`);
      try {
        const res = await fetch("http://127.0.0.1:19111/api/openclaw/uninstall", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            npmPackage: pkg,
            ...(uTarget === "clawheart-external" ? { uninstallTarget: "clawheart-external" } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 409) {
          setMessage("已有安装或卸载任务在进行，以下为实时日志");
        } else if (!res.ok && res.status !== 202) {
          setError(data?.error?.message || "卸载请求失败");
          setUninstalling(false);
          return;
        } else if (res.status === 202) {
          setMessage(data?.message || "卸载已开始…");
        }
        panelInstallDiagRef.current = data?.openclawInstall as OpenClawInstallDiag | undefined;
        panelUninstallDiagRef.current = data?.openclawUninstall as OpenClawInstallDiag | undefined;
        ingestGatewayDiagnosticFields(data);
        mergePanelGatewayLog();
        const pollTick = async () => {
          try {
            const pr = await fetch(INSTALL_PROGRESS_URL);
            const st = await pr.json();
            if (!pr.ok) return;
            panelInstallDiagRef.current = st?.openclawInstall as OpenClawInstallDiag | undefined;
            panelUninstallDiagRef.current = st?.openclawUninstall as OpenClawInstallDiag | undefined;
            ingestGatewayDiagnosticFields(st);
            mergePanelGatewayLog();
            const uo = st?.openclawUninstall as OpenClawInstallDiag | undefined;
            if (uo == null) return;
            if (!uo.running) {
              stopUninstallLogPoll();
              setUninstalling(false);
              if (uo.exitCode === 0) {
                setMessage("卸载命令已执行完毕，正在刷新状态…");
              } else if (uo.exitCode != null && uo.exitCode !== 0) {
                setError(uo.lastError?.trim() || `卸载失败（退出码 ${uo.exitCode}）`);
              }
              void refresh();
            }
          } catch {
            /* ignore */
          }
        };
        uninstallPollRef.current = setInterval(() => void pollTick(), 100);
        await pollTick();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "卸载失败");
        setUninstalling(false);
        stopUninstallLogPoll();
      }
    },
    [ingestGatewayDiagnosticFields, mergePanelGatewayLog, refresh]
  );

  const openBuiltInConfigTab = useCallback(
    (mode?: GatewayOpenclawBinary) => {
      const willSwitch = mode != null && mode !== builtInBinaryTab;
      if (willSwitch) {
        setBuiltInBinaryTab(mode);
      }
      setMainTab("builtin");
      if (!willSwitch) {
        void loadConfig();
      }
    },
    [builtInBinaryTab, loadConfig]
  );

  const openClawConfigForRow = useCallback(
    (row: ClawInventoryEntry) => {
      if (row.productId !== "openclaw") {
        setMessage(`「${row.label}」的配置请参考厂商文档。可执行文件：${row.executable}`);
        setTimeout(() => setMessage(null), 6000);
        return;
      }
      openBuiltInConfigTab();
      setMessage("已切换到本页。请在内置或外置卡片上点击「配置」打开编辑弹窗。");
      setTimeout(() => setMessage(null), 8000);
    },
    [openBuiltInConfigTab]
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        await refresh();
        await loadConfig();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        setLoading(false);
      }
    };
    void load();

    const interval = setInterval(() => {
      refresh().catch(() => {});
    }, 3000);

    return () => {
      clearInterval(interval);
      stopInstallLogPoll();
      stopUninstallLogPoll();
      stopNodeInstallPoll();
    };
    // 仅挂载时拉一次；轮询与 refresh 闭包取最新即可
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only bootstrap
  }, []);

  useEffect(() => {
    if (openClawConfigTargetEffectSkipRef.current) {
      openClawConfigTargetEffectSkipRef.current = false;
      return;
    }
    void loadConfig();
  }, [activeOpenClawConfigTarget, loadConfig]);

  const cliSourceLabel =
    cliSource === "global"
      ? "全局 npm CLI"
      : cliSource === "project-modules"
        ? "开发依赖（node_modules）"
        : cliSource === "packaged"
          ? "应用内置"
          : "未检测到";

  return {
    mainTab,
    setMainTab,
    loading,
    error,
    message,
    hasEmbedded,
    hasBundledOpenClaw,
    bundledOpenClawVersion,
    hasExternalManagedOpenClaw,
    externalOpenClawNpmPrefix,
    externalOpenClawPrefixDirExists,
    externalOpenClawRuntimeDirExists,
    externalManagedOpenClawBinPath,
    externalOpenClawBinPath,
    externalOpenClawBinSource,
    externalOpenClawVersion,
    userEnvironmentOpenClaw,
    externalOpenClawInstallTag,
    hasUserEnvironmentOpenClawAside,
    builtInBinaryTab,
    setBuiltInBinaryTab,
    gatewayOpenclawBinary,
    isRunning,
    localInstalled,
    localBinaryPath,
    openClawDiscovery,
    clawEnvironment,
    clawInstallations,
    otherClawInstallations,
    clawScannedAt,
    gatewayOpenclawTarget,
    gatewayOpenclawTargetExternal,
    activeOpenClawConfigTarget,
    cliSource,
    cliSourceLabel,
    uiUrl,
    startingGatewayMode,
    stoppingGatewayMode,
    gatewayCardMessage,
    installing,
    uninstalling,
    hasEmbeddedNode,
    hasExternalGatewayNode,
    packagedNodePath,
    hasSystemNpm,
    nodeInstalling,
    configJson,
    setConfigJson,
    configPath,
    configLoading,
    configSaving,
    taskLog,
    gatewayBundledLog,
    gatewayExternalLog,
    gatewayLogFileBundled,
    gatewayLogFileExternal,
    gatewayDiagnosticConsoleRef,
    taskLogConsoleRef,
    refresh,
    copyGatewayLog,
    loadConfig,
    saveConfig,
    restartGateway,
    formatJson,
    reloadConfig,
    installOpenClaw,
    installOpenClawExternal,
    upgradeOpenClawExternal,
    fetchOpenclawNpmLatestVersion,
    installRuntimeNode,
    uninstallRuntimeNode,
    startGateway,
    stopGateway,
    gatewayPortConflictBundled,
    gatewayPortConflictExternal,
    killingGatewayPortPid,
    killGatewayPortListener,
    uninstallNpmClaw,
    openClawConfigForRow,
    openBuiltInConfigTab,
  };
}
