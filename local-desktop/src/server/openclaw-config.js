const path = require("path");
const fs = require("fs");
const { execWithOutput } = require("./utils.js");
const {
  getUnpackedAppRoot,
  getPackagedOpenClawBinFromUnpacked,
  getPackagedOpenClawMjsPath,
  resolveRealNodeExecutable,
  buildOpenClawChildEnv,
} = require("./openclaw-paths.js");
const { getManagedOpenClawEnv, getActiveOpenClawEnv } = require("./openclaw-workspace.js");
const { getUserProfileOpenClawPaths } = require("./openclaw-discovery.js");

/**
 * 获取 OpenClaw 可执行文件路径
 */
function getOpenClawBinPath() {
  const binDir = path.join(__dirname, "../../node_modules/.bin");
  
  if (process.platform === "win32") {
    return path.join(binDir, "openclaw.cmd");
  }
  return path.join(binDir, "openclaw");
}

/**
 * 执行 openclaw config 命令
 */
async function runOpenClawConfig(args) {
  const packagedBin = getPackagedOpenClawBinFromUnpacked();
  if (packagedBin) {
    const childEnv = buildOpenClawChildEnv(packagedBin.cwd);
    if (process.platform === "win32") {
      return execWithOutput("cmd.exe", ["/c", packagedBin.bin, "config", ...args], {
        shell: false,
        cwd: packagedBin.cwd,
        env: childEnv,
      });
    }
    return execWithOutput(packagedBin.bin, ["config", ...args], {
      shell: false,
      cwd: packagedBin.cwd,
      env: childEnv,
    });
  }

  const packagedMjs = getPackagedOpenClawMjsPath();
  if (packagedMjs) {
    const unpackedRoot = getUnpackedAppRoot();
    const nodeExe = resolveRealNodeExecutable();
    if (!nodeExe) {
      return {
        code: 1,
        stdout: "",
        stderr:
          process.platform === "darwin"
            ? "未找到 node（应用 Contents/Resources/node 或 OpenClaw 面板「下载运行时 Node」）。请更新安装包或在面板下载。"
            : "未找到 node.exe（安装包 resources 或面板「下载运行时 Node」）。请更新安装包或在面板下载。",
      };
    }
    const extraEnv = buildOpenClawChildEnv(unpackedRoot);
    return execWithOutput(nodeExe, [packagedMjs, "config", ...args], {
      shell: false,
      cwd: path.dirname(packagedMjs),
      env: extraEnv,
    });
  }

  const binPath = getOpenClawBinPath();
  
  const env = buildOpenClawChildEnv(path.join(__dirname, "../.."));
  if (process.platform === "win32") {
    return execWithOutput("cmd.exe", ["/c", binPath, "config", ...args], { shell: false, env });
  }
  return execWithOutput(binPath, ["config", ...args], { shell: false, env });
}

/**
 * 设置 OpenClaw 配置
 */
async function setOpenClawConfig(key, value) {
  console.log(`[OpenClaw Config] 设置 ${key}`);
  const result = await runOpenClawConfig(["set", key, value]);
  
  if (result.code !== 0) {
    throw new Error(`设置配置失败: ${result.stderr || result.stdout}`);
  }
  
  return true;
}

/**
 * 获取 OpenClaw 配置
 */
async function getOpenClawConfig(key) {
  const result = await runOpenClawConfig(["get", key]);
  
  if (result.code === 0 && result.stdout) {
    return result.stdout.trim();
  }
  
  return null;
}

/**
 * 执行 openclaw models 命令
 */
async function runOpenClawModels(args) {
  const packagedBin = getPackagedOpenClawBinFromUnpacked();
  if (packagedBin) {
    const childEnv = buildOpenClawChildEnv(packagedBin.cwd);
    if (process.platform === "win32") {
      return execWithOutput("cmd.exe", ["/c", packagedBin.bin, "models", ...args], {
        shell: false,
        cwd: packagedBin.cwd,
        env: childEnv,
      });
    }
    return execWithOutput(packagedBin.bin, ["models", ...args], {
      shell: false,
      cwd: packagedBin.cwd,
      env: childEnv,
    });
  }

  const packagedMjs = getPackagedOpenClawMjsPath();
  if (packagedMjs) {
    const unpackedRoot = getUnpackedAppRoot();
    const nodeExe = resolveRealNodeExecutable();
    if (!nodeExe) {
      return {
        code: 1,
        stdout: "",
        stderr:
          process.platform === "darwin"
            ? "未找到 node（应用 Contents/Resources/node 或 OpenClaw 面板「下载运行时 Node」）。请更新安装包或在面板下载。"
            : "未找到 node.exe（安装包 resources 或面板「下载运行时 Node」）。请更新安装包或在面板下载。",
      };
    }
    const extraEnv = buildOpenClawChildEnv(unpackedRoot);
    return execWithOutput(nodeExe, [packagedMjs, "models", ...args], {
      shell: false,
      cwd: path.dirname(packagedMjs),
      env: extraEnv,
    });
  }

  const binPath = getOpenClawBinPath();
  const env = buildOpenClawChildEnv(path.join(__dirname, "../.."));
  if (process.platform === "win32") {
    return execWithOutput("cmd.exe", ["/c", binPath, "models", ...args], { shell: false, env });
  }
  return execWithOutput(binPath, ["models", ...args], { shell: false, env });
}

