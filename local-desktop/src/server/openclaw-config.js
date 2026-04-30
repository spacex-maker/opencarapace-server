const path = require("path");
const fs = require("fs");
const axios = require("axios");
const { execWithOutput } = require("./utils.js");
const {
  getUnpackedAppRoot,
  getPackagedOpenClawBinFromUnpacked,
  getPackagedOpenClawMjsPath,
  resolveRealNodeExecutable,
  buildOpenClawChildEnv,
} = require("./openclaw-paths.js");
const { getManagedOpenClawEnv, getActiveOpenClawEnv, getUserDefaultOpenClawEnv } = require("./openclaw-workspace.js");
const { getUserProfileOpenClawPaths } = require("./openclaw-discovery.js");

/**
 * 内置（Bundled）Gateway 专属固定端口。
 * 与外置 openclaw 标准默认端口 18789 错开，避免共存时端口争抢与进程误识别。
 * 修改此值需同步更新 openclaw-manager.js 中的同名常量。
 */
const BUNDLED_GATEWAY_PORT = 19278;

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
 * agents.defaults.workspace：与 openclaw.json 同一代目录下的 workspace 子目录。
 * configDir 已由 OPENCLAW_CONFIG_PATH 解析（内置托管目录随 Electron userData，Windows/macOS 路径不同）。
 */
function getDefaultAgentsWorkspacePath(configDir) {
  return path.join(configDir, "workspace");
}

/**
 * 从 OpenCarapace 服务端「系统配置」暴露的公开接口拉取默认 MiniMax Key（管理员在 Web 后台维护）。
 * 使用本地 settings.apiBase（默认官方域名）；离线或失败时返回空字符串。
 */
async function fetchDefaultMinimaxApiKeyFromCloud() {
  try {
    const { getLocalSettings } = require("../db.js");
    const settings = await getLocalSettings();
    const base = String(settings?.apiBase || "https://api.clawheart.live").replace(/\/+$/, "");
    const url = `${base}/api/public/client-defaults/minimax-api-key`;
    const res = await axios.get(url, { timeout: 12000, validateStatus: () => true });
    if (res.status !== 200 || res.data == null || typeof res.data.apiKey !== "string") {
      return "";
    }
    return String(res.data.apiKey).trim();
  } catch (e) {
    console.warn("[OpenClaw Config] 拉取云端默认 MiniMax API Key 失败:", e?.message || e);
    return "";
  }
}

/**
 * 轮换 Gateway 鉴权 token（用于认证失败锁定后的快速恢复）
 */
function rotateGatewayAuthToken() {
  const configPath = getOpenClawConfigPath();
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  let cfg = {};
  if (fs.existsSync(configPath)) {
    try {
      cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch (e) {
      console.warn("[OpenClaw Config] 读取现有配置失败，将以空配置重建 gateway.auth:", e?.message || e);
      cfg = {};
    }
  }

  if (!cfg.gateway || typeof cfg.gateway !== "object") {
    cfg.gateway = {};
  }
  if (!cfg.gateway.auth || typeof cfg.gateway.auth !== "object") {
    cfg.gateway.auth = {};
  }
  if (!cfg.gateway.mode || String(cfg.gateway.mode).trim() === "") {
    cfg.gateway.mode = "local";
  }
  cfg.gateway.auth.mode = "token";
  cfg.gateway.auth.token = generateToken();

  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), "utf-8");
  return { token: cfg.gateway.auth.token, configPath };
}

/**
 * OpenClaw 2026.3+：`gateway run` 要求 `gateway.mode=local` 或传 `--allow-unconfigured`。
 * 旧版/手写的 openclaw.json 可能没有 mode，仅补全为 local，不覆盖已有非空 mode。
 * @param {string} configPath 绝对路径 openclaw.json
 */
