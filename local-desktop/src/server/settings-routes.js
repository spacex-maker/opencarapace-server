const axios = require("axios");
const {
  getLocalSettings,
  saveLocalSettings,
  getLocalAuth,
  getLlmRouteMode,
  saveLlmRouteMode,
  listLlmMappings,
  upsertLlmMapping,
  deleteLlmMapping,
  getSyncUserSkillsToCloud,
  saveSyncUserSkillsToCloud,
  getSyncUserDangersToCloud,
  saveSyncUserDangersToCloud,
  getLastKnownVersion,
  saveLastKnownVersion,
} = require("../db.js");

function registerSettingsRoutes(app) {
  app.post("/api/settings", async (req, res) => {
    try {
      const { apiBase, ocApiKey, llmKey } = req.body || {};
      if (!apiBase || !ocApiKey) {
        res.status(400).json({ error: { message: "apiBase / ocApiKey 均为必填项" } });
        return;
      }
      await saveLocalSettings({ apiBase: String(apiBase), ocApiKey: String(ocApiKey), llmKey: String(llmKey || "") });
      res.status(200).json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "保存设置失败" } });
    }
  });

  // 仅更新 apiBase（用于“测试模式”切换），避免前端还要携带 ocApiKey
  app.post("/api/settings/api-base", async (req, res) => {
    try {
      const { apiBase } = req.body || {};
      const nextApiBase = String(apiBase || "").trim();
      if (!nextApiBase) {
        res.status(400).json({ error: { message: "apiBase 为必填项" } });
        return;
      }
      const current = await getLocalSettings();
      await saveLocalSettings({
        apiBase: nextApiBase,
        ocApiKey: String(current?.ocApiKey || ""),
        llmKey: String(current?.llmKey || ""),
      });
      res.status(200).json({ ok: true, apiBase: nextApiBase });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "更新 apiBase 失败" } });
    }
  });

  app.get("/api/user-settings/llm-route-mode", async (_req, res) => {
    try {
      const mode = await getLlmRouteMode();
      res.status(200).json({ llmRouteMode: mode });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "读取 LLM 路由模式失败" } });
    }
  });

  app.post("/api/user-settings/llm-route-mode", async (req, res) => {
    try {
      const { llmRouteMode } = req.body || {};
      if (llmRouteMode !== "DIRECT" && llmRouteMode !== "GATEWAY") {
        res.status(400).json({ error: { message: "llmRouteMode 必须是 DIRECT 或 GATEWAY" } });
        return;
      }
      await saveLlmRouteMode(llmRouteMode);

      try {
        const settings = await getLocalSettings();
        const auth = await getLocalAuth();
        const apiBase = (settings && settings.apiBase) || "https://api.clawheart.live";
        if (auth && auth.token) {
          await axios.put(
            `${apiBase}/api/user-settings/me/llm-route-mode`,
            { llmRouteMode },
            {
              headers: { Authorization: `Bearer ${auth.token}` },
              validateStatus: () => true,
            }
          );
        }
      } catch {
        // ignore sync failure
      }

      res.status(200).json({ llmRouteMode });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "更新 LLM 路由模式失败" } });
    }
  });

  app.get("/api/user-settings/check-version", async (_req, res) => {
    try {
      const settings = await getLocalSettings();
      const auth = await getLocalAuth();
      const apiBase = (settings && settings.apiBase) || "https://api.clawheart.live";
      if (!auth || !auth.token) {
        res.status(200).json({ needSync: false, cloudVersion: null, localVersion: null });
        return;
      }

      const cloudRes = await axios.get(`${apiBase}/api/user-settings/version`, {
        headers: { Authorization: `Bearer ${auth.token}` },
        validateStatus: () => true,
      });

      if (cloudRes.status !== 200 || !cloudRes.data || typeof cloudRes.data.combinedVersion !== "number") {
        res.status(200).json({ needSync: false, cloudVersion: null, localVersion: null });
        return;
      }

      const cloudVersion = cloudRes.data.combinedVersion;
      const localVersion = await getLastKnownVersion();

      if (cloudVersion > localVersion) {
        res.status(200).json({ needSync: true, cloudVersion, localVersion });
      } else {
        res.status(200).json({ needSync: false, cloudVersion, localVersion });
      }
    } catch (e) {
      res.status(200).json({ needSync: false, cloudVersion: null, localVersion: null });
    }
  });

  app.post("/api/user-settings/update-local-version", async (req, res) => {
    try {
      const { version } = req.body || {};
      if (typeof version !== "number") {
        res.status(400).json({ error: { message: "version 必须是数字" } });
        return;
      }
      await saveLastKnownVersion(version);
      res.status(200).json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "更新版本号失败" } });
    }
  });

  app.get("/api/user-settings/sync-user-skills-to-cloud", async (_req, res) => {
    try {
      const value = await getSyncUserSkillsToCloud();
      res.status(200).json({ syncUserSkillsToCloud: value === 1 });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "读取同步开关失败" } });
    }
  });

  app.post("/api/user-settings/sync-user-skills-to-cloud", async (req, res) => {
    try {
      const { syncUserSkillsToCloud } = req.body || {};
      await saveSyncUserSkillsToCloud(syncUserSkillsToCloud === true);
      res.status(200).json({ syncUserSkillsToCloud: syncUserSkillsToCloud === true });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "更新同步开关失败" } });
    }
  });

  app.get("/api/user-settings/sync-user-dangers-to-cloud", async (_req, res) => {
    try {
      const value = await getSyncUserDangersToCloud();
      res.status(200).json({ syncUserDangersToCloud: value === 1 });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "读取同步开关失败" } });
    }
  });

  app.post("/api/user-settings/sync-user-dangers-to-cloud", async (req, res) => {
    try {
      const { syncUserDangersToCloud } = req.body || {};
      await saveSyncUserDangersToCloud(syncUserDangersToCloud === true);
      res.status(200).json({ syncUserDangersToCloud: syncUserDangersToCloud === true });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "更新同步开关失败" } });
    }
  });

  app.get("/api/llm-mappings", async (_req, res) => {
    try {
      const rows = await listLlmMappings();
      res.status(200).json({ items: rows });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "读取网络映射配置失败" } });
    }
  });

  app.post("/api/llm-mappings", async (req, res) => {
    try {
      const { prefix, targetBase } = req.body || {};
      const p = (prefix || "").trim();
      const t = (targetBase || "").trim();
      if (!p || !t) {
        res.status(400).json({ error: { message: "prefix 与 targetBase 均为必填项" } });
        return;
      }
      await upsertLlmMapping({ prefix: p, target_base: t });
      const rows = await listLlmMappings();
      res.status(200).json({ items: rows });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "保存网络映射配置失败" } });
    }
  });

  app.delete("/api/llm-mappings/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id || Number.isNaN(id)) {
        res.status(400).json({ error: { message: "id 无效" } });
        return;
      }
      await deleteLlmMapping(id);
      const rows = await listLlmMappings();
      res.status(200).json({ items: rows });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "删除网络映射配置失败" } });
    }
  });

  // 云端映射配置代理：获取云端映射列表
  app.get("/api/cloud-llm-mappings", async (_req, res) => {
    try {
      const settings = await getLocalSettings();
      const auth = await getLocalAuth();
      const apiBase = (settings && settings.apiBase) || "https://api.clawheart.live";
      
      if (!auth || !auth.token) {
        res.status(401).json({ error: { message: "未登录" } });
        return;
      }

      const cloudRes = await axios.get(`${apiBase}/api/user-llm-mappings/me`, {
        headers: { Authorization: `Bearer ${auth.token}` },
        validateStatus: () => true,
      });

      if (cloudRes.status !== 200) {
        res.status(cloudRes.status).json(cloudRes.data || { error: { message: "获取云端映射失败" } });
        return;
      }

      res.status(200).json({ items: cloudRes.data || [] });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "获取云端映射失败" } });
    }
  });

  // 云端映射配置代理：创建或更新云端映射
  app.post("/api/cloud-llm-mappings", async (req, res) => {
    try {
      const { prefix, targetBase } = req.body || {};
      const p = (prefix || "").trim();
      const t = (targetBase || "").trim();
      if (!p || !t) {
        res.status(400).json({ error: { message: "prefix 与 targetBase 均为必填项" } });
        return;
      }

      const settings = await getLocalSettings();
      const auth = await getLocalAuth();
      const apiBase = (settings && settings.apiBase) || "https://api.clawheart.live";
      
      if (!auth || !auth.token) {
        res.status(401).json({ error: { message: "未登录" } });
        return;
      }

      const cloudRes = await axios.post(
        `${apiBase}/api/user-llm-mappings/me`,
        { prefix: p, targetBase: t },
        {
          headers: { Authorization: `Bearer ${auth.token}` },
          validateStatus: () => true,
        }
      );

      if (cloudRes.status !== 200) {
        res.status(cloudRes.status).json(cloudRes.data || { error: { message: "保存云端映射失败" } });
        return;
      }

      res.status(200).json(cloudRes.data);
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "保存云端映射失败" } });
    }
  });

  // 云端映射配置代理：删除云端映射
  app.delete("/api/cloud-llm-mappings/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id || Number.isNaN(id)) {
        res.status(400).json({ error: { message: "id 无效" } });
        return;
      }

      const settings = await getLocalSettings();
      const auth = await getLocalAuth();
      const apiBase = (settings && settings.apiBase) || "https://api.clawheart.live";
      
      if (!auth || !auth.token) {
        res.status(401).json({ error: { message: "未登录" } });
        return;
      }

      const cloudRes = await axios.delete(`${apiBase}/api/user-llm-mappings/me/${id}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
        validateStatus: () => true,
      });

      if (cloudRes.status !== 200) {
        res.status(cloudRes.status).json(cloudRes.data || { error: { message: "删除云端映射失败" } });
        return;
      }

      res.status(200).json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "删除云端映射失败" } });
    }
  });
}

module.exports = {
  registerSettingsRoutes,
};
