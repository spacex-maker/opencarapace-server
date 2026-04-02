const express = require("express");
const os = require("os");
const { getDb, getLocalSettings, getLocalAuth, getLlmRouteMode } = require("./db.js");
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

  app.get("/api/security-scan/items", async (_req, res) => {
    try {
      const { apiBase, headers } = await cloudAxiosConfig();
      if (!headers.Authorization) {
        res.status(401).json({ error: { message: "请先登录云端账户后再获取安全扫描项。" } });
        return;
      }
      const url = `${apiBase}/api/security-scan/items`;
      const r = await axios.get(url, { headers, validateStatus: () => true });
      res.status(r.status).json(r.data);
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "获取安全扫描项失败" } });
    }
  });

  app.post("/api/security-scan/ai-run", async (req, res) => {
    try {
      const { apiBase, headers } = await cloudAxiosConfig();
      if (!headers.Authorization) {
        res.status(401).json({ error: { message: "请先登录云端账户后再执行安全扫描。" } });
        return;
      }
      const url = `${apiBase}/api/security-scan/ai-run`;
      const r = await axios.post(url, req.body || {}, {
        headers: { ...headers, "Content-Type": "application/json" },
        validateStatus: () => true,
      });
      res.status(r.status).json(r.data);
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "安全扫描请求失败" } });
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
  return { ...counts, auth, llmRouteMode };
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
      const { danger, disabled, deprecated, auth, llmRouteMode } = await getLocalStatus();
      const settings = await getLocalSettings();
      res.status(200).json({
        danger,
        disabled,
        deprecated,
        auth,
        settings,
        llmRouteMode,
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
