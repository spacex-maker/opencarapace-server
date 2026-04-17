/**
 * Gateway 生命周期：start / stop / exec-stop-cli / preemptive-stop。
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execWithOutput } = require("../utils.js");
const {
  isWin,
  localBinPath,
  spawnOpenClawBin,
  execOpenClawBin,
  formatSpawnCommand,
  killProcessTree,
  getNodeMissingDiagnostics,
  getNodeMissingStopError,
  getLaunchctlHint,
} = require("./platform.js");
const {
  getUnpackedAppRoot,
  getPackagedOpenClawBinFromUnpacked,
  getPackagedOpenClawMjsPath,
  resolveRealNodeExecutable,
  buildOpenClawChildEnv,
} = require("../openclaw-paths.js");
const {
  clearGatewayPortConflictMode,
  listTcpListenersOnPort,
} = require("../openclaw-gateway-port-conflict.js");
const { resolveEffectiveExternalOpenClawBin } = require("../openclaw-discovery.js");
const {
  appendGatewayDiag,
  clearGatewayDiag,
  attachChildProcessLogs,
  gatewayDiagLogShowsGatewayListening,
  appendPreStopOutputToDiag,
} = require("./diag.js");
const {
  writePidFile,
  readPidFile,
  removePidFile,
  isProcessAlive,
  killProcessGroup,
  killByPidFile,
} = require("./pid-file.js");

// ─── 共享可变状态（由主模块注入） ─────────────────────────────────

/**
 * 生命周期函数需要访问主模块的可变状态。
 * 调用方通过 initLifecycle(shared) 注入引用，避免循环依赖。
 * @type {{ gatewayProcesses, lastGatewayStopEpochMs, clearCachedDashboardUrl, checkOpenClawRunning, probeGatewayReadyAfterSpawn, hasBundledOpenClawCli, BUNDLED_GATEWAY_PORT, getExternalGatewayPort }}
 */
let S = null;

function initLifecycle(shared) {
  S = shared;
}

// ─── 路径标记收集（孤儿进程匹配） ────────────────────────────────

function collectBundledGatewayStopPathMarkers() {
  const markers = [];
  const root = getUnpackedAppRoot();
  if (root) markers.push(root);
  const packagedBin = getPackagedOpenClawBinFromUnpacked();
  if (packagedBin?.bin) markers.push(packagedBin.bin);
  const mjs = getPackagedOpenClawMjsPath();
  if (mjs) markers.push(mjs);
  try {
    const rp = process.resourcesPath || "";
    if (rp) markers.push(rp);
  } catch {
    /* ignore */
  }
  try {
    const nodeExe = resolveRealNodeExecutable();
    if (nodeExe) markers.push(nodeExe);
  } catch {
    /* ignore */
  }
  const devCmd = path.join(__dirname, "../../../node_modules/.bin/openclaw.cmd");
  if (fs.existsSync(devCmd)) markers.push(devCmd);
  const devSh = path.join(__dirname, "../../../node_modules/.bin/openclaw");
  if (fs.existsSync(devSh)) markers.push(devSh);
  const devMjs = path.join(__dirname, "../../../node_modules/openclaw/openclaw.mjs");
  if (fs.existsSync(devMjs)) markers.push(devMjs);
  return [...new Set(markers.map((m) => path.normalize(m)))].filter(Boolean);
}

async function collectExternalGatewayStopPathMarkers() {
  const {
    getExternalOpenClawNpmPrefix,
    getExternalOpenClawRuntimeStateDir,
    resolveExternalOpenClawBinPath,
  } = require("../openclaw-external.js");
  const markers = [];
  const prefix = getExternalOpenClawNpmPrefix();
  const rt = getExternalOpenClawRuntimeStateDir();
  if (prefix) markers.push(prefix);
  if (rt) markers.push(rt);
  const managed = resolveExternalOpenClawBinPath();
  if (managed) markers.push(managed);
  try {
    const { binPath } = await resolveEffectiveExternalOpenClawBin();
    if (binPath) markers.push(binPath);
  } catch {
    /* ignore */
  }
  try {
    const nodeExe = resolveRealNodeExecutable({ gatewayOpenclawBinary: "external" });
    if (nodeExe) markers.push(nodeExe);
  } catch {
    /* ignore */
  }
  return [...new Set(markers.map((m) => path.normalize(String(m || "").trim())))].filter((m) => m.length >= 4);
}

