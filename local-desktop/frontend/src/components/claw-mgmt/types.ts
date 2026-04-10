export type OpenClawDiscovery = {
  electronUserData: string;
  managed: { stateDir: string; configPath: string; configExists: boolean };
  userProfile: { stateDir: string; configPath: string; configExists: boolean };
  /** 外置 Gateway 专用 ~/.opencarapace/external-openclaw-runtime（可选，旧服务端无此字段） */
  externalManaged?: { stateDir: string; configPath: string; configExists: boolean };
  binaries: Array<{ path: string; source: string; version: string | null }>;
  openClawMacApp: string | null;
};

export type ClawEnvironment = {
  platform: string;
  arch: string;
  homedir: string;
  serviceNodeVersion: string;
  hasEmbeddedNode: boolean;
  hasExternalGatewayNode?: boolean;
  embeddedNodePaths?: unknown;
  externalGatewayNodePaths?: unknown;
  packagedNodePath?: string | null;
  clientNodeRuntimeTarget?: string;
  hasSystemNpm: boolean;
  systemNpmVersion: string | null;
  systemNodeVersion: string | null;
};

export type ClawInventoryEntry = {
  id: string;
  productId: string;
  label: string;
  executable: string;
  version: string | null;
  source: string;
  npmPackage: string | null;
  configKind: string;
};

/** 内置二进制 对应的 openclaw.json 工作区（Electron 托管 vs ~/.openclaw） */
export type ClawWorkspaceTarget = "clawheart-managed" | "user-profile";

/** 外置 Gateway 工作区固定为 user-profile（~/.openclaw）；external-managed 仅为历史 API 值 */
export type ExternalWorkspaceTarget = "external-managed" | "user-profile";

/** Gateway 使用的 OpenClaw 二进制：安装包/开发依赖 或 ClawHeart 外置 prefix */
export type GatewayOpenclawBinary = "bundled" | "external";

/** 外置 prefix 中 OpenClaw 的安装来源（embedded-status） */
export type ExternalOpenClawInstallTag = "client" | "user" | "unknown" | null;

/** 外置 Gateway 解析到的 openclaw 可执行文件来源 */
export type ExternalOpenClawBinSource = "managed-prefix" | "user-environment" | null;

/** 服务端从 Gateway stderr / lsof 汇总的端口占用（用于展示进程名与一键结束） */
export type GatewayPortConflict = {
  port: number;
  pid?: number;
  processName: string;
  bindAddress?: string;
  commandLineHint?: string;
  source?: string;
  ambiguousListenerCount?: number;
};

export type OpenClawCliSource = "project-modules" | "packaged" | "global" | "none";

export type OpenClawInstallDiag = {
  running: boolean;
  log: string;
  exitCode: number | null;
  lastError: string | null;
};

export type ClawMainTab = "builtin" | "other";