/**
 * 读取 OpenClaw 配置文件
 */
/** 与当前「Gateway 工作区」一致：便于 configureProvider / 安全扫描 / init 与正在启动的 Gateway 读写同一份 openclaw.json */
function getOpenClawConfigPath() {
  return getActiveOpenClawEnv().OPENCLAW_CONFIG_PATH;
}

/** 解析「配置编辑」目标。仅允许 ClawHeart 托管路径与用户 ~/.openclaw，防止任意写文件 */
function resolveConfigEditTarget(target) {
  const t = String(target || "").trim() || "user-profile";
  if (t === "clawheart-managed" || t === "managed") {
    return getManagedOpenClawEnv().OPENCLAW_CONFIG_PATH;
  }
  if (t === "external-managed" || t === "external-runtime" || t === "opencarapace-external") {
    return getUserProfileOpenClawPaths().configPath;
  }
  if (t === "user-profile" || t === "user-default") {
    return getUserProfileOpenClawPaths().configPath;
  }
  throw new Error("无效的配置目标");
}

/**
 * 生成随机 token
 */
function generateToken() {
  const crypto = require("crypto");
  return crypto.randomBytes(24).toString("hex");
}

/**
 * OpenClaw 2026.3+：`gateway run` 要求 `gateway.mode=local` 或传 `--allow-unconfigured`。
 * 旧版/手写的 openclaw.json 可能没有 mode，仅补全为 local，不覆盖已有非空 mode。
 */
function ensureGatewayModeLocal() {
  const configPath = getOpenClawConfigPath();
  if (!fs.existsSync(configPath)) {
    return false;
  }
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (e) {
    console.warn("[OpenClaw Config] ensureGatewayModeLocal 解析失败:", e?.message || e);
    return false;
  }
  if (!cfg.gateway || typeof cfg.gateway !== "object") {
    cfg.gateway = {};
  }
  const m = cfg.gateway.mode;
  if (m != null && String(m).trim() !== "") {
    return false;
  }
  cfg.gateway.mode = "local";
  try {
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), "utf-8");
    console.log("[OpenClaw Config] 已补全 gateway.mode=local");
    return true;
  } catch (e) {
    console.warn("[OpenClaw Config] ensureGatewayModeLocal 写入失败:", e?.message || e);
    return false;
  }
}

/**
 * 初始化 OpenClaw 配置文件（如果不存在）
 * 完全按照用户提供的配置结构，但不设置 API Key
 */
function initOpenClawConfig() {
  const configPath = getOpenClawConfigPath();
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  // 如果配置文件已存在，不覆盖
  if (fs.existsSync(configPath)) {
    console.log("[OpenClaw Config] 配置文件已存在，跳过初始化");
    ensureGatewayModeLocal();
    return;
  }
  
  console.log("[OpenClaw Config] 初始化配置文件...");
  
  // 创建默认配置（完全按照用户的配置结构）
  const defaultConfig = {
    meta: {
      lastTouchedVersion: "2026.3.13",
      lastTouchedAt: new Date().toISOString(),
    },
    auth: {
      profiles: {
        "minimax:manual": {
          provider: "minimax",
          mode: "api_key",
        },
      },
    },
    models: {
      providers: {
        minimax: {
          baseUrl: "https://api.minimaxi.com/anthropic",
          apiKey: "",
          auth: "api-key",
          api: "anthropic-messages",
          authHeader: true,
          models: [
            {
              id: "MiniMax-M2.5",
              name: "MiniMax-M2.5",
              api: "anthropic-messages",
              reasoning: true,
              input: ["text"],
              contextWindow: 204800,
              maxTokens: 4096,
            },
          ],
        },
      },
    },
    agents: {
      defaults: {
        model: {
          primary: "minimax/MiniMax-M2.5",
        },
        models: {
          "minimax/MiniMax-M2.5": {},
        },
        workspace: path.join(configDir, "workspace"),
      },
    },
    commands: {
      native: "auto",
      nativeSkills: "auto",
      restart: true,
      ownerDisplay: "raw",
    },
    gateway: {
      port: 18789,
      mode: "local",
      auth: {
        mode: "token",
        token: generateToken(),
      },
    },
  };
  
  fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), "utf-8");
  console.log("[OpenClaw Config] 配置文件已创建:", configPath);
}

