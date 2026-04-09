const { spawn, execFileSync, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execWithOutput } = require("./utils.js");
const { detectOpenClawGatewayProcessRunning } = require("./openclaw-gateway-process.js");
const {
  getUnpackedAppRoot,
  getPackagedOpenClawBinFromUnpacked,
  getPackagedOpenClawMjsPath,
  resolveRealNodeExecutable,
  buildOpenClawChildEnv,
} = require("./openclaw-paths.js");
const { getElectronUserDataPath } = require("./openclaw-workspace.js");
const {
  ingestGatewayPortConflictStderrLine,
  clearGatewayPortConflictMode,
  getGatewayPortConflictsPayload,
  enrichGatewayPortConflictsWithLsof,
} = require("./openclaw-gateway-port-conflict.js");

function killWindowsProcessTree(pid) {
  if (process.platform !== "win32" || pid == null) return;
  const p = Number(pid);
  if (!Number.isFinite(p) || p <= 0) return;
  try {
    execSync(`taskkill /F /T /PID ${p}`, { stdio: "ignore", timeout: 15000 });
  } catch {
    /* ignore */
  }
}

async function refreshGatewayWorkspaceFromDb() {
  const { getOpenClawSettings } = require("../db.js");
  const { syncGatewayWorkspaceFromSettings } = require("./openclaw-workspace.js");
  const s = await getOpenClawSettings();
  syncGatewayWorkspaceFromSettings(s);
}

let openclawProcess = null;
/** 最近一次用户发起「停止 Gateway」的墙钟时间（ms）；用于区分诊断里旧的 listening 行与当前是否仍在跑 */
let lastGatewayStopEpochMs = 0;
/** 仅作缺省/回退；实际探测用 DB `ui_url`（用户可改端口） */
const OPENCLAW_UI_URL = "http://localhost:18789";
let cachedDashboardUrl = null; // 缓存带 token 的 dashboard URL

function clearCachedDashboardUrl() {
  cachedDashboardUrl = null;
}

/** 供 UI 复制的诊断日志（含启动命令、路径、子进程输出）；内置 / 外置分文件、分缓冲区 */
const MAX_GATEWAY_DIAG_CHARS = 200000;
/** @type {{ bundled: string; external: string }} */
let gatewayDiagnosticLogs = { bundled: "", external: "" };

function normalizeGatewayDiagMode(mode) {
  return mode === "external" ? "external" : "bundled";
}

function getGatewayLogsDir() {
  return path.join(getElectronUserDataPath(), "logs");
}

function getGatewayLogFilePath(mode) {
  const m = normalizeGatewayDiagMode(mode);
  const name = m === "external" ? "openclaw-gateway-external.log" : "openclaw-gateway-bundled.log";
  return path.join(getGatewayLogsDir(), name);
}

function appendGatewayDiagToFile(mode, entry) {
  try {
    const m = normalizeGatewayDiagMode(mode);
    const dir = getGatewayLogsDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(getGatewayLogFilePath(m), entry, "utf8");
  } catch (e) {
    console.warn("[OpenClaw][diag] 写入日志文件失败:", e?.message || e);
  }
}

function appendGatewayDiag(line, modeOpt) {
  let m;
  if (modeOpt === "bundled" || modeOpt === "external") {
    m = modeOpt;
  } else {
    const { getGatewayWorkspaceStateSync } = require("./openclaw-workspace.js");
    m = normalizeGatewayDiagMode(getGatewayWorkspaceStateSync().binaryMode);
  }
  const ts = new Date().toISOString();
  const entry = `[${ts}] ${line}\n`;
  gatewayDiagnosticLogs[m] += entry;
  if (gatewayDiagnosticLogs[m].length > MAX_GATEWAY_DIAG_CHARS) {
    gatewayDiagnosticLogs[m] =
      "...[日志过长已截断，仅保留末尾部分]\n" +
      gatewayDiagnosticLogs[m].slice(-(MAX_GATEWAY_DIAG_CHARS - 50));
  }
  appendGatewayDiagToFile(m, entry);
  console.log("[OpenClaw][diag]", line);
}

/** 新开一轮 Gateway 诊断时清空对应模式的内存缓冲，并在磁盘日志中写入会话分隔 */
function clearGatewayDiag(mode) {
  const m = normalizeGatewayDiagMode(mode);
  gatewayDiagnosticLogs[m] = "";
  try {
    const dir = getGatewayLogsDir();
    fs.mkdirSync(dir, { recursive: true });
    const banner = `\n======== OpenClaw Gateway 诊断会话 ${new Date().toISOString()} (${m}) ========\n`;
    fs.appendFileSync(getGatewayLogFilePath(m), banner, "utf8");
  } catch (e) {
    console.warn("[OpenClaw][diag] 会话标记写入失败:", e?.message || e);
  }
}

function getGatewayDiagnosticLogForMode(mode) {
  const m = normalizeGatewayDiagMode(mode);
  return gatewayDiagnosticLogs[m];
}