function getStateDirForMode(binaryMode) {
  const { getManagedOpenClawEnv, getUserDefaultOpenClawEnv } = require("../openclaw-workspace.js");
  return binaryMode === "external"
    ? getUserDefaultOpenClawEnv().OPENCLAW_STATE_DIR
    : getManagedOpenClawEnv().OPENCLAW_STATE_DIR;
}

function trackGatewayChild(child, binaryMode, { port, bin } = {}) {
  const m = binaryMode === "external" ? "external" : "bundled";
  attachChildProcessLogs(child, m);

  const stateDir = getStateDirForMode(m);
  writePidFile(stateDir, {
    pid: child.pid,
    pgid: child.pid,
    port,
    bin,
  });
  appendGatewayDiag(`PID 文件已写入: ${stateDir} (pid=${child.pid})`, m);

  child.on("exit", () => {
    if (S.gatewayProcesses[m] === child) S.gatewayProcesses[m] = null;
    removePidFile(stateDir);
  });
  S.gatewayProcesses[m] = child;
}

// ─── exec gateway stop CLI ───────────────────────────────────────

async function execOpenClawGatewayStopCli(binaryMode) {
  const mode = binaryMode === "external" ? "external" : "bundled";
  const { getManagedOpenClawEnv, getUserDefaultOpenClawEnv } = require("../openclaw-workspace.js");
  const correctModeEnv = mode === "external" ? getUserDefaultOpenClawEnv() : getManagedOpenClawEnv();

  const applyModeEnv = (env) => {
    env.OPENCLAW_STATE_DIR = correctModeEnv.OPENCLAW_STATE_DIR;
    env.OPENCLAW_CONFIG_PATH = correctModeEnv.OPENCLAW_CONFIG_PATH;
    return env;
  };

  const packagedBin = getPackagedOpenClawBinFromUnpacked();
  const packagedMjs = packagedBin ? null : getPackagedOpenClawMjsPath();

  if (mode === "external") {
    const resolved = await resolveEffectiveExternalOpenClawBin();
    const extBin = resolved.binPath;
    if (!extBin) {
      return {
        code: 1, stdout: "",
        stderr: "外置模式未解析到 openclaw（前缀与本机扫描均无），跳过 gateway stop 命令",
      };
    }
    const env = applyModeEnv(buildOpenClawChildEnv(null));
    return execOpenClawBin(extBin, ["gateway", "stop"], { cwd: os.tmpdir(), env });
  }

  if (packagedBin) {
    const childEnv = applyModeEnv(buildOpenClawChildEnv(packagedBin.cwd));
    return execOpenClawBin(packagedBin.bin, ["gateway", "stop"], {
      cwd: packagedBin.cwd, env: childEnv,
    });
  }

  if (packagedMjs) {
    const unpackedRoot = getUnpackedAppRoot();
    const nodeExe = resolveRealNodeExecutable();
    if (!nodeExe) {
      return {
        code: 1, stdout: "",
        stderr: getNodeMissingStopError(),
      };
    }
    const extraEnv = applyModeEnv(buildOpenClawChildEnv(unpackedRoot));
    return execWithOutput(nodeExe, [packagedMjs, "gateway", "stop"], {
      shell: false, cwd: path.dirname(packagedMjs), env: extraEnv,
    });
  }

  const _localBinDir = path.join(__dirname, "../../../node_modules", ".bin");
  const devOpenClawBin = localBinPath(_localBinDir);
  if (!fs.existsSync(devOpenClawBin)) {
    return {
      code: 1, stdout: "",
      stderr: "内置模式未找到 node_modules/.bin/openclaw",
    };
  }
  const env = applyModeEnv(buildOpenClawChildEnv(null));
  return execOpenClawBin(devOpenClawBin, ["gateway", "stop"], { cwd: os.tmpdir(), env });
}

