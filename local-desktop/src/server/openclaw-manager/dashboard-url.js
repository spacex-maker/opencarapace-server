/**
 * Dashboard URL 解析：sanitize / token 拼接 / getDashboardUrl。
 */

const path = require("path");
const fs = require("fs");
const os = require("os");
const { execWithOutput } = require("../utils.js");
const {
  isWin,
  localBinPath,
  execOpenClawBin,
} = require("./platform.js");
const {
  getUnpackedAppRoot,
  getPackagedOpenClawBinFromUnpacked,
  getPackagedOpenClawMjsPath,
  resolveRealNodeExecutable,
  buildOpenClawChildEnv,
} = require("../openclaw-paths.js");
const {
  listTcpListenersOnPort,
} = require("../openclaw-gateway-port-conflict.js");
const { resolveEffectiveExternalOpenClawBin } = require("../openclaw-discovery.js");
const { execFileSync } = require("child_process");

// ─── URL 工具函数 ─────────────────────────────────────────────────

function sanitizeDashboardUrlCandidate(raw) {
  if (raw == null) return null;
  const cleaned = String(raw)
    .replace(/\u001b\[[0-9;]*m/g, "")
    .trim();
  if (!cleaned) return null;

  const match = cleaned.match(/https?:\/\/[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+/i);
  if (!match) return null;

  const candidate = match[0].replace(/[),.;]+$/g, "");
  try {
    const u = new URL(candidate);
    const trimCorruptedTokenSuffix = (token) => {
      if (!token) return token;
      if (/^[0-9a-f]+token$/i.test(token)) return token.slice(0, -5);
      return token;
    };

    const hash = u.hash || "";
    if (/^#token=/i.test(hash)) {
      const hashParams = new URLSearchParams(hash.slice(1));
      const token = trimCorruptedTokenSuffix(hashParams.get("token"));
      if (token != null) hashParams.set("token", token);
      u.hash = hashParams.toString();
    } else {
      const token = trimCorruptedTokenSuffix(u.searchParams.get("token"));
      if (token != null) u.searchParams.set("token", token);
    }
    return u.toString();
  } catch {
    return null;
  }
}

function composeUiUrlWithToken(baseUrl, token, opts = {}) {
  const fallback = opts.fallbackUrl || "http://localhost:18789";
  const sanitizedBase = sanitizeDashboardUrlCandidate(baseUrl) || fallback;
  if (!token || typeof token !== "string") return sanitizedBase;
  try {
    const u = new URL(sanitizedBase);
    if (Number.isFinite(opts.port) && opts.port > 0) {
      u.port = String(opts.port);
    }
    const cleanToken = String(token).trim();
    if (!cleanToken) return u.toString();
    u.hash = `token=${encodeURIComponent(cleanToken)}`;
    return u.toString();
  } catch {
    return sanitizedBase;
  }
}

function getUiUrlFromActiveConfig(baseUrl, configPathOverride) {
  try {
    let configPath = configPathOverride;
    if (!configPath) {
      const { getActiveOpenClawEnv } = require("../openclaw-workspace.js");
      configPath = getActiveOpenClawEnv()?.OPENCLAW_CONFIG_PATH;
    }
    if (!configPath || !fs.existsSync(configPath)) return null;
    const raw = fs.readFileSync(configPath, "utf-8");
    if (!raw || !raw.trim()) return null;
    const cfg = JSON.parse(raw);
    const token = cfg?.gateway?.auth?.token;
    if (!token || typeof token !== "string" || !token.trim()) return null;
    const portRaw = cfg?.gateway?.port;
    const port = Number(portRaw);
    return composeUiUrlWithToken(baseUrl, token, {
      port: Number.isFinite(port) && port > 0 ? port : undefined,
    });
  } catch {
    return null;
  }
}

function getUiUrlFromListeningGatewayProcess(baseUrl) {
  if (isWin) return null;
  try {
    let port = 18789;
    try {
      const u = new URL(baseUrl || "http://localhost:18789");
      const p = Number(u.port);
      if (Number.isFinite(p) && p > 0) port = p;
    } catch {
      /* ignore */
    }

    const listeners = listTcpListenersOnPort(port) || [];
    for (const l of listeners) {
      const pid = Number(l?.pid);
      if (!Number.isFinite(pid) || pid <= 0) continue;
      let out = "";
      try {
        out = execFileSync("lsof", ["-p", String(pid)], {
          encoding: "utf8",
          timeout: 6000,
          maxBuffer: 2 * 1024 * 1024,
        });
      } catch {
        continue;
      }

      const configLine = out
        .split(/\r?\n/)
        .find((line) => /\/openclaw\.json\s*$/.test(line) && !/node_modules/.test(line));
      if (!configLine) continue;
      const mm = configLine.match(/(\/.*openclaw\.json)\s*$/);
      const configPath = mm ? mm[1].trim() : null;
      if (!configPath || !fs.existsSync(configPath)) continue;

      const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      const token = cfg?.gateway?.auth?.token;
      if (!token || typeof token !== "string" || !token.trim()) continue;
      const pRaw = Number(cfg?.gateway?.port);
      return composeUiUrlWithToken(baseUrl, token, {
        port: Number.isFinite(pRaw) && pRaw > 0 ? pRaw : undefined,
      });
    }
    return null;
  } catch {
    return null;
  }
}

// ─── getDashboardUrl ──────────────────────────────────────────────

/**
 * 获取指定模式带 token 的 dashboard URL。
 *
 * 需要调用方注入运行时状态（避免循环依赖）：
 * @param {object} ctx
 * @param {string} ctx.resolvedMode "bundled" | "external"
 * @param {{ bundled: string|null, external: string|null }} ctx.cachedDashboardUrl
 * @param {{ bundled: number, external: number }} ctx.lastGatewayStopEpochMs
 * @param {number} ctx.DASHBOARD_CLI_AFTER_STOP_MS
 * @param {string} ctx.BUNDLED_OPENCLAW_UI_URL
 * @param {string} ctx.OPENCLAW_UI_URL
 * @param {function} ctx.getExternalGatewayBaseUrl
 * @param {function} ctx.getDefaultUiUrlForMode
 * @param {function} ctx.hasBundledOpenClawCli
 */
async function getDashboardUrl(ctx) {
  const {
    resolvedMode,
    cachedDashboardUrl,
    lastGatewayStopEpochMs,
    DASHBOARD_CLI_AFTER_STOP_MS,
    BUNDLED_OPENCLAW_UI_URL,
    OPENCLAW_UI_URL,
    getExternalGatewayBaseUrl,
    getDefaultUiUrlForMode,
    hasBundledOpenClawCli,
  } = ctx;
  const binaryMode = resolvedMode;

  if (cachedDashboardUrl[binaryMode]) {
    const sanitizedCached = sanitizeDashboardUrlCandidate(cachedDashboardUrl[binaryMode]);
    if (sanitizedCached) {
      cachedDashboardUrl[binaryMode] = sanitizedCached;
      return sanitizedCached;
    }
    cachedDashboardUrl[binaryMode] = null;
  }

  try {
    const baseUi = binaryMode !== "external" ? BUNDLED_OPENCLAW_UI_URL : getExternalGatewayBaseUrl();
    const fallbackUrl = getDefaultUiUrlForMode(binaryMode);

    if (Date.now() - lastGatewayStopEpochMs[binaryMode] < DASHBOARD_CLI_AFTER_STOP_MS) {
      return baseUi;
    }

    const { getManagedOpenClawEnv, getUserDefaultOpenClawEnv } = require("../openclaw-workspace.js");
    const modeEnv =
      binaryMode === "external" ? getUserDefaultOpenClawEnv() : getManagedOpenClawEnv();
    const modeConfigPath = modeEnv.OPENCLAW_CONFIG_PATH;

    const processUrl = getUiUrlFromListeningGatewayProcess(baseUi);
    if (processUrl) {
      cachedDashboardUrl[binaryMode] = processUrl;
      return processUrl;
    }
    const configUrl = getUiUrlFromActiveConfig(baseUi, modeConfigPath);
    if (configUrl) {
      cachedDashboardUrl[binaryMode] = configUrl;
      return configUrl;
    }

    const buildModeChildEnv = (unpackedRoot) => {
      const e = buildOpenClawChildEnv(unpackedRoot);
      e.OPENCLAW_STATE_DIR = modeEnv.OPENCLAW_STATE_DIR;
      e.OPENCLAW_CONFIG_PATH = modeEnv.OPENCLAW_CONFIG_PATH;
      return e;
    };

    const packagedBin = getPackagedOpenClawBinFromUnpacked();
    const packagedMjs = packagedBin ? null : getPackagedOpenClawMjsPath();
    let result;

    if (binaryMode === "external") {
      // 外置模式：只用外置二进制，绝不回退到内置/packaged 路径
      const resolved = await resolveEffectiveExternalOpenClawBin();
      const extBin = resolved.binPath;
      if (extBin) {
        const env = buildModeChildEnv(null);
        result = await execOpenClawBin(extBin, ["dashboard", "--no-open"], {
          cwd: os.tmpdir(), env,
        });
      }
    } else {
      // 内置模式：按 packaged → mjs → dev 顺序
      if (packagedBin) {
        const childEnv = buildModeChildEnv(packagedBin.cwd);
        result = await execOpenClawBin(packagedBin.bin, ["dashboard", "--no-open"], {
          cwd: packagedBin.cwd, env: childEnv,
        });
      } else if (packagedMjs) {
        const unpackedRoot = getUnpackedAppRoot();
        const nodeExe = resolveRealNodeExecutable();
        if (!nodeExe) {
          return fallbackUrl;
        }
        const extraEnv = buildModeChildEnv(unpackedRoot);
        result = await execWithOutput(nodeExe, [packagedMjs, "dashboard", "--no-open"], {
          shell: false,
          cwd: path.dirname(packagedMjs),
          env: extraEnv,
        });
      } else {
        if (!hasBundledOpenClawCli()) {
          return fallbackUrl;
        }
        const _localBinDir = path.join(__dirname, "../../../node_modules", ".bin");
        const devOpenClawBin = localBinPath(_localBinDir);
        if (!fs.existsSync(devOpenClawBin)) {
          return fallbackUrl;
        }
        const env = buildModeChildEnv(null);
        result = await execOpenClawBin(devOpenClawBin, ["dashboard", "--no-open"], {
          cwd: os.tmpdir(), env,
        });
      }
    }

    if (result && result.code === 0 && result.stdout) {
      const lines = result.stdout.split("\n");
      for (const line of lines) {
        if (line.includes("Dashboard URL:")) {
          const parsed = sanitizeDashboardUrlCandidate(line);
          if (parsed) {
            cachedDashboardUrl[binaryMode] = parsed;
            console.log("[OpenClaw] Dashboard URL 已获取:", parsed);
            return parsed;
          }
        }
        const parsed = sanitizeDashboardUrlCandidate(line);
        if (parsed && /[#?]token=/i.test(parsed)) {
          cachedDashboardUrl[binaryMode] = parsed;
          console.log("[OpenClaw] Dashboard URL 已获取:", parsed);
          return parsed;
        }
      }
    }

    console.log("[OpenClaw] 无法获取 dashboard URL，使用默认 URL");
    return fallbackUrl;
  } catch (err) {
    console.error("[OpenClaw] 获取 dashboard URL 失败:", err);
    return getDefaultUiUrlForMode(resolvedMode);
  }
}

module.exports = {
  sanitizeDashboardUrlCandidate,
  composeUiUrlWithToken,
  getUiUrlFromActiveConfig,
  getUiUrlFromListeningGatewayProcess,
  getDashboardUrl,
};
