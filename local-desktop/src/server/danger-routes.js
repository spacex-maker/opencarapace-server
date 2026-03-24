const axios = require("axios");
const { getDb, getLocalSettings, updateUserDangerCommand, getLocalAuth, getSyncUserDangersToCloud } = require("../db.js");

async function requireLoginForCloudSync(res) {
  const auth = await getLocalAuth();
  if (!auth?.token) {
    res.status(401).json({ error: { message: "请先登录后再从云端同步危险指令库" } });
    return false;
  }
  return true;
}
const { syncDangerCommandsFromServer, syncUserDangerCommandsFromServer } = require("../sync.js");
const { syncState, updateDangerProgress, finishDangerProgress } = require("./sync-state.js");

function registerDangerRoutes(app) {
  app.get("/api/danger-commands", (req, res) => {
    const db = getDb();
    const { systemType, category, riskLevel, keyword, systemEnabled, userEnabled } = req.query || {};

    const where = [];
    const params = [];

    if (typeof systemType === "string" && systemType.trim()) {
      where.push("system_type = ?");
      params.push(systemType.trim());
    }
    if (typeof category === "string" && category.trim()) {
      where.push("category = ?");
      params.push(category.trim());
    }
    if (typeof riskLevel === "string" && riskLevel.trim()) {
      where.push("risk_level = ?");
      params.push(riskLevel.trim());
    }
    if (typeof keyword === "string" && keyword.trim()) {
      where.push("LOWER(command_pattern) LIKE ?");
      params.push(`%${keyword.trim().toLowerCase()}%`);
    }
    if (systemEnabled === "1") {
      where.push("enabled = 1");
    } else if (systemEnabled === "0") {
      where.push("enabled = 0");
    }
    if (userEnabled === "1") {
      where.push("(user_enabled IS NULL OR user_enabled = 1)");
    } else if (userEnabled === "0") {
      where.push("user_enabled = 0");
    }

    const sql =
      "SELECT id, command_pattern, system_type, category, risk_level, enabled, user_enabled FROM danger_commands" +
      (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
      " ORDER BY id";

    db.all(sql, params, (err, rows = []) => {
      if (err) {
        res.status(500).json({ error: { message: err.message || "读取危险指令库失败" } });
      } else {
        res.status(200).json({ items: rows });
      }
    });
  });

  app.get("/api/danger-commands/meta", async (_req, res) => {
    try {
      const settings = await getLocalSettings();
      const apiBase = (settings && settings.apiBase) || "https://api.clawheart.live";
      const url = `${apiBase}/api/danger-commands/meta`;
      const auth = await getLocalAuth();
      const headers = {};
      if (auth && auth.token) {
        headers.Authorization = `Bearer ${auth.token}`;
      }
      const upstreamRes = await axios.get(url, { headers, validateStatus: () => true });
      if (upstreamRes.status === 200 && upstreamRes.data) {
        res.status(200).json(upstreamRes.data);
        return;
      }
      res.status(200).json({
        systemTypes: ["LINUX", "WINDOWS", "DATABASE", "SHELL", "DOCKER", "KUBERNETES", "GIT", "OTHER"],
        categories: [
          "FILE_SYSTEM",
          "DATABASE",
          "NETWORK",
          "PROCESS",
          "PERMISSION",
          "CONTAINER",
          "VERSION_CONTROL",
          "OTHER",
        ],
        riskLevels: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
      });
    } catch (e) {
      res.status(200).json({
        systemTypes: ["LINUX", "WINDOWS", "DATABASE", "SHELL", "DOCKER", "KUBERNETES", "GIT", "OTHER"],
        categories: [
          "FILE_SYSTEM",
          "DATABASE",
          "NETWORK",
          "PROCESS",
          "PERMISSION",
          "CONTAINER",
          "VERSION_CONTROL",
          "OTHER",
        ],
        riskLevels: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
      });
    }
  });

  app.post("/api/danger-commands/sync", async (req, res) => {
    try {
      if (!(await requireLoginForCloudSync(res))) return;
      const settings = await getLocalSettings();
      const apiKey = (settings && settings.ocApiKey) ? String(settings.ocApiKey) : "";
      syncState.danger = { running: true, total: 0, synced: 0 };
      syncDangerCommandsFromServer(apiKey, updateDangerProgress)
        .then(async (p) => {
          try {
            await syncUserDangerCommandsFromServer(apiKey);
          } catch {
            // ignore
          }
          finishDangerProgress(p);
        })
        .catch(() => finishDangerProgress({ total: syncState.danger.total, synced: syncState.danger.synced }));
      res.status(202).json({ accepted: true });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "触发危险指令同步失败" } });
    }
  });

  app.put("/api/user-danger-commands/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id || Number.isNaN(id)) {
        res.status(400).json({ error: { message: "id 无效" } });
        return;
      }
      const { enabled } = req.body || {};
      if (typeof enabled !== "boolean") {
        res.status(400).json({ error: { message: "enabled 必须是 boolean" } });
        return;
      }

      await updateUserDangerCommand(id, enabled);

      const syncToCloud = await getSyncUserDangersToCloud();
      if (syncToCloud === 1) {
        try {
          const settings = await getLocalSettings();
          const auth = await getLocalAuth();
          const apiBase = (settings && settings.apiBase) || "https://api.clawheart.live";
          if (auth && auth.token) {
            await axios.put(
              `${apiBase}/api/user-danger-commands/me/${id}`,
              { enabled },
              {
                headers: { Authorization: `Bearer ${auth.token}` },
                validateStatus: () => true,
              }
            );
          }
        } catch {
          // ignore cloud sync failure
        }
      }

      res.status(200).json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "更新用户危险指令失败" } });
    }
  });
}

module.exports = {
  registerDangerRoutes,
};
