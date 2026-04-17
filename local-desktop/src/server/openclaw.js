const {
  getOpenClawSettings,
  saveOpenClawSettings,
  patchExternalOpenClawInstallSource,
  upsertLlmMapping,
  listLlmMappings,
  deleteLlmMappingByPrefix,
  getOpenClawSecurityMonitorSession,
  upsertOpenClawSecurityMonitorSession,
  listOpenClawSecurityMonitorBackups,
  replaceOpenClawSecurityMonitorBackups,
  clearOpenClawSecurityMonitorBackups,
} = require("../db.js");
const {
  detectPlatform,
  execWithOutput,
  execWithOutputStream,
  hasCommand,
  sanitizeInstallEnv,
  envWithWindowsNodePathProbe,
  resolveWindowsSystemNodeExeSync,
} = require("./utils.js");
const { detectOpenClawGatewayProcessRunning } = require("./openclaw-gateway-process.js");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");
const {
  hasEmbeddedNode,
  getEmbeddedNodePath,
  removeNodeRuntime,
  downloadAndInstallNode,
  runEmbeddedNpm,
  runEmbeddedNpmStream,
  NODE_VERSION,
} = require("./node-manager.js");
const {
  getOpenClawStatus,
  getOpenClawCliSource,
  startEmbeddedOpenClaw,
  stopEmbeddedOpenClaw,
  getGatewayDiagnosticLog,
  getGatewayDiagnosticLogsPayload,
} = require("./openclaw-manager.js");
const {
  enrichGatewayPortConflictsWithLsof,
  getGatewayPortConflictsPayload,
  killVerifiedGatewayPortListener,
} = require("./openclaw-gateway-port-conflict.js");

function jsonGatewayDiagnosticFields() {
  enrichGatewayPortConflictsWithLsof();
  return {
    gatewayDiagnosticLog: getGatewayDiagnosticLog(),
    ...getGatewayDiagnosticLogsPayload(),
    ...getGatewayPortConflictsPayload(),
  };
}

const CLIENT_RELAY_ORIGIN = "http://127.0.0.1:19111";

