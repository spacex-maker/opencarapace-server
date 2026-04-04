const express = require("express");
const os = require("os");
const {
  getDb,
  getLocalSettings,
  getLocalAuth,
  getLlmRouteMode,
  getSecurityScanPrivacy,
  setSecurityScanPrivacy,
  listRecentConversationTurns,
} = require("./db.js");
const { syncState } = require("./server/sync-state.js");
const { registerOpenClawRoutes } = require("./server/openclaw.js");
const { registerAuthRoutes } = require("./server/auth-routes.js");
const { registerSettingsRoutes } = require("./server/settings-routes.js");
const { registerDangerRoutes } = require("./server/danger-routes.js");
const { forwardChatCompletions } = require("./server/llm-proxy.js");
const { registerSkillsRoutes } = require("./server/skills-routes.js");
const { registerInterceptLogsRoutes } = require("./server/intercept-logs-routes.js");
const { registerProxyRequestLogsRoutes } = require("./server/proxy-request-logs-routes.js");
const { registerTokenUsageRoutes } = require("./server/token-usage-routes.js");
const { registerAgentMgmtRoutes } = require("./server/agent-mgmt-routes.js");
const { registerBudgetRoutes } = require("./server/budget-routes.js");
const axios = require("axios");

const PORT = 19111;