/** 与当前 DB 同步的 binaryMode 对应的诊断文本（兼容旧字段 gatewayDiagnosticLog） */
function getGatewayDiagnosticLog() {
  const { getGatewayWorkspaceStateSync } = require("./openclaw-workspace.js");
  const st = getGatewayWorkspaceStateSync();
  return getGatewayDiagnosticLogForMode(st.binaryMode === "external" ? "external" : "bundled");
}

function getGatewayDiagnosticLogsPayload() {
  return {
    gatewayDiagnosticLogBundled: gatewayDiagnosticLogs.bundled,
    gatewayDiagnosticLogExternal: gatewayDiagnosticLogs.external,
    gatewayDiagnosticLogFileBundled: getGatewayLogFilePath("bundled"),
    gatewayDiagnosticLogFileExternal: getGatewayLogFilePath("external"),
  };
}

function attachChildProcessLogs(child, mode) {
  const m = normalizeGatewayDiagMode(mode);
  const onData = (label) => (data) => {
    const s = String(data).replace(/\r\n/g, "\n");
    for (const line of s.split("\n")) {
      if (line.trim().length > 0) {
        appendGatewayDiag(`${label} ${line}`, m);
      }
    }
  };
  const onStderr = (data) => {
    const s = String(data).replace(/\r\n/g, "\n");
    for (const line of s.split("\n")) {
      if (line.trim().length > 0) {
        ingestGatewayPortConflictStderrLine(m, line);
        appendGatewayDiag(`[stderr] ${line}`, m);
      }
    }
  };
  child.stdout?.on("data", onData("[stdout]"));
  child.stderr?.on("data", onStderr);
  child.on("error", (err) => {
    appendGatewayDiag(`[spawn-error] ${err?.message || String(err)}`, m);
  });
  child.on("exit", (code, signal) => {
    appendGatewayDiag(`[子进程退出] code=${code} signal=${signal || "(无)"}`, m);
  });
}

/**
 * 获取 OpenClaw 的可执行文件路径
 * 优先使用项目内置的，如果不存在则尝试全局安装的
 */
function getOpenClawBinPath() {
  // 1. 尝试项目内置的 OpenClaw
  const localBinDir = path.join(__dirname, "../../node_modules/.bin");
  const localBin = process.platform === "win32" 
    ? path.join(localBinDir, "openclaw.cmd")
    : path.join(localBinDir, "openclaw");
  
  if (fs.existsSync(localBin)) {
    return localBin;
  }
  
  // 2. 使用全局安装的 OpenClaw（假设在 PATH 中）
  if (process.platform === "win32") {
    // 部分安装只提供 openclaw.exe，而不是 openclaw 命令别名
    try {
      const { execSync } = require("child_process");
      execSync("where openclaw.exe", { stdio: "ignore", timeout: 3000, cwd: os.tmpdir() });
      return "openclaw.exe";
    } catch {
      // ignore
    }
    try {
      const { execSync } = require("child_process");
      execSync("where openclaw.cmd", { stdio: "ignore", timeout: 3000, cwd: os.tmpdir() });
      return "openclaw.cmd";
    } catch {
      // ignore
    }
  }

  return "openclaw";
}

/**
 * 检查 OpenClaw 是否已安装（项目内置或全局）
 */
function hasEmbeddedOpenClaw() {
  // 1. 检查项目内置（静默检测，不打印日志）
  const localBinDir = path.join(__dirname, "../../node_modules/.bin");
  const localBin = process.platform === "win32" 
    ? path.join(localBinDir, "openclaw.cmd")
    : path.join(localBinDir, "openclaw");
  
  if (fs.existsSync(localBin)) {
    return true;
  }

  // 2. 打包后：asarUnpack 下的 .bin（推荐，含完整 node_modules 依赖）
  if (getPackagedOpenClawBinFromUnpacked()) {
    return true;
  }

  // 3. 打包：openclaw.mjs（extraResources 或 unpacked 内）
  const packagedMjs = getPackagedOpenClawMjsPath();
  if (packagedMjs) {
    return true;
  }
  
  // 4. 检查全局安装（静默检测）
  try {
    const { execSync } = require("child_process");
    execSync("openclaw --version", { stdio: "ignore", timeout: 3000, cwd: os.tmpdir() });
    return true;
  } catch (e) {
    // 兼容：有些安装只提供 openclaw.exe/openclaw.cmd，但不提供 openclaw 命令
    try {
      execSync("where openclaw.exe", { stdio: "ignore", timeout: 3000, cwd: os.tmpdir() });
      return true;
    } catch {
      // ignore
    }
    try {
      execSync("where openclaw.cmd", { stdio: "ignore", timeout: 3000, cwd: os.tmpdir() });
      return true;
    } catch {
      // ignore
    }
    return false;
  }
}

/**
 * OpenClaw 可执行来源（与 hasEmbeddedOpenClaw 检测顺序一致，用于「仅全局 npm 可卸载」等提示）
 * @returns {"project-modules"|"packaged"|"global"|"none"}
 */