function normalizeProviderPrefix(provider) {
  const raw = String(provider || "").trim().toLowerCase();
  const normalized = raw.replace(/[^a-z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "provider";
}

function getClientRelayPrefixFromBaseUrl(baseUrl) {
  const s = String(baseUrl || "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" || u.hostname !== "127.0.0.1" || String(u.port || "") !== "19111") return null;
    const seg = u.pathname
      .split("/")
      .map((x) => x.trim())
      .filter(Boolean);
    return seg.length > 0 ? seg[0] : null;
  } catch {
    return null;
  }
}

function normalizeSecurityMonitorPrefix(target, provider) {
  const side = String(target || "").trim() === "clawheart-managed" ? "bi" : "ext";
  return `ocmon-${side}-${normalizeProviderPrefix(provider)}`;
}

function extractProvidersFromConfig(config) {
  if (
    !config ||
    typeof config !== "object" ||
    !config.models ||
    typeof config.models !== "object" ||
    !config.models.providers ||
    typeof config.models.providers !== "object"
  ) {
    return {};
  }
  return config.models.providers;
}

function buildSecurityMonitorPreviewRows(target, config) {
  const providersRoot = extractProvidersFromConfig(config);
  return Object.entries(providersRoot).map(([provider, entry]) => {
    const record = entry && typeof entry === "object" ? entry : {};
    const currentBaseUrl =
      typeof record.baseUrl === "string" && record.baseUrl.trim() ? record.baseUrl.trim() : null;
    const prefix = normalizeSecurityMonitorPrefix(target, provider);
    const relayBaseUrl = `${CLIENT_RELAY_ORIGIN}/${prefix}`;
    const currentRelayPrefix = currentBaseUrl ? getClientRelayPrefixFromBaseUrl(currentBaseUrl) : null;
    // 只要当前已指向 127.0.0.1:19111 的任意前缀，视为已中转，不做替换
    const isAlreadyAnyRelay = !!currentRelayPrefix;
    return {
      provider,
      currentBaseUrl,
      relayBaseUrl,
      relayPrefix: prefix,
      currentRelayPrefix,
      isAlreadyAnyRelay,
      // 已是任意中转地址就不需要再替换
      willChange: !!currentBaseUrl && !isAlreadyAnyRelay,
      hasBaseUrl: !!currentBaseUrl,
    };
  });
}
const {
  configureProvider,
  resetOpenClawConfig,
  restartGateway,
  rotateGatewayAuthToken,
  readOpenClawConfigFromPath,
  writeOpenClawConfigToPath,
  resolveConfigEditTarget,
  initOpenClawConfig,
  PROVIDER_PRESETS,
} = require("./openclaw-config.js");
const { discoverOpenClawInstallations, discoverClawInventory } = require("./openclaw-discovery.js");
const { syncGatewayWorkspaceFromSettings, getManagedRuntimeResolutionInfo } = require("./openclaw-workspace.js");
const {
  hasExternalManagedOpenClaw,
  getExternalOpenClawNpmPrefix,
  getExternalOpenClawRuntimeStateDir,
  resolveExternalOpenClawBinPath,
  getUserEnvironmentOpenClawFromInventory,
  normalizeGatewayOpenclawBinary,
  hasExternalOpenClawClientMarker,
  writeExternalOpenClawClientMarker,
  removeExternalOpenClawClientMarker,
  resolveExternalOpenClawInstallTag,
  purgeClawHeartExternalOpenClawArtefacts,
} = require("./openclaw-external.js");
const { tryOpenClawVersion } = require("./openclaw-discovery.js");
const {
  getBundledNodeFromInstaller,
  buildOpenClawChildEnv,
  getPackagedOpenClawBinFromUnpacked,
  getPackagedOpenClawMjsPath,
  resolveRealNodeExecutable,
} = require("./openclaw-paths.js");

function createIdleNodeInstallState() {
  return {
    installing: false,
    stage: "",
    percent: 0,
    error: null,
    completed: false,
    logs: [],
  };
}

/** bundled = 内置卡 ~/.opencarapace/embedded-node；external = 外置卡专用 ~/.opencarapace/external-gateway-node */
let nodeInstallState = {
  bundled: createIdleNodeInstallState(),
  external: createIdleNodeInstallState(),
};

const MAX_OPENCLAW_INSTALL_LOG = 200000;
/** OpenClaw 安装过程日志（供前端底部面板轮询展示） */
let openclawInstallDiag = {
  running: false,
  log: "",
  exitCode: null,
  lastError: null,
};

function appendOpenClawInstallLog(chunk) {
  const s = typeof chunk === "string" ? chunk : String(chunk ?? "");
  openclawInstallDiag.log += s;
  if (openclawInstallDiag.log.length > MAX_OPENCLAW_INSTALL_LOG) {
    openclawInstallDiag.log =
      "...[日志过长已截断]\n" + openclawInstallDiag.log.slice(-(MAX_OPENCLAW_INSTALL_LOG - 80));
  }
}

function getOpenClawInstallDiagSnapshot() {
  return {
    running: openclawInstallDiag.running,
    log: openclawInstallDiag.log,
    exitCode: openclawInstallDiag.exitCode,
    lastError: openclawInstallDiag.lastError,
  };
}

let openclawUninstallDiag = {
  running: false,
  log: "",
  exitCode: null,
  lastError: null,
};

function appendOpenClawUninstallLog(chunk) {
  const s = typeof chunk === "string" ? chunk : String(chunk ?? "");
  openclawUninstallDiag.log += s;
  if (openclawUninstallDiag.log.length > MAX_OPENCLAW_INSTALL_LOG) {
    openclawUninstallDiag.log =
      "...[日志过长已截断]\n" + openclawUninstallDiag.log.slice(-(MAX_OPENCLAW_INSTALL_LOG - 80));
  }
}

function getOpenClawUninstallDiagSnapshot() {
  return {
    running: openclawUninstallDiag.running,
    log: openclawUninstallDiag.log,
    exitCode: openclawUninstallDiag.exitCode,
    lastError: openclawUninstallDiag.lastError,
  };
}

/** 安装过程：同时打服务端控制台 + 写入面板轮询日志 */
function installClientLog(streamLog, line) {
  const s = typeof line === "string" ? line : String(line);
  const out = s.endsWith("\n") ? s : `${s}\n`;
  console.log("[OpenClaw install]", out.replace(/\n+$/, ""));
  if (typeof streamLog === "function") streamLog(out);
}

function detectMacLocalOpenClaw() {
  if (process.platform !== "darwin") {
    return {
      installed: false,
      method: "unsupported_platform",
      binaryPath: null,
      appPath: null,
      searchedPaths: [],
    };
  }
  const home = os.homedir();
  const candidates = [
    "/opt/homebrew/bin/openclaw",
    "/usr/local/bin/openclaw",
    path.join(home, ".npm-global", "bin", "openclaw"),
    path.join(home, "Library", "Application Support", "OpenClaw", "bin", "openclaw"),
  ];
  const hit = candidates.find((p) => fs.existsSync(p));
  const appPath = "/Applications/OpenClaw.app";
  const appExists = fs.existsSync(appPath);
  if (hit) {
    return {
      installed: true,
      method: "binary_exists",
      binaryPath: hit,
      appPath: appExists ? appPath : null,
      searchedPaths: candidates,
    };
  }
  if (appExists) {
    return {
      installed: true,
      method: "app_bundle_exists",
      binaryPath: null,
      appPath,
      searchedPaths: candidates,
    };
  }
  return {
    installed: false,
    method: "not_found",
    binaryPath: null,
    appPath: null,
    searchedPaths: candidates,
  };
}

/**
 * 与 discoverOpenClawInstallations 结果对齐的「本机 OpenClaw」摘要（供 localInstall / 旧 API）。
 * macOS 仍优先固定路径 + .app；Windows/Linux 用清单中的二进制（where / npm prefix / 静态候选）。
 */
function computeLocalInstallFromOpenClawDiscovery(discovery) {
  const platformDarwin = process.platform === "darwin";
  const binaries = discovery?.binaries || [];
  if (platformDarwin) {
    const mac = detectMacLocalOpenClaw();
    if (mac.installed) return mac;
  }
  const first = binaries.find((b) => b && typeof b.path === "string" && b.path.trim());
  if (first) {
    return {
      installed: true,
      method: "discovery_path",
      binaryPath: first.path,
      appPath: platformDarwin && discovery?.openClawMacApp ? discovery.openClawMacApp : null,
      searchedPaths: binaries.map((b) => b.path).filter(Boolean),
    };
  }
  if (platformDarwin && discovery?.openClawMacApp) {
    return {
      installed: true,
      method: "app_bundle_exists",
      binaryPath: null,
      appPath: discovery.openClawMacApp,
      searchedPaths: [],
    };
  }
  return {
    installed: false,
    method: "not_found",
    binaryPath: null,
    appPath: null,
    searchedPaths: binaries.map((b) => b.path).filter(Boolean),
  };
}

/** 非 Windows：优先 bash 支持 -lc（login PATH，兼容 nvm）；否则 /bin/sh -c */
function unixLoginShell() {
  const bash = "/bin/bash";
  if (fs.existsSync(bash)) return { exe: bash, arg: "-lc" };
  return { exe: "/bin/sh", arg: "-c" };
}

/**
 * npm install -g 不依赖仓库目录；固定用用户目录下可写路径作为 cwd，避免：
 * - 打包后 __dirname 落在 app.asar 内；
 * - Electron 下 process.cwd() / 仓库路径异常；
 * - PATH 里叫 sh/npm 的怪东西（配合 utils 里绝对路径 shell）。
 */
function getOpenClawInstallCwd() {
  /** 全局 npm 仅需可写目录；固定 tmp 避免家目录/权限/奇怪 fs 导致 spawn ENOTDIR */
  return os.tmpdir();
}

/**
 * 查询 npm registry 上 openclaw 当前 latest 版本（与外置 prefix 安装使用同一套 npm 来源：内置/外置专用 Node 或系统 npm）。
 * @returns {Promise<{ ok: true, latestVersion: string } | { ok: false, error: string }>}
 */
async function queryOpenclawNpmLatestVersion() {
  const installCwd = getOpenClawInstallCwd();
  const platform = detectPlatform();
  let npmProfile = "bundled";
  if (hasEmbeddedNode("external")) npmProfile = "external";
  else if (hasEmbeddedNode("bundled")) npmProfile = "bundled";
  const hasEmbedded = hasEmbeddedNode(npmProfile);
  const hasSystemNpm = await hasCommand("npm");

  if (!hasEmbedded && !hasSystemNpm) {
    return {
      ok: false,
      error: "需要本机 npm 或面板已下载的 Node（内置 / 外置专用目录）才能查询 npm registry。",
    };
  }

  const args = ["view", "openclaw", "version"];
  try {
    let r;
    if (hasEmbedded) {
      r = await runEmbeddedNpm(args, { cwd: installCwd, profile: npmProfile });
    } else if (platform === "windows") {
      r = await execWithOutput("cmd.exe", ["/c", "npm", ...args], {
        shell: false,
        cwd: installCwd,
        env: sanitizeInstallEnv(),
      });
    } else {
      const { exe, arg } = unixLoginShell();
      r = await execWithOutput(exe, [arg, "npm view openclaw version"], {
        shell: false,
        cwd: installCwd,
        env: sanitizeInstallEnv(),
      });
    }
    if (r.code !== 0) {
      const err =
        [r.stderr, r.stdout].map((x) => String(x || "").trim()).filter(Boolean).join("\n") || `npm 退出码 ${r.code}`;
      return { ok: false, error: err };
    }
    const lines = String(r.stdout || "")
      .trim()
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);
    const v = lines[lines.length - 1];
    if (!v || !/^[\d.]/.test(v)) {
      return { ok: false, error: `npm 返回无法解析的版本: ${JSON.stringify(lines)}` };
    }
    return { ok: true, latestVersion: v };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * 内置卡实际使用的 openclaw CLI 的 --version（与 getOpenClawCliSource 中 project-modules / packaged 路径一致）。
 */
function readBundledOpenClawCliVersion() {
  const localBinDir = path.join(__dirname, "../../node_modules/.bin");
  const localBin = process.platform === "win32" ? path.join(localBinDir, "openclaw.cmd") : path.join(localBinDir, "openclaw");
  if (fs.existsSync(localBin)) {
    return tryOpenClawVersion(localBin);
  }
  const packagedBin = getPackagedOpenClawBinFromUnpacked();
  if (packagedBin?.bin && fs.existsSync(packagedBin.bin)) {
    return tryOpenClawVersion(packagedBin.bin);
  }
  const mjs = getPackagedOpenClawMjsPath();
  const nodeExe = resolveRealNodeExecutable();
  if (mjs && nodeExe) {
    try {
      const out = execFileSync(nodeExe, [mjs, "--version"], {
        encoding: "utf8",
        timeout: 8000,
        maxBuffer: 512 * 1024,
        cwd: os.tmpdir(),
      });
      const line = String(out || "")
        .trim()
        .split(/\r?\n/)[0];
      return line ? line.slice(0, 256) : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * @param {string} rawCmd
 * @param {(chunk: string) => void} [onChunk] 若传入则 npm / onboard / 自定义命令使用流式输出
 * @param {{ installTarget?: "default" | "clawheart-external" }} [opts]
 */
async function runInstallCommand(rawCmd, onChunk, opts = {}) {
  const streamLog = typeof onChunk === "function" ? (s) => onChunk(s) : null;
  const platform = detectPlatform();
  const cmd = String(rawCmd || "").trim();
  const installCwd = getOpenClawInstallCwd();
  const installTarget =
    opts && String(opts.installTarget || "").trim() === "clawheart-external"
      ? "clawheart-external"
      : "default";

  installClientLog(streamLog, `[开始] ${new Date().toISOString()}`);
  installClientLog(streamLog, `平台: ${platform} · 安装 cwd: ${installCwd}`);
  installClientLog(
    streamLog,
    installTarget === "clawheart-external"
      ? "流程: ClawHeart 外置 prefix（~/.opencarapace/external-openclaw）+ npm -g --prefix + onboard"
      : cmd
        ? `自定义安装命令: ${cmd}`
        : "默认流程: 全局 npm 安装 openclaw@latest，然后 onboard --install-daemon"
  );

  if (installTarget === "clawheart-external") {
    const { getExternalOpenClawNpmPrefix, resolveExternalOpenClawBinPath } = require("./openclaw-external.js");
    const prefix = getExternalOpenClawNpmPrefix();
    fs.mkdirSync(prefix, { recursive: true });
    installClientLog(streamLog, `外置 npm prefix: ${prefix}\n`);

    let npmProfile = "bundled";
    if (hasEmbeddedNode("external")) npmProfile = "external";
    else if (hasEmbeddedNode("bundled")) npmProfile = "bundled";

    const hasEmbedded = hasEmbeddedNode(npmProfile);
    const hasSystemNpm = await hasCommand("npm");
    if (!hasEmbedded && !hasSystemNpm) {
      const msg =
        "外置安装需要 npm：请在外置卡片打开「Node」下载专用运行时，或使用内置卡已下载的运行时 / 本机 Node。";
      installClientLog(streamLog, msg);
      return { used: "none", code: 1, stdout: "", stderr: msg };
    }

    let r;
    if (hasEmbedded) {
      installClientLog(
        streamLog,
        `\n--- 步骤 1/2: 客户端 npm（${npmProfile}）· install -g openclaw@latest --prefix ---\n`
      );
      r = streamLog
        ? await runEmbeddedNpmStream(
            ["install", "-g", "openclaw@latest", "--prefix", prefix],
            { cwd: installCwd, profile: npmProfile },
            streamLog
          )
        : await runEmbeddedNpm(["install", "-g", "openclaw@latest", "--prefix", prefix], {
            cwd: installCwd,
            profile: npmProfile,
          });
    } else if (platform === "windows") {
      installClientLog(streamLog, "\n--- 步骤 1/2: cmd · npm install -g openclaw@latest --prefix ---\n");
      r = streamLog
        ? await execWithOutputStream(
            "cmd.exe",
            ["/c", "npm", "install", "-g", "openclaw@latest", "--prefix", prefix],
            { shell: false, cwd: installCwd, env: sanitizeInstallEnv() },
            (s) => streamLog(s)
          )
        : await execWithOutput("cmd.exe", ["/c", "npm", "install", "-g", "openclaw@latest", "--prefix", prefix], {
            shell: false,
            cwd: installCwd,
            env: sanitizeInstallEnv(),
          });
    } else {
      const { exe, arg } = unixLoginShell();
      const shLine = `npm install -g openclaw@latest --prefix ${JSON.stringify(prefix)}`;
      installClientLog(streamLog, `\n--- 步骤 1/2: ${exe} ${arg} · ${shLine} ---\n`);
      r = streamLog
        ? await execWithOutputStream(
            exe,
            [arg, shLine],
            { shell: false, cwd: installCwd, env: sanitizeInstallEnv() },
            (s) => streamLog(s)
          )
        : await execWithOutput(exe, [arg, shLine], {
            shell: false,
            cwd: installCwd,
            env: sanitizeInstallEnv(),
          });
    }

    installClientLog(streamLog, `\n[步骤 1 结束] 退出码 ${r.code}`);
    if (r.code !== 0) {
      if (r.stderr && streamLog) installClientLog(streamLog, `stderr:\n${r.stderr}`);
      if (r.stdout && streamLog) installClientLog(streamLog, `stdout:\n${r.stdout}`);
      return { used: hasEmbedded ? "embedded-npm" : "system-npm", ...r };
    }

    installClientLog(
      streamLog,
      "\n--- 步骤 2/2: 外置 openclaw onboard --install-daemon（非交互：--non-interactive --accept-risk）---\n"
    );
    const extBin = resolveExternalOpenClawBinPath();
    if (!extBin) {
      const msg = "步骤 1 已完成，但未在 prefix/bin 下找到 openclaw，请查看上方日志。";
      installClientLog(streamLog, msg);
      return { used: hasEmbedded ? "embedded-npm" : "system-npm", code: 1, stdout: "", stderr: msg };
    }

    try {
      let ob = { code: 0, stdout: "", stderr: "" };
      const onboardDaemonArgs = [
        "onboard",
        "--install-daemon",
        "--non-interactive",
        "--accept-risk",
      ];
      const obEnv = buildOpenClawChildEnv(null, { gatewayOpenclawBinary: "external" });
      if (platform === "windows") {
        ob = streamLog
          ? await execWithOutputStream(
              "cmd.exe",
              ["/c", extBin, ...onboardDaemonArgs],
              { shell: false, cwd: installCwd, env: obEnv },
              (s) => streamLog(s)
            )
          : await execWithOutput("cmd.exe", ["/c", extBin, ...onboardDaemonArgs], {
              shell: false,
              cwd: installCwd,
              env: obEnv,
            });
      } else {
        ob = streamLog
          ? await execWithOutputStream(
              extBin,
              onboardDaemonArgs,
              { shell: false, cwd: installCwd, env: obEnv },
              (s) => streamLog(s)
            )
          : await execWithOutput(extBin, onboardDaemonArgs, {
              shell: false,
              cwd: installCwd,
              env: obEnv,
            });
      }
      installClientLog(streamLog, `\n[步骤 2 结束] 退出码 ${ob.code}`);
      if (ob.stderr?.trim()) installClientLog(streamLog, `onboard stderr:\n${ob.stderr}`);
      if (ob.code !== 0 && ob.stdout?.trim()) installClientLog(streamLog, `onboard stdout:\n${ob.stdout}`);
    } catch (e) {
      installClientLog(streamLog, `[步骤 2 异常] ${e?.message ?? e}`);
    }
    return { used: hasEmbedded ? "embedded-npm" : "system-npm", ...r };
  }

  if (!cmd) {
    const hasEmbedded = hasEmbeddedNode("bundled");
    installClientLog(streamLog, `检测到内置 Node 目录: ${hasEmbedded ? "是" : "否"}`);
    if (hasEmbedded) {
      try {
        const ep = getEmbeddedNodePath("bundled");
        installClientLog(streamLog, `内置 node: ${ep.node}`);
        installClientLog(streamLog, `内置 npm: ${ep.npm}`);
      } catch (e) {
        installClientLog(streamLog, `读取内置路径失败: ${e?.message ?? e}`);
      }
    }

    installClientLog(streamLog, "正在检测系统 PATH 中是否存在 npm…");
    const hasSystemNpm = await hasCommand("npm");
    installClientLog(streamLog, `系统 npm 可用: ${hasSystemNpm ? "是" : "否"}`);

    if (!hasEmbedded && !hasSystemNpm) {
      const msg =
        "未检测到系统 npm，且本机尚未下载客户端自带的运行时 Node。请在 OpenClaw 面板黄色提示区点击「下载运行时 Node」，完成后再点「安装 OpenClaw」。";
      installClientLog(streamLog, msg);
      return {
        used: "none",
        code: 1,
        stdout: "",
        stderr: msg,
      };
    }

    let r;
    if (hasEmbedded) {
      installClientLog(streamLog, "\n--- 步骤 1/2: 内置 npm · npm install -g openclaw@latest ---\n");
      r = streamLog
        ? await runEmbeddedNpmStream(["install", "-g", "openclaw@latest"], { cwd: installCwd }, streamLog)
        : await runEmbeddedNpm(["install", "-g", "openclaw@latest"], { cwd: installCwd });
    } else if (platform === "windows") {
      installClientLog(streamLog, "\n--- 步骤 1/2: cmd · npm install -g openclaw@latest ---\n");
      r = streamLog
        ? await execWithOutputStream(
            "cmd.exe",
            ["/c", "npm", "install", "-g", "openclaw@latest"],
            { shell: false, cwd: installCwd, env: sanitizeInstallEnv() },
            (s) => streamLog(s)
          )
        : await execWithOutput("cmd.exe", ["/c", "npm", "install", "-g", "openclaw@latest"], {
            shell: false,
            cwd: installCwd,
            env: sanitizeInstallEnv(),
          });
    } else {
      const { exe, arg } = unixLoginShell();
      installClientLog(streamLog, `\n--- 步骤 1/2: ${exe} ${arg} · npm install -g openclaw@latest ---\n`);
      r = streamLog
        ? await execWithOutputStream(
            exe,
            [arg, "npm install -g openclaw@latest"],
            { shell: false, cwd: installCwd, env: sanitizeInstallEnv() },
            (s) => streamLog(s)
          )
        : await execWithOutput(exe, [arg, "npm install -g openclaw@latest"], {
            shell: false,
            cwd: installCwd,
            env: sanitizeInstallEnv(),
          });
    }

    installClientLog(streamLog, `\n[步骤 1 结束] 退出码 ${r.code}`);
    if (r.code !== 0) {
      if (r.stderr && streamLog) installClientLog(streamLog, `stderr:\n${r.stderr}`);
      if (r.stdout && streamLog) installClientLog(streamLog, `stdout:\n${r.stdout}`);
      return { used: hasEmbedded ? "embedded-npm" : "system-npm", ...r };
    }

    installClientLog(
      streamLog,
      "\n--- 步骤 2/2: openclaw onboard --install-daemon（--non-interactive --accept-risk）---\n"
    );
    try {
      let ob = { code: 0, stdout: "", stderr: "" };
      const onboardSh = "openclaw onboard --install-daemon --non-interactive --accept-risk";
      if (platform === "windows") {
        ob = streamLog
          ? await execWithOutputStream(
              "cmd.exe",
              ["/c", "openclaw", "onboard", "--install-daemon", "--non-interactive", "--accept-risk"],
              { shell: false, cwd: installCwd, env: sanitizeInstallEnv() },
              (s) => streamLog(s)
            )
          : await execWithOutput("cmd.exe", ["/c", "openclaw", "onboard", "--install-daemon", "--non-interactive", "--accept-risk"], {
              shell: false,
              cwd: installCwd,
              env: sanitizeInstallEnv(),
            });
      } else {
        const { exe, arg } = unixLoginShell();
        ob = streamLog
          ? await execWithOutputStream(
              exe,
              [arg, onboardSh],
              { shell: false, cwd: installCwd, env: sanitizeInstallEnv() },
              (s) => streamLog(s)
            )
          : await execWithOutput(exe, [arg, onboardSh], {
              shell: false,
              cwd: installCwd,
              env: sanitizeInstallEnv(),
            });
      }
      installClientLog(streamLog, `\n[步骤 2 结束] 退出码 ${ob.code}`);
      if (ob.stderr?.trim()) installClientLog(streamLog, `onboard stderr:\n${ob.stderr}`);
      if (ob.code !== 0 && ob.stdout?.trim()) installClientLog(streamLog, `onboard stdout:\n${ob.stdout}`);
    } catch (e) {
      installClientLog(streamLog, `[步骤 2 异常] ${e?.message ?? e}`);
    }
    return { used: hasEmbedded ? "embedded-npm" : "system-npm", ...r };
  }

  // 自定义命令
  if (platform === "windows") {
    installClientLog(streamLog, "\n--- 自定义: PowerShell 执行 ---\n");
    const r = streamLog
      ? await execWithOutputStream(
          "powershell.exe",
          ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd],
          { shell: false, cwd: installCwd, env: sanitizeInstallEnv() },
          (s) => streamLog(s)
        )
      : await execWithOutput("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd], {
          shell: false,
          cwd: installCwd,
          env: sanitizeInstallEnv(),
        });
    installClientLog(streamLog, `\n[自定义命令结束] 退出码 ${r.code}`);
    if (r.stderr?.trim()) installClientLog(streamLog, r.stderr);
    if (r.stdout?.trim()) installClientLog(streamLog, r.stdout);
    return { used: "powershell", ...r };
  }
  const { exe, arg } = unixLoginShell();
  installClientLog(streamLog, `\n--- 自定义: ${exe} ${arg} ---\n`);
  const r = streamLog
    ? await execWithOutputStream(
        exe,
        [arg, cmd],
        { shell: false, cwd: installCwd, env: sanitizeInstallEnv() },
        (s) => streamLog(s)
      )
    : await execWithOutput(exe, [arg, cmd], {
        shell: false,
        cwd: installCwd,
        env: sanitizeInstallEnv(),
      });
  installClientLog(streamLog, `\n[自定义命令结束] 退出码 ${r.code}`);
  if (r.stderr?.trim()) installClientLog(streamLog, r.stderr);
  if (r.stdout?.trim()) installClientLog(streamLog, r.stdout);
  return { used: "sh", ...r };
}

function isSafeNpmPackageName(name) {
  const s = String(name || "").trim();
  if (!s || s.length > 214) return false;
  if (s.startsWith("@")) {
    const i = s.indexOf("/");
    if (i <= 1 || i === s.length - 1) return false;
    const scope = s.slice(1, i);
    const pkg = s.slice(i + 1);
    if (!/^[a-zA-Z0-9._-]+$/.test(scope) || !/^[a-zA-Z0-9._-]+$/.test(pkg)) return false;
    return true;
  }
  return /^[a-zA-Z0-9._-]+$/.test(s);
}

async function collectClawEnvironment() {
  let systemNpmOk = false;
  let systemNodeOk = false;
  let systemNpmVersion = null;
  let systemNodeVersion = null;
  const unixSh = fs.existsSync("/bin/bash") ? "/bin/bash" : "/bin/sh";
  const unixArg = fs.existsSync("/bin/bash") ? "-lc" : "-c";
  const winProbeEnv = process.platform === "win32" ? envWithWindowsNodePathProbe() : null;

  if (process.platform === "win32") {
    const directNode = resolveWindowsSystemNodeExeSync();
    if (directNode) {
      systemNodeOk = true;
      try {
        const out = execFileSync(directNode, ["--version"], {
          encoding: "utf8",
          timeout: 8000,
          windowsHide: true,
          maxBuffer: 64 * 1024,
        });
        const line = String(out || "")
          .trim()
          .split(/\r?\n/)[0];
        if (line) systemNodeVersion = line;
      } catch {
        /* ignore */
      }
      const npmCmd = path.join(path.dirname(directNode), "npm.cmd");
      if (fs.existsSync(npmCmd)) {
        systemNpmOk = true;
        try {
          const r = await execWithOutput("cmd.exe", ["/c", npmCmd, "--version"], {
            cwd: os.tmpdir(),
            env: winProbeEnv,
          });
          if (r.code === 0 && r.stdout?.trim()) systemNpmVersion = r.stdout.trim().split(/\r?\n/)[0];
        } catch {
          /* ignore */
        }
      }
    }
    if (!systemNodeOk) systemNodeOk = await hasCommand("node");
    if (!systemNpmOk) systemNpmOk = await hasCommand("npm");
    try {
      if (systemNodeOk && !systemNodeVersion) {
        const r = await execWithOutput("cmd.exe", ["/c", "node", "--version"], {
          cwd: os.tmpdir(),
          env: winProbeEnv,
        });
        if (r.code === 0 && r.stdout?.trim()) systemNodeVersion = r.stdout.trim().split(/\r?\n/)[0];
      }
    } catch {
      /* ignore */
    }
    try {
      if (systemNpmOk && !systemNpmVersion) {
        const r = await execWithOutput("cmd.exe", ["/c", "npm", "--version"], {
          cwd: os.tmpdir(),
          env: winProbeEnv,
        });
        if (r.code === 0 && r.stdout?.trim()) systemNpmVersion = r.stdout.trim().split(/\r?\n/)[0];
      }
    } catch {
      /* ignore */
    }
  } else {
    systemNpmOk = await hasCommand("npm");
    systemNodeOk = await hasCommand("node");
    try {
      if (systemNpmOk) {
        const r = await execWithOutput(unixSh, [unixArg, "npm --version"], { cwd: os.tmpdir() });
        if (r.code === 0 && r.stdout?.trim()) systemNpmVersion = r.stdout.trim().split(/\r?\n/)[0];
      }
    } catch {
      /* ignore */
    }
    try {
      if (systemNodeOk) {
        const r = await execWithOutput(unixSh, [unixArg, "node --version"], { cwd: os.tmpdir() });
        if (r.code === 0 && r.stdout?.trim()) systemNodeVersion = r.stdout.trim().split(/\r?\n/)[0];
      }
    } catch {
      /* ignore */
    }
  }
  return {
    platform: process.platform,
    arch: process.arch,
    homedir: os.homedir(),
    serviceNodeVersion: process.version,
    hasEmbeddedNode: hasEmbeddedNode("bundled"),
    hasExternalGatewayNode: hasEmbeddedNode("external"),
    embeddedNodePaths: hasEmbeddedNode("bundled") ? getEmbeddedNodePath("bundled") : null,
    externalGatewayNodePaths: hasEmbeddedNode("external") ? getEmbeddedNodePath("external") : null,
    packagedNodePath: getBundledNodeFromInstaller() || null,
    clientNodeRuntimeTarget: NODE_VERSION,
    hasSystemNpm: systemNpmOk,
    systemNpmVersion,
    systemNodeVersion,
  };
}

/**
 * 移除 npm 全局包（不删除各厂商状态目录）
 * @param {string} packageName
 * @param {(chunk: string) => void} [onChunk]
 * @param {{ npmPrefix?: string }} [opts] 若提供则执行 npm uninstall -g --prefix
 */
async function runNpmUninstallGlobalPackage(packageName, onChunk, opts = {}) {
  const streamLog = typeof onChunk === "function" ? (s) => onChunk(s) : null;
  const platform = detectPlatform();
  const cwd = getOpenClawInstallCwd();
  const pkg = String(packageName || "").trim();
  const npmPrefix = typeof opts?.npmPrefix === "string" && opts.npmPrefix.trim() ? opts.npmPrefix.trim() : "";
  installClientLog(streamLog, `[卸载] ${new Date().toISOString()} · cwd: ${cwd}\n`);
  installClientLog(
    streamLog,
    npmPrefix ? `流程: npm uninstall -g ${pkg} --prefix ${npmPrefix}\n` : `流程: npm uninstall -g ${pkg}\n`
  );

  const { getExternalOpenClawNpmPrefix } = require("./openclaw-external.js");
  const extPrefixResolved = path.resolve(getExternalOpenClawNpmPrefix());
  const forExternalPrefix = npmPrefix && path.resolve(npmPrefix) === extPrefixResolved;

  let npmProfile = "bundled";
  if (forExternalPrefix) {
    if (hasEmbeddedNode("external")) npmProfile = "external";
    else npmProfile = "bundled";
  } else {
    if (hasEmbeddedNode("bundled")) npmProfile = "bundled";
    else if (hasEmbeddedNode("external")) npmProfile = "external";
  }

  const hasEmbedded = hasEmbeddedNode(npmProfile);
  const hasSystemNpm = await hasCommand("npm");
  if (!hasEmbedded && !hasSystemNpm) {
    const msg = "未检测到 npm（无系统 npm 且未下载客户端运行时 Node），无法执行卸载。";
    installClientLog(streamLog, msg);
    return { used: "none", code: 1, stdout: "", stderr: msg };
  }

  const withPrefix = (base) => (npmPrefix ? [...base, "--prefix", npmPrefix] : base);

  let r;
  if (hasEmbedded) {
    installClientLog(
      streamLog,
      `\n客户端 npm（${npmProfile}）· npm uninstall -g ${pkg}${npmPrefix ? ` --prefix …` : ""}\n`
    );
    r = streamLog
      ? await runEmbeddedNpmStream(withPrefix(["uninstall", "-g", pkg]), { cwd, profile: npmProfile }, streamLog)
      : await runEmbeddedNpm(withPrefix(["uninstall", "-g", pkg]), { cwd, profile: npmProfile });
  } else if (platform === "windows") {
    installClientLog(streamLog, `\ncmd · npm uninstall -g ${pkg}\n`);
    const winArgs = ["/c", "npm", "uninstall", "-g", pkg, ...(npmPrefix ? ["--prefix", npmPrefix] : [])];
    r = streamLog
      ? await execWithOutputStream("cmd.exe", winArgs, { shell: false, cwd, env: sanitizeInstallEnv() }, (s) =>
          streamLog(s)
        )
      : await execWithOutput("cmd.exe", winArgs, {
          shell: false,
          cwd,
          env: sanitizeInstallEnv(),
        });
  } else {
    const { exe, arg } = unixLoginShell();
    const quoted = JSON.stringify(pkg);
    const shLine = npmPrefix
      ? `npm uninstall -g ${quoted} --prefix ${JSON.stringify(npmPrefix)}`
      : `npm uninstall -g ${quoted}`;
    installClientLog(streamLog, `\n${exe} ${arg} · ${shLine}\n`);
    r = streamLog
      ? await execWithOutputStream(
          exe,
          [arg, shLine],
          { shell: false, cwd, env: sanitizeInstallEnv() },
          (s) => streamLog(s)
        )
      : await execWithOutput(exe, [arg, shLine], {
          shell: false,
          cwd,
          env: sanitizeInstallEnv(),
        });
  }
  installClientLog(streamLog, `\n[卸载结束] 退出码 ${r.code}\n`);
  if (r.stderr && streamLog) installClientLog(streamLog, `stderr:\n${r.stderr}`);
  if (r.stdout && streamLog) installClientLog(streamLog, `stdout:\n${r.stdout}`);
  return { used: hasEmbedded ? "embedded-npm" : "system-npm", ...r };
}

function registerOpenClawRoutes(app) {
  app.get("/api/openclaw/discovery", async (_req, res) => {
    try {
      const discovery = await discoverOpenClawInstallations();
      res.status(200).json({ ok: true, discovery });
    } catch (e) {
      res.status(500).json({ ok: false, error: { message: e?.message ?? "探测失败" } });
    }
  });

  // 获取 OpenClaw 配置文件
  app.get("/api/openclaw/config", (req, res) => {
    try {
      const target = typeof req.query?.target === "string" ? req.query.target : "user-profile";
      const configPath = resolveConfigEditTarget(target);
      const config = readOpenClawConfigFromPath(configPath);
      res.status(200).json({
        ok: true,
        target,
        config: config || {},
        configPath,
        exists: !!config,
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: { message: e?.message ?? "读取配置失败" } });
    }
  });

  // 保存 OpenClaw 配置文件
  app.post("/api/openclaw/config-save", async (req, res) => {
    try {
      const { config, target } = req.body || {};

      if (!config || typeof config !== "object") {
        return res.status(400).json({ error: { message: "无效的配置数据" } });
      }

      const configPath = resolveConfigEditTarget(
        typeof target === "string" ? target : "user-profile"
      );
      writeOpenClawConfigToPath(configPath, config);

      res.status(200).json({
        ok: true,
        target: typeof target === "string" ? target : "user-profile",
        configPath,
        message: "配置已保存。重启 Gateway 后生效。",
      });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "保存配置失败" } });
    }
  });

  // 获取提供商预设列表
  app.get("/api/openclaw/providers", (_req, res) => {
    res.status(200).json({ providers: PROVIDER_PRESETS });
  });

  // 扫描目标 openclaw.json 中的 providers（仅返回安全字段）
  app.get("/api/openclaw/providers-scan", (req, res) => {
    try {
      const target = typeof req.query?.target === "string" ? req.query.target : "user-profile";
      const configPath = resolveConfigEditTarget(target);
      const config = readOpenClawConfigFromPath(configPath);
      const providersRoot =
        config &&
        typeof config === "object" &&
        config.models &&
        typeof config.models === "object" &&
        config.models.providers &&
        typeof config.models.providers === "object"
          ? config.models.providers
          : {};

      const providers = Object.entries(providersRoot).map(([provider, entry]) => {
        const record = entry && typeof entry === "object" ? entry : {};
        const models = Array.isArray(record.models) ? record.models : [];
        const baseUrl =
          typeof record.baseUrl === "string" && record.baseUrl.trim()
            ? record.baseUrl.trim()
            : null;
        const relayPrefix = baseUrl ? getClientRelayPrefixFromBaseUrl(baseUrl) : null;
        return {
          provider,
          baseUrl,
          api: typeof record.api === "string" && record.api.trim() ? record.api.trim() : null,
          auth: typeof record.auth === "string" && record.auth.trim() ? record.auth.trim() : null,
          modelCount: models.length,
          relayPrefix,
          isClientRelay: !!relayPrefix,
        };
      });

      res.status(200).json({
        ok: true,
        target,
        configPath,
        exists: !!config,
        providers,
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: { message: e?.message ?? "扫描 providers 失败" } });
    }
  });

  app.get("/api/openclaw/security-monitor/preview", (req, res) => {
    try {
      const target = typeof req.query?.target === "string" ? req.query.target : "user-profile";
      const configPath = resolveConfigEditTarget(target);
      const config = readOpenClawConfigFromPath(configPath);
      const rows = buildSecurityMonitorPreviewRows(target, config || {});
      const actionableRows = rows.filter((r) => r.hasBaseUrl);
      res.status(200).json({
        ok: true,
        target,
        configPath,
        exists: !!config,
        preview: actionableRows,
        summary: {
          totalProviders: rows.length,
          actionableProviders: actionableRows.length,
          willChangeProviders: actionableRows.filter((r) => r.willChange).length,
        },
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: { message: e?.message ?? "生成预览失败" } });
    }
  });

  app.get("/api/openclaw/security-monitor/status", async (req, res) => {
    try {
      const target = typeof req.query?.target === "string" ? req.query.target : "user-profile";
      const configPath = resolveConfigEditTarget(target);
      const config = readOpenClawConfigFromPath(configPath);
      const rows = buildSecurityMonitorPreviewRows(target, config || {});
      const actionableRows = rows.filter((r) => r.hasBaseUrl);
      const session = await getOpenClawSecurityMonitorSession(target);
      const backups = await listOpenClawSecurityMonitorBackups(target);
      const enabled = !!session?.enabled && backups.length > 0;
      const backupProviderSet = new Set(backups.map((b) => String(b.provider)));
      res.status(200).json({
        ok: true,
        target,
        enabled,
        configPath,
        exists: !!config,
        preview: actionableRows.map((r) => ({ ...r, hasBackup: backupProviderSet.has(r.provider) })),
        session: session || null,
        backupCount: backups.length,
        summary: {
          totalProviders: rows.length,
          actionableProviders: actionableRows.length,
          willChangeProviders: actionableRows.filter((r) => r.willChange).length,
        },
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: { message: e?.message ?? "读取监控状态失败" } });
    }
  });

  app.post("/api/openclaw/security-monitor/enable", async (req, res) => {
    try {
      const target = typeof req.body?.target === "string" ? req.body.target : "user-profile";
      // 可选：仅处理指定的 provider 列表（单独或批量操作）
      const providersFilter =
        Array.isArray(req.body?.providers) && req.body.providers.length > 0
          ? new Set(req.body.providers.map(String))
          : null;

      const configPath = resolveConfigEditTarget(target);
      const config = readOpenClawConfigFromPath(configPath) || {};
      const providersRoot = extractProvidersFromConfig(config);
      let rows = buildSecurityMonitorPreviewRows(target, config).filter((r) => r.hasBaseUrl);
      if (providersFilter) rows = rows.filter((r) => providersFilter.has(r.provider));
      if (rows.length === 0) {
        return res.status(400).json({ ok: false, error: { message: "未找到可处理的 provider baseUrl" } });
      }

      const mappings = await listLlmMappings();
      const mappingByPrefix = new Map(
        (Array.isArray(mappings) ? mappings : []).map((m) => [String(m.prefix || "").trim(), String(m.target_base || "")])
      );

      // 合并已有备份，避免覆盖其他 provider 的备份
      const existingBackups = await listOpenClawSecurityMonitorBackups(target);
      const existingProviderSet = new Set(existingBackups.map((b) => String(b.provider)));
      const newBackups = [];
      let changedProviders = 0;

      for (const row of rows) {
        // 已是任意 127.0.0.1:19111 中转地址，跳过——不备份、不改配置
        if (row.isAlreadyAnyRelay) continue;

        const currentBaseUrl = row.currentBaseUrl;
        const prefix = row.relayPrefix;
        const mappingBefore = mappingByPrefix.get(prefix);
        if (!existingProviderSet.has(row.provider)) {
          newBackups.push({
            provider: row.provider,
            originalBaseUrl: currentBaseUrl,
            relayPrefix: prefix,
            mappingExistedBefore: mappingByPrefix.has(prefix),
            mappingTargetBefore: mappingByPrefix.has(prefix) ? mappingBefore || null : null,
          });
        }
        await upsertLlmMapping({ prefix, target_base: currentBaseUrl });
        const cur = providersRoot[row.provider];
        providersRoot[row.provider] = { ...cur, baseUrl: row.relayBaseUrl };
        changedProviders += 1;
      }

      writeOpenClawConfigToPath(configPath, config);
      await replaceOpenClawSecurityMonitorBackups(target, [...existingBackups, ...newBackups]);
      await upsertOpenClawSecurityMonitorSession({ target, enabled: true, configPath });
      res.status(200).json({
        ok: true,
        target,
        configPath,
        changedProviders,
        totalProviders: rows.length,
        message:
          changedProviders > 0
            ? `已为 ${changedProviders} 个 provider 开启监控，关闭时可自动恢复`
            : "所选 provider 均已在中转状态，无需修改",
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: { message: e?.message ?? "开启安全监控失败" } });
    }
  });

  app.post("/api/openclaw/security-monitor/disable", async (req, res) => {
    try {
      const target = typeof req.body?.target === "string" ? req.body.target : "user-profile";
      // 可选：仅恢复指定的 provider 列表（单独或批量操作）
      const providersFilter =
        Array.isArray(req.body?.providers) && req.body.providers.length > 0
          ? new Set(req.body.providers.map(String))
          : null;

      const configPath = resolveConfigEditTarget(target);
      const config = readOpenClawConfigFromPath(configPath) || {};
      const providersRoot = extractProvidersFromConfig(config);
      const allBackups = await listOpenClawSecurityMonitorBackups(target);

      const toRestore = providersFilter ? allBackups.filter((b) => providersFilter.has(String(b.provider))) : allBackups;
      const remaining = providersFilter ? allBackups.filter((b) => !providersFilter.has(String(b.provider))) : [];

      if (toRestore.length === 0) {
        if (!providersFilter) {
          await upsertOpenClawSecurityMonitorSession({ target, enabled: false, configPath });
        }
        return res.status(200).json({
          ok: true,
          target,
          configPath,
          restoredProviders: 0,
          message: "无对应备份项，未做恢复",
        });
      }

      let restoredProviders = 0;
      for (const item of toRestore) {
        const cur = providersRoot[item.provider];
        if (cur && typeof cur === "object") {
          providersRoot[item.provider] = { ...cur, baseUrl: item.originalBaseUrl };
          restoredProviders += 1;
        }
        if (item.mappingExistedBefore) {
          if (item.mappingTargetBefore && String(item.mappingTargetBefore).trim()) {
            await upsertLlmMapping({
              prefix: item.relayPrefix,
              target_base: String(item.mappingTargetBefore).trim(),
            });
          }
        } else {
          await deleteLlmMappingByPrefix(item.relayPrefix);
        }
      }

      writeOpenClawConfigToPath(configPath, config);
      if (remaining.length > 0) {
        await replaceOpenClawSecurityMonitorBackups(target, remaining);
        await upsertOpenClawSecurityMonitorSession({ target, enabled: true, configPath });
      } else {
        await clearOpenClawSecurityMonitorBackups(target);
        await upsertOpenClawSecurityMonitorSession({ target, enabled: false, configPath });
      }
      res.status(200).json({
        ok: true,
        target,
        configPath,
        restoredProviders,
        message:
          remaining.length > 0
            ? `已恢复 ${restoredProviders} 个 provider，其余 ${remaining.length} 个仍在监控中`
            : `已关闭监控并恢复 ${restoredProviders} 个 provider 的原始配置`,
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: { message: e?.message ?? "关闭安全监控失败" } });
    }
  });

  // 一键中转：把 provider baseUrl 切到本地网关，并自动写入网络映射（prefix -> 原始 baseUrl）
  app.post("/api/openclaw/provider-relay", async (req, res) => {
    try {
      const target = typeof req.body?.target === "string" ? req.body.target : "user-profile";
      const provider = typeof req.body?.provider === "string" ? req.body.provider.trim() : "";
      if (!provider) {
        return res.status(400).json({ ok: false, error: { message: "provider 不能为空" } });
      }

      const configPath = resolveConfigEditTarget(target);
      const config = readOpenClawConfigFromPath(configPath) || {};
      const providersRoot =
        config &&
        typeof config === "object" &&
        config.models &&
        typeof config.models === "object" &&
        config.models.providers &&
        typeof config.models.providers === "object"
          ? config.models.providers
          : null;
      if (!providersRoot) {
        return res.status(400).json({ ok: false, error: { message: "配置中不存在 models.providers" } });
      }

      const entry = providersRoot[provider];
      if (!entry || typeof entry !== "object") {
        return res.status(404).json({ ok: false, error: { message: `未找到 provider: ${provider}` } });
      }

      const currentBaseUrl =
        typeof entry.baseUrl === "string" && entry.baseUrl.trim() ? entry.baseUrl.trim() : null;
      if (!currentBaseUrl) {
        return res.status(400).json({ ok: false, error: { message: "当前 provider 未配置 baseUrl，无法自动中转" } });
      }

      const existingRelayPrefix = getClientRelayPrefixFromBaseUrl(currentBaseUrl);
      const prefix = normalizeProviderPrefix(provider);
      const relayBaseUrl = `${CLIENT_RELAY_ORIGIN}/${prefix}`;
      if (existingRelayPrefix === prefix) {
        return res.status(200).json({
          ok: true,
          target,
          provider,
          configPath,
          relayBaseUrl,
          mapping: { prefix, targetBase: null, reused: true },
          message: "当前 provider 已是本地中转地址",
        });
      }
      if (existingRelayPrefix && existingRelayPrefix !== prefix) {
        return res.status(409).json({
          ok: false,
          error: { message: `当前 baseUrl 已是中转地址（/${existingRelayPrefix}），请先手动确认后再替换` },
        });
      }

      await upsertLlmMapping({ prefix, target_base: currentBaseUrl });
      providersRoot[provider] = { ...entry, baseUrl: relayBaseUrl };
      writeOpenClawConfigToPath(configPath, config);

      res.status(200).json({
        ok: true,
        target,
        provider,
        configPath,
        relayBaseUrl,
        mapping: { prefix, targetBase: currentBaseUrl, reused: false },
        message: "已完成一键中转：映射已写入，provider baseUrl 已替换为本地网关地址",
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: { message: e?.message ?? "一键中转失败" } });
    }
  });

  // 启动 Gateway（双路独立：body.gatewayOpenclawBinary 决定启哪路）
  app.post("/api/openclaw/start-gateway", async (req, res) => {
    try {
      const rawBin = req.body?.gatewayOpenclawBinary;
      const { normalizeGatewayOpenclawBinary } = require("./openclaw-external.js");
      const mode = normalizeGatewayOpenclawBinary(rawBin);
      // 保存「最后激活模式」到 DB（仅供 UI 记忆上次选择，不影响双路启动逻辑）
      if (rawBin != null) {
        const cur = await getOpenClawSettings();
        await saveOpenClawSettings({ ...cur, gatewayOpenclawBinary: mode });
      }
      // 直接传 mode 给 startEmbeddedOpenClaw，绕过全局工作区状态竞争
      const result = await startEmbeddedOpenClaw(mode);
      res.status(200).json({
        ok: result,
        mode,
        message: result ? `${mode} Gateway 已启动` : `${mode} Gateway 启动失败或超时，见诊断日志`,
        ...jsonGatewayDiagnosticFields(),
      });
    } catch (e) {
      res.status(500).json({
        error: { message: e?.message ?? "启动失败" },
        ...jsonGatewayDiagnosticFields(),
      });
    }
  });

  // 停止 Gateway（双路独立：body.gatewayOpenclawBinary 决定停哪路）
  app.post("/api/openclaw/stop-gateway", async (req, res) => {
    try {
      const rawBin = req.body?.gatewayOpenclawBinary;
      const { normalizeGatewayOpenclawBinary } = require("./openclaw-external.js");
      const mode = normalizeGatewayOpenclawBinary(rawBin);
      const stopped = await stopEmbeddedOpenClaw(mode);
      res.status(200).json({
        ok: stopped,
        mode,
        message: stopped
          ? `${mode} Gateway 已停止`
          : `${mode} Gateway 可能仍在运行，请查看诊断日志或手动结束相关进程`,
        ...jsonGatewayDiagnosticFields(),
      });
    } catch (e) {
      res.status(500).json({
        error: { message: e?.message ?? "停止失败" },
        ...jsonGatewayDiagnosticFields(),
      });
    }
  });

  /**
   * 结束占用 Gateway 端口的进程：仅当该 PID 正在监听「设置中的 UI 端口」或请求里给出的冲突端口时执行。
   */
  app.post("/api/openclaw/kill-gateway-port-listener", async (req, res) => {
    try {
      const pid = Number(req.body?.pid);
      const conflictPort =
        req.body?.conflictPort != null && req.body.conflictPort !== ""
          ? Number(req.body.conflictPort)
          : undefined;
      const rawBin = req.body?.gatewayOpenclawBinary;
      const { normalizeGatewayOpenclawBinary } = require("./openclaw-external.js");
      const mode = rawBin != null ? normalizeGatewayOpenclawBinary(rawBin) : undefined;
      const result = await killVerifiedGatewayPortListener(pid, {
        conflictPort: Number.isFinite(conflictPort) ? conflictPort : undefined,
        mode,
      });
      if (!result.ok) {
        return res.status(400).json({
          ok: false,
          error: { message: result.error || "无法结束进程" },
          ...jsonGatewayDiagnosticFields(),
        });
      }
      res.status(200).json({ ok: true, message: "已发送结束信号", ...jsonGatewayDiagnosticFields() });
    } catch (e) {
      res.status(500).json({
        error: { message: e?.message ?? "结束进程失败" },
        ...jsonGatewayDiagnosticFields(),
      });
    }
  });

  // 重置配置（清理错误配置）
  // 重置指定模式的配置（body.gatewayOpenclawBinary 决定哪路）
  app.post("/api/openclaw/reset-config", async (req, res) => {
    try {
      const rawBin = req.body?.gatewayOpenclawBinary;
      const { normalizeGatewayOpenclawBinary } = require("./openclaw-external.js");
      const mode = normalizeGatewayOpenclawBinary(rawBin);
      syncGatewayWorkspaceFromSettings({ gatewayOpenclawBinary: mode });
      const result = resetOpenClawConfig();
      res.status(200).json(result);
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "重置失败" } });
    }
  });

  // 轮换 Gateway token（认证失败锁定时一键恢复；body.gatewayOpenclawBinary 决定哪路）
  app.post("/api/openclaw/rotate-gateway-token", async (req, res) => {
    try {
      const rawBin = req.body?.gatewayOpenclawBinary;
      const { normalizeGatewayOpenclawBinary } = require("./openclaw-external.js");
      const mode = normalizeGatewayOpenclawBinary(rawBin);
      syncGatewayWorkspaceFromSettings({ gatewayOpenclawBinary: mode });
      initOpenClawConfig();
      const rotated = rotateGatewayAuthToken();
      await restartGateway(mode);
      const status = await getOpenClawStatus();
      res.status(200).json({
        ok: true,
        mode,
        message: `${mode} Gateway token 已重置并重启`,
        uiUrl: mode === "external" ? status?.uiUrlExternal : status?.uiUrlBundled,
        token: rotated?.token || null,
      });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "重置 Gateway token 失败" } });
    }
  });

  // 重启 Gateway（body.gatewayOpenclawBinary 决定哪路）
  app.post("/api/openclaw/restart-gateway", async (req, res) => {
    try {
      const rawBin = req.body?.gatewayOpenclawBinary;
      const { normalizeGatewayOpenclawBinary } = require("./openclaw-external.js");
      const mode = normalizeGatewayOpenclawBinary(rawBin);
      if (rawBin != null) {
        const cur = await getOpenClawSettings();
        await saveOpenClawSettings({ ...cur, gatewayOpenclawBinary: mode });
      }
      syncGatewayWorkspaceFromSettings({ gatewayOpenclawBinary: mode });
      await restartGateway(mode);
      res.status(200).json({ ok: true, mode, message: `${mode} Gateway 正在重启` });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "重启失败" } });
    }
  });

  // 配置模型提供商（body.gatewayOpenclawBinary 决定写哪路配置；之后只重启该路）
  app.post("/api/openclaw/configure-provider", async (req, res) => {
    try {
      const { provider, apiKey, model, baseUrl, setAsDefault, gatewayOpenclawBinary: rawBin } = req.body || {};

      if (!provider || !PROVIDER_PRESETS[provider]) {
        return res.status(400).json({ error: { message: "无效的提供商" } });
      }

      const preset = PROVIDER_PRESETS[provider];

      if (preset.requiresApiKey && !apiKey) {
        return res.status(400).json({ error: { message: "此提供商需要 API Key" } });
      }

      const { normalizeGatewayOpenclawBinary } = require("./openclaw-external.js");
      const mode = normalizeGatewayOpenclawBinary(rawBin);
      syncGatewayWorkspaceFromSettings({ gatewayOpenclawBinary: mode });

      const config = {
        apiKey: apiKey || undefined,
        model: model || preset.defaultModel,
        baseUrl: baseUrl || preset.baseUrl,
        setAsDefault: setAsDefault !== false,
      };

      const result = await configureProvider(provider, config);
      await restartGateway(mode);

      res.status(200).json({
        ok: true,
        mode,
        message: `${preset.name} 配置成功，${mode} Gateway 已重启`,
        results: result.results,
      });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "配置失败" } });
    }
  });

  /** 仅安装进度 + Gateway 诊断，不做 discoverOpenClawInstallations（避免与安装并发卡住/拖慢，导致前端拿不到日志） */
  app.get("/api/openclaw/install-progress", (_req, res) => {
    try {
      res.status(200).json({
        openclawInstall: getOpenClawInstallDiagSnapshot(),
        openclawUninstall: getOpenClawUninstallDiagSnapshot(),
        ...jsonGatewayDiagnosticFields(),
      });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "读取安装进度失败" } });
    }
  });

  /** npm registry 上 openclaw@latest 版本（内置 / 外置「版本与升级」弹窗共用） */
  app.get("/api/openclaw/openclaw-npm-latest", async (_req, res) => {
    try {
      const r = await queryOpenclawNpmLatestVersion();
      if (r.ok) {
        res.status(200).json({ ok: true, latestVersion: r.latestVersion });
      } else {
        res.status(200).json({ ok: false, error: { message: r.error || "查询失败" } });
      }
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "查询失败" } });
    }
  });

  // 新的简化 API：获取内置 OpenClaw 状态
  app.get("/api/openclaw/embedded-status", async (_req, res) => {
    try {
      const status = await getOpenClawStatus();
      const clawInventory = await discoverClawInventory();
      const openClawDiscovery = clawInventory.discovery;
      const localInstall = computeLocalInstallFromOpenClawDiscovery(openClawDiscovery);
      const clawEnvironment = await collectClawEnvironment();
      const ocSettings = await getOpenClawSettings();
      const nodeRuntimeReady = hasEmbeddedNode("bundled");
      const systemNpmOk = await hasCommand("npm");
      const cliSource = getOpenClawCliSource();
      const hasBundledOpenClaw = cliSource === "project-modules" || cliSource === "packaged";
      const bundledOpenClawVersion =
        cliSource === "project-modules" || cliSource === "packaged" ? readBundledOpenClawCliVersion() : null;
      const hasExternalManaged = hasExternalManagedOpenClaw();
      const managedExtBin = resolveExternalOpenClawBinPath();
      const userEnvironmentOpenClaw = getUserEnvironmentOpenClawFromInventory(
        clawInventory.installations,
        getExternalOpenClawNpmPrefix()
      );
      const extBinPath = managedExtBin || userEnvironmentOpenClaw?.binPath || null;
      const externalOpenClawBinSource = managedExtBin
        ? "managed-prefix"
        : userEnvironmentOpenClaw?.binPath
          ? "user-environment"
          : null;
      const externalOpenClawVersion = extBinPath ? tryOpenClawVersion(extBinPath) : null;
      const externalOpenClawInstallTag = resolveExternalOpenClawInstallTag(
        hasExternalManaged,
        ocSettings.externalOpenClawInstallSource || null,
        hasExternalOpenClawClientMarker()
      );
      const hasUserEnvironmentOpenClawAside = !!userEnvironmentOpenClaw?.binPath;
      const extPrefixPath = getExternalOpenClawNpmPrefix();
      const extRuntimePath = getExternalOpenClawRuntimeStateDir();
      const managedRuntimeResolution = getManagedRuntimeResolutionInfo();
      res.status(200).json({
        ...status,
        hasEmbeddedNode: nodeRuntimeReady,
        hasExternalGatewayNode: hasEmbeddedNode("external"),
        packagedNodePath: getBundledNodeFromInstaller() || null,
        hasSystemNpm: systemNpmOk,
        hasBundledOpenClaw,
        bundledOpenClawVersion,
        hasExternalManagedOpenClaw: hasExternalManaged,
        externalOpenClawNpmPrefix: extPrefixPath,
        externalOpenClawPrefixDirExists: fs.existsSync(extPrefixPath),
        externalOpenClawRuntimeDirExists: fs.existsSync(extRuntimePath),
        externalManagedOpenClawBinPath: managedExtBin,
        externalOpenClawBinPath: extBinPath,
        externalOpenClawBinSource,
        externalOpenClawVersion,
        userEnvironmentOpenClaw,
        externalOpenClawInstallTag,
        hasUserEnvironmentOpenClawAside,
        managedRuntimeResolution,
        localInstall,
        openClawDiscovery,
        clawInventory,
        clawEnvironment,
        gatewayOpenclawTarget: ocSettings.gatewayOpenclawTarget,
        gatewayOpenclawTargetExternal: ocSettings.gatewayOpenclawTargetExternal,
        gatewayOpenclawBinary: normalizeGatewayOpenclawBinary(ocSettings.gatewayOpenclawBinary),
        cliSource,
        openclawInstall: getOpenClawInstallDiagSnapshot(),
        openclawUninstall: getOpenClawUninstallDiagSnapshot(),
      });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "获取 OpenClaw 状态失败" } });
    }
  });

  app.get("/api/openclaw/local-installation", async (_req, res) => {
    try {
      const clawInventory = await discoverClawInventory();
      const localInstall = computeLocalInstallFromOpenClawDiscovery(clawInventory.discovery);
      res.status(200).json(localInstall);
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "检测本地 OpenClaw 失败" } });
    }
  });

  // 旧的 API（保留兼容性）
  app.get("/api/openclaw/node-status", async (_req, res) => {
    try {
      const hasEmbedded = hasEmbeddedNode("bundled");
      const hasExtRt = hasEmbeddedNode("external");
      const hasSystemNpm = await hasCommand("npm");
      res.status(200).json({
        hasEmbeddedNode: hasEmbedded,
        hasExternalGatewayNode: hasExtRt,
        hasSystemNpm: hasSystemNpm,
        nodeVersion: NODE_VERSION,
      });
    } catch (e) {
      res.status(200).json({
        hasEmbeddedNode: false,
        hasExternalGatewayNode: false,
        hasSystemNpm: false,
        nodeVersion: NODE_VERSION,
      });
    }
  });

  app.get("/api/openclaw/install-node-progress", (req, res) => {
    const profile = String(req.query?.profile || "").toLowerCase() === "external" ? "external" : "bundled";
    res.status(200).json({ profile, ...nodeInstallState[profile] });
  });

  app.post("/api/openclaw/uninstall-node", async (req, res) => {
    try {
      const profile = String(req.body?.profile || "").toLowerCase() === "external" ? "external" : "bundled";
      if (!hasEmbeddedNode(profile)) {
        return res.status(200).json({ ok: true, message: "指定位置未安装客户端 Node，无需卸载" });
      }
      removeNodeRuntime(profile);
      nodeInstallState[profile] = createIdleNodeInstallState();
      res.status(200).json({ ok: true, profile, message: "已移除客户端下载的 Node 目录" });
    } catch (e) {
      res.status(500).json({ ok: false, error: { message: e?.message ?? "卸载失败" } });
    }
  });

  app.post("/api/openclaw/install-node", async (req, res) => {
    try {
      const profile = String(req.body?.profile || "").toLowerCase() === "external" ? "external" : "bundled";
      const force = !!req.body?.force;

      if (hasEmbeddedNode(profile) && !force) {
        return res.status(200).json({
          ok: true,
          profile,
          message: profile === "external" ? "外置专用 Node 已存在" : "内置运行时 Node 已存在",
        });
      }

      const st = nodeInstallState[profile];
      if (st.installing) {
        return res.status(200).json({ ok: true, profile, message: "安装正在进行中，请稍候..." });
      }

      if (force && hasEmbeddedNode(profile)) {
        try {
          removeNodeRuntime(profile);
        } catch (rmErr) {
          return res.status(500).json({
            ok: false,
            error: { message: rmErr?.message ?? "无法移除旧版本以升级" },
          });
        }
      }

      nodeInstallState[profile] = {
        installing: true,
        stage: "preparing",
        percent: 0,
        error: null,
        completed: false,
        logs: [],
      };

      res.status(200).json({
        ok: true,
        profile,
        message: `开始下载 Node（${profile === "external" ? "外置专用" : "内置"}），请通过进度接口查询状态`,
      });

      console.log(`[OpenClaw] 开始下载 Node（profile=${profile}）…`);

      downloadAndInstallNode((progress) => {
        const cur = nodeInstallState[profile];
        cur.stage = progress.stage || "downloading";
        cur.percent = progress.percent || 0;
        const log = `${progress.stage}: ${progress.percent}%`;
        const prev = cur.logs[cur.logs.length - 1];
        if (prev !== log) {
          cur.logs.push(log);
          console.log(`[OpenClaw][${profile}] ${log}`);
        }
      }, profile)
        .then(() => {
          console.log(`[OpenClaw] Node 安装完成 (${profile})`);
          const cur = nodeInstallState[profile];
          cur.installing = false;
          cur.completed = true;
          cur.stage = "completed";
          cur.percent = 100;
        })
        .catch((e) => {
          console.error(`[OpenClaw] Node 安装失败 (${profile}):`, e);
          const cur = nodeInstallState[profile];
          cur.installing = false;
          cur.error = e?.message ?? "安装失败";
          cur.stage = "failed";
          cur.logs.push(`错误: ${e?.message}`);
        });
    } catch (e) {
      console.error("[OpenClaw] 安装 Node 异常:", e);
      const profile = String(req.body?.profile || "").toLowerCase() === "external" ? "external" : "bundled";
      nodeInstallState[profile].installing = false;
      nodeInstallState[profile].error = e?.message ?? "下载失败";
      res.status(500).json({
        ok: false,
        error: { message: e?.message ?? "下载客户端 Node 失败" },
      });
    }
  });

  app.get("/api/openclaw/check-npm", async (_req, res) => {
    try {
      const npmAvailable = await hasCommand("npm");
      const hasEmb = hasEmbeddedNode("bundled");
      const hasExt = hasEmbeddedNode("external");
      res.status(200).json({
        hasNpm: npmAvailable || hasEmb || hasExt,
        hasSystemNpm: npmAvailable,
        hasEmbeddedNode: hasEmb,
        hasExternalGatewayNode: hasExt,
      });
    } catch (e) {
      res.status(200).json({ hasNpm: false, hasSystemNpm: false, hasEmbeddedNode: false, hasExternalGatewayNode: false });
    }
  });

  app.get("/api/openclaw/status", async (_req, res) => {
    try {
      const cfg = await getOpenClawSettings();
      const uiUrl = cfg.uiUrl || "http://localhost:18789";
      const gatewayProcessRunning = await detectOpenClawGatewayProcessRunning();
      const installed = (await hasCommand("openclaw")) || (await hasCommand("openclaw.exe"));
      res.status(200).json({
        config: {
          uiUrl,
          installCmd: cfg.installCmd || "",
          gatewayOpenclawTarget: cfg.gatewayOpenclawTarget || "clawheart-managed",
          gatewayOpenclawTargetExternal: cfg.gatewayOpenclawTargetExternal || "user-profile",
          gatewayOpenclawBinary: normalizeGatewayOpenclawBinary(cfg.gatewayOpenclawBinary),
          externalOpenClawInstallSource: cfg.externalOpenClawInstallSource ?? null,
        },
        status: { installed, gatewayProcessRunning },
      });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "读取 OpenClaw 状态失败" } });
    }
  });

  app.post("/api/openclaw/config", async (req, res) => {
    try {
      const cur = await getOpenClawSettings();
      const {
        uiUrl,
        installCmd,
        gatewayOpenclawTarget,
        gatewayOpenclawBinary,
        gatewayOpenclawTargetExternal,
        externalOpenClawInstallSource,
      } = req.body || {};
      const { normalizeExternalOpenClawInstallSource } = require("./openclaw-external.js");
      const next = {
        uiUrl: uiUrl != null ? String(uiUrl).trim() : cur.uiUrl || "http://localhost:18789",
        installCmd: installCmd != null ? String(installCmd) : cur.installCmd || "",
        gatewayOpenclawTarget:
          gatewayOpenclawTarget != null
            ? String(gatewayOpenclawTarget)
            : cur.gatewayOpenclawTarget || "clawheart-managed",
        gatewayOpenclawBinary:
          gatewayOpenclawBinary != null ? String(gatewayOpenclawBinary) : cur.gatewayOpenclawBinary || "bundled",
        gatewayOpenclawTargetExternal:
          gatewayOpenclawTargetExternal != null
            ? String(gatewayOpenclawTargetExternal)
            : cur.gatewayOpenclawTargetExternal || "user-profile",
        externalOpenClawInstallSource:
          externalOpenClawInstallSource !== undefined
            ? normalizeExternalOpenClawInstallSource(externalOpenClawInstallSource)
            : cur.externalOpenClawInstallSource ?? null,
      };
      await saveOpenClawSettings(next);
      syncGatewayWorkspaceFromSettings(await getOpenClawSettings());
      res.status(200).json({ config: next });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "保存 OpenClaw 配置失败" } });
    }
  });

  app.post("/api/openclaw/install", async (req, res) => {
    try {
      console.log("[OpenClaw] 收到安装 OpenClaw 请求");
      if (openclawInstallDiag.running || openclawUninstallDiag.running) {
        return res.status(409).json({
          error: { message: "已有任务进行中，请查看下方日志" },
          openclawInstall: getOpenClawInstallDiagSnapshot(),
          openclawUninstall: getOpenClawUninstallDiagSnapshot(),
          ...jsonGatewayDiagnosticFields(),
        });
      }

      const cfg = await getOpenClawSettings();
      const installCmd = typeof req.body?.installCmd === "string" ? req.body.installCmd : cfg.installCmd;
      const installTarget =
        String(req.body?.installTarget || "").trim() === "clawheart-external"
          ? "clawheart-external"
          : "default";
      console.log("[OpenClaw] 安装命令:", installCmd || "(默认)", "target:", installTarget);

      openclawInstallDiag = {
        running: true,
        log: "",
        exitCode: null,
        lastError: null,
      };
      appendOpenClawInstallLog(
        `[客户端任务启动] ${installCmd ? "自定义命令\n" : "默认: npm -g openclaw@latest + onboard\n"}`
      );
      appendOpenClawInstallLog(`服务端: Node ${process.version} · pid ${process.pid}\n`);

      res.status(202).json({
        ok: true,
        message: "安装已开始，日志在下方区域实时更新",
        openclawInstall: getOpenClawInstallDiagSnapshot(),
        ...jsonGatewayDiagnosticFields(),
      });

      (async () => {
        try {
          const result = await runInstallCommand(installCmd, appendOpenClawInstallLog, {
            installTarget,
          });
          console.log("[OpenClaw] 安装命令执行完成，退出码:", result.code);
          openclawInstallDiag.exitCode = result.code;

          const installed =
            installTarget === "clawheart-external"
              ? hasExternalManagedOpenClaw()
              : (await hasCommand("openclaw")) || (await hasCommand("openclaw.exe"));
          console.log("[OpenClaw] OpenClaw 是否已安装:", installed);

          if (result.code === 0) {
            try {
              syncGatewayWorkspaceFromSettings(await getOpenClawSettings());
              initOpenClawConfig();
            } catch (configErr) {
              console.log(
                "[OpenClaw] 安装后初始化当前工作区 OpenClaw 配置失败（可忽略）:",
                configErr
              );
            }
            if (installTarget === "clawheart-external" && installed) {
              try {
                await patchExternalOpenClawInstallSource("clawheart");
                writeExternalOpenClawClientMarker();
              } catch (markErr) {
                console.warn("[OpenClaw] 记录外置客户端安装来源失败:", markErr?.message || markErr);
              }
            }
            appendOpenClawInstallLog("\n[完成] 退出码 0");
            if (!installed) {
              appendOpenClawInstallLog(
                "\n（提示：命令已成功，但尚未在 PATH 中检测到 openclaw，可重开终端或检查 npm 全局 bin）\n"
              );
            }
          } else {
            const errText = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
            openclawInstallDiag.lastError = errText || `进程退出码 ${result.code}`;
            appendOpenClawInstallLog(`\n[失败] 退出码 ${result.code}\n${openclawInstallDiag.lastError}\n`);
          }
        } catch (e) {
          console.error("[OpenClaw] 安装失败:", e);
          openclawInstallDiag.exitCode = openclawInstallDiag.exitCode ?? -1;
          openclawInstallDiag.lastError = e?.message ?? String(e);
          appendOpenClawInstallLog(`\n[异常] ${openclawInstallDiag.lastError}\n`);
        } finally {
          openclawInstallDiag.running = false;
        }
      })();
    } catch (e) {
      openclawInstallDiag.running = false;
      console.error("[OpenClaw] 安装失败:", e);
      res.status(500).json({ error: { message: e?.message ?? "OpenClaw 安装失败" } });
    }
  });

  app.post("/api/openclaw/uninstall", async (req, res) => {
    try {
      if (openclawInstallDiag.running || openclawUninstallDiag.running) {
        return res.status(409).json({
          error: { message: "已有任务进行中，请查看下方日志" },
          openclawUninstall: getOpenClawUninstallDiagSnapshot(),
          openclawInstall: getOpenClawInstallDiagSnapshot(),
          ...jsonGatewayDiagnosticFields(),
        });
      }
      const rawPkg =
        typeof req.body?.npmPackage === "string" ? req.body.npmPackage.trim() : "openclaw";
      if (!isSafeNpmPackageName(rawPkg)) {
        return res.status(400).json({ error: { message: "无效的 npm 包名" } });
      }
      const uninstallTarget =
        String(req.body?.uninstallTarget || "").trim() === "clawheart-external"
          ? "clawheart-external"
          : "default";

      if (rawPkg === "openclaw" && uninstallTarget !== "clawheart-external") {
        const cliSource = getOpenClawCliSource();
        if (cliSource !== "global") {
          return res.status(400).json({
            error: {
              message:
                cliSource === "none"
                  ? "未检测到可卸载的全局 openclaw npm 包。"
                  : "当前 OpenClaw 来自应用内置或开发依赖，不能通过 npm 全局卸载。",
            },
          });
        }
      }

      openclawUninstallDiag = {
        running: true,
        log: "",
        exitCode: null,
        lastError: null,
      };
      appendOpenClawUninstallLog(
        uninstallTarget === "clawheart-external"
          ? `[卸载任务启动] ClawHeart 外置：npm uninstall -g ${rawPkg}，随后删除 .opencarapace 下 external-openclaw 与 external-openclaw-runtime（不删 ~/.openclaw）\n`
          : `[卸载任务启动] npm uninstall -g ${rawPkg}\n`
      );

      res.status(202).json({
        ok: true,
        message: "卸载已开始，日志在下方区域实时更新",
        openclawUninstall: getOpenClawUninstallDiagSnapshot(),
        ...jsonGatewayDiagnosticFields(),
      });

      (async () => {
        try {
          const prefixOpt =
            uninstallTarget === "clawheart-external" ? getExternalOpenClawNpmPrefix() : undefined;
          const result = await runNpmUninstallGlobalPackage(rawPkg, appendOpenClawUninstallLog, {
            npmPrefix: prefixOpt,
          });
          openclawUninstallDiag.exitCode = result.code;
          if (result.code === 0) {
            appendOpenClawUninstallLog("\n[npm] 卸载命令退出码 0。\n");
          } else {
            const errText = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
            openclawUninstallDiag.lastError = errText || `进程退出码 ${result.code}`;
            appendOpenClawUninstallLog(`\n[npm] 退出码 ${result.code}${errText ? `\n${errText}` : ""}\n`);
          }

          if (uninstallTarget === "clawheart-external") {
            appendOpenClawUninstallLog("\n--- 清理 ClawHeart 外置目录（完整卸载）---\n");
            try {
              await patchExternalOpenClawInstallSource(null);
            } catch (clearErr) {
              console.warn("[OpenClaw] 清除外置安装来源失败:", clearErr?.message || clearErr);
            }
            removeExternalOpenClawClientMarker();
            purgeClawHeartExternalOpenClawArtefacts(appendOpenClawUninstallLog);
            openclawUninstallDiag.exitCode = !hasExternalManagedOpenClaw() ? 0 : result.code;
            if (!hasExternalManagedOpenClaw()) {
              appendOpenClawUninstallLog(
                "\n[完成] 已移除 ClawHeart 管理的 npm 前缀与 external-openclaw-runtime。\n" +
                  "说明: 标准用户配置 ~/.openclaw（OPENCLAW_CONFIG_PATH）按设计保留，不属于「外置卸载」清理范围。\n" +
                  "若本机仍有其它 openclaw（PATH、工程 node_modules 等），面板「扫描」仍会显示，与是否装过前缀无关。\n"
              );
            } else {
              appendOpenClawUninstallLog(
                "\n[警告] 仍检测到 prefix 内 openclaw，可关闭占用进程后重试卸载或手动删除 ~/.opencarapace/external-openclaw。\n"
              );
            }
            try {
              const cur = await getOpenClawSettings();
              if (normalizeGatewayOpenclawBinary(cur.gatewayOpenclawBinary) === "external") {
                await saveOpenClawSettings({ ...cur, gatewayOpenclawBinary: "bundled" });
                syncGatewayWorkspaceFromSettings(await getOpenClawSettings());
                appendOpenClawUninstallLog(
                  "[配置] 已将 Gateway 切为内置模式（外置 CLI 不可用）。\n"
                );
              }
            } catch (gwErr) {
              appendOpenClawUninstallLog(`[警告] 自动切回内置模式失败: ${gwErr?.message || gwErr}\n`);
            }
          } else if (result.code === 0) {
            appendOpenClawUninstallLog(
              "\n[完成] 已请求移除全局 npm 包。各厂商状态目录（若存在）不会自动删除。\n"
            );
          }
        } catch (e) {
          console.error("[OpenClaw] 卸载失败:", e);
          openclawUninstallDiag.exitCode = openclawUninstallDiag.exitCode ?? -1;
          openclawUninstallDiag.lastError = e?.message ?? String(e);
          appendOpenClawUninstallLog(`\n[异常] ${openclawUninstallDiag.lastError}\n`);
        } finally {
          openclawUninstallDiag.running = false;
        }
      })();
    } catch (e) {
      openclawUninstallDiag.running = false;
      console.error("[OpenClaw] 卸载请求失败:", e);
      res.status(500).json({ error: { message: e?.message ?? "OpenClaw 卸载失败" } });
    }
  });
}

module.exports = {
  registerOpenClawRoutes,
};