/**
 * 配置模型提供商
 */
async function configureProvider(provider, config) {
  const results = [];
  
  try {
    const configPath = getOpenClawConfigPath();
    
    // 读取现有配置
    let openclawConfig = {};
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");
      openclawConfig = JSON.parse(content);
    }
    
    // 确保 models.providers 结构存在
    if (!openclawConfig.models) {
      openclawConfig.models = {};
    }
    if (!openclawConfig.models.providers) {
      openclawConfig.models.providers = {};
    }
    if (!openclawConfig.models.providers[provider]) {
      openclawConfig.models.providers[provider] = {};
    }
    
    const providerConfig = openclawConfig.models.providers[provider];
    
    // 设置 API Key
    if (config.apiKey) {
      providerConfig.apiKey = config.apiKey;
      results.push(`设置 API Key: ${provider}`);
    }
    
    // 设置 baseUrl
    if (config.baseUrl) {
      providerConfig.baseUrl = config.baseUrl;
      results.push(`设置 baseUrl: ${config.baseUrl}`);
    }
    
    // 设置认证方式
    if (config.apiKey) {
      providerConfig.auth = "api-key";
    }
    
    // 设置 API 格式（根据提供商）
    if (provider === "minimax") {
      providerConfig.api = "anthropic-messages";
      
      // 设置模型列表
      providerConfig.models = [
        {
          id: config.model || "MiniMax-M2.5",
          name: config.model || "MiniMax-M2.5",
          api: "anthropic-messages",
          reasoning: true,
          input: ["text"],
          contextWindow: 204800,
          maxTokens: 4096,
        },
      ];
    } else if (provider === "openai") {
      providerConfig.api = "openai-chat";
    } else if (provider === "anthropic") {
      providerConfig.api = "anthropic-messages";
    } else if (provider === "groq") {
      providerConfig.api = "openai-chat";
    }
    
    // 配置 agents.defaults（设置默认模型）
    if (config.setAsDefault) {
      const modelRef = `${provider}/${config.model || providerConfig.models?.[0]?.id}`;
      
      if (!openclawConfig.agents) {
        openclawConfig.agents = {};
      }
      if (!openclawConfig.agents.defaults) {
        openclawConfig.agents.defaults = {};
      }
      
      // 设置主模型
      openclawConfig.agents.defaults.model = {
        primary: modelRef,
      };
      
      // 添加到模型目录
      if (!openclawConfig.agents.defaults.models) {
        openclawConfig.agents.defaults.models = {};
      }
      openclawConfig.agents.defaults.models[modelRef] = {
        alias: config.model || providerConfig.models?.[0]?.id,
      };
      
      results.push(`设置默认模型: ${modelRef}`);
    }
    
    // 保存配置文件
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(openclawConfig, null, 2), "utf-8");
    console.log(`[OpenClaw Config] 配置文件已保存: ${configPath}`);
    console.log(`[OpenClaw Config] 配置完成: ${results.join(", ")}`);
    
    return { ok: true, results };
  } catch (err) {
    console.error(`[OpenClaw Config] 配置失败:`, err);
    throw err;
  }
}

/**
 * 获取提供商对应的环境变量名
 */
function getApiKeyEnvVar(provider) {
  const envVars = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    minimax: "MINIMAX_API_KEY",
    groq: "GROQ_API_KEY",
  };
  return envVars[provider];
}

/**
 * 重置 OpenClaw 配置（清理环境变量中的 API Key）
 */
