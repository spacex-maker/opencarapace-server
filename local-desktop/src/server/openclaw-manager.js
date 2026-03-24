const { spawn, execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const { execWithOutput, checkUrlReachable } = require("./utils.js");
const net = require("net");
const {
  getUnpackedAppRoot,
  getPackagedOpenClawBinFromUnpacked,
  getPackagedOpenClawMjsPath,
  resolveRealNodeExecutable,
  buildOpenClawChildEnv,
} = require("./openclaw-paths.js");

let openclawProcess = null;
const OPENCLAW_UI_URL = "http://localhost:18789"; // OpenClaw Gateway 默认端口
const OPENCLAW_WS_PORT = 18789; // OpenClaw Gateway WebSocket 端口
let cachedDashboardUrl = null; // 缓存带 token 的 dashboard URL

function clearCachedDashboardUrl() {
  cachedDashboardUrl = null;
}

/** 供 UI 复制的诊断日志（含启动命令、路径、子进程输出） */
const MAX_GATEWAY_DIAG_CHARS = 200000;
let gatewayDiagnosticLog = "";

function appendGatewayDiag(line) {
  const ts = new Date().toISOString();
  const entry = `[${ts}] ${line}\n`;
  gatewayDiagnosticLog += entry;
  if (gatewayDiagnosticLog.length > MAX_GATEWAY_DIAG_CHARS) {
    gatewayDiagnosticLog =
      "...[日志过长已截断，仅保留末尾部分]\n" +
      gatewayDiagnosticLog.slice(-(MAX_GATEWAY_DIAG_CHARS - 50));
  }
  console.log("[OpenClaw][diag]", line);
}

function clearGatewayDiag() {
  gatewayDiagnosticLog = "";
}

function getGatewayDiagnosticLog() {
  return gatewayDiagnosticLog;
}

function attachChildProcessLogs(child) {
  const onData = (label) => (data) => {
    const s = String(data).replace(/\r\n/g, "\n");
    for (const line of s.split("\n")) {
      if (line.trim().length > 0) {
        appendGatewayDiag(`${label} ${line}`);
      }
    }
  };
  child.stdout?.on("data", onData("[stdout]"));
  child.stderr?.on("data", onData("[stderr]"));
  child.on("error", (err) => {
    appendGatewayDiag(`[spawn-error] ${err?.message || String(err)}`);
  });
  child.on("exit", (code, signal) => {
    appendGatewayDiag(`[子进程退出] code=${code} signal=${signal || "(无)"}`);
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
      execSync("where openclaw.exe", { stdio: "ignore", timeout: 3000 });
      return "openclaw.exe";
    } catch {
      // ignore
    }
    try {
      const { execSync } = require("child_process");
      execSync("where openclaw.cmd", { stdio: "ignore", timeout: 3000 });
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
    execSync("openclaw --version", { stdio: "ignore", timeout: 3000 });
    return true;
  } catch (e) {
    // 兼容：有些安装只提供 openclaw.exe/openclaw.cmd，但不提供 openclaw 命令
    try {
      execSync("where openclaw.exe", { stdio: "ignore", timeout: 3000 });
      return true;
    } catch {
      // ignore
    }
    try {
      execSync("where openclaw.cmd", { stdio: "ignore", timeout: 3000 });
      return true;
    } catch {
      // ignore
    }
    return false;
  }
}

/**
 * 检查 OpenClaw Gateway 是否在运行（通过检测端口）
 */
async function checkOpenClawRunning() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    socket.setTimeout(1000);
    
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.on("error", () => {
      resolve(false);
    });
    
    socket.connect(OPENCLAW_WS_PORT, "127.0.0.1");
  });
}

/**
 * 启动内置 OpenClaw（直接启动 gateway run，不使用 daemon）
 */
