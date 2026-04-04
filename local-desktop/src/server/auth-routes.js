const axios = require("axios");
const {
  getLocalSettings,
  getLocalAuth,
  saveLocalAuth,
  clearLocalAuth,
  clearLocalUserScopedState,
  saveLlmRouteMode,
  ensureDefaultLlmMappings,
  saveLastKnownVersion,
} = require("../db.js");
const {
  syncDangerCommandsFromServer,
  syncSystemSkillsStatusFromServer,
  syncUserSkillsFromServer,
  syncUserDangerCommandsFromServer,
} = require("../sync.js");
const { updateDangerProgress, finishDangerProgress, startSkillsProgress, finishSkillsProgress, syncState } = require("./sync-state.js");
const { clearCachedDashboardUrl } = require("./openclaw-manager.js");

/**
 * 登录/注册上游成功后：写本地 token、同步 LLM 路由与危险/技能数据，并向渲染进程返回脱敏 JSON（不含 token）。
 */
async function finalizeAuthAfterUpstreamSuccess(res, data, emailFallback) {
  const email = emailFallback;
  if (!data.token) {
    res.status(500).json({ error: { message: "上游响应缺少 token" } });
    return;
  }
  const prevAuth = await getLocalAuth();
  const displayName =
    data.displayName != null && String(data.displayName).trim() ? String(data.displayName).trim() : null;
  await saveLocalAuth({
    email: data.email || email,
    token: data.token,
    displayName,
  });
  const currentEmail = String(data.email || email || "").trim().toLowerCase();
  const previousEmail = String(prevAuth?.email || "").trim().toLowerCase();
  const switchedUser = previousEmail && currentEmail && previousEmail !== currentEmail;
  if (switchedUser) {
    await clearLocalUserScopedState();
    await saveLastKnownVersion(0);
    clearCachedDashboardUrl();
  }

  try {
    await ensureDefaultLlmMappings();
  } catch {
    // ignore
  }

  try {
    const settings = await getLocalSettings();
    const apiBase = (settings && settings.apiBase) || "https://api.clawheart.live";
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
    const apiKey = settings && settings.ocApiKey ? String(settings.ocApiKey) : "";
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

    startSkillsProgress();
    syncSystemSkillsStatusFromServer(apiKey, (p) => {
      syncState.skills = {
        running: true,
        total: typeof p.total === "number" ? p.total : syncState.skills.total,
        synced: typeof p.synced === "number" ? p.synced : syncState.skills.synced,
      };
    })
      .then(({ totalSkills }) =>
        syncUserSkillsFromServer(apiKey).then(() => finishSkillsProgress(totalSkills, totalSkills))
      )
      .catch(() => finishSkillsProgress(syncState.skills.total, syncState.skills.synced));
  } catch {
    // ignore
  }

  res.status(200).json({
    email: data.email || email,
    displayName: displayName || undefined,
  });
}

function registerAuthRoutes(app) {
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        res.status(400).json({ error: { message: "email / password 均为必填项" } });
        return;
      }
      const settings = await getLocalSettings();
      const apiBase = settings && settings.apiBase ? String(settings.apiBase).replace(/\/+$/, "") : "https://api.clawheart.live";
      const url = `${apiBase}/api/auth/login`;
      const upstreamRes = await axios.post(url, { email, password }, { validateStatus: () => true });
      if (upstreamRes.status !== 200) {
        res.status(upstreamRes.status).json(upstreamRes.data || { error: { message: "登录失败" } });
        return;
      }
      await finalizeAuthAfterUpstreamSuccess(res, upstreamRes.data || {}, email);
    } catch (e) {
      console.error("local desktop auth login error", e);
      res.status(500).json({ error: { message: "本地登录失败" } });
    }
  });

  /** 与网页端同源：POST 云端 /api/auth/register，成功后与登录相同落盘与同步 */
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, displayName } = req.body || {};
      if (!email || !password) {
        res.status(400).json({ error: { message: "邮箱与密码均为必填项" } });
        return;
      }
      if (String(password).length < 6) {
        res.status(400).json({ error: { message: "密码至少 6 位" } });
        return;
      }
      const settings = await getLocalSettings();
      const apiBase = settings && settings.apiBase ? String(settings.apiBase).replace(/\/+$/, "") : "https://api.clawheart.live";
      const url = `${apiBase}/api/auth/register`;
      const payload = {
        email: String(email).trim(),
        password,
        displayName: displayName != null && String(displayName).trim() ? String(displayName).trim() : undefined,
      };
      const upstreamRes = await axios.post(url, payload, { validateStatus: () => true });
      if (upstreamRes.status !== 200 && upstreamRes.status !== 201) {
        const body = upstreamRes.data;
        const msg =
          body?.message ||
          body?.error?.message ||
          (typeof body === "string" ? body : null) ||
          "注册失败";
        res.status(upstreamRes.status >= 400 ? upstreamRes.status : 400).json({
          error: { message: String(msg) },
        });
        return;
      }
      await finalizeAuthAfterUpstreamSuccess(res, upstreamRes.data || {}, email);
    } catch (e) {
      console.error("local desktop auth register error", e);
      res.status(500).json({ error: { message: "本地注册失败" } });
    }
  });

  app.post("/api/auth/logout", async (_req, res) => {
    try {
      await clearLocalAuth();
      await clearLocalUserScopedState();
      await saveLastKnownVersion(0);
      clearCachedDashboardUrl();
      res.status(200).json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "退出登录失败" } });
    }
  });
}

module.exports = {
  registerAuthRoutes,
};
