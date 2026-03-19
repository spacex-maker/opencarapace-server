const axios = require("axios");
const { getLocalSettings, getLocalAuth } = require("../db.js");

function registerTokenUsageRoutes(app) {
  app.get("/api/token-usages", async (req, res) => {
    try {
      const settings = await getLocalSettings();
      const apiBase = String(settings?.apiBase || "").replace(/\/+$/, "");
      const auth = await getLocalAuth().catch(() => null);
      if (!apiBase) {
        res.status(400).json({ error: { message: "未配置 API Base" } });
        return;
      }
      if (!auth?.token) {
        res.status(401).json({ error: { message: "请先登录云端账户后再查看 Token 账单。" } });
        return;
      }

      const params = new URLSearchParams();
      if (req.query.page) params.set("page", String(req.query.page));
      if (req.query.size) params.set("size", String(req.query.size));
      if (req.query.from) params.set("from", String(req.query.from));
      if (req.query.to) params.set("to", String(req.query.to));

      const url = `${apiBase}/api/billing/token-usages/me?${params.toString()}`;
      const headers = { Authorization: `Bearer ${auth.token}` };
      const upstream = await axios.get(url, { headers, validateStatus: () => true });
      res.status(upstream.status).json(upstream.data);
    } catch (e) {
      console.error("token usages proxy error", e);
      res.status(500).json({ error: { message: "读取 Token 账单失败" } });
    }
  });
}

module.exports = {
  registerTokenUsageRoutes,
};