async function startEmbeddedOpenClaw() {
  if (!hasEmbeddedOpenClaw()) {
    appendGatewayDiag("======== OpenClaw Gateway 启动中止 ========");
    appendGatewayDiag("原因: hasEmbeddedOpenClaw() = false（未检测到可运行的 OpenClaw）");
    appendGatewayDiag(`execPath=${process.execPath}`);
    appendGatewayDiag(`resourcesPath=${process.resourcesPath || "(空)"}`);
    console.log("[OpenClaw] 内置 OpenClaw 未找到");
    return false;
  }

  // 检查是否已经在运行（通过端口检测）
  const isRunning = await checkOpenClawRunning();
  if (isRunning) {
    appendGatewayDiag(`端口 ${OPENCLAW_WS_PORT} 已在监听，Gateway 视为已运行: ${OPENCLAW_UI_URL}`);
    console.log("[OpenClaw] OpenClaw Gateway 已在运行: " + OPENCLAW_UI_URL);
    return true;
  }

  clearGatewayDiag();
  appendGatewayDiag("======== OpenClaw Gateway 启动尝试 ========");
  appendGatewayDiag(`platform=${process.platform}`);
  appendGatewayDiag(`检测端口(就绪判断)=${OPENCLAW_WS_PORT} (TCP 127.0.0.1)`);
  appendGatewayDiag(`process.execPath=${process.execPath}`);
  appendGatewayDiag(`process.resourcesPath=${process.resourcesPath || "(空)"}`);
  appendGatewayDiag(`process.cwd()=${process.cwd()}`);
  appendGatewayDiag("说明: 子进程使用 stdio 管道收集日志；关闭本客户端后 Gateway 进程会一并结束。");

  console.log("[OpenClaw] 尝试启动 OpenClaw Gateway...");

  // 首次启动时初始化配置文件（如果不存在）
  try {
    const { initOpenClawConfig } = require("./openclaw-config.js");
    initOpenClawConfig();
    appendGatewayDiag("已执行 initOpenClawConfig()（若已有配置则跳过）");
  } catch (configErr) {
    appendGatewayDiag(`initOpenClawConfig 异常: ${configErr?.message || configErr}`);
    console.log("[OpenClaw] 配置初始化失败（可忽略）:", configErr);
  }

  try {
    const packagedBin = getPackagedOpenClawBinFromUnpacked();
    const packagedMjs = packagedBin ? null : getPackagedOpenClawMjsPath();
    const binPath = packagedBin || packagedMjs ? null : getOpenClawBinPath();

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

    // 使用管道收集 stdout/stderr；不 detached，便于诊断（关闭客户端会结束 Gateway）
    const spawnOptions = {
      detached: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: false,
    };

    let child;
    if (packagedBin) {
      const nodeExe = resolveRealNodeExecutable();
      appendGatewayDiag(`启动方式: app.asar.unpacked 内 .bin`);
      appendGatewayDiag(`openclaw.cmd/bin=${packagedBin.bin}`);
      appendGatewayDiag(`cwd=${packagedBin.cwd}`);
      appendGatewayDiag(
        nodeExe
          ? `已解析到 Node: ${nodeExe}（已注入 PATH 供 .cmd 使用）`
          : "警告: 未解析到独立 node.exe，openclaw.cmd 可能找不到 node（请安装 Node 或安装客户端内置 Node）"
      );
      const childEnv = buildOpenClawChildEnv(packagedBin.cwd);
      if (process.platform === "win32") {
        appendGatewayDiag(`命令: cmd.exe /c "${packagedBin.bin}" gateway run`);
        child = spawn("cmd.exe", ["/c", packagedBin.bin, "gateway", "run"], {
          ...spawnOptions,
          cwd: packagedBin.cwd,
          env: childEnv,
        });
      } else {
        appendGatewayDiag(`命令: ${packagedBin.bin} gateway run`);
        child = spawn(packagedBin.bin, ["gateway", "run"], {
          ...spawnOptions,
          cwd: packagedBin.cwd,
          env: childEnv,
        });
      }
    } else if (packagedMjs) {
      const nodeExe = resolveRealNodeExecutable();
      if (!nodeExe) {
        appendGatewayDiag(
          "错误: 未找到安装包内置的 node.exe（resources/node.exe）或客户端「内置 Node」下载目录中的 node。"
        );
        appendGatewayDiag(
          "说明: 不能使用本程序 ClawHeart Desktop.exe 代替 Node；否则会启动第二个桌面主进程（日志里会出现 19111 本地代理，而非 OpenClaw 18789）。"
        );
        appendGatewayDiag(
          "解决: ① 请使用最新安装包（构建时已打入 resources/node.exe）；或 ② 在客户端完成「安装内置 Node.js」后再启动 Gateway。"
        );
        return false;
      }
      const extraEnv = buildOpenClawChildEnv(unpackedRoot);
      appendGatewayDiag(`启动方式: openclaw.mjs + 独立 Node`);
      appendGatewayDiag(`node=${nodeExe}`);
      appendGatewayDiag(`args=${JSON.stringify([packagedMjs, "gateway", "run"])}`);
      appendGatewayDiag(`cwd=${path.dirname(packagedMjs)}`);
      appendGatewayDiag(`NODE_PATH=${extraEnv.NODE_PATH || "(未设置)"}`);
      child = spawn(nodeExe, [packagedMjs, "gateway", "run"], {
        ...spawnOptions,
        cwd: path.dirname(packagedMjs),
        env: extraEnv,
      });
    } else {
      if (process.platform === "win32") {
        appendGatewayDiag(`启动方式: 开发/全局 cmd`);
        appendGatewayDiag(`命令: cmd.exe /c "${binPath}" gateway run`);
        child = spawn("cmd.exe", ["/c", binPath, "gateway", "run"], spawnOptions);
      } else {
        appendGatewayDiag(`启动方式: 开发/全局`);
        appendGatewayDiag(`命令: ${binPath} gateway run`);
        child = spawn(binPath, ["gateway", "run"], spawnOptions);
      }
    }

    attachChildProcessLogs(child);
    openclawProcess = child;

    appendGatewayDiag("已 spawn 子进程，等待端口就绪（最多约 45 秒）...");
    console.log("[OpenClaw] Gateway 进程已启动，等待服务就绪...");

    // 等待 OpenClaw 启动（冷启动可能较慢，最多约 45 秒）
    for (let i = 0; i < 90; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const running = await checkOpenClawRunning();
      if (running) {
        appendGatewayDiag(`成功: 端口 ${OPENCLAW_WS_PORT} 已可连接`);
        console.log("[OpenClaw] OpenClaw Gateway 启动成功！UI: " + OPENCLAW_UI_URL);
        return true;
      }
    }

    appendGatewayDiag(`失败: 约 45 秒内端口 ${OPENCLAW_WS_PORT} 仍未监听`);
    appendGatewayDiag("可能原因: 子进程已崩溃、监听其他端口、或本机防火墙/安全软件拦截。");
    console.log("[OpenClaw] OpenClaw Gateway 启动超时（约 45 秒）");
    console.log("[OpenClaw] 提示：Gateway 可能正在后台初始化，或端口非 18789 / 被占用");
    return false;
  } catch (err) {
    appendGatewayDiag(`启动过程异常: ${err?.stack || err?.message || String(err)}`);
    console.error("[OpenClaw] 启动失败:", err);
    return false;
  }
}

