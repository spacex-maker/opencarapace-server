const axios = require("axios");
const {
  getLocalSettings,
  getLocalAuth,
  saveLocalAuth,
  clearLocalAuth,
  saveLlmRouteMode,
  ensureDefaultLlmMappings,
} = require("../db.js");
const {
  syncDangerCommandsFromServer,
  syncSystemSkillsStatusFromServer,
  syncUserSkillsFromServer,
  syncUserDangerCommandsFromServer,
} = require("../sync.js");
const { updateDangerProgress, finishDangerProgress, startSkillsProgress, finishSkillsProgress, syncState } = require("./sync-state.js");

function registerAuthRoutes(app) {
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        res.status(400).json({ error: { message: "email / password 均为必填项" } });
        return;
      }
      const url = "http://localhost:8080/api/auth/login";
      const upstreamRes = await axios.post(url, { email, password }, { validateStatus: () => true });
      if (upstreamRes.status !== 200) {
        res.status(upstreamRes.status).json(upstreamRes.data || { error: { message: "登录失败" } });
        return;
      }
      const data = upstreamRes.data || {};
      if (!data.token) {
        res.status(500).json({ error: { message: "登录响应缺少 token" } });
        return;
      }
      await saveLocalAuth({
        email: data.email || email,
        token: data.token,
      });

      try {
        await ensureDefaultLlmMappings();
      } catch {
        // ignore
      }

      try {
        const settings = await getLocalSettings();
        const apiBase = (settings && settings.apiBase) || "http://localhost:8080";
        const routeRes = await axios.get(`${apiBase}/api/user-settings/me`, {
          headers: {
            Authorization: `Bearer ${data.token}`,
          },
          validateStatus: () => true,
        });
        if (routeRes.status === 200 && routeRes.data && routeRes.data.llmRouteMode) {
          await saveLlmRouteMode(routeRes.data.llmRouteMode);
        } else {
          await saveLlmRouteMode("GATEWAY");
        }
      } catch {
        // ignore
      }

      try {
        const settings = await getLocalSettings();
        const apiKey = settings && settings.ocApiKey;
        if (apiKey) {
          syncState.danger = { running: true, total: 0, synced: 0 };
          syncDangerCommandsFromServer(String(apiKey), updateDangerProgress)
            .then(async (p) => {
              try {
                await syncUserDangerCommandsFromServer(String(apiKey));
              } catch {
                // ignore
              }
              finishDangerProgress(p);
            })
            .catch(() => finishDangerProgress({ total: syncState.danger.total, synced: syncState.danger.synced }));

          startSkillsProgress();
          syncSystemSkillsStatusFromServer(String(apiKey), (p) => {
            syncState.skills = {
              running: true,
              total: typeof p.total === "number" ? p.total : syncState.skills.total,
              synced: typeof p.synced === "number" ? p.synced : syncState.skills.synced,
            };
          })
            .then(({ totalSkills }) =>
              syncUserSkillsFromServer(String(apiKey)).then(() => finishSkillsProgress(totalSkills, totalSkills))
            )
            .catch(() => finishSkillsProgress(syncState.skills.total, syncState.skills.synced));
        }
      } catch {
        // ignore
      }
      res.status(200).json({
        email: data.email || email,
      });
    } catch (e) {
      console.error("local desktop auth login error", e);
      res.status(500).json({ error: { message: "本地登录失败" } });
    }
  });

  app.post("/api/auth/logout", async (_req, res) => {
    try {
      await clearLocalAuth();
      res.status(200).json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "退出登录失败" } });
    }
  });
}

module.exports = {
  registerAuthRoutes,
};