/** 安全扫描：转发至云端（与独立模块同逻辑，内联避免打包/路径导致未注册 404） */
function registerSecurityScanRoutes(app) {
  const HISTORY_PREFIX = "history_";
  const SYSTEM_CONFIG_SCAN_CODES = new Set([
    "secrets_api_key",
    "mcp_privilege",
    "routing_llm",
    "skills_governance",
    "baseline_tls_files",
  ]);

  async function cloudAxiosConfig() {
    const settings = await getLocalSettings();
    const apiBase = settings && settings.apiBase
      ? String(settings.apiBase).replace(/\/+$/, "")
      : "https://api.clawheart.live";
    const auth = await getLocalAuth();
    const headers = { Accept: "application/json" };
    if (auth && auth.token) {
      headers.Authorization = `Bearer ${auth.token}`;
    }
    return { apiBase, headers };
  }

  function maskSecretValue(val) {
    if (val == null) return val;
    const s = String(val);

    // 保留常见前缀，便于模型判断“是否存在密钥模式”
    if (/sk-ant-/i.test(s)) return "sk-ant-***";
    if (/\bgsk_/i.test(s)) return "gsk_***";
    if (/\bsk-/i.test(s)) return "sk-***";
    if (/^Bearer\s+/i.test(s)) return "Bearer ***";

    // 其它密钥字段值直接替换
    return "***";
  }

  function redactSecretLikeText(text) {
    if (text == null) return "";
    let s = String(text);

    // Bearer token
    s = s.replace(/\bBearer\s+[A-Za-z0-9._-]{6,}\b/gi, "Bearer ***");

    // sk- / gsk_ 等常见前缀
    s = s.replace(/\bsk-ant-[A-Za-z0-9_-]{4,}\b/gi, "sk-ant-***");
    s = s.replace(/\bsk-[A-Za-z0-9_-]{4,}\b/gi, "sk-***");
    s = s.replace(/\bgsk_[A-Za-z0-9_-]{4,}\b/gi, "gsk_***");

    // api_key / api-key 形式（尽量不破坏其它文本）
    s = s.replace(/(api[_-]?key\s*[:=]\s*)([^\s"'`]{3,})/gi, "$1***");
    s = s.replace(/(authorization\s*[:=]\s*)([^\s"'`]{3,})/gi, "$1***");

    return s;
  }

  function redactSecretsDeep(value, depth = 6) {
    if (depth <= 0) return value;
    if (value == null) return value;

    if (Array.isArray(value)) {
      return value.map((v) => redactSecretsDeep(v, depth - 1));
    }
    if (typeof value !== "object") {
      return typeof value === "string" ? redactSecretLikeText(value) : value;
    }

    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const keyLower = k.toLowerCase();
      const shouldMask = /(api[_-]?key|oc_api_key|llm_key|token|secret|password|authorization|bearer|auth)/i.test(keyLower);
      out[k] = shouldMask ? maskSecretValue(v) : redactSecretsDeep(v, depth - 1);
    }
    return out;
  }

  function truncateStr(s, max = 120000) {
    const text = String(s || "");
    if (text.length <= max) return text;
    return text.slice(0, Math.max(0, max - 1)) + "…";
  }

  app.get("/api/security-scan/privacy", async (_req, res) => {
    try {
      const privacy = await getSecurityScanPrivacy();
      res.status(200).json(privacy);
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "读取隐私配置失败" } });
    }
  });

  app.post("/api/security-scan/privacy", async (req, res) => {
    try {
      const body = req.body || {};
      const next = {
        shareHistoryEnabled: !!body.shareHistoryEnabled,
        consentSystemConfigEnabled: !!body.consentSystemConfigEnabled,
      };
      await setSecurityScanPrivacy(next);
      res.status(200).json({ ok: true, privacy: next });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "更新隐私配置失败" } });
    }
  });

  app.get("/api/security-scan/items", async (_req, res) => {
    try {
      const { apiBase, headers } = await cloudAxiosConfig();
      if (!headers.Authorization) {
        res.status(401).json({
          error: {
            code: "security_scan_login_items",
            message: "请先登录云端账户后再获取安全扫描项。",
          },
        });
        return;
      }
      const clientOs = encodeURIComponent(process.platform || "");
      const url = `${apiBase}/api/security-scan/items?clientOs=${clientOs}`;
      const r = await axios.get(url, { headers, validateStatus: () => true });
      res.status(r.status).json(r.data);
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "获取安全扫描项失败" } });
    }
  });

  app.post("/api/security-scan/ai-run", async (req, res) => {
    try {
      const body = req.body || {};
      const baseContext = body.context != null ? String(body.context) : "";
      const requestedCodes = Array.isArray(body.itemCodes) ? body.itemCodes.map((c) => String(c)) : [];
      const locale = body.locale != null ? String(body.locale).trim() : "";

      const privacy = await getSecurityScanPrivacy();
      const historyCodes = requestedCodes.filter((c) => c && c.startsWith(HISTORY_PREFIX));
      const systemCodes = requestedCodes.filter((c) => c && !c.startsWith(HISTORY_PREFIX));

      const skipFindings = [];
      const allowedHistoryCodes = privacy.shareHistoryEnabled ? historyCodes : [];
      const allowedSystemCodes = privacy.consentSystemConfigEnabled ? systemCodes : [];

      for (const code of historyCodes) {
        if (!allowedHistoryCodes.includes(code)) {
          skipFindings.push({
            itemCode: code,
            severity: "WARN",
            title: "已跳过（需开启共享对话历史）",
            detail: "本机安全扫描要求用户开启共享对话历史后才会上传用于扫描。",
            remediation: "",
            location: "",
          });
        }
      }
      for (const code of systemCodes) {
        if (!allowedSystemCodes.includes(code)) {
          skipFindings.push({
            itemCode: code,
            severity: "WARN",
            title: "已跳过（需同意扫描本机 AI 配置）",
            detail: "本机安全扫描要求用户同意后才会读取本机 AI 配置并上传用于扫描。",
            remediation: "",
            location: "",
          });
        }
      }

      const allowedCodesForCloud = allowedHistoryCodes.concat(allowedSystemCodes);
      if (allowedCodesForCloud.length === 0) {
        res.status(200).json({
          findings: skipFindings,
          scannedItemCodes: requestedCodes,
          scannedAt: new Date().toISOString(),
        });
        return;
      }

      // 执行云端扫描前：需要云端鉴权
      const { apiBase, headers } = await cloudAxiosConfig();
      if (!headers.Authorization) {
        res.status(401).json({
          error: {
            code: "security_scan_login_scan",
            message: "请先登录云端账户后再执行安全扫描。",
          },
        });
        return;
      }

      // 构建最终上传 context（按同意选择填充）
      const parts = [];

      if (allowedHistoryCodes.length > 0) {
        const turns = await listRecentConversationTurns(10, 12000);
        const historyBlock =
          turns.length === 0
            ? "【历史对话】（无可用共享对话记录）"
            : `【历史对话】\n${turns
                .map((t) => {
                  const user = redactSecretLikeText(t.userText);
                  const assistant = redactSecretLikeText(t.assistantText);
                  return `[${t.createdAt}]\n用户：${user}\n助手：${assistant}`;
                })
                .join("\n\n")}`;
        parts.push(historyBlock);
      }

      if (allowedSystemCodes.length > 0) {
        // 系统配置扫描只读取本机 OpenClaw 配置 + local_settings，并在上传前脱敏
        const localSettings = await getLocalSettings();
        const openclawCfg = (() => {
          try {
            const { readOpenClawConfig, getOpenClawConfigPath } = require("./server/openclaw-config.js");
            const cfg = readOpenClawConfig();
            return { config: cfg || {}, configPath: typeof getOpenClawConfigPath === "function" ? getOpenClawConfigPath() : "" };
          } catch {
            return { config: {}, configPath: "" };
          }
        })();

        const picked = {
          openclaw: {
            configPath: openclawCfg.configPath || "",
            // 只保留用于 AI 配置扫描的关键段落，减少上传体积
            gateway: openclawCfg.config?.gateway || {},
            models: openclawCfg.config?.models || {},
            agents: openclawCfg.config?.agents || {},
            commands: openclawCfg.config?.commands || {},
          },
          local_settings: {
            apiBase: localSettings?.apiBase || "",
            ocApiKey: localSettings?.ocApiKey || "",
            llmKey: localSettings?.llmKey || "",
          },
        };

        const redacted = redactSecretsDeep(picked);
        const configJson = truncateStr(JSON.stringify(redacted, null, 2), 45000);
        parts.push(`【本机AI配置（脱敏）】\n${configJson}`);
      }

      const finalContext = [baseContext.trim(), ...parts].filter(Boolean).join("\n\n");
      const url = `${apiBase}/api/security-scan/ai-run`;

      const r = await axios.post(
        url,
        {
          itemCodes: allowedCodesForCloud,
          context: finalContext,
          clientOs: process.platform || "",
          locale,
        },
        {
          headers: { ...headers, "Content-Type": "application/json" },
          validateStatus: () => true,
        }
      );

      const cloudFindings = Array.isArray(r.data?.findings) ? r.data.findings : [];
      res.status(200).json({
        findings: skipFindings.concat(cloudFindings),
        scannedItemCodes: requestedCodes,
        scannedAt: new Date().toISOString(),
      });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "安全扫描请求失败" } });
    }
  });

  // 异步扫描 Runs：用于进度轮询 + 历史记录
  app.get("/api/security-scan/runs", async (_req, res) => {
    try {
      const { apiBase, headers } = await cloudAxiosConfig();
      if (!headers.Authorization) {
        res.status(401).json({
          error: {
            code: "security_scan_login_history",
            message: "请先登录云端账户后再查看扫描历史。",
          },
        });
        return;
      }
      const url = `${apiBase}/api/security-scan/runs`;
      const r = await axios.get(url, { headers, validateStatus: () => true });
      res.status(r.status).json(r.data);
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "获取扫描历史失败" } });
    }
  });

  app.get("/api/security-scan/runs/:id", async (req, res) => {
    try {
      const id = String(req.params.id || "").trim();
      const { apiBase, headers } = await cloudAxiosConfig();
      if (!headers.Authorization) {
        res.status(401).json({
          error: {
            code: "security_scan_login_run_detail",
            message: "请先登录云端账户后再查看扫描记录。",
          },
        });
        return;
      }
      const url = `${apiBase}/api/security-scan/runs/${encodeURIComponent(id)}`;
      const r = await axios.get(url, { headers, validateStatus: () => true });
      res.status(r.status).json(r.data);
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "获取扫描记录失败" } });
    }
  });

  app.post("/api/security-scan/runs", async (req, res) => {
    try {
      const body = req.body || {};
      const baseContext = body.context != null ? String(body.context) : "";
      const requestedCodes = Array.isArray(body.itemCodes) ? body.itemCodes.map((c) => String(c)) : [];
      const locale = body.locale != null ? String(body.locale).trim() : "";

      const privacy = await getSecurityScanPrivacy();
      const historyCodes = requestedCodes.filter((c) => c && c.startsWith(HISTORY_PREFIX));
      const systemCodes = requestedCodes.filter((c) => c && !c.startsWith(HISTORY_PREFIX));

      const allowedHistoryCodes = privacy.shareHistoryEnabled ? historyCodes : [];
      const allowedSystemCodes = privacy.consentSystemConfigEnabled ? systemCodes : [];

      const allowedCodesForCloud = allowedHistoryCodes.concat(allowedSystemCodes);
      if (allowedCodesForCloud.length === 0) {
        res.status(400).json({ error: { message: "没有可执行的扫描项（请检查隐私授权设置）" } });
        return;
      }

      // 执行云端扫描前：需要云端鉴权
      const { apiBase, headers } = await cloudAxiosConfig();
      if (!headers.Authorization) {
        res.status(401).json({
          error: {
            code: "security_scan_login_scan",
            message: "请先登录云端账户后再执行安全扫描。",
          },
        });
        return;
      }

      // 构建最终上传 context（按同意选择填充）
      const parts = [];

      if (allowedHistoryCodes.length > 0) {
        const turns = await listRecentConversationTurns(10, 12000);
        const historyBlock =
          turns.length === 0
            ? "【历史对话】（无可用共享对话记录）"
            : `【历史对话】\n${turns
                .map((t) => {
                  const user = redactSecretLikeText(t.userText);
                  const assistant = redactSecretLikeText(t.assistantText);
                  return `[${t.createdAt}]\n用户：${user}\n助手：${assistant}`;
                })
                .join("\n\n")}`;
        parts.push(historyBlock);
      }

      if (allowedSystemCodes.length > 0) {
        const localSettings = await getLocalSettings();
        const openclawCfg = (() => {
          try {
            const { readOpenClawConfig, getOpenClawConfigPath } = require("./server/openclaw-config.js");
            const cfg = readOpenClawConfig();
            return { config: cfg || {}, configPath: typeof getOpenClawConfigPath === "function" ? getOpenClawConfigPath() : "" };
          } catch {
            return { config: {}, configPath: "" };
          }
        })();

        const picked = {
          openclaw: {
            configPath: openclawCfg.configPath || "",
            gateway: openclawCfg.config?.gateway || {},
            models: openclawCfg.config?.models || {},
            agents: openclawCfg.config?.agents || {},
            commands: openclawCfg.config?.commands || {},
          },
          local_settings: {
            apiBase: localSettings?.apiBase || "",
            ocApiKey: localSettings?.ocApiKey || "",
            llmKey: localSettings?.llmKey || "",
          },
        };

        const redacted = redactSecretsDeep(picked);
        const configJson = truncateStr(JSON.stringify(redacted, null, 2), 45000);
        parts.push(`【本机AI配置（脱敏）】\n${configJson}`);
      }

      const finalContext = [baseContext.trim(), ...parts].filter(Boolean).join("\n\n");
      const url = `${apiBase}/api/security-scan/runs`;

      const r = await axios.post(
        url,
        {
          itemCodes: allowedCodesForCloud,
          context: finalContext,
          clientOs: process.platform || "",
          locale,
        },
        {
          headers: { ...headers, "Content-Type": "application/json" },
          validateStatus: () => true,
        }
      );

      res.status(r.status).json(r.data);
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "创建扫描任务失败" } });
    }
  });
}