// ─── preemptive stop ─────────────────────────────────────────────

async function preemptiveGatewayStopBeforeStart(binaryMode) {
  S.clearCachedDashboardUrl(binaryMode);
  appendGatewayDiag(
    "启动前: 执行 openclaw gateway stop（释放锁与端口；若 macOS 有 LaunchAgent 托管，仅 kill PID 往往不够）…",
    binaryMode
  );
  const launchctlHint = getLaunchctlHint();
  if (launchctlHint) {
    appendGatewayDiag(launchctlHint, binaryMode);
  }
  try {
    const result = await execOpenClawGatewayStopCli(binaryMode);
    appendPreStopOutputToDiag("[pre-stop stdout]", result.stdout, binaryMode);
    appendPreStopOutputToDiag("[pre-stop stderr]", result.stderr, binaryMode);
    appendGatewayDiag(`[pre-stop] 命令结束 code=${result.code}`, binaryMode);
  } catch (e) {
    appendGatewayDiag(`[pre-stop] 异常: ${e?.message || String(e)}`, binaryMode);
  }
  await new Promise((r) => setTimeout(r, 2500));
}

// ─── start ───────────────────────────────────────────────────────

async function refreshGatewayWorkspaceFromDb() {
  const { getOpenClawSettings } = require("../../db.js");
  const { syncGatewayWorkspaceFromSettings } = require("../openclaw-workspace.js");
  const s = await getOpenClawSettings();
  syncGatewayWorkspaceFromSettings(s);
}