function resetOpenClawConfig() {
  try {
    const configPath = getOpenClawConfigPath();
    
    if (!fs.existsSync(configPath)) {
      console.log("[OpenClaw Config] 配置文件不存在，无需重置");
      return { ok: true, message: "配置文件不存在" };
    }
    
    // 读取现有配置
    const content = fs.readFileSync(configPath, "utf-8");
    const openclawConfig = JSON.parse(content);
    
    // 清理 env 中的 API Key（这些不应该存在）
    if (openclawConfig.env) {
      const keysToRemove = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "MINIMAX_API_KEY", "GROQ_API_KEY"];
      keysToRemove.forEach(key => {
        if (openclawConfig.env[key]) {
          delete openclawConfig.env[key];
          console.log(`[OpenClaw Config] 清理环境变量: ${key}`);
        }
      });
      
      // 如果 env 为空，删除整个 env 对象
      if (Object.keys(openclawConfig.env).length === 0) {
        delete openclawConfig.env;
      }
    }
    
    // 保存清理后的配置
    fs.writeFileSync(configPath, JSON.stringify(openclawConfig, null, 2), "utf-8");
    console.log("[OpenClaw Config] 配置已重置，清理了环境变量中的 API Key");
    
    return { ok: true, message: "配置已重置（清理了环境变量）" };
  } catch (err) {
    console.error("[OpenClaw Config] 重置失败:", err);
    throw err;
  }
}

/**
 * 重启 OpenClaw Gateway
 */
async function restartGateway() {
  console.log("[OpenClaw Config] 重启 Gateway...");
  
  try {
    // 先停止
    const { stopEmbeddedOpenClaw } = require("./openclaw-manager.js");
    await stopEmbeddedOpenClaw();
    
    console.log("[OpenClaw Config] 等待 Gateway 停止...");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    // 再启动
    const { startEmbeddedOpenClaw } = require("./openclaw-manager.js");
    const started = await startEmbeddedOpenClaw();
    
    if (started) {
      console.log("[OpenClaw Config] Gateway 重启成功");
    } else {
      console.log("[OpenClaw Config] Gateway 重启超时，但可能正在后台启动");
    }
    
    return true;
  } catch (err) {
    console.error("[OpenClaw Config] 重启失败:", err);
    return false;
  }
}

/**
 * 快速配置预设
 */
const PROVIDER_PRESETS = {
  minimax: {
    name: "MiniMax（国内）",
    defaultModel: "MiniMax-M2.5",
    requiresApiKey: true,
    apiKeyFormat: "sk-api-...",
    getApiKeyUrl: "https://platform.minimaxi.com/user-center/basic-information/interface-key",
    baseUrl: "https://api.minimaxi.com/anthropic",
  },
  openai: {
    name: "OpenAI",
    defaultModel: "gpt-4o",
    requiresApiKey: true,
    apiKeyFormat: "sk-...",
    getApiKeyUrl: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    name: "Anthropic (Claude)",
    defaultModel: "claude-opus-4",
    requiresApiKey: true,
    apiKeyFormat: "sk-ant-...",
    getApiKeyUrl: "https://console.anthropic.com/settings/keys",
  },
  ollama: {
    name: "Ollama (本地)",
    defaultModel: "llama3.2",
    requiresApiKey: false,
    baseUrl: "http://localhost:11434",
    installUrl: "https://ollama.ai/",
  },
  groq: {
    name: "Groq",
    defaultModel: "llama-3.3-70b-versatile",
    requiresApiKey: true,
    apiKeyFormat: "gsk_...",
    getApiKeyUrl: "https://console.groq.com/keys",
  },
};

/**
 * 读取完整的 OpenClaw 配置
 */
function readOpenClawConfig() {
  return readOpenClawConfigFromPath(getOpenClawConfigPath());
}

function readOpenClawConfigFromPath(configPath) {
  if (!configPath || !fs.existsSync(configPath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error("[OpenClaw Config] 读取配置文件失败:", err);
    return null;
  }
}

/**
 * 保存完整的 OpenClaw 配置
 */
function writeOpenClawConfig(config) {
  return writeOpenClawConfigToPath(getOpenClawConfigPath(), config);
}

function writeOpenClawConfigToPath(configPath, config) {
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
    console.log("[OpenClaw Config] 配置文件已保存:", configPath);
    return true;
  } catch (err) {
    console.error("[OpenClaw Config] 保存配置文件失败:", err);
    throw err;
  }
}

module.exports = {
  setOpenClawConfig,
  getOpenClawConfig,
  configureProvider,
  resetOpenClawConfig,
  restartGateway,
  readOpenClawConfig,
  readOpenClawConfigFromPath,
  writeOpenClawConfig,
  writeOpenClawConfigToPath,
  getOpenClawConfigPath,
  resolveConfigEditTarget,
  initOpenClawConfig,
  ensureGatewayModeLocal,
  PROVIDER_PRESETS,
};
