const axios = require("axios");
const { getLocalAuth, getLocalSettings } = require("../db.js");

async function getCloudConfig() {
  const settings = await getLocalSettings();
  const auth = await getLocalAuth();
  const apiBase = settings && settings.apiBase
    ? String(settings.apiBase).replace(/\/+$/, "")
    : "https://api.clawheart.live";
  const headers = { "Content-Type": "application/json" };
  if (auth && auth.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }
  return { apiBase, headers };
}

function registerTrackingRoutes(app) {
  app.post("/api/track/events", async (req, res) => {
    try {
      const body = req.body || {};
      if (!Array.isArray(body.events) || body.events.length === 0) {
        res.status(400).json({ error: { message: "events is required" } });
        return;
      }
      const { apiBase, headers } = await getCloudConfig();
      const url = `${apiBase}/api/track/events`;
      const response = await axios.post(url, body, {
        headers,
        validateStatus: () => true,
      });
      res.status(response.status).json(response.data);
    } catch (e) {
      res.status(500).json({ error: { message: e?.message || "track events failed" } });
    }
  });
}

module.exports = { registerTrackingRoutes };