function getOpenClawCliSource() {
  const localBinDir = path.join(__dirname, "../../node_modules/.bin");
  const localBin =
    process.platform === "win32" ? path.join(localBinDir, "openclaw.cmd") : path.join(localBinDir, "openclaw");
  if (fs.existsSync(localBin)) {
    return "project-modules";
  }
  if (getPackagedOpenClawBinFromUnpacked()) {
    return "packaged";
  }
  if (getPackagedOpenClawMjsPath()) {
    return "packaged";
  }
  try {
    execSync("openclaw --version", { stdio: "ignore", timeout: 3000, cwd: os.tmpdir() });
    return "global";
  } catch {
    /* ignore */
  }
  if (process.platform === "win32") {
    try {
      execSync("where openclaw.exe", { stdio: "ignore", timeout: 3000, cwd: os.tmpdir() });
      return "global";
    } catch {
      /* ignore */
    }
    try {
      execSync("where openclaw.cmd", { stdio: "ignore", timeout: 3000, cwd: os.tmpdir() });
      return "global";
    } catch {
      /* ignore */
    }
  }
  return "none";
}

/**
 * 是否与「内置 Gateway」所用 CLI 一致：仅 project-modules / packaged，不含 PATH 全局包。
 * 必须与 getOpenClawCliSource() 同源派生，避免 UI 上「来源」与「是否内置」互相矛盾。
 */
function hasBundledOpenClawCli() {
  const src = getOpenClawCliSource();
  return src === "project-modules" || src === "packaged";
}

function normalizeOpenClawUiUrl(uiUrl) {
  const u = String(uiUrl ?? "").trim();
  if (!u) return OPENCLAW_UI_URL;
  try {
    new URL(u);
    return u;
  } catch {
    return OPENCLAW_UI_URL;
  }
}

/**
 * 子进程 stdout/stderr 单行是否表示 Gateway 已起来（与 probe 判定对齐）。
 * 新版 OpenClaw 可能只打 MCP/canvas 的 listening on http，而不打 ws://；另有 `[gateway] ready (` 形态。
 */