async function startEmbeddedOpenClaw(modeArg) {
  const { normalizeGatewayOpenclawBinary } = require("../openclaw-external.js");
  let binaryMode;
  if (modeArg === "bundled" || modeArg === "external") {
    binaryMode = modeArg;
  } else {
    await refreshGatewayWorkspaceFromDb();
    const { getOpenClawSettings } = require("../../db.js");
    const settings = await getOpenClawSettings();
    binaryMode = normalizeGatewayOpenclawBinary(settings.gatewayOpenclawBinary);
  }

  S.clearCachedDashboardUrl(binaryMode);

  const { getManagedOpenClawEnv, getUserDefaultOpenClawEnv, syncGatewayWorkspaceFromSettings, getGatewayWorkspaceStateSync } = require("../openclaw-workspace.js");
  const _modeEnv = binaryMode === "external" ? getUserDefaultOpenClawEnv() : getManagedOpenClawEnv();
  const makeChildEnv = (unpackedRoot) => {
    const e = buildOpenClawChildEnv(unpackedRoot);
    e.OPENCLAW_STATE_DIR = _modeEnv.OPENCLAW_STATE_DIR;
    e.OPENCLAW_CONFIG_PATH = _modeEnv.OPENCLAW_CONFIG_PATH;
    return e;
  };

  syncGatewayWorkspaceFromSettings({ gatewayOpenclawBinary: binaryMode });

  const uiUrlForLog = S.getDefaultUiUrlForMode(binaryMode);

  const isRunning = await S.checkOpenClawRunning(binaryMode);
  if (isRunning) {
    appendGatewayDiag(
      `检测到 ${binaryMode} Gateway 已在运行（端口/进程检测）；UI: ${uiUrlForLog}`,
      binaryMode
    );
    console.log(`[OpenClaw] ${binaryMode} Gateway 已在运行`);
    clearGatewayPortConflictMode(binaryMode);
    return true;
  }

  clearGatewayDiag(binaryMode);
  const ws = getGatewayWorkspaceStateSync();
  appendGatewayDiag(`Gateway 二进制模式: ${binaryMode}`, binaryMode);
  appendGatewayDiag(`Gateway 工作区状态: ${JSON.stringify(ws)}`, binaryMode);
  appendGatewayDiag(`OPENCLAW_STATE_DIR=${_modeEnv.OPENCLAW_STATE_DIR}`, binaryMode);
  appendGatewayDiag(`OPENCLAW_CONFIG_PATH=${_modeEnv.OPENCLAW_CONFIG_PATH}`, binaryMode);
  appendGatewayDiag("======== OpenClaw Gateway 启动尝试 ========", binaryMode);
  appendGatewayDiag(`platform=${process.platform}`, binaryMode);
  appendGatewayDiag(`就绪判断=进程命令行（openclaw · gateway run）；配置中 UI: ${uiUrlForLog}`, binaryMode);
  appendGatewayDiag(`process.execPath=${process.execPath}`, binaryMode);
  appendGatewayDiag(`process.resourcesPath=${process.resourcesPath || "(空)"}`, binaryMode);
  appendGatewayDiag(`process.cwd()=${process.cwd()}`, binaryMode);
  appendGatewayDiag("说明: 子进程使用 stdio 管道收集日志；关闭本客户端后 Gateway 进程会一并结束。", binaryMode);

  console.log("[OpenClaw] 尝试启动 OpenClaw Gateway...");

  if (binaryMode !== "external") {
    try {
      const { initOpenClawConfig, ensureGatewayModeLocal, ensureManagedGatewayPort } = require("../openclaw-config.js");
      initOpenClawConfig();
      ensureGatewayModeLocal();
      ensureManagedGatewayPort();
      appendGatewayDiag(
        `已执行 initOpenClawConfig + ensureGatewayModeLocal + ensureManagedGatewayPort（内置专属端口 ${S.BUNDLED_GATEWAY_PORT}）`,
        binaryMode
      );
    } catch (configErr) {
      appendGatewayDiag(`initOpenClawConfig 异常: ${configErr?.message || configErr}`, binaryMode);
      console.log("[OpenClaw] 配置初始化失败（可忽略）:", configErr);
    }
  }

  await preemptiveGatewayStopBeforeStart(binaryMode);

  try {
    const gatewayRunArgs = ["gateway", "run", "--allow-unconfigured"];
    const spawnOptions = {
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: false,
      cwd: os.tmpdir(),
    };

    if (binaryMode === "external") {
      const resolved = await resolveEffectiveExternalOpenClawBin();
      const extBin = resolved.binPath;
      if (!extBin) {
        appendGatewayDiag("======== OpenClaw Gateway 启动中止 ========", binaryMode);
        appendGatewayDiag(
          "原因: 未找到可用于外置模式的 openclaw（ClawHeart npm 前缀内无，且本机扫描 PATH / npm 全局等也未发现）。可点外置卡片「扫描本机」后重试，或「安装到 prefix」。",
          binaryMode
        );
        return false;
      }
      const devEnv = makeChildEnv(null);
      appendGatewayDiag(
        resolved.source === "managed-prefix"
          ? "启动方式: ClawHeart 外置 npm 前缀内的 openclaw"
          : "启动方式: 本机扫描到的 openclaw（非 ClawHeart 前缀）",
        binaryMode
      );
      appendGatewayDiag(`openclaw=${extBin}`, binaryMode);
      appendGatewayDiag(`命令: ${formatSpawnCommand(extBin, gatewayRunArgs)}`, binaryMode);
      let child = spawnOpenClawBin(extBin, gatewayRunArgs, {
        ...spawnOptions,
        env: devEnv,
      });
      child.unref();
      trackGatewayChild(child, binaryMode, { port: S.getExternalGatewayPort(), bin: extBin });
      appendGatewayDiag("已 spawn 子进程，等待 Gateway UI 就绪（最多约 45 秒）...", binaryMode);
      for (let i = 0; i < 90; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (await S.probeGatewayReadyAfterSpawn(binaryMode)) {
          appendGatewayDiag("成功: Gateway 已就绪（进程列表或子进程 listening 日志）", binaryMode);
          console.log("[OpenClaw] OpenClaw Gateway 启动成功！");
          clearGatewayPortConflictMode(binaryMode);
          return true;
        }
      }
      appendGatewayDiag(
        "失败: 约 45 秒内仍未判定就绪（进程扫描与 listening 日志均未命中；请查看子进程输出）",
        binaryMode
      );
      return false;
    }

    if (!S.hasBundledOpenClawCli()) {
      appendGatewayDiag("======== OpenClaw Gateway 启动中止 ========", binaryMode);
      appendGatewayDiag(
        "原因: 内置模式未检测到安装包/开发目录内的 OpenClaw（不会回退到系统 PATH 上的全局 openclaw）。",
        binaryMode
      );
      return false;
    }

    const packagedBin = getPackagedOpenClawBinFromUnpacked();
    const packagedMjs = packagedBin ? null : getPackagedOpenClawMjsPath();
    const _localBinDir = path.join(__dirname, "../../../node_modules", ".bin");
    const devOpenClawBin = localBinPath(_localBinDir);
    const binPath = packagedBin || packagedMjs ? null : devOpenClawBin;

    const unpackedRoot = getUnpackedAppRoot();
    if (!packagedBin && packagedMjs && unpackedRoot) {
      const binDir = path.join(unpackedRoot, "node_modules", ".bin");
      appendGatewayDiag(
        `提示: 未使用 node_modules/.bin/openclaw（.bin 目录存在=${fs.existsSync(binDir)}）`,
        binaryMode
      );
      if (fs.existsSync(binDir)) {
        try {
          const names = fs.readdirSync(binDir).filter((n) => /openclaw/i.test(n));
          appendGatewayDiag(`.bin 内与 openclaw 相关文件: ${names.length ? names.join(", ") : "(无)"}`, binaryMode);
        } catch (e) {
          appendGatewayDiag(`列举 .bin 失败: ${e?.message || e}`, binaryMode);
        }
      }
    }

    let child;
    if (packagedBin) {
      const nodeExe = resolveRealNodeExecutable();
      appendGatewayDiag(`启动方式: app.asar.unpacked 内 .bin`, binaryMode);
      appendGatewayDiag(`openclaw.cmd/bin=${packagedBin.bin}`, binaryMode);
      appendGatewayDiag(`cwd=${packagedBin.cwd}`, binaryMode);
      appendGatewayDiag(
        nodeExe
          ? `已解析到 Node: ${nodeExe}（已注入 PATH 供 .cmd 使用）`
          : "警告: 未解析到独立 node.exe，openclaw.cmd 可能找不到 node（请安装系统 Node 或在面板「下载运行时 Node」）",
        binaryMode
      );
      const childEnv = makeChildEnv(packagedBin.cwd);
      appendGatewayDiag(`命令: ${formatSpawnCommand(packagedBin.bin, gatewayRunArgs)}`, binaryMode);
      child = spawnOpenClawBin(packagedBin.bin, gatewayRunArgs, {
        ...spawnOptions,
        cwd: packagedBin.cwd,
        env: childEnv,
      });
    } else if (packagedMjs) {
      const nodeExe = resolveRealNodeExecutable();
      if (!nodeExe) {
        const diag = getNodeMissingDiagnostics(S.BUNDLED_GATEWAY_PORT);
        appendGatewayDiag(diag.missing, binaryMode);
        appendGatewayDiag(diag.explain, binaryMode);
        appendGatewayDiag(diag.fix, binaryMode);
        return false;
      }
      const extraEnv = makeChildEnv(unpackedRoot);
      appendGatewayDiag(`启动方式: openclaw.mjs + 独立 Node`, binaryMode);
      appendGatewayDiag(`node=${nodeExe}`, binaryMode);
      appendGatewayDiag(`args=${JSON.stringify([packagedMjs, ...gatewayRunArgs])}`, binaryMode);
      appendGatewayDiag(`cwd=${path.dirname(packagedMjs)}`, binaryMode);
      appendGatewayDiag(`NODE_PATH=${extraEnv.NODE_PATH || "(未设置)"}`, binaryMode);
      child = spawn(nodeExe, [packagedMjs, ...gatewayRunArgs], {
        ...spawnOptions,
        cwd: path.dirname(packagedMjs),
        env: extraEnv,
      });
    } else {
      if (!binPath || !fs.existsSync(binPath)) {
        appendGatewayDiag("内置模式：未找到开发目录 node_modules/.bin/openclaw", binaryMode);
        return false;
      }
      const devEnv = makeChildEnv(null);
      appendGatewayDiag(`启动方式: 开发依赖（node_modules/.bin）`, binaryMode);
      appendGatewayDiag(`命令: ${formatSpawnCommand(binPath, gatewayRunArgs)}`, binaryMode);
      child = spawnOpenClawBin(binPath, gatewayRunArgs, {
        ...spawnOptions,
        env: devEnv,
      });
    }

    child.unref();
    trackGatewayChild(child, binaryMode, { port: S.BUNDLED_GATEWAY_PORT, bin: packagedBin?.bin || binPath || "(mjs)" });

    appendGatewayDiag("已 spawn 子进程，等待 Gateway UI 就绪（最多约 45 秒）...", binaryMode);
    console.log("[OpenClaw] Gateway 进程已启动，等待服务就绪...");

    for (let i = 0; i < 90; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const running = await S.probeGatewayReadyAfterSpawn(binaryMode);
      if (running) {
        appendGatewayDiag("成功: Gateway 已就绪（进程列表或子进程 listening 日志）", binaryMode);
        console.log("[OpenClaw] OpenClaw Gateway 启动成功！");
        clearGatewayPortConflictMode(binaryMode);
        return true;
      }
    }

    appendGatewayDiag("失败: 约 45 秒内仍未判定就绪（进程扫描与 listening 日志均未命中）", binaryMode);
    appendGatewayDiag("可能原因: 子进程已崩溃、启动参数非 gateway run、或本机进程列表扫描异常。", binaryMode);
    console.log("[OpenClaw] OpenClaw Gateway 启动超时（约 45 秒）");
    console.log("[OpenClaw] 提示：请查看 Gateway 诊断日志");
    return false;
  } catch (err) {
    appendGatewayDiag(`启动过程异常: ${err?.stack || err?.message || String(err)}`, binaryMode);
    console.error("[OpenClaw] 启动失败:", err);
    return false;
  }
}