function getClientId() {
  const hostname = os.hostname();
  return `desktop-${hostname}`;
}

async function getLocalStatus() {
  const db = getDb();
  const counts = {
    danger: 0,
    disabled: 0,
    deprecated: 0,
  };
  await new Promise((resolve) => {
    db.serialize(() => {
      db.get("SELECT COUNT(1) AS c FROM danger_commands", (err, row) => {
        counts.danger = err ? 0 : row?.c ?? 0;
      });
      db.get("SELECT COUNT(1) AS c FROM disabled_skills", (err, row) => {
        counts.disabled = err ? 0 : row?.c ?? 0;
      });
      db.get("SELECT COUNT(1) AS c FROM deprecated_skills", (err, row) => {
        counts.deprecated = err ? 0 : row?.c ?? 0;
      });
      resolve();
    });
  });
  const auth = await getLocalAuth();
  const llmRouteMode = await getLlmRouteMode();
  const platform = process.platform || "";
  let platformLabel = "未知";
  if (platform === "win32") platformLabel = "Windows";
  else if (platform === "darwin") platformLabel = "macOS";
  else if (platform) platformLabel = platform;
  return { ...counts, auth, llmRouteMode, platform, platformLabel };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });

  const clientId = getClientId();
  console.log(`ClawHeart local desktop proxy starting on port ${PORT}, clientId=${clientId}`);

  getDb();

  app.get("/api/status", async (_req, res) => {
    try {
      const { danger, disabled, deprecated, auth, llmRouteMode, platform, platformLabel } = await getLocalStatus();
      const settings = await getLocalSettings();
      res.status(200).json({
        danger,
        disabled,
        deprecated,
        auth,
        settings,
        llmRouteMode,
        platform,
        platformLabel,
      });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "读取本地状态失败" } });
    }
  });

  app.get("/api/sync-status", (req, res) => {
    const type = req.query.type === "skills" ? "skills" : "danger";
    res.status(200).json(syncState[type]);
  });

  registerOpenClawRoutes(app);
  registerAuthRoutes(app);
  registerSettingsRoutes(app);
  registerDangerRoutes(app);
  registerSkillsRoutes(app);
  registerInterceptLogsRoutes(app);
  registerProxyRequestLogsRoutes(app);
  registerTokenUsageRoutes(app);
  registerSecurityScanRoutes(app);
  registerAgentMgmtRoutes(app);
  registerBudgetRoutes(app);

  app.post(/^(?!\/api\/).+$/, forwardChatCompletions);

  app.listen(PORT, () => {
    console.log(`ClawHeart local desktop proxy listening at http://127.0.0.1:${PORT}`);
  });
}

module.exports = {
  startServer,
};
