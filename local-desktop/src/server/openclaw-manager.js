const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { execWithOutput, checkUrlReachable } = require("./utils.js");
const net = require("net");

let openclawProcess = null;
const OPENCLAW_UI_URL = "http://localhost:18789"; // OpenClaw Gateway 默认端口
const OPENCLAW_WS_PORT = 18789; // OpenClaw Gateway WebSocket 端口
let cachedDashboardUrl = null; // 缓存带 token 的 dashboard URL

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
  
  // 2. 检查全局安装（静默检测）
  try {
    const { execSync } = require("child_process");
    execSync("openclaw --version", { stdio: "ignore", timeout: 3000 });
    return true;
  } catch (e) {
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
    console.log("[OpenClaw] 内置 OpenClaw 未找到");
    return false;
  }

  // 检查是否已经在运行（通过端口检测）
  const isRunning = await checkOpenClawRunning();
  if (isRunning) {
    console.log("[OpenClaw] OpenClaw Gateway 已在运行: " + OPENCLAW_UI_URL);
    return true;
  }

  console.log("[OpenClaw] 尝试启动 OpenClaw Gateway...");
  
  // 首次启动时初始化配置文件（如果不存在）
  try {
    const { initOpenClawConfig } = require("./openclaw-config.js");
    initOpenClawConfig();
  } catch (configErr) {
    console.log("[OpenClaw] 配置初始化失败（可忽略）:", configErr);
  }
  
  try {
    const binPath = getOpenClawBinPath();
    
    // 直接启动 gateway run（不使用 daemon，避免 Windows 任务计划问题）
    const spawnOptions = {
      detached: true, // 分离进程，让它在后台运行
      stdio: "ignore", // 忽略输出，避免管道阻塞
      windowsHide: true,
      shell: false,
    };
    
    let child;
    if (process.platform === "win32") {
      // Windows: 使用 cmd.exe 执行
      child = spawn("cmd.exe", ["/c", binPath, "gateway", "run"], spawnOptions);
    } else {
      // Unix: 直接执行
      child = spawn(binPath, ["gateway", "run"], spawnOptions);
    }
    
    // 分离后不再持有引用
    child.unref();
    openclawProcess = child;

    console.log("[OpenClaw] Gateway 进程已启动，等待服务就绪...");
    
    // 等待 OpenClaw 启动（最多等待 15 秒）
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const running = await checkOpenClawRunning();
      if (running) {
        console.log("[OpenClaw] OpenClaw Gateway 启动成功！UI: " + OPENCLAW_UI_URL);
        return true;
      }
    }

    console.log("[OpenClaw] OpenClaw Gateway 启动超时（15秒）");
    console.log("[OpenClaw] 提示：Gateway 可能正在后台初始化");
    return false;
  } catch (err) {
    console.error("[OpenClaw] 启动失败:", err);
    return false;
  }
}

/**
 * 停止内置 OpenClaw
 */
async function stopEmbeddedOpenClaw() {
  console.log("[OpenClaw] 停止 OpenClaw Gateway...");
  
  try {
    // 如果有进程引用，直接 kill
    if (openclawProcess) {
      try {
        openclawProcess.kill();
        console.log("[OpenClaw] 已终止 Gateway 进程");
      } catch (err) {
        console.log("[OpenClaw] 终止进程失败:", err);
      }
      openclawProcess = null;
    }
    
    // 使用 openclaw gateway stop 命令
    const binPath = getOpenClawBinPath();
    
    let result;
    if (process.platform === "win32") {
      result = await execWithOutput("cmd.exe", ["/c", binPath, "gateway", "stop"], { shell: false });
    } else {
      result = await execWithOutput(binPath, ["gateway", "stop"], { shell: false });
    }
    
    console.log("[OpenClaw] 停止命令已执行");
    console.log("[OpenClaw] stdout:", result.stdout);
    console.log("[OpenClaw] stderr:", result.stderr);
    
    // 清除缓存的 URL
    cachedDashboardUrl = null;
    
    return true;
  } catch (err) {
    console.error("[OpenClaw] 停止失败:", err);
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
    const binPath = getOpenClawBinPath();
    let result;
    
    if (process.platform === "win32") {
      result = await execWithOutput("cmd.exe", ["/c", binPath, "dashboard", "--no-open"], { shell: false });
    } else {
      result = await execWithOutput(binPath, ["dashboard", "--no-open"], { shell: false });
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
  };
}

module.exports = {
  hasEmbeddedOpenClaw,
  startEmbeddedOpenClaw,
  stopEmbeddedOpenClaw,
  getOpenClawStatus,
  OPENCLAW_UI_URL,
};