// ─── stop ────────────────────────────────────────────────────────

async function stopEmbeddedOpenClaw(modeArg) {
  const { normalizeGatewayOpenclawBinary } = require("../openclaw-external.js");
  let binaryMode;
  if (modeArg === "bundled" || modeArg === "external") {
    binaryMode = modeArg;
  } else {
    await refreshGatewayWorkspaceFromDb();
    const { getOpenClawSettings } = require("../../db.js");
    const settings = await getOpenClawSettings();
    binaryMode = normalizeGatewayOpenclawBinary(settings.gatewayOpenclawBinary);
  }

  console.log(`[OpenClaw] 停止 ${binaryMode} Gateway...`);

  const stateDir = getStateDirForMode(binaryMode);

  try {
    S.lastGatewayStopEpochMs[binaryMode] = Date.now();
    appendGatewayDiag(`======== 停止 ${binaryMode} Gateway ========`, binaryMode);

    S.clearCachedDashboardUrl(binaryMode);
    const pidInfo = readPidFile(stateDir);

    // ① PID 文件存在 → 进程组杀（主路径，最可靠）
    if (pidInfo) {
      appendGatewayDiag(
        `PID 文件: pid=${pidInfo.pid} pgid=${pidInfo.pgid} port=${pidInfo.port}`,
        binaryMode
      );

      if (isProcessAlive(pidInfo.pid)) {
        appendGatewayDiag("进程存活，发送 SIGTERM 至进程组...", binaryMode);
        killProcessGroup(pidInfo.pgid, "SIGTERM");
        await new Promise((r) => setTimeout(r, 2000));

        if (isProcessAlive(pidInfo.pid)) {
          appendGatewayDiag("SIGTERM 后仍存活，发送 SIGKILL 至进程组...", binaryMode);
          killProcessGroup(pidInfo.pgid, "SIGKILL");
          try { process.kill(pidInfo.pid, "SIGKILL"); } catch { /* already dead */ }
          await new Promise((r) => setTimeout(r, 500));
        }
      } else {
        appendGatewayDiag("PID 文件存在但进程已退出，清理 PID 文件", binaryMode);
      }

      removePidFile(stateDir);
      S.gatewayProcesses[binaryMode] = null;
    }

    // ② CLI stop 作为补充（处理非本应用 spawn 的 gateway，或 PID 文件缺失的情况）
    if (await S.checkOpenClawRunning(binaryMode)) {
      appendGatewayDiag("进程组杀后 Gateway 仍在运行，尝试 CLI gateway stop...", binaryMode);
      const result = await execOpenClawGatewayStopCli(binaryMode);
      appendGatewayDiag(
        `CLI stop: code=${result.code} stdout=${(result.stdout || "").slice(0, 200)} stderr=${(result.stderr || "").slice(0, 200)}`,
        binaryMode
      );
      await new Promise((r) => setTimeout(r, 1500));
    }

    // ③ 内存中的子进程引用兜底（理论上 ① 已处理，但防御性清理）
    const proc = S.gatewayProcesses[binaryMode];
    if (proc) {
      try { proc.kill("SIGKILL"); } catch { /* already dead */ }
      S.gatewayProcesses[binaryMode] = null;
    }

    // ④ 端口级兜底：lsof/netstat 找残留进程并 kill
    if (await S.checkOpenClawRunning(binaryMode)) {
      const targetPort = binaryMode === "external"
        ? S.getExternalGatewayPort()
        : S.BUNDLED_GATEWAY_PORT;

      if (isWin) {
        const { findBundledGatewayRunPidsWindows } = require("../openclaw-gateway-process.js");
        const markers =
          binaryMode === "external"
            ? await collectExternalGatewayStopPathMarkers()
            : collectBundledGatewayStopPathMarkers();
        if (markers.length) {
          const orphanPids = await findBundledGatewayRunPidsWindows(markers);
          for (const opid of orphanPids) killProcessTree(opid);
        }
      } else {
        const listeners = listTcpListenersOnPort(targetPort);
        if (listeners.length) {
          appendGatewayDiag(
            `端口 ${targetPort} 残留 ${listeners.length} 个进程: ` +
              listeners.map((l) => `${l.command}(${l.pid})`).join(", ") + "；强杀",
            binaryMode
          );
          for (const l of listeners) {
            killProcessGroup(l.pid, "SIGKILL");
            try { process.kill(l.pid, "SIGKILL"); } catch { /* ignore */ }
          }
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    }

    // ⑤ 最终确认
    const stepMs = 300;
    const maxWaitMs = 8000;
    for (let elapsed = 0; elapsed < maxWaitMs; elapsed += stepMs) {
      if (!(await S.checkOpenClawRunning(binaryMode))) {
        appendGatewayDiag(`${binaryMode} Gateway 已停止`, binaryMode);
        removePidFile(stateDir);
        return true;
      }
      await new Promise((r) => setTimeout(r, stepMs));
    }

    const stillRunning = await S.checkOpenClawRunning(binaryMode);
    if (stillRunning) {
      appendGatewayDiag(`警告: 所有手段用尽后 ${binaryMode} Gateway 仍在运行`, binaryMode);
      return false;
    }
    removePidFile(stateDir);
    return true;
  } catch (err) {
    console.error(`[OpenClaw] 停止 ${binaryMode} 失败:`, err);
    appendGatewayDiag(`停止异常: ${err?.stack || err?.message || String(err)}`, binaryMode);
    return false;
  }
}

module.exports = {
  initLifecycle,
  startEmbeddedOpenClaw,
  stopEmbeddedOpenClaw,
};
