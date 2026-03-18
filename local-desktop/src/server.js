const express = require("express");
const axios = require("axios");
const os = require("os");
const {
  getDb,
  getLocalSettings,
  saveLocalSettings,
  getLocalAuth,
  saveLocalAuth,
  saveLlmRouteMode,
  getLlmRouteMode,
  listLlmMappings,
  upsertLlmMapping,
  deleteLlmMapping,
} = require("./db.js");
const {
  syncDangerCommandsFromServer,
  syncSystemSkillsStatusFromServer,
  syncUserSkillsFromServer,
  syncUserDangerCommandsFromServer,
} = require("./sync.js");

// 避开 Ollama 等常用端口（例如 11434），使用自定义端口
const PORT = 19111;

const syncState = {
  danger: { running: false, total: 0, synced: 0 },
  skills: { running: false, total: 0, synced: 0 },
};

function updateDangerProgress(p) {
  syncState.danger = {
    running: true,
    total: typeof p.total === "number" ? p.total : syncState.danger.total,
    synced: typeof p.synced === "number" ? p.synced : syncState.danger.synced,
  };
}

function finishDangerProgress(p) {
  syncState.danger = {
    running: false,
    total: typeof p.total === "number" ? p.total : syncState.danger.total,
    synced: typeof p.synced === "number" ? p.synced : syncState.danger.synced,
  };
}

function startSkillsProgress() {
  syncState.skills = { running: true, total: 0, synced: 0 };
}

