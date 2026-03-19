const axios = require("axios");
const { getDb, getLocalSettings, getLocalAuth, upsertUserSkill, upsertUserSkillSafetyLabel, getSyncUserSkillsToCloud } = require("../db.js");
const { syncSystemSkillsStatusFromServer, syncUserSkillsFromServer, syncDangerCommandsFromServer, syncUserDangerCommandsFromServer } = require("../sync.js");
const { syncState, startSkillsProgress, finishSkillsProgress, updateDangerProgress, finishDangerProgress } = require("./sync-state.js");

function registerSkillsRoutes(app) {
  app.get("/api/skills", (req, res) => {
    const { keyword, systemStatus, userEnabled } = req.query || {};
    const db = getDb();
    db.serialize(() => {
      db.all("SELECT id, slug, name, type, category, status, short_desc, source_name, safe_mark_count, unsafe_mark_count, user_safety_label FROM skills", (err0, skillRows = []) => {
        if (err0) {
          res.status(500).json({ error: { message: err0.message || "读取 skills 失败" } });
          return;
        }
        db.all("SELECT slug, enabled FROM user_skills", (err3, userRows = []) => {
          if (err3) {
            res.status(500).json({ error: { message: err3.message || "读取 user_skills 失败" } });
            return;
          }
          const userMap = new Map(userRows.map((r) => [r.slug, r.enabled]));
          let items = skillRows.map((r) => {
            let systemStatus = "NORMAL";
            if (r.status === "DISABLED") systemStatus = "DISABLED";
            else if (r.status === "DEPRECATED") systemStatus = "DEPRECATED";
            const userEnabled = userMap.has(r.slug) ? userMap.get(r.slug) : 1;
            return {
              id: r.id,
              slug: r.slug,
              name: r.name || null,
              type: r.type || null,
              category: r.category || null,
              systemStatus,
              shortDesc: r.short_desc || null,
              userEnabled,
              sourceName: r.source_name || null,
              safeMarkCount: Number(r.safe_mark_count || 0),
              unsafeMarkCount: Number(r.unsafe_mark_count || 0),
              userSafetyLabel: r.user_safety_label || null,
            };
          });

          if (typeof keyword === "string" && keyword.trim()) {
            const k = keyword.trim().toLowerCase();
            items = items.filter((it) => String(it.slug || "").toLowerCase().includes(k));
          }
          if (typeof systemStatus === "string" && systemStatus.trim()) {
            const s = systemStatus.trim().toUpperCase();
            items = items.filter((it) => it.systemStatus === s);
          }
          if (userEnabled === "1") {
            items = items.filter((it) => it.userEnabled === 1 || it.userEnabled === true || it.userEnabled === null);
          } else if (userEnabled === "0") {
            items = items.filter((it) => it.userEnabled === 0 || it.userEnabled === false);
          }

          res.status(200).json({ items });
        });
      });
    });
  });

  app.get("/api/skills/detail/:slug", async (req, res) => {
    try {
      const slug = req.params.slug;
      const db = getDb();
      const row = await new Promise((resolve) => {
        db.get("SELECT id FROM skills WHERE slug = ?", [slug], (err, r) => {
          if (err || !r) resolve(null);
          else resolve(r);
        });
      });
      if (!row || !row.id) {
        res.status(404).json({ error: { message: "本地未找到该 skill" } });
        return;
      }
      const settings = await getLocalSettings();
      const auth = await getLocalAuth();
      const apiBase = (settings && settings.apiBase) || "https://api.clawheart.live";
      const headers = {
        "Content-Type": "application/json",
        "X-OC-API-KEY": settings && settings.ocApiKey,
      };
      if (auth && auth.token) {
        headers.Authorization = `Bearer ${auth.token}`;
      }
      const url = `${apiBase}/api/skills/${row.id}`;
      const upstreamRes = await axios.get(url, { headers, validateStatus: () => true });
      res.status(upstreamRes.status).json(upstreamRes.data);
    } catch (e) {
      console.error("local desktop skill detail error", e);
      res.status(500).json({ error: { message: "读取 skill 详情失败" } });
    }
  });

  app.post("/api/skills/sync", async (req, res) => {
    try {
      const settings = await getLocalSettings();
      const apiKey = settings && settings.ocApiKey;
      if (!apiKey) {
        res.status(400).json({ error: { message: "本地尚未配置 OC API Key" } });
        return;
      }
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
      res.status(202).json({ accepted: true });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "触发 Skills 同步失败" } });
    }
  });

  app.post("/api/skills/clear", async (_req, res) => {
    try {
      const db = getDb();
      await new Promise((resolve, reject) => {
        db.serialize(() => {
          db.run("DELETE FROM skills");
          db.run("DELETE FROM user_skills");
          db.run("DELETE FROM user_skill_safety_labels");
          db.run("DELETE FROM disabled_skills");
          db.run("DELETE FROM deprecated_skills", (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });
      syncState.skills = { running: false, total: 0, synced: 0 };
      res.status(200).json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "清空本地 skills 数据失败" } });
    }
  });

  app.put("/api/user-skills/:slug", async (req, res) => {
    try {
      const slug = req.params.slug;
      const { enabled } = req.body || {};
      if (typeof enabled !== "boolean") {
        res.status(400).json({ error: { message: "enabled 必须是 boolean" } });
        return;
      }

      await upsertUserSkill(slug, enabled);

      const syncToCloud = await getSyncUserSkillsToCloud();
      if (syncToCloud === 1) {
        try {
          const settings = await getLocalSettings();
          const auth = await getLocalAuth();
          const apiBase = (settings && settings.apiBase) || "https://api.clawheart.live";
          if (auth && auth.token) {
            await axios.put(
              `${apiBase}/api/user-skills/me/${encodeURIComponent(slug)}`,
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
      res.status(500).json({ error: { message: e?.message ?? "更新用户技能失败" } });
    }
  });

  app.put("/api/user-skills/:slug/safety-label", async (req, res) => {
    try {
      const slug = req.params.slug;
      const { label } = req.body || {};
      if (label !== "SAFE" && label !== "UNSAFE") {
        res.status(400).json({ error: { message: "label 必须是 SAFE 或 UNSAFE" } });
        return;
      }

      const db = getDb();
      const current = await new Promise((resolve) => {
        db.get("SELECT user_safety_label, safe_mark_count, unsafe_mark_count FROM skills WHERE slug = ?", [slug], (_e, row) => resolve(row || null));
      });
      if (!current) {
        res.status(404).json({ error: { message: "技能不存在" } });
        return;
      }

      const prev = current.user_safety_label || null;
      const safe = Number(current.safe_mark_count || 0);
      const unsafe = Number(current.unsafe_mark_count || 0);
      const nextSafe = safe + (label === "SAFE" ? 1 : 0) - (prev === "SAFE" ? 1 : 0);
      const nextUnsafe = unsafe + (label === "UNSAFE" ? 1 : 0) - (prev === "UNSAFE" ? 1 : 0);
      await new Promise((resolve, reject) => {
        db.run(
          "UPDATE skills SET user_safety_label = ?, safe_mark_count = ?, unsafe_mark_count = ? WHERE slug = ?",
          [label, Math.max(0, nextSafe), Math.max(0, nextUnsafe), slug],
          (err) => (err ? reject(err) : resolve())
        );
      });
      await upsertUserSkillSafetyLabel(slug, label);

      const syncToCloud = await getSyncUserSkillsToCloud();
      if (syncToCloud === 1) {
        try {
          const settings = await getLocalSettings();
          const auth = await getLocalAuth();
          const apiBase = (settings && settings.apiBase) || "https://api.clawheart.live";
          if (auth && auth.token) {
            await axios.put(
              `${apiBase}/api/user-skills/me/${encodeURIComponent(slug)}/safety-label`,
              { label },
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
      res.status(500).json({ error: { message: e?.message ?? "更新用户技能打标失败" } });
    }
  });

  app.post("/api/user-settings/sync", async (req, res) => {
    try {
      const settings = await getLocalSettings();
      const apiKey = settings && settings.ocApiKey;
      if (!apiKey) {
        res.status(400).json({ error: { message: "本地尚未配置 OC API Key" } });
        return;
      }
      
      startSkillsProgress();
      syncState.danger = { running: true, total: 0, synced: 0 };

      Promise.all([
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
          .catch(() => finishSkillsProgress(syncState.skills.total, syncState.skills.synced)),
        
        syncDangerCommandsFromServer(String(apiKey), (p) => {
          syncState.danger = {
            running: true,
            total: typeof p.total === "number" ? p.total : syncState.danger.total,
            synced: typeof p.synced === "number" ? p.synced : syncState.danger.synced,
          };
        })
          .then((p) =>
            syncUserDangerCommandsFromServer(String(apiKey)).then(() => finishDangerProgress(p))
          )
          .catch(() => finishDangerProgress({ total: syncState.danger.total, synced: syncState.danger.synced })),
      ]);

      res.status(202).json({ accepted: true });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "同步失败" } });
    }
  });
}

module.exports = {
  registerSkillsRoutes,
};