function patchEnsureGatewayModeLocalForPath(configPath) {
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

function ensureGatewayModeLocal() {
  return patchEnsureGatewayModeLocalForPath(getOpenClawConfigPath());
}

/**
 * 初始化**内置（ClawHeart 托管）** OpenClaw 配置文件（若不存在则创建）。
 *
 * 固定写入 `clawheart-openclaw-runtime/openclaw.json`（见 getManagedOpenClawEnv），与「当前 UI 选的是内置还是外置」无关，
 * 避免在外置工作区激活时误在用户 ~/.openclaw 里生成一份内置模板。
 *
 * 结构对齐 OpenClaw 2026.3.x：`meta` / `auth.profiles` / `models.providers.minimax` / `agents.defaults` /
 * `commands` / `gateway`（port 19278、mode local、token 鉴权）。
 * MiniMax `apiKey` 仅来自云端公开接口；Gateway `token` 每次随机；`workspace` 为托管目录下 `workspace` 子目录（随 Electron userData 变化）。
 */
async function initOpenClawConfig() {
  const managed = getManagedOpenClawEnv();
  const configPath = managed.OPENCLAW_CONFIG_PATH;
  const configDir = managed.OPENCLAW_STATE_DIR;
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // 如果配置文件已存在，不覆盖（仍补全 gateway.mode 等，读写的亦是托管路径）
  if (fs.existsSync(configPath)) {
    console.log("[OpenClaw Config] 托管目录配置文件已存在，跳过初始化");
    patchEnsureGatewayModeLocalForPath(configPath);
    return;
  }

  console.log("[OpenClaw Config] 初始化内置托管目录配置文件...");

  const minimaxApiKeyFromCloud = await fetchDefaultMinimaxApiKeyFromCloud();

  const workspacePath = getDefaultAgentsWorkspacePath(configDir);
  try {
    fs.mkdirSync(workspacePath, { recursive: true });
  } catch (e) {
    console.warn("[OpenClaw Config] 创建工作区目录失败（可继续写入配置）:", e?.message || e);
  }

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
          apiKey: minimaxApiKeyFromCloud,
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
        workspace: getDefaultAgentsWorkspacePath(configDir),
      },
    },
    commands: {
      native: "auto",
      nativeSkills: "auto",
      restart: true,
      ownerDisplay: "raw",
    },
    gateway: {
      port: BUNDLED_GATEWAY_PORT,
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
/**
 * 重启指定模式的 Gateway。
 * @param {string} [mode] "bundled" | "external"；省略时由 stop/start 内部读 DB 决定（向后兼容）
 */
async function restartGateway(mode) {
  console.log(`[OpenClaw Config] 重启 ${mode || "default"} Gateway...`);
  try {
    const { stopEmbeddedOpenClaw, startEmbeddedOpenClaw } = require("./openclaw-manager.js");
    await stopEmbeddedOpenClaw(mode);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const started = await startEmbeddedOpenClaw(mode);
    if (started) {
      console.log(`[OpenClaw Config] ${mode || ""} Gateway 重启成功`);
    } else {
      console.log(`[OpenClaw Config] ${mode || ""} Gateway 重启超时，但可能正在后台启动`);
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

/**
 * 迁移旧托管配置：将 gateway.port 从 18789（openclaw 标准默认端口）修正为
 * BUNDLED_GATEWAY_PORT（内置专属端口），避免与用户自行安装的外置 openclaw 争抢端口。
 *
 * 调用时机：每次 startEmbeddedOpenClaw 初始化阶段（initOpenClawConfig 之后）。
 * 仅操作 ClawHeart 托管目录（clawheart-openclaw-runtime），不触碰 ~/.openclaw。
 *
 * @returns {boolean} true = 发生了写入（端口已更新）；false = 无需更改
 */
/**
 * 启动 Web UI 前审计 openclaw.json（内置读托管目录，外置读 ~/.openclaw）。
 * @param {"bundled"|"external"} mode
 * @returns {{ configPath: string, issues: Array<{ severity: string, code: string, message: string }>, blocking: boolean, canApplyOfficialMinimaxKey: boolean }}
 */
function auditOpenClawConfigForWebUi(mode) {
  const env = mode === "external" ? getUserDefaultOpenClawEnv() : getManagedOpenClawEnv();
  const configPath = env.OPENCLAW_CONFIG_PATH;
  /** @type {Array<{ severity: string, code: string, message: string }>} */
  const issues = [];

  if (!fs.existsSync(configPath)) {
    issues.push({
      severity: "error",
      code: "config_missing",
      message: "未找到 openclaw.json，请先完成初始化或启动过一次 Gateway。",
    });
    return { configPath, issues, blocking: true, canApplyOfficialMinimaxKey: false };
  }

  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (e) {
    issues.push({
      severity: "error",
      code: "config_invalid_json",
      message: "openclaw.json 无法解析为 JSON，请检查文件是否损坏。",
    });
    return { configPath, issues, blocking: true, canApplyOfficialMinimaxKey: false };
  }

  const gw = cfg.gateway;
  if (!gw || typeof gw !== "object") {
    issues.push({ severity: "error", code: "gateway_missing", message: "缺少 gateway 配置段。" });
  } else {
    const tok = gw.auth && typeof gw.auth === "object" ? String(gw.auth.token || "").trim() : "";
    if (!tok) {
      issues.push({
        severity: "error",
        code: "gateway_token_empty",
        message: "Gateway 鉴权 token 为空，浏览器打开 Web UI 时可能无法自动附带登录参数。",
      });
    }
    const gmode = String(gw.mode || "").trim();
    if (gmode && gmode !== "local") {
      issues.push({
        severity: "warn",
        code: "gateway_mode",
        message: `gateway.mode 为「${gmode}」，内置/本地 Gateway 通常应为 local。`,
      });
    }
    if (mode === "bundled") {
      const p = Number(gw.port);
      if (Number.isFinite(p) && p !== BUNDLED_GATEWAY_PORT) {
        issues.push({
          severity: "warn",
          code: "gateway_port",
          message: `Gateway 端口为 ${p}，内置模式建议使用 ${BUNDLED_GATEWAY_PORT}，否则与客户端检测不一致。`,
        });
      }
    }
  }

  const providers = cfg.models && typeof cfg.models === "object" ? cfg.models.providers : null;
  const minimax = providers && typeof providers === "object" ? providers.minimax : null;
  if (!minimax || typeof minimax !== "object") {
    issues.push({
      severity: "error",
      code: "minimax_provider_missing",
      message: "未配置 models.providers.minimax，无法在 Web UI 中使用默认 MiniMax 模型。",
    });
  } else {
    if (!String(minimax.apiKey || "").trim()) {
      issues.push({
        severity: "error",
        code: "minimax_api_key_empty",
        message: "MiniMax API Key 为空，对话请求将失败（401/403）。",
      });
    }
    if (!String(minimax.baseUrl || "").trim()) {
      issues.push({
        severity: "error",
        code: "minimax_base_url_empty",
        message: "MiniMax baseUrl 未设置。",
      });
    }
  }

  const ws =
    cfg.agents &&
    cfg.agents.defaults &&
    typeof cfg.agents.defaults === "object"
      ? String(cfg.agents.defaults.workspace || "").trim()
      : "";
  if (!ws) {
    issues.push({
      severity: "warn",
      code: "workspace_empty",
      message: "agents.defaults.workspace 未设置，代理工作目录可能异常。",
    });
  } else if (!fs.existsSync(ws)) {
    issues.push({
      severity: "warn",
      code: "workspace_dir_missing",
      message: `工作区目录不存在：${ws}`,
    });
  }

  const blocking = issues.some((i) => i.severity === "error");
  const canApplyOfficialMinimaxKey = issues.some((i) => i.code === "minimax_api_key_empty");
  return { configPath, issues, blocking, canApplyOfficialMinimaxKey };
}

/**
 * 将云端「系统配置」中的默认 MiniMax Key 写入指定模式的 openclaw.json（不删其它字段）。
 * @param {"bundled"|"external"} mode
 */
/**
 * 合并用户填写的 MiniMax / Gateway 必填项（不重拉起进程）。
 * @param {"bundled"|"external"} mode
 * @param {{ minimaxApiKey?: string, minimaxBaseUrl?: string, generateGatewayTokenIfEmpty?: boolean }} patch
 */
function mergeGatewayPrereqsForMode(mode, patch) {
  const env = mode === "external" ? getUserDefaultOpenClawEnv() : getManagedOpenClawEnv();
  const configPath = env.OPENCLAW_CONFIG_PATH;
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let cfg = {};
  if (fs.existsSync(configPath)) {
    try {
      cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch (e) {
      return { ok: false, message: `配置 JSON 无效：${e?.message || e}` };
    }
  }

  const ak =
    patch.minimaxApiKey != null && typeof patch.minimaxApiKey === "string" ? patch.minimaxApiKey.trim() : "";
  const bu =
    patch.minimaxBaseUrl != null && typeof patch.minimaxBaseUrl === "string" ? patch.minimaxBaseUrl.trim() : "";

  if (ak || bu) {
    if (!cfg.models) cfg.models = {};
    if (!cfg.models.providers) cfg.models.providers = {};
    if (!cfg.models.providers.minimax) cfg.models.providers.minimax = {};
    if (ak) {
      cfg.models.providers.minimax.apiKey = ak;
      cfg.models.providers.minimax.auth = "api-key";
    }
    if (bu) {
      cfg.models.providers.minimax.baseUrl = bu;
    }
    if (!cfg.models.providers.minimax.api) cfg.models.providers.minimax.api = "anthropic-messages";
    if (cfg.models.providers.minimax.authHeader !== false) cfg.models.providers.minimax.authHeader = true;
    if (!Array.isArray(cfg.models.providers.minimax.models) || cfg.models.providers.minimax.models.length === 0) {
      cfg.models.providers.minimax.models = [
        {
          id: "MiniMax-M2.5",
          name: "MiniMax-M2.5",
          api: "anthropic-messages",
          reasoning: true,
          input: ["text"],
          contextWindow: 204800,
          maxTokens: 4096,
        },
      ];
    }
  }

  if (patch.generateGatewayTokenIfEmpty) {
    if (!cfg.gateway) cfg.gateway = {};
    if (!cfg.gateway.auth || typeof cfg.gateway.auth !== "object") cfg.gateway.auth = {};
    if (!String(cfg.gateway.auth.token || "").trim()) {
      cfg.gateway.auth.mode = "token";
      cfg.gateway.auth.token = generateToken();
    }
  }

  if (!cfg.gateway) cfg.gateway = {};
  if (!String(cfg.gateway.mode || "").trim()) cfg.gateway.mode = "local";

  const ws =
    cfg.agents &&
    cfg.agents.defaults &&
    typeof cfg.agents.defaults === "object"
      ? String(cfg.agents.defaults.workspace || "").trim()
      : "";
  if (ws && !fs.existsSync(ws)) {
    try {
      fs.mkdirSync(ws, { recursive: true });
    } catch (e) {
      console.warn("[OpenClaw Config] mergeGatewayPrereqsForMode 创建工作区目录失败:", e?.message || e);
    }
  }

  try {
    writeOpenClawConfigToPath(configPath, cfg);
  } catch (e) {
    return { ok: false, message: `写入失败：${e?.message || e}` };
  }
  return { ok: true, configPath };
}

async function applyOfficialMinimaxKeyForMode(mode) {
  const key = await fetchDefaultMinimaxApiKeyFromCloud();
  if (!key) {
    return {
      ok: false,
      message:
        "未获取到云端默认 Key（请检查网络，或由管理员在 Web 后台系统配置中填写 client.default.minimax.api_key）。",
    };
  }
  const configPath =
    mode === "external" ? getUserDefaultOpenClawEnv().OPENCLAW_CONFIG_PATH : getManagedOpenClawEnv().OPENCLAW_CONFIG_PATH;
  let cfg = {};
  if (fs.existsSync(configPath)) {
    try {
      cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch (e) {
      return { ok: false, message: `读取配置失败：${e?.message || e}` };
    }
  }
  if (!cfg.models) cfg.models = {};
  if (!cfg.models.providers) cfg.models.providers = {};
  if (!cfg.models.providers.minimax) cfg.models.providers.minimax = {};
  cfg.models.providers.minimax.apiKey = key;
  if (!cfg.models.providers.minimax.auth) cfg.models.providers.minimax.auth = "api-key";
  writeOpenClawConfigToPath(configPath, cfg);
  return { ok: true, message: "已写入云端下发的默认 MiniMax API Key" };
}

function ensureManagedGatewayPort() {
  const configPath = getManagedOpenClawEnv().OPENCLAW_CONFIG_PATH;
  if (!fs.existsSync(configPath)) return false;
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (e) {
    console.warn("[OpenClaw Config] ensureManagedGatewayPort 解析失败:", e?.message || e);
    return false;
  }
  if (!cfg.gateway || typeof cfg.gateway !== "object") cfg.gateway = {};
  const curPort = Number(cfg.gateway.port);
  if (curPort === BUNDLED_GATEWAY_PORT) return false;
  const prevPort = Number.isFinite(curPort) && curPort > 0 ? curPort : "(未设置)";
  cfg.gateway.port = BUNDLED_GATEWAY_PORT;
  try {
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), "utf-8");
    console.log(`[OpenClaw Config] 内置 Gateway 端口已迁移: ${prevPort} → ${BUNDLED_GATEWAY_PORT}`);
    return true;
  } catch (e) {
    console.warn("[OpenClaw Config] ensureManagedGatewayPort 写入失败:", e?.message || e);
    return false;
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
  ensureManagedGatewayPort,
  rotateGatewayAuthToken,
  auditOpenClawConfigForWebUi,
  mergeGatewayPrereqsForMode,
  applyOfficialMinimaxKeyForMode,
  PROVIDER_PRESETS,
  BUNDLED_GATEWAY_PORT,
};