function finishSkillsProgress(total, synced) {
  syncState.skills = {
    running: false,
    total: total ?? synced ?? 0,
    synced: synced ?? total ?? 0,
  };
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

async function forwardChatCompletions(req, res) {
  try {
    const settings = await getLocalSettings();
    if (!settings) {
      res
        .status(500)
        .json({ error: { message: "本地客户端尚未配置后端地址与密钥，请先在设置页完成配置。" } });
      return;
    }

    const skillsHeader = req.headers["x-oc-skills"] || req.headers["X-OC-SKILLS"];
    const skillSlugs =
      typeof skillsHeader === "string"
        ? skillsHeader
            .split(/[,\s]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : Array.isArray(skillsHeader)
        ? skillsHeader
            .join(",")
            .split(/[,\s]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

    const db = getDb();

    if (skillSlugs.length > 0) {
      const placeholders = skillSlugs.map(() => "?").join(",");

      const systemDisabled = await new Promise((resolve) => {
        db.all(
          `SELECT slug FROM disabled_skills WHERE slug IN (${placeholders})`,
          skillSlugs,
          (_err, rows = []) => {
            resolve(rows.map((r) => r.slug));
          }
        );
      });

      const userDisabled = await new Promise((resolve) => {
        db.all(
          `SELECT slug FROM user_skills WHERE enabled = 0 AND slug IN (${placeholders})`,
          skillSlugs,
          (_err, rows = []) => {
            resolve(rows.map((r) => r.slug));
          }
        );
      });

      const disabledHits = Array.from(new Set([...systemDisabled, ...userDisabled]));

      if (disabledHits.length > 0) {
        res.status(403).json({
          error: {
            type: "skill_disabled",
            message: "请求中包含被禁用的技能（系统或用户设置），已在本地被拦截。",
            skills: disabledHits,
          },
        });
        return;
      }

      const deprecatedHits = await new Promise((resolve) => {
        db.all(
          `SELECT slug FROM deprecated_skills WHERE slug IN (${placeholders})`,
          skillSlugs,
          (_err, rows = []) => {
            resolve(rows.map((r) => r.slug));
          }
        );
      });

      if (deprecatedHits.length > 0) {
        req._ocSkillWarnings = {
          deprecatedSkills: deprecatedHits,
        };
      }
    }

    const body = req.body || {};
    let combinedText = "";
    if (Array.isArray(body.messages)) {
      combinedText = body.messages
        .map((m) => (typeof m?.content === "string" ? m.content : ""))
        .filter(Boolean)
        .join("\n");
    } else if (typeof body.prompt === "string") {
      combinedText = body.prompt;
    }

    if (combinedText) {
      const dangerRows = await new Promise((resolve) => {
        db.all(
          "SELECT id, command_pattern, enabled FROM danger_commands WHERE enabled = 1",
          (_err, rows = []) => resolve(rows)
        );
      });

      const textLower = combinedText.toLowerCase();
      const hitRules = dangerRows.filter((r) => {
        const p = (r.command_pattern || "").trim();
        if (!p) return false;
        return textLower.includes(p.toLowerCase());
      });

      if (hitRules.length > 0) {
        res.status(403).json({
          error: {
            type: "danger_command_blocked",
            message: "本地危险指令规则命中，已阻断请求。",
            ruleIds: hitRules.map((r) => r.id),
            patterns: hitRules.map((r) => r.command_pattern),
          },
        });
        return;
      }
    }

    // 解析路径与前缀，用于自定义转发映射；不强行限定具体 path
    const originalPath = req.path || "/";
    const segments = originalPath.split("/").filter(Boolean);

    const llmRouteMode = await getLlmRouteMode();

    let upstreamUrl;
    let headers;

    // 先尝试命中自定义前缀映射（例如 /deepseek/...）
    if (segments.length > 0) {
      const mappings = await listLlmMappings();
      const hit = mappings.find((m) => m.prefix === segments[0]);
      if (hit) {
        const base = String(hit.target_base || "").replace(/\/+$/, "");
        const restPath = "/" + segments.slice(1).join("/");
        const tail = restPath === "/" ? "/" : restPath; // 保持用户自定义 path，不做强制限制
        upstreamUrl = base + tail;
        headers = {
          "Content-Type": "application/json",
          Authorization: settings.llmKey.startsWith("Bearer ")
            ? settings.llmKey
            : `Bearer ${settings.llmKey}`,
        };
      }
    }

    if (!upstreamUrl) {
      if (llmRouteMode === "DIRECT") {
        // 直接连接上游 LLM：使用 API Base + 上游 LLM Key，path 完全由用户决定
        const base = String(settings.apiBase || "").replace(/\/+$/, "");
        const tail = originalPath || "/";
        upstreamUrl = base + tail;
        headers = {
          "Content-Type": "application/json",
          Authorization: settings.llmKey.startsWith("Bearer ")
            ? settings.llmKey
            : `Bearer ${settings.llmKey}`,
        };
      } else {
        // 默认：走云端 ClawHeart 网关（此处仍使用固定后端路径）
        upstreamUrl = `${settings.apiBase}/api/llm/v1/chat/completions`;
        headers = {
          "Content-Type": "application/json",
          "X-OC-API-KEY": settings.ocApiKey,
          Authorization: settings.llmKey.startsWith("Bearer ")
            ? settings.llmKey
            : `Bearer ${settings.llmKey}`,
        };
      }
    }

    const upstreamRes = await axios.post(upstreamUrl, req.body, {
      headers,
      validateStatus: () => true,
    });
    res.status(upstreamRes.status).set("Content-Type", "application/json").send(upstreamRes.data);
  } catch (e) {
    console.error("local desktop proxy error", e);
    res.status(500).json({ error: { message: "本地代理转发失败" } });
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  // 简单 CORS 处理，避免前端预检 OPTIONS 返回 404
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
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

  // 同步进度查询
  app.get("/api/sync-status", (req, res) => {
    const type = req.query.type === "skills" ? "skills" : "danger";
    res.status(200).json(syncState[type]);
  });

  // 用户级 LLM 路由模式：本地读取
  app.get("/api/user-settings/llm-route-mode", async (_req, res) => {
    try {
      const mode = await getLlmRouteMode();
      res.status(200).json({ llmRouteMode: mode });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "读取 LLM 路由模式失败" } });
    }
  });

  // 用户级 LLM 路由模式：本地更新 + 尝试同步到云端
  app.post("/api/user-settings/llm-route-mode", async (req, res) => {
    try {
      const { llmRouteMode } = req.body || {};
      if (llmRouteMode !== "DIRECT" && llmRouteMode !== "GATEWAY") {
        res.status(400).json({ error: { message: "llmRouteMode 必须是 DIRECT 或 GATEWAY" } });
        return;
      }
      await saveLlmRouteMode(llmRouteMode);

      // 尝试同步到云端用户设置（忽略失败）
      try {
        const settings = await getLocalSettings();
        const auth = await getLocalAuth();
        const apiBase = (settings && settings.apiBase) || "http://localhost:8080";
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

  // LLM 映射配置：列出所有映射
  app.get("/api/llm-mappings", async (_req, res) => {
    try {
      const rows = await listLlmMappings();
      res.status(200).json({ items: rows });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "读取 LLM 映射配置失败" } });
    }
  });

  // LLM 映射配置：新增或更新（按 prefix 去重）
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
      res.status(500).json({ error: { message: e?.message ?? "保存 LLM 映射配置失败" } });
    }
  });

  // LLM 映射配置：删除
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
      res.status(500).json({ error: { message: e?.message ?? "删除 LLM 映射配置失败" } });
    }
  });

  // 危险指令库列表
  app.get("/api/danger-commands", (_req, res) => {
    const db = getDb();
    db.all(
      "SELECT id, command_pattern, system_type, category, risk_level, enabled, user_enabled FROM danger_commands ORDER BY id",
      (err, rows = []) => {
        if (err) {
          res.status(500).json({ error: { message: err.message || "读取危险指令库失败" } });
        } else {
          res.status(200).json({ items: rows });
        }
      }
    );
  });

  // skills 仓库视图：聚合系统禁用/不推荐 + 用户启用状态
  app.get("/api/skills", (_req, res) => {
    const db = getDb();
    db.serialize(() => {
      db.all("SELECT id, slug, status FROM skills", (err0, skillRows = []) => {
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
          const items = skillRows.map((r) => {
            let systemStatus = "NORMAL";
            if (r.status === "DISABLED") systemStatus = "DISABLED";
            else if (r.status === "DEPRECATED") systemStatus = "DEPRECATED";
            // 关联不到用户记录，视为默认启用
            const userEnabled = userMap.has(r.slug) ? userMap.get(r.slug) : 1;
            return { id: r.id, slug: r.slug, systemStatus, userEnabled };
          });
          res.status(200).json({ items });
        });
      });
    });
  });

  // skill 详情：通过本地 id 代理到云端 /api/skills/{id}
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
      const apiBase = (settings && settings.apiBase) || "http://localhost:8080";
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

  // 登录：通过已配置的 apiBase 代理到云端 /api/auth/login，保存 token 与 email
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        res.status(400).json({ error: { message: "email / password 均为必填项" } });
        return;
      }
      // 登录目前统一走本机 Spring Boot，端口 8080
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

      // 同步用户级 LLM 路由模式
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
          // 接口不可用或未配置时，回退为 GATEWAY
          await saveLlmRouteMode("GATEWAY");
        }
      } catch {
        // 忽略路由模式同步失败
      }

      // 登录成功后，根据当前配置触发一次增量同步
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
        // 忽略同步失败，登录仍然成功
      }
      res.status(200).json({
        email: data.email || email,
      });
    } catch (e) {
      console.error("local desktop auth login error", e);
      res.status(500).json({ error: { message: "本地登录失败" } });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const { apiBase, ocApiKey, llmKey } = req.body || {};
      if (!apiBase || !ocApiKey || !llmKey) {
        res.status(400).json({ error: { message: "apiBase / ocApiKey / llmKey 均为必填项" } });
        return;
      }
      await saveLocalSettings({ apiBase: String(apiBase), ocApiKey: String(ocApiKey), llmKey: String(llmKey) });
      // 仅保存配置，不在这里触发同步；同步在登录后或手动触发
      res.status(200).json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "保存设置失败" } });
    }
  });

  // 手动触发危险指令同步
  app.post("/api/danger-commands/sync", async (req, res) => {
    try {
      const settings = await getLocalSettings();
      const apiKey = settings && settings.ocApiKey;
      if (!apiKey) {
        res.status(400).json({ error: { message: "本地尚未配置 OC API Key" } });
        return;
      }
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
      res.status(202).json({ accepted: true });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "触发危险指令同步失败" } });
    }
  });

  // 手动触发 skills 状态同步
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

  // 清空本地 skills 相关数据
  app.post("/api/skills/clear", async (_req, res) => {
    try {
      const db = getDb();
      await new Promise((resolve, reject) => {
        db.serialize(() => {
          db.run("DELETE FROM skills");
          db.run("DELETE FROM user_skills");
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

  // 非 /api 开头的 POST 请求，统一视为 LLM 转发入口，由 forwardChatCompletions 处理
  app.post(/^(?!\/api\/).+$/, forwardChatCompletions);

  app.listen(PORT, () => {
    console.log(`ClawHeart local desktop proxy listening at http://127.0.0.1:${PORT}`);
  });
}

module.exports = {
  startServer,
};

