const { getOpenClawSettings, saveOpenClawSettings } = require("../db.js");
const { detectPlatform, execWithOutput, hasCommand, checkUrlReachable } = require("./utils.js");
const { hasEmbeddedNode, downloadAndInstallNode, runEmbeddedNpm, NODE_VERSION } = require("./node-manager.js");
const {
  getOpenClawStatus,
  startEmbeddedOpenClaw,
  stopEmbeddedOpenClaw,
  getGatewayDiagnosticLog,
} = require("./openclaw-manager.js");
const { configureProvider, resetOpenClawConfig, restartGateway, readOpenClawConfig, writeOpenClawConfig, getOpenClawConfigPath, initOpenClawConfig, PROVIDER_PRESETS } = require("./openclaw-config.js");

// 全局安装状态
let nodeInstallState = {
  installing: false,
  stage: "",
  percent: 0,
  error: null,
  completed: false,
};

async function runInstallCommand(rawCmd) {
  console.log("[runInstallCommand] 开始执行");
  const platform = detectPlatform();
  const cmd = String(rawCmd || "").trim();
  console.log("[runInstallCommand] 平台:", platform, "命令:", cmd || "(默认)");
  
  if (!cmd) {
    // 优先使用内置 Node.js
    console.log("[runInstallCommand] 检查内置 Node.js...");
    const hasEmbedded = hasEmbeddedNode();
    console.log("[runInstallCommand] 内置 Node.js:", hasEmbedded);
    
    console.log("[runInstallCommand] 检查系统 npm...");
    const hasSystemNpm = await hasCommand("npm");
    console.log("[runInstallCommand] 系统 npm:", hasSystemNpm);
    
    if (!hasEmbedded && !hasSystemNpm) {
      console.log("[runInstallCommand] 两者都不存在，返回错误");
      return { 
        used: "none", 
        code: 1, 
        stdout: "", 
        stderr: "未检测到 npm，且内置 Node.js 未安装。请先在面板中点击\"安装内置 Node.js\"按钮。" 
      };
    }
    
    // 使用内置 Node.js 或系统 npm
    let r;
    if (hasEmbedded) {
      r = await runEmbeddedNpm(["install", "-g", "openclaw@latest"]);
    } else if (platform === "windows") {
      r = await execWithOutput("cmd.exe", ["/c", "npm", "install", "-g", "openclaw@latest"], { shell: false });
    } else {
      r = await execWithOutput("npm", ["install", "-g", "openclaw@latest"], { shell: false });
    }
    
    if (r.code !== 0) {
      return { used: hasEmbedded ? "embedded-npm" : "system-npm", ...r };
    }
    
    try {
      if (platform === "windows") {
        await execWithOutput("cmd.exe", ["/c", "openclaw", "onboard", "--install-daemon"], { shell: false });
      } else {
        await execWithOutput("openclaw", ["onboard", "--install-daemon"], { shell: false });
      }
    } catch {
      // ignore init failure
    }
    return { used: hasEmbedded ? "embedded-npm" : "system-npm", ...r };
  }

  // 自定义命令
  if (platform === "windows") {
    const r = await execWithOutput("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd], {
      shell: false,
    });
    return { used: "powershell", ...r };
  }
  const r = await execWithOutput("sh", ["-lc", cmd], { shell: false });
  return { used: "sh", ...r };
}

