const axios = require("axios");
const { getDb, getLocalSettings, getLlmRouteMode, listLlmMappings } = require("../db.js");

async function forwardChatCompletions(req, res) {
  try {
    console.log("[LLM Proxy] 收到请求:", req.method, req.path);
    
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

    console.log("[LLM Proxy] 技能 header:", skillSlugs);

    const db = getDb();

    // 提前提取请求文本内容，用于后续拦截检查和日志记录
    const body = req.body || {};
    console.log("[LLM Proxy] 请求体结构:", JSON.stringify(body).substring(0, 500));
    
    let combinedText = "";
    if (Array.isArray(body.messages)) {
      console.log("[LLM Proxy] 检测到 messages 数组，长度:", body.messages.length);
      combinedText = body.messages
        .map((m) => {
          if (typeof m?.content === "string") {
            return m.content;
          } else if (Array.isArray(m?.content)) {
            // Anthropic 格式：content 可能是数组
            return m.content
              .map((c) => (c?.type === "text" ? c.text : ""))
              .filter(Boolean)
              .join("\n");
          }
          return "";
        })
        .filter(Boolean)
        .join("\n");
    } else if (typeof body.prompt === "string") {
      combinedText = body.prompt;
    }

    console.log("[LLM Proxy] 提取的文本内容长度:", combinedText.length);

    if (skillSlugs.length > 0) {
      const placeholders = skillSlugs.map(() => "?").join(",");

      // 1. 检查系统级禁用（优先级最高，无论用户设置如何都拦截）
      const systemDisabled = await new Promise((resolve) => {
        db.all(
          `SELECT slug FROM disabled_skills WHERE slug IN (${placeholders})`,
          skillSlugs,
          (_err, rows = []) => {
            resolve(rows.map((r) => r.slug));
          }
        );
      });

      // 2. 检查用户禁用（只有在系统未禁用的情况下才检查）
      const userDisabled = await new Promise((resolve) => {
        db.all(
          `SELECT slug FROM user_skills WHERE enabled = 0 AND slug IN (${placeholders})`,
          skillSlugs,
          (_err, rows = []) => {
            resolve(rows.map((r) => r.slug));
          }
        );
      });

      // 3. 检查用户启用状态（如果用户明确启用了，即使系统禁用也不拦截）
      const userEnabled = await new Promise((resolve) => {
        db.all(
          `SELECT slug FROM user_skills WHERE enabled = 1 AND slug IN (${placeholders})`,
          skillSlugs,
          (_err, rows = []) => {
            resolve(rows.map((r) => r.slug));
          }
        );
      });

      console.log("[LLM Proxy] 系统禁用:", systemDisabled);
      console.log("[LLM Proxy] 用户禁用:", userDisabled);
      console.log("[LLM Proxy] 用户启用:", userEnabled);

      // 拦截逻辑：
      // - 如果用户明确启用了（enabled = 1），则不拦截
      // - 如果用户禁用了（enabled = 0），则拦截
      // - 如果用户没有设置，则看系统状态：系统禁用则拦截，系统正常则不拦截
      const disabledHits = [];
      for (const slug of skillSlugs) {
        const isSystemDisabled = systemDisabled.includes(slug);
        const isUserDisabled = userDisabled.includes(slug);
        const isUserEnabled = userEnabled.includes(slug);

        console.log(`[LLM Proxy] 技能 ${slug}: 系统=${isSystemDisabled}, 用户禁用=${isUserDisabled}, 用户启用=${isUserEnabled}`);

        // 如果用户明确启用了，则不拦截（用户设置优先）
        if (isUserEnabled) {
          console.log(`[LLM Proxy] 技能 ${slug} 用户已启用，跳过拦截`);
          continue;
        }

        // 如果用户禁用了，则拦截
        if (isUserDisabled) {
          console.log(`[LLM Proxy] 技能 ${slug} 用户已禁用，拦截`);
          disabledHits.push(slug);
          continue;
        }

        // 如果用户没有设置，则看系统状态
        if (isSystemDisabled) {
          console.log(`[LLM Proxy] 技能 ${slug} 系统已禁用且用户未设置，拦截`);
          disabledHits.push(slug);
        }
      }

      if (disabledHits.length > 0) {
        console.log("[LLM Proxy] 检测到被禁用的技能:", disabledHits);
        
        // 记录拦截日志到后端
        try {
          console.log("[LLM Proxy] 正在记录技能拦截日志到后端...");
          console.log("[LLM Proxy] API Base:", settings.apiBase);
          console.log("[LLM Proxy] API Key 长度:", settings.ocApiKey?.length || 0);
          await axios.post(`${settings.apiBase}/api/safety/log-block`, {
            blockType: "skill_disabled",
            skills: disabledHits,
            prompt: combinedText.substring(0, 500),
            timestamp: new Date().toISOString(),
          }, {
            headers: {
              "X-OC-API-KEY": settings.ocApiKey,
            },
            timeout: 3000,
          }).catch((err) => {
            console.log("[LLM Proxy] 日志记录请求失败:", err.response?.status, err.message);
          });
          console.log("[LLM Proxy] 拦截日志已记录");
        } catch (logErr) {
          console.log("[LLM Proxy] 拦截日志记录失败:", logErr.message);
        }
        
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

    if (combinedText) {
      // 查询所有危险指令规则（包括系统和用户状态）
      const dangerRows = await new Promise((resolve) => {
        db.all(
          "SELECT id, command_pattern, enabled, user_enabled FROM danger_commands",
          (_err, rows = []) => resolve(rows)
        );
      });

      const textLower = combinedText.toLowerCase();
      const matchedRules = dangerRows.filter((r) => {
        const p = (r.command_pattern || "").trim();
        if (!p) return false;
        return textLower.includes(p.toLowerCase());
      });

      console.log("[LLM Proxy] 匹配到的危险指令规则:", matchedRules.map((r) => ({
        id: r.id,
        pattern: r.command_pattern,
        systemEnabled: r.enabled,
        userEnabled: r.user_enabled
      })));

      // 拦截逻辑：
      // - 只有用户明确禁用（user_enabled = 0）才拦截
      // - 用户启用（user_enabled = 1）或未设置（user_enabled = null）都不拦截
      const hitRules = matchedRules.filter((r) => {
        // 只有用户明确禁用才拦截
        if (r.user_enabled === 0) {
          console.log(`[LLM Proxy] 危险指令规则 ${r.id} (${r.command_pattern}) 用户已禁用，拦截`);
          return true;
        }
        
        // 其他情况（用户启用或未设置）都不拦截
        console.log(`[LLM Proxy] 危险指令规则 ${r.id} (${r.command_pattern}) 用户未禁用（enabled=${r.user_enabled}），跳过拦截`);
        return false;
      });

      if (hitRules.length > 0) {
        console.log("[LLM Proxy] 最终拦截的危险指令:", hitRules.map((r) => r.command_pattern));
        
        // 记录危险指令拦截日志到后端
        try {
          console.log("[LLM Proxy] 正在记录危险指令拦截日志到后端...");
          console.log("[LLM Proxy] API Base:", settings.apiBase);
          console.log("[LLM Proxy] API Key 长度:", settings.ocApiKey?.length || 0);
          await axios.post(`${settings.apiBase}/api/safety/log-block`, {
            blockType: "danger_command",
            ruleIds: hitRules.map((r) => r.id),
            patterns: hitRules.map((r) => r.command_pattern),
            prompt: combinedText.substring(0, 500),
            timestamp: new Date().toISOString(),
          }, {
            headers: {
              "X-OC-API-KEY": settings.ocApiKey,
            },
            timeout: 3000,
          }).catch((err) => {
            console.log("[LLM Proxy] 日志记录请求失败:", err.response?.status, err.message);
          });
          console.log("[LLM Proxy] 拦截日志已记录");
        } catch (logErr) {
          console.log("[LLM Proxy] 拦截日志记录失败:", logErr.message);
        }
        
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

    const originalPath = req.path || "/";
    const segments = originalPath.split("/").filter(Boolean);

    const llmRouteMode = await getLlmRouteMode();

    let upstreamUrl;
    let headers;

    if (segments.length > 0) {
      const mappings = await listLlmMappings();
      const hit = mappings.find((m) => m.prefix === segments[0]);
      if (hit) {
        const base = String(hit.target_base || "").replace(/\/+$/, "");
        const restPath = "/" + segments.slice(1).join("/");
        const tail = restPath === "/" ? "/" : restPath;
        upstreamUrl = base + tail;
        
        // 转发所有请求头（除了 host 等特殊头）
        headers = { ...req.headers };
        
        // 删除不应该转发的请求头
        delete headers.host;
        delete headers.connection;
        delete headers["content-length"];
        
        // 确保 Content-Type
        if (!headers["content-type"]) {
          headers["content-type"] = "application/json";
        }
      }
    }

    if (!upstreamUrl) {
      if (llmRouteMode === "DIRECT") {
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

module.exports = {
  forwardChatCompletions,
};