function gatewayDiagChildLineIndicatesGatewayUp(body) {
  if (!body || typeof body !== "string") return false;
  if (/\blistening on ws:\/\//i.test(body)) return true;
  if (/\[gateway\][^\n]*listening on/i.test(body)) return true;
  if (/\[gateway\][\s\S]*?\bready\s*\(/i.test(body)) return true;
  return false;
}

/**
 * ClawHeart 写入的 `[ISO] [stdout|stderr] ...` 行里，最近一次判定为 Gateway 已就绪的时间。
 * fork 后进程扫描常漏外置路径；与 lastGatewayStopEpochMs 配合给 embedded-status 的 isRunning。
 */
function latestClawHeartDiagGatewayUpTimestampMs(mode) {
  const m = normalizeGatewayDiagMode(mode);
  const log = gatewayDiagnosticLogs[m] || "";
  const lineRe =
    /^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\] \[(?:stdout|stderr)\] (.*)$/gm;
  let last = 0;
  let mm;
  while ((mm = lineRe.exec(log)) !== null) {
    if (!gatewayDiagChildLineIndicatesGatewayUp(mm[2])) continue;
    const t = Date.parse(mm[1]);
    if (!Number.isNaN(t)) last = Math.max(last, t);
  }
  return last;
}

/**
 * Gateway 是否在跑：进程命令行扫描；若漏检（fork 等）则用本模式诊断中晚于上次「停止」的就绪行推断。
 */
async function checkOpenClawRunning() {
  if (await detectOpenClawGatewayProcessRunning()) return true;
  const { getGatewayWorkspaceStateSync } = require("./openclaw-workspace.js");
  const st = getGatewayWorkspaceStateSync();
  const mode = st.binaryMode === "external" ? "external" : "bundled";
  const tUp = latestClawHeartDiagGatewayUpTimestampMs(mode);
  return tUp > 0 && tUp > lastGatewayStopEpochMs;
}

function gatewayDiagLogShowsGatewayListening(mode) {
  const m = normalizeGatewayDiagMode(mode);
  const log = gatewayDiagnosticLogs[m] || "";
  if (/\blistening on ws:\/\//i.test(log)) return true;
  if (/\[gateway\][^\n]*listening on/i.test(log)) return true;
  if (/\[gateway\][\s\S]*?\bready\s*\(/i.test(log)) return true;
  return false;
}

/**
 * spawn 后轮询就绪：全机进程扫描；否则以本模式诊断缓冲区内 OpenClaw 的 listening 行为准。
 * 注意：部分安装下包装进程在子进程监听后会先 exit(0)，此时 exitCode 已为 0 而非 null，
 * 不能再依赖「子进程未退出」才认日志，否则会永远等不到（你本地即属此类）。
 */
async function probeGatewayReadyAfterSpawn(binaryMode) {
  if (await detectOpenClawGatewayProcessRunning()) return true;
  if (gatewayDiagLogShowsGatewayListening(binaryMode)) return true;
  return false;
}

/**
 * 启动 OpenClaw Gateway（内置二进制或 ClawHeart 外置 prefix，由 DB gateway_openclaw_binary 决定）
 */
async function startEmbeddedOpenClaw() {
  // 先与 DB 对齐工作区（含 gateway_openclaw_binary），再判断 Gateway UI 是否已可达；否则已运行时仍会遗留旧的 binaryMode，导致 OPENCLAW_* 与当前页签不一致
  await refreshGatewayWorkspaceFromDb();
  const { getGatewayWorkspaceStateSync, getActiveOpenClawEnv } = require("./openclaw-workspace.js");
  const { getOpenClawSettings } = require("../db.js");
  const { normalizeGatewayOpenclawBinary, resolveExternalOpenClawBinPath } = require("./openclaw-external.js");

  const settings = await getOpenClawSettings();
  const binaryMode = normalizeGatewayOpenclawBinary(settings.gatewayOpenclawBinary);
  const uiUrlForLog = normalizeOpenClawUiUrl(settings.uiUrl);

  const isRunning = await checkOpenClawRunning();
  if (isRunning) {
    appendGatewayDiag(
      `检测到 OpenClaw Gateway 进程（命令行含 openclaw + gateway run）；配置中 UI: ${uiUrlForLog}`,
      binaryMode
    );
    console.log("[OpenClaw] OpenClaw Gateway 已在运行（进程检测）");
    clearGatewayPortConflictMode(binaryMode);
    return true;
  }

  clearGatewayDiag(binaryMode);
  const ws = getGatewayWorkspaceStateSync();
  const ocEnv = getActiveOpenClawEnv();
  appendGatewayDiag(`Gateway 二进制模式: ${binaryMode}`);
  appendGatewayDiag(`Gateway 工作区状态: ${JSON.stringify(ws)}`);
  appendGatewayDiag(`OPENCLAW_STATE_DIR=${ocEnv.OPENCLAW_STATE_DIR}`);
  appendGatewayDiag(`OPENCLAW_CONFIG_PATH=${ocEnv.OPENCLAW_CONFIG_PATH}`);
  appendGatewayDiag("======== OpenClaw Gateway 启动尝试 ========");
  appendGatewayDiag(`platform=${process.platform}`);
  appendGatewayDiag(`就绪判断=进程命令行（openclaw · gateway run）；配置中 UI: ${uiUrlForLog}`);
  appendGatewayDiag(`process.execPath=${process.execPath}`);
  appendGatewayDiag(`process.resourcesPath=${process.resourcesPath || "(空)"}`);
  appendGatewayDiag(`process.cwd()=${process.cwd()}`);
  appendGatewayDiag("说明: 子进程使用 stdio 管道收集日志；关闭本客户端后 Gateway 进程会一并结束。");

  console.log("[OpenClaw] 尝试启动 OpenClaw Gateway...");

  // 首次启动时初始化配置文件（如果不存在）
  try {
    const { initOpenClawConfig, ensureGatewayModeLocal } = require("./openclaw-config.js");
    initOpenClawConfig();
    ensureGatewayModeLocal();
    appendGatewayDiag("已执行 initOpenClawConfig + ensureGatewayModeLocal（兼容 OpenClaw 2026.3+ gateway.mode）");
  } catch (configErr) {
    appendGatewayDiag(`initOpenClawConfig 异常: ${configErr?.message || configErr}`);
    console.log("[OpenClaw] 配置初始化失败（可忽略）:", configErr);
  }

  await preemptiveGatewayStopBeforeStart(binaryMode);

  try {
    /** OpenClaw 2026.3+：未配置 gateway.mode 时需 --allow-unconfigured；与 ensureGatewayModeLocal 双保险 */
    const gatewayRunArgs = ["gateway", "run", "--allow-unconfigured"];
    const spawnOptions = {
      detached: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: false,
      cwd: os.tmpdir(),
    };

    if (binaryMode === "external") {
      const extBin = resolveExternalOpenClawBinPath();
      if (!extBin) {
        appendGatewayDiag("======== OpenClaw Gateway 启动中止 ========");
        appendGatewayDiag("原因: ClawHeart 外置目录中未找到 openclaw（请在外置管理 Tab 中完成安装）。");
        return false;
      }
      const devEnv = buildOpenClawChildEnv(null, { gatewayOpenclawBinary: "external" });
      appendGatewayDiag(`启动方式: ClawHeart 外置 CLI（~/.opencarapace/external-openclaw）`);
      appendGatewayDiag(`openclaw=${extBin}`);
      let child;
      if (process.platform === "win32") {
        appendGatewayDiag(`命令: cmd.exe /c "${extBin}" gateway run --allow-unconfigured`);
        child = spawn("cmd.exe", ["/c", extBin, ...gatewayRunArgs], {
          ...spawnOptions,
          env: devEnv,
        });
      } else {
        appendGatewayDiag(`命令: ${extBin} gateway run --allow-unconfigured`);
        child = spawn(extBin, gatewayRunArgs, {
          ...spawnOptions,
          env: devEnv,
        });
      }
      attachChildProcessLogs(child, binaryMode);
      openclawProcess = child;
      appendGatewayDiag("已 spawn 子进程，等待 Gateway UI 就绪（最多约 45 秒）...");
      for (let i = 0; i < 90; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (await probeGatewayReadyAfterSpawn(binaryMode)) {
          appendGatewayDiag("成功: Gateway 已就绪（进程列表或子进程 listening 日志）");
          console.log("[OpenClaw] OpenClaw Gateway 启动成功！");
          clearGatewayPortConflictMode(binaryMode);
          return true;
        }
      }
      appendGatewayDiag(
        "失败: 约 45 秒内仍未判定就绪（进程扫描与 listening 日志均未命中；请查看子进程输出）"
      );
      return false;
    }

    if (!hasBundledOpenClawCli()) {
      appendGatewayDiag("======== OpenClaw Gateway 启动中止 ========");
      appendGatewayDiag(
        "原因: 内置模式未检测到安装包/开发目录内的 OpenClaw（不会回退到系统 PATH 上的全局 openclaw）。"
      );
      return false;
    }

    const packagedBin = getPackagedOpenClawBinFromUnpacked();
    const packagedMjs = packagedBin ? null : getPackagedOpenClawMjsPath();
    const localBinDir = path.join(__dirname, "../../node_modules", ".bin");
    const devOpenClawBin =
      process.platform === "win32" ? path.join(localBinDir, "openclaw.cmd") : path.join(localBinDir, "openclaw");
    const binPath = packagedBin || packagedMjs ? null : devOpenClawBin;

    const unpackedRoot = getUnpackedAppRoot();
    if (!packagedBin && packagedMjs && unpackedRoot) {
      const binDir = path.join(unpackedRoot, "node_modules", ".bin");
      appendGatewayDiag(
        `提示: 未使用 node_modules/.bin/openclaw（.bin 目录存在=${fs.existsSync(binDir)}）`
      );
      if (fs.existsSync(binDir)) {
        try {
          const names = fs.readdirSync(binDir).filter((n) => /openclaw/i.test(n));
          appendGatewayDiag(`.bin 内与 openclaw 相关文件: ${names.length ? names.join(", ") : "(无)"}`);
        } catch (e) {
          appendGatewayDiag(`列举 .bin 失败: ${e?.message || e}`);
        }
      }
    }

    let child;
    if (packagedBin) {
      const nodeExe = resolveRealNodeExecutable();
      appendGatewayDiag(`启动方式: app.asar.unpacked 内 .bin`);
      appendGatewayDiag(`openclaw.cmd/bin=${packagedBin.bin}`);
      appendGatewayDiag(`cwd=${packagedBin.cwd}`);
      appendGatewayDiag(
        nodeExe
          ? `已解析到 Node: ${nodeExe}（已注入 PATH 供 .cmd 使用）`
          : "警告: 未解析到独立 node.exe，openclaw.cmd 可能找不到 node（请安装系统 Node 或在面板「下载运行时 Node」）"
      );
      const childEnv = buildOpenClawChildEnv(packagedBin.cwd);
      if (process.platform === "win32") {
        appendGatewayDiag(`命令: cmd.exe /c "${packagedBin.bin}" gateway run --allow-unconfigured`);
        child = spawn("cmd.exe", ["/c", packagedBin.bin, ...gatewayRunArgs], {
          ...spawnOptions,
          cwd: packagedBin.cwd,
          env: childEnv,
        });
      } else {
        appendGatewayDiag(`命令: ${packagedBin.bin} gateway run --allow-unconfigured`);
        child = spawn(packagedBin.bin, gatewayRunArgs, {
          ...spawnOptions,
          cwd: packagedBin.cwd,
          env: childEnv,
        });
      }
    } else if (packagedMjs) {
      const nodeExe = resolveRealNodeExecutable();
      if (!nodeExe) {
        const missing =
          process.platform === "darwin"
            ? "错误: 未找到安装包自带的 node（应用 Contents/Resources/node），也未找到客户端「下载运行时 Node」保存的 node。"
            : "错误: 未找到安装包自带的 node.exe（resources/node.exe），也未找到客户端「下载运行时 Node」保存的 node。";
        const explain =
          process.platform === "darwin"
            ? "说明: 不能用本应用主程序代替 Node 跑 openclaw.mjs；否则会再拉起桌面主进程（日志里会出现 19111 本地代理，而非 OpenClaw 18789）。"
            : "说明: 不能使用本程序 ClawHeart Desktop.exe 代替 Node；否则会启动第二个桌面主进程（日志里会出现 19111 本地代理，而非 OpenClaw 18789）。";
        const fix =
          process.platform === "darwin"
            ? "解决: ① 请用最新 DMG 重装（构建会把 node 写入 Resources）；或 ② 在 OpenClaw 面板黄色区域点「下载运行时 Node」后再启动 Gateway。"
            : "解决: ① 请使用最新安装包（构建时已打入 resources/node.exe）；或 ② 在 OpenClaw 面板黄色区域点「下载运行时 Node」后再启动 Gateway。";
        appendGatewayDiag(missing);
        appendGatewayDiag(explain);
        appendGatewayDiag(fix);
        return false;
      }
      const extraEnv = buildOpenClawChildEnv(unpackedRoot);
      appendGatewayDiag(`启动方式: openclaw.mjs + 独立 Node`);
      appendGatewayDiag(`node=${nodeExe}`);
      appendGatewayDiag(`args=${JSON.stringify([packagedMjs, ...gatewayRunArgs])}`);
      appendGatewayDiag(`cwd=${path.dirname(packagedMjs)}`);
      appendGatewayDiag(`NODE_PATH=${extraEnv.NODE_PATH || "(未设置)"}`);
      child = spawn(nodeExe, [packagedMjs, ...gatewayRunArgs], {
        ...spawnOptions,
        cwd: path.dirname(packagedMjs),
        env: extraEnv,
      });
    } else {
      if (!binPath || !fs.existsSync(binPath)) {
        appendGatewayDiag("内置模式：未找到开发目录 node_modules/.bin/openclaw");
        return false;
      }
      const devEnv = buildOpenClawChildEnv(null);
      if (process.platform === "win32") {
        appendGatewayDiag(`启动方式: 开发依赖（node_modules/.bin）`);
        appendGatewayDiag(`命令: cmd.exe /c "${binPath}" gateway run --allow-unconfigured`);
        child = spawn("cmd.exe", ["/c", binPath, ...gatewayRunArgs], {
          ...spawnOptions,
          env: devEnv,
        });
      } else {
        appendGatewayDiag(`启动方式: 开发依赖（node_modules/.bin）`);
        appendGatewayDiag(`命令: ${binPath} gateway run --allow-unconfigured`);
        child = spawn(binPath, gatewayRunArgs, {
          ...spawnOptions,
          env: devEnv,
        });
      }
    }

    attachChildProcessLogs(child, binaryMode);
    openclawProcess = child;

    appendGatewayDiag("已 spawn 子进程，等待 Gateway UI 就绪（最多约 45 秒）...");
    console.log("[OpenClaw] Gateway 进程已启动，等待服务就绪...");

    // 等待 OpenClaw 启动（冷启动可能较慢，最多约 45 秒）
    for (let i = 0; i < 90; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const running = await probeGatewayReadyAfterSpawn(binaryMode);
      if (running) {
        appendGatewayDiag("成功: Gateway 已就绪（进程列表或子进程 listening 日志）");
        console.log("[OpenClaw] OpenClaw Gateway 启动成功！");
        clearGatewayPortConflictMode(binaryMode);
        return true;
      }
    }

    appendGatewayDiag("失败: 约 45 秒内仍未判定就绪（进程扫描与 listening 日志均未命中）");
    appendGatewayDiag("可能原因: 子进程已崩溃、启动参数非 gateway run、或本机进程列表扫描异常。");
    console.log("[OpenClaw] OpenClaw Gateway 启动超时（约 45 秒）");
    console.log("[OpenClaw] 提示：请查看 Gateway 诊断日志");
    return false;
  } catch (err) {
    appendGatewayDiag(`启动过程异常: ${err?.stack || err?.message || String(err)}`);
    console.error("[OpenClaw] 启动失败:", err);
    return false;
  }
}

const PRE_STOP_LOG_MAX = 4000;

function appendPreStopOutputToDiag(label, text) {
  const s = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!s) return;
  const chunk = s.length > PRE_STOP_LOG_MAX ? `${s.slice(0, PRE_STOP_LOG_MAX)}…[截断]` : s;
  for (const line of chunk.split("\n")) {
    if (line.trim()) appendGatewayDiag(`${label} ${line}`);
  }
}

/**
 * 与当前内置/外置工作区一致的 `openclaw gateway stop`（不操作 openclawProcess）。
 * 用于正式停止流程与启动前抢占锁/端口。
 */
async function execOpenClawGatewayStopCli(binaryMode) {
  const { resolveExternalOpenClawBinPath } = require("./openclaw-external.js");
  const mode = binaryMode === "external" ? "external" : "bundled";
  const packagedBin = getPackagedOpenClawBinFromUnpacked();
  const packagedMjs = packagedBin ? null : getPackagedOpenClawMjsPath();

  if (mode === "external") {
    const extBin = resolveExternalOpenClawBinPath();
    if (!extBin) {
      return {
        code: 1,
        stdout: "",
        stderr: "ClawHeart 外置 openclaw 未安装，跳过 gateway stop 命令",
      };
    }
    const env = buildOpenClawChildEnv(null, { gatewayOpenclawBinary: "external" });
    if (process.platform === "win32") {
      return execWithOutput("cmd.exe", ["/c", extBin, "gateway", "stop"], {
        shell: false,
        cwd: os.tmpdir(),
        env,
      });
    }
    return execWithOutput(extBin, ["gateway", "stop"], {
      shell: false,
      cwd: os.tmpdir(),
      env,
    });
  }

  if (packagedBin) {
    const childEnv = buildOpenClawChildEnv(packagedBin.cwd);
    if (process.platform === "win32") {
      return execWithOutput("cmd.exe", ["/c", packagedBin.bin, "gateway", "stop"], {
        shell: false,
        cwd: packagedBin.cwd,
        env: childEnv,
      });
    }
    return execWithOutput(packagedBin.bin, ["gateway", "stop"], {
      shell: false,
      cwd: packagedBin.cwd,
      env: childEnv,
    });
  }

  if (packagedMjs) {
    const unpackedRoot = getUnpackedAppRoot();
    const nodeExe = resolveRealNodeExecutable();
    if (!nodeExe) {
      return {
        code: 1,
        stdout: "",
        stderr:
          process.platform === "darwin"
            ? "未找到内置 node（Resources/node），无法执行 gateway stop"
            : "未找到 node.exe，无法执行 gateway stop",
      };
    }
    const extraEnv = buildOpenClawChildEnv(unpackedRoot);
    return execWithOutput(nodeExe, [packagedMjs, "gateway", "stop"], {
      shell: false,
      cwd: path.dirname(packagedMjs),
      env: extraEnv,
    });
  }

  const localBinDir = path.join(__dirname, "../../node_modules", ".bin");
  const devOpenClawBin =
    process.platform === "win32" ? path.join(localBinDir, "openclaw.cmd") : path.join(localBinDir, "openclaw");
  if (!fs.existsSync(devOpenClawBin)) {
    return {
      code: 1,
      stdout: "",
      stderr: "内置模式未找到 node_modules/.bin/openclaw",
    };
  }
  const env = buildOpenClawChildEnv(null);
  if (process.platform === "win32") {
    return execWithOutput("cmd.exe", ["/c", devOpenClawBin, "gateway", "stop"], {
      shell: false,
      cwd: os.tmpdir(),
      env,
    });
  }
  return execWithOutput(devOpenClawBin, ["gateway", "stop"], {
    shell: false,
    cwd: os.tmpdir(),
    env,
  });
}

/**
 * 启动 gateway run 之前先 graceful stop：清 PID 锁、释放端口；仅 kill 进程时 launchd 可能立刻复活子进程，stop 才能对齐状态。
 */
async function preemptiveGatewayStopBeforeStart(binaryMode) {
  appendGatewayDiag(
    "启动前: 执行 openclaw gateway stop（释放锁与端口；若 macOS 有 LaunchAgent 托管，仅 kill PID 往往不够）…"
  );
  if (process.platform === "darwin") {
    appendGatewayDiag(
      "macOS 提示: 若仍报已运行，可终端执行 launchctl bootout gui/$(id -u)/ai.openclaw.gateway（或上游文档中的服务名）"
    );
  }
  try {
    const result = await execOpenClawGatewayStopCli(binaryMode);
    appendPreStopOutputToDiag("[pre-stop stdout]", result.stdout);
    appendPreStopOutputToDiag("[pre-stop stderr]", result.stderr);
    appendGatewayDiag(`[pre-stop] 命令结束 code=${result.code}`);
  } catch (e) {
    appendGatewayDiag(`[pre-stop] 异常: ${e?.message || String(e)}`);
  }
  await new Promise((r) => setTimeout(r, 2500));
}

/**
 * 停止内置 OpenClaw
 */
async function stopEmbeddedOpenClaw() {
  console.log("[OpenClaw] 停止 OpenClaw Gateway...");

  try {
    await refreshGatewayWorkspaceFromDb();
    lastGatewayStopEpochMs = Date.now();
    appendGatewayDiag("======== 停止 Gateway ========");
    if (openclawProcess) {
      const pid = openclawProcess.pid;
      try {
        openclawProcess.kill();
        console.log("[OpenClaw] 已终止 Gateway 进程 (pid=%s)", pid);
      } catch (err) {
        console.log("[OpenClaw] 终止进程失败:", err);
      }
      killWindowsProcessTree(pid);
      openclawProcess = null;
    }

    const { getOpenClawSettings } = require("../db.js");
    const { normalizeGatewayOpenclawBinary } = require("./openclaw-external.js");
    const settings = await getOpenClawSettings();
    const binaryMode = normalizeGatewayOpenclawBinary(settings.gatewayOpenclawBinary);

    const result = await execOpenClawGatewayStopCli(binaryMode);

    console.log("[OpenClaw] 停止命令已执行");
    console.log("[OpenClaw] stdout:", result.stdout);
    console.log("[OpenClaw] stderr:", result.stderr);

    clearCachedDashboardUrl();

    const stepMs = 300;
    const maxWaitMs = 15000;
    for (let elapsed = 0; elapsed < maxWaitMs; elapsed += stepMs) {
      const stillRunning = await checkOpenClawRunning();
      if (!stillRunning) {
        appendGatewayDiag("未再检测到 gateway run 进程，Gateway 已停止");
        return true;
      }
      await new Promise((r) => setTimeout(r, stepMs));
    }

    const stillRunning = await checkOpenClawRunning();
    if (stillRunning) {
      appendGatewayDiag("警告: 停止后仍能扫到 gateway run 进程；可能为本机另有终端/守护在跑 OpenClaw Gateway");
      return false;
    }
    return true;
  } catch (err) {
    console.error("[OpenClaw] 停止失败:", err);
    appendGatewayDiag(`停止异常: ${err?.stack || err?.message || String(err)}`);
    return false;
  }
}

/**
 * 获取带 token 的 dashboard URL
 */
async function getDashboardUrl() {
  if (cachedDashboardUrl) {
    return cachedDashboardUrl;
  }

  try {
    await refreshGatewayWorkspaceFromDb();
    const { getOpenClawSettings } = require("../db.js");
    const { normalizeGatewayOpenclawBinary, resolveExternalOpenClawBinPath } = require("./openclaw-external.js");
    const settings = await getOpenClawSettings();
    const binaryMode = normalizeGatewayOpenclawBinary(settings.gatewayOpenclawBinary);

    const packagedBin = getPackagedOpenClawBinFromUnpacked();
    const packagedMjs = packagedBin ? null : getPackagedOpenClawMjsPath();
    let result;

    if (binaryMode === "external") {
      const extBin = resolveExternalOpenClawBinPath();
      if (extBin) {
        const env = buildOpenClawChildEnv(null, { gatewayOpenclawBinary: "external" });
        if (process.platform === "win32") {
          result = await execWithOutput("cmd.exe", ["/c", extBin, "dashboard", "--no-open"], {
            shell: false,
            cwd: os.tmpdir(),
            env,
          });
        } else {
          result = await execWithOutput(extBin, ["dashboard", "--no-open"], {
            shell: false,
            cwd: os.tmpdir(),
            env,
          });
        }
      }
    }

    if (result == null && packagedBin) {
      const childEnv = buildOpenClawChildEnv(packagedBin.cwd);
      if (process.platform === "win32") {
        result = await execWithOutput("cmd.exe", ["/c", packagedBin.bin, "dashboard", "--no-open"], {
          shell: false,
          cwd: packagedBin.cwd,
          env: childEnv,
        });
      } else {
        result = await execWithOutput(packagedBin.bin, ["dashboard", "--no-open"], {
          shell: false,
          cwd: packagedBin.cwd,
          env: childEnv,
        });
      }
    } else if (result == null && packagedMjs) {
      const unpackedRoot = getUnpackedAppRoot();
      const nodeExe = resolveRealNodeExecutable();
      if (!nodeExe) {
        return OPENCLAW_UI_URL;
      }
      const extraEnv = buildOpenClawChildEnv(unpackedRoot);
      result = await execWithOutput(nodeExe, [packagedMjs, "dashboard", "--no-open"], {
        shell: false,
        cwd: path.dirname(packagedMjs),
        env: extraEnv,
      });
    } else if (result == null) {
      if (!hasBundledOpenClawCli()) {
        return OPENCLAW_UI_URL;
      }
      const localBinDir = path.join(__dirname, "../../node_modules", ".bin");
      const devOpenClawBin =
        process.platform === "win32" ? path.join(localBinDir, "openclaw.cmd") : path.join(localBinDir, "openclaw");
      if (!fs.existsSync(devOpenClawBin)) {
        return OPENCLAW_UI_URL;
      }
      const env = buildOpenClawChildEnv(null);
      if (process.platform === "win32") {
        result = await execWithOutput("cmd.exe", ["/c", devOpenClawBin, "dashboard", "--no-open"], {
          shell: false,
          cwd: os.tmpdir(),
          env,
        });
      } else {
        result = await execWithOutput(devOpenClawBin, ["dashboard", "--no-open"], {
          shell: false,
          cwd: os.tmpdir(),
          env,
        });
      }
    }

    if (result && result.code === 0 && result.stdout) {
      // 从输出中提取 URL（格式：http://localhost:18789/#token=xxx 或 ?token=xxx）
      const lines = result.stdout.split("\n");
      for (const line of lines) {
        // 匹配 Dashboard URL: 开头的行
        if (line.includes("Dashboard URL:")) {
          const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
          if (urlMatch) {
            cachedDashboardUrl = urlMatch[1].trim();
            console.log("[OpenClaw] Dashboard URL 已获取:", cachedDashboardUrl);
            return cachedDashboardUrl;
          }
        }
        // 或者直接匹配包含 token 的 URL
        const match = line.match(/(https?:\/\/[^\s]+[#?]token=[^\s]+)/);
        if (match) {
          cachedDashboardUrl = match[1].trim();
          console.log("[OpenClaw] Dashboard URL 已获取:", cachedDashboardUrl);
          return cachedDashboardUrl;
        }
      }
    }
    
    console.log("[OpenClaw] 无法获取 dashboard URL，使用默认 URL");
    return OPENCLAW_UI_URL;
  } catch (err) {
    console.error("[OpenClaw] 获取 dashboard URL 失败:", err);
    return OPENCLAW_UI_URL;
  }
}

/**
 * 获取 OpenClaw 状态
 */
async function getOpenClawStatus() {
  const hasEmbedded = hasEmbeddedOpenClaw();
  const { getOpenClawSettings } = require("../db.js");
  const settings = await getOpenClawSettings();
  const baseUi = normalizeOpenClawUiUrl(settings.uiUrl);
  const isRunning = await checkOpenClawRunning();

  let uiUrl = baseUi;
  if (isRunning) {
    uiUrl = await getDashboardUrl();
  }

  enrichGatewayPortConflictsWithLsof();

  return {
    hasEmbedded,
    isRunning,
    uiUrl,
    gatewayDiagnosticLog: getGatewayDiagnosticLog(),
    ...getGatewayDiagnosticLogsPayload(),
    ...getGatewayPortConflictsPayload(),
  };
}

module.exports = {
  hasEmbeddedOpenClaw,
  hasBundledOpenClawCli,
  getOpenClawCliSource,
  startEmbeddedOpenClaw,
  stopEmbeddedOpenClaw,
  getOpenClawStatus,
  getGatewayDiagnosticLog,
  getGatewayDiagnosticLogsPayload,
  clearCachedDashboardUrl,
  OPENCLAW_UI_URL,
};