function registerOpenClawRoutes(app) {
  // 安装 OpenClaw
  app.post("/api/openclaw/install", async (_req, res) => {
    try {
      console.log("[OpenClaw] 开始安装 OpenClaw...");
      
      const path = require("path");
      const { spawn } = require("child_process");
      const projectRoot = path.join(__dirname, "../..");
      
      // 安装 OpenClaw 到项目依赖
      const result = await new Promise((resolve) => {
        const child = spawn("npm", ["install", "openclaw@latest"], {
          shell: true,
          cwd: projectRoot,
          windowsHide: true,
        });
        
        let stdout = "";
        let stderr = "";
        
        child.stdout?.on("data", (d) => {
          stdout += String(d);
          console.log("[OpenClaw Install]", String(d).trim());
        });
        
        child.stderr?.on("data", (d) => {
          stderr += String(d);
          console.log("[OpenClaw Install]", String(d).trim());
        });
        
        child.on("close", (code) => {
          resolve({ code: typeof code === "number" ? code : 1, stdout, stderr });
        });
        
        child.on("error", (e) => {
          resolve({ code: 1, stdout, stderr: String(e?.message || e) });
        });
      });
      
      if (result.code !== 0) {
        throw new Error(`安装失败: ${result.stderr || result.stdout}`);
      }
      
      console.log("[OpenClaw] OpenClaw 安装成功");
      
      // 初始化配置文件（生成默认配置和 token）
      try {
        initOpenClawConfig();
        console.log("[OpenClaw] 配置文件初始化完成");
      } catch (configErr) {
        console.log("[OpenClaw] 配置文件初始化失败:", configErr);
      }
      
      // 安装 daemon 服务
      try {
        const { getOpenClawBinPath } = require("./openclaw-manager.js");
        const binPath = getOpenClawBinPath();
        
        const daemonResult = await new Promise((resolve) => {
          const child = process.platform === "win32"
            ? spawn("cmd.exe", ["/c", binPath, "daemon", "install"], { shell: false, windowsHide: true })
            : spawn(binPath, ["daemon", "install"], { shell: false });
          
          let stdout = "";
          let stderr = "";
          
          child.stdout?.on("data", (d) => {
            stdout += String(d);
            console.log("[OpenClaw Daemon]", String(d).trim());
          });
          
          child.stderr?.on("data", (d) => {
            stderr += String(d);
            console.log("[OpenClaw Daemon]", String(d).trim());
          });
          
          child.on("close", (code) => {
            resolve({ code: typeof code === "number" ? code : 1, stdout, stderr });
          });
          
          child.on("error", (e) => {
            resolve({ code: 1, stdout, stderr: String(e?.message || e) });
          });
        });
        
        console.log("[OpenClaw] Daemon 服务安装完成");
      } catch (daemonErr) {
        console.log("[OpenClaw] Daemon 安装失败（可忽略）:", daemonErr);
      }
      
      res.status(200).json({ 
        ok: true, 
        message: "OpenClaw 安装成功",
      });
    } catch (e) {
      console.error("[OpenClaw] 安装失败:", e);
      res.status(500).json({ error: { message: e?.message ?? "安装失败" } });
    }
  });

  // 获取 OpenClaw 配置文件
  app.get("/api/openclaw/config", (_req, res) => {
    try {
      const config = readOpenClawConfig();
      const configPath = getOpenClawConfigPath();
      res.status(200).json({
        ok: true,
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
      const { config } = req.body || {};
      
      if (!config || typeof config !== "object") {
        return res.status(400).json({ error: { message: "无效的配置数据" } });
      }
      
      writeOpenClawConfig(config);
      
      res.status(200).json({ 
        ok: true, 
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

  // 启动 Gateway
  app.post("/api/openclaw/start-gateway", async (_req, res) => {
    try {
      const result = await startEmbeddedOpenClaw();
      res.status(200).json({
        ok: result,
        message: result ? "Gateway 已启动" : "Gateway 启动失败或超时，诊断见 gatewayDiagnosticLog",
        gatewayDiagnosticLog: getGatewayDiagnosticLog(),
      });
    } catch (e) {
      res.status(500).json({
        error: { message: e?.message ?? "启动失败" },
        gatewayDiagnosticLog: getGatewayDiagnosticLog(),
      });
    }
  });

  // 停止 Gateway
  app.post("/api/openclaw/stop-gateway", async (_req, res) => {
    try {
      stopEmbeddedOpenClaw();
      res.status(200).json({ ok: true, message: "Gateway 停止命令已发送" });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "停止失败" } });
    }
  });

  // 重置配置（清理错误配置）
  app.post("/api/openclaw/reset-config", async (_req, res) => {
    try {
      const result = resetOpenClawConfig();
      res.status(200).json(result);
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "重置失败" } });
    }
  });

  // 重启 Gateway
  app.post("/api/openclaw/restart-gateway", async (_req, res) => {
    try {
      await restartGateway();
      res.status(200).json({ ok: true, message: "Gateway 正在重启" });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "重启失败" } });
    }
  });

  // 配置模型提供商
  app.post("/api/openclaw/configure-provider", async (req, res) => {
    try {
      const { provider, apiKey, model, baseUrl, setAsDefault } = req.body || {};
      
      if (!provider || !PROVIDER_PRESETS[provider]) {
        return res.status(400).json({ error: { message: "无效的提供商" } });
      }
      
      const preset = PROVIDER_PRESETS[provider];
      
      if (preset.requiresApiKey && !apiKey) {
        return res.status(400).json({ error: { message: "此提供商需要 API Key" } });
      }
      
      const config = {
        apiKey: apiKey || undefined,
        model: model || preset.defaultModel,
        baseUrl: baseUrl || preset.baseUrl,
        setAsDefault: setAsDefault !== false,
      };
      
      const result = await configureProvider(provider, config);
      
      // 配置完成后重启 Gateway
      await restartGateway();
      
      res.status(200).json({ 
        ok: true, 
        message: `${preset.name} 配置成功，Gateway 已重启`,
        results: result.results,
      });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "配置失败" } });
    }
  });

  // 新的简化 API：获取内置 OpenClaw 状态
  app.get("/api/openclaw/embedded-status", async (_req, res) => {
    try {
      const status = await getOpenClawStatus();
      res.status(200).json(status);
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "获取 OpenClaw 状态失败" } });
    }
  });

  // 旧的 API（保留兼容性）
  app.get("/api/openclaw/node-status", async (_req, res) => {
    try {
      const hasEmbedded = hasEmbeddedNode();
      const hasSystemNpm = await hasCommand("npm");
      res.status(200).json({ 
        hasEmbeddedNode: hasEmbedded,
        hasSystemNpm: hasSystemNpm,
        nodeVersion: NODE_VERSION,
      });
    } catch (e) {
      res.status(200).json({ hasEmbeddedNode: false, hasSystemNpm: false, nodeVersion: NODE_VERSION });
    }
  });

  app.get("/api/openclaw/install-node-progress", (_req, res) => {
    res.status(200).json(nodeInstallState);
  });

  app.post("/api/openclaw/install-node", async (_req, res) => {
    try {
      if (hasEmbeddedNode()) {
        return res.status(200).json({ ok: true, message: "内置 Node.js 已存在" });
      }
      
      if (nodeInstallState.installing) {
        return res.status(200).json({ ok: true, message: "安装正在进行中，请稍候..." });
      }
      
      // 重置状态
      nodeInstallState = {
        installing: true,
        stage: "preparing",
        percent: 0,
        error: null,
        completed: false,
        logs: [],
      };
      
      // 异步执行安装
      res.status(200).json({ ok: true, message: "开始安装内置 Node.js，请通过进度接口查询状态" });
      
      console.log("[OpenClaw] 开始下载内置 Node.js...");
      
      downloadAndInstallNode((progress) => {
        nodeInstallState.stage = progress.stage || "downloading";
        nodeInstallState.percent = progress.percent || 0;
        const log = `${progress.stage}: ${progress.percent}%`;
        nodeInstallState.logs.push(log);
        console.log(`[OpenClaw] ${log}`);
      }).then(() => {
        console.log("[OpenClaw] 内置 Node.js 安装完成");
        nodeInstallState.installing = false;
        nodeInstallState.completed = true;
        nodeInstallState.stage = "completed";
        nodeInstallState.percent = 100;
      }).catch((e) => {
        console.error("[OpenClaw] 安装失败:", e);
        nodeInstallState.installing = false;
        nodeInstallState.error = e?.message ?? "安装失败";
        nodeInstallState.stage = "failed";
        nodeInstallState.logs.push(`错误: ${e?.message}`);
      });
    } catch (e) {
      console.error("[OpenClaw] 安装异常:", e);
      nodeInstallState.installing = false;
      nodeInstallState.error = e?.message ?? "安装内置 Node.js 失败";
      res.status(500).json({ 
        ok: false, 
        error: { message: e?.message ?? "安装内置 Node.js 失败" } 
      });
    }
  });

  app.get("/api/openclaw/check-npm", async (_req, res) => {
    try {
      const npmAvailable = await hasCommand("npm");
      const hasEmbedded = hasEmbeddedNode();
      res.status(200).json({ 
        hasNpm: npmAvailable || hasEmbedded,
        hasSystemNpm: npmAvailable,
        hasEmbeddedNode: hasEmbedded,
      });
    } catch (e) {
      res.status(200).json({ hasNpm: false, hasSystemNpm: false, hasEmbeddedNode: false });
    }
  });

  app.get("/api/openclaw/status", async (_req, res) => {
    try {
      const cfg = await getOpenClawSettings();
      const uiUrl = cfg.uiUrl || "http://localhost:18789";
      const uiReachable = await checkUrlReachable(uiUrl);
      const installed = (await hasCommand("openclaw")) || (await hasCommand("openclaw.exe"));
      res.status(200).json({
        config: { uiUrl, installCmd: cfg.installCmd || "" },
        status: { installed, uiReachable },
      });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "读取 OpenClaw 状态失败" } });
    }
  });

  app.post("/api/openclaw/config", async (req, res) => {
    try {
      const { uiUrl, installCmd } = req.body || {};
      const next = {
        uiUrl: String(uiUrl || "http://localhost:18789").trim(),
        installCmd: String(installCmd || ""),
      };
      await saveOpenClawSettings(next);
      res.status(200).json({ config: next });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "保存 OpenClaw 配置失败" } });
    }
  });

  app.post("/api/openclaw/install", async (req, res) => {
    try {
      console.log("[OpenClaw] 收到安装 OpenClaw 请求");
      const cfg = await getOpenClawSettings();
      const installCmd = typeof req.body?.installCmd === "string" ? req.body.installCmd : cfg.installCmd;
      console.log("[OpenClaw] 安装命令:", installCmd || "(默认)");
      
      const result = await runInstallCommand(installCmd);
      console.log("[OpenClaw] 安装命令执行完成，退出码:", result.code);
      
      const installed = (await hasCommand("openclaw")) || (await hasCommand("openclaw.exe"));
      console.log("[OpenClaw] OpenClaw 是否已安装:", installed);
      
      res.status(result.code === 0 ? 200 : 500).json({
        ok: result.code === 0,
        used: result.used,
        exitCode: result.code,
        installed,
        stdout: result.stdout,
        stderr: result.stderr,
      });
    } catch (e) {
      console.error("[OpenClaw] 安装失败:", e);
      res.status(500).json({ error: { message: e?.message ?? "OpenClaw 安装失败" } });
    }
  });
}

module.exports = {
  registerOpenClawRoutes,
};
