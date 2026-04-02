const axios = require("axios");
const { getLocalSettings, getLocalAuth } = require("../db.js");

function registerInterceptLogsRoutes(app) {
  app.get("/api/intercept-logs", async (req, res) => {
    try {
      const settings = await getLocalSettings();
      const apiBaseRaw = (settings && settings.apiBase) || "https://api.clawheart.live";
      const apiBase = String(apiBaseRaw).replace(/\/+$/, "");

      const auth = await getLocalAuth().catch(() => null);
      if (!auth?.token) {
        res.status(401).json({ error: { message: "请先登录云端账户后再查看拦截监控。" } });
        return;
      }

      const params = new URLSearchParams();
      if (req.query.page) params.set("page", String(req.query.page));
      if (req.query.size) params.set("size", String(req.query.size));
      if (req.query.blockType) params.set("blockType", String(req.query.blockType));

      const url = `${apiBase}/api/safety/block-logs?${params.toString()}`;
      const headers = { Authorization: `Bearer ${auth.token}` };

      const upstream = await axios.get(url, { headers, validateStatus: () => true });
      res.status(upstream.status).json(upstream.data);
    } catch (e) {
      console.error("intercept logs proxy error", e);
      res.status(500).json({ error: { message: "读取拦截监控失败" } });
    }
  });

  app.get("/api/intercept-logs/:id", async (req, res) => {
    try {
      const settings = await getLocalSettings();
      const apiBaseRaw = (settings && settings.apiBase) || "https://api.clawheart.live";
      const apiBase = String(apiBaseRaw).replace(/\/+$/, "");
      const auth = await getLocalAuth().catch(() => null);
      if (!auth?.token) {
        res.status(401).json({ error: { message: "请先登录云端账户后再查看拦截监控。" } });
        return;
      }
      const id = encodeURIComponent(String(req.params.id || ""));
      const url = `${apiBase}/api/safety/block-logs/${id}`;
      const headers = { Authorization: `Bearer ${auth.token}` };
      const upstream = await axios.get(url, { headers, validateStatus: () => true });
      res.status(upstream.status).json(upstream.data);
    } catch (e) {
      console.error("intercept log detail proxy error", e);
      res.status(500).json({ error: { message: "读取拦截监控详情失败" } });
    }
  });
}

module.exports = {
  registerInterceptLogsRoutes,
};