/**
 * 停止内置 OpenClaw
 */
async function stopEmbeddedOpenClaw() {
  console.log("[OpenClaw] 停止 OpenClaw Gateway...");
  appendGatewayDiag("======== 停止 Gateway ========");

  try {
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
    
    const packagedBin = getPackagedOpenClawBinFromUnpacked();
    const packagedMjs = packagedBin ? null : getPackagedOpenClawMjsPath();

    let result;
    if (packagedBin) {
      const childEnv = buildOpenClawChildEnv(packagedBin.cwd);
      if (process.platform === "win32") {
        result = await execWithOutput("cmd.exe", ["/c", packagedBin.bin, "gateway", "stop"], {
          shell: false,
          cwd: packagedBin.cwd,
          env: childEnv,
        });
      } else {
        result = await execWithOutput(packagedBin.bin, ["gateway", "stop"], {
          shell: false,
          cwd: packagedBin.cwd,
          env: childEnv,
        });
      }
    } else if (packagedMjs) {
      const unpackedRoot = getUnpackedAppRoot();
      const nodeExe = resolveRealNodeExecutable();
      if (!nodeExe) {
        result = { code: 1, stdout: "", stderr: "未找到 node.exe，无法执行 gateway stop" };
      } else {
        const extraEnv = buildOpenClawChildEnv(unpackedRoot);
        result = await execWithOutput(nodeExe, [packagedMjs, "gateway", "stop"], {
          shell: false,
          cwd: path.dirname(packagedMjs),
          env: extraEnv,
        });
      }
    } else {
      const binPath = getOpenClawBinPath();
      if (process.platform === "win32") {
        result = await execWithOutput("cmd.exe", ["/c", binPath, "gateway", "stop"], { shell: false });
      } else {
        result = await execWithOutput(binPath, ["gateway", "stop"], { shell: false });
      }
    }
    
    console.log("[OpenClaw] 停止命令已执行");
    console.log("[OpenClaw] stdout:", result.stdout);
    console.log("[OpenClaw] stderr:", result.stderr);

    clearCachedDashboardUrl();

    const stepMs = 300;
    const maxWaitMs = 15000;
    for (let elapsed = 0; elapsed < maxWaitMs; elapsed += stepMs) {
      const stillRunning = await checkOpenClawRunning();
      if (!stillRunning) {
        appendGatewayDiag(`端口 ${OPENCLAW_WS_PORT} 已关闭，Gateway 已停止`);
        return true;
      }
      await new Promise((r) => setTimeout(r, stepMs));
    }

    const stillRunning = await checkOpenClawRunning();
    if (stillRunning) {
      appendGatewayDiag(
        `警告: 停止后端口 ${OPENCLAW_WS_PORT} 仍监听；可能为本机其他 Gateway/守护进程，或未随父进程退出的子进程`
      );
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
    const packagedBin = getPackagedOpenClawBinFromUnpacked();
    const packagedMjs = packagedBin ? null : getPackagedOpenClawMjsPath();
    let result;

    if (packagedBin) {
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
    } else if (packagedMjs) {
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
    } else {
      const binPath = getOpenClawBinPath();
      if (process.platform === "win32") {
        result = await execWithOutput("cmd.exe", ["/c", binPath, "dashboard", "--no-open"], { shell: false });
      } else {
        result = await execWithOutput(binPath, ["dashboard", "--no-open"], { shell: false });
      }
    }
    
    if (result.code === 0 && result.stdout) {
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
  const isRunning = await checkOpenClawRunning();
  
  let uiUrl = OPENCLAW_UI_URL;
  if (isRunning) {
    // 如果正在运行，尝试获取带 token 的 URL
    uiUrl = await getDashboardUrl();
  }
  
  return {
    hasEmbedded,
    isRunning,
    uiUrl,
    gatewayDiagnosticLog: getGatewayDiagnosticLog(),
  };
}

module.exports = {
  hasEmbeddedOpenClaw,
  startEmbeddedOpenClaw,
  stopEmbeddedOpenClaw,
  getOpenClawStatus,
  getGatewayDiagnosticLog,
  clearCachedDashboardUrl,
  OPENCLAW_UI_URL,
};
