const axios = require("axios");
const os = require("os");
const { getDb, getLocalSettings, getLlmRouteMode, listLlmMappings, getLocalAuth } = require("../db.js");

function estimateTokensFromString(s) {
  if (!s) return 0;
  const bytes = Buffer.byteLength(String(s), "utf8");
  return Math.ceil(bytes / 4);
}

/** 单条 message 的 content 转纯文本（支持 string 与多模态数组）。 */
function messageContentToString(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => (c && c.type === "text" && typeof c.text === "string" ? c.text : ""))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

/**
 * 仅取「最后一条 role=user」的文本用于危险指令匹配，避免整段对话历史导致误拦。
 * 无 messages 时使用 prompt（completions 形态视为当前输入）。
 */
function extractLatestUserMessageText(body) {
  if (!body || typeof body !== "object") return "";
  if (typeof body.prompt === "string" && body.prompt.trim()) return body.prompt;
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const role = typeof m?.role === "string" ? m.role.toLowerCase() : "";
    if (role !== "user") continue;
    const t = messageContentToString(m?.content).trim();
    if (t) return t;
  }
  return "";
}

function extractUsage(responseData) {
  try {
    const root = typeof responseData === "string" ? JSON.parse(responseData) : responseData;
    const usage = root?.usage;
    if (usage) {
      const promptTokens = usage.prompt_tokens ?? usage.input_tokens;
      const completionTokens = usage.completion_tokens ?? usage.output_tokens;
      const totalTokens = usage.total_tokens ?? (typeof promptTokens === "number" && typeof completionTokens === "number" ? promptTokens + completionTokens : undefined);
      return {
        promptTokens: typeof promptTokens === "number" ? promptTokens : null,
        completionTokens: typeof completionTokens === "number" ? completionTokens : null,
        totalTokens: typeof totalTokens === "number" ? totalTokens : null,
        model: typeof root?.model === "string" ? root.model : null,
        estimated: false,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

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
          const auth = await getLocalAuth().catch(() => null);
          const logHeaders = {};
          const apiKey = settings && settings.ocApiKey && String(settings.ocApiKey).trim();
          if (apiKey) {
            logHeaders["X-OC-API-KEY"] = apiKey;
          }
          if (auth && auth.token) {
            logHeaders.Authorization = `Bearer ${auth.token}`;
          }

          const maxPromptChars = 20000;
          const fullPrompt = typeof combinedText === "string" ? combinedText : String(combinedText || "");
          const promptForLog = fullPrompt.length > maxPromptChars ? fullPrompt.substring(0, maxPromptChars) : fullPrompt;

          const logRes = await axios.post(`${settings.apiBase}/api/safety/log-block`, {
            blockType: "skill_disabled",
            skills: disabledHits,
            prompt: promptForLog,
            timestamp: new Date().toISOString(),
          }, {
            headers: {
              ...logHeaders,
            },
            timeout: 3000,
            validateStatus: () => true,
          }).catch((err) => {
            console.log("[LLM Proxy] 日志记录请求异常:", err?.message);
            return null;
          });
          if (logRes && logRes.status >= 200 && logRes.status < 300) {
            console.log("[LLM Proxy] 拦截日志已记录");
          } else if (logRes) {
            console.log("[LLM Proxy] 拦截日志记录失败:", logRes.status, logRes.data?.error?.message || "unknown");
          }
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

    const latestUserText = extractLatestUserMessageText(body);

    if (latestUserText) {
      // 查询所有危险指令规则（包括系统和用户状态）
      const dangerRows = await new Promise((resolve) => {
        db.all(
          "SELECT id, command_pattern, enabled, user_enabled FROM danger_commands",
          (_err, rows = []) => resolve(rows)
        );
      });

      const textLower = latestUserText.toLowerCase();
      const matchedRules = dangerRows.filter((r) => {
        const p = (r.command_pattern || "").trim();
        if (!p) return false;
        const matched = textLower.includes(p.toLowerCase());
        if (matched) {
          console.log(`[LLM Proxy] 规则 ${r.id} (${r.command_pattern}) 匹配到文本片段:`, 
            textLower.substring(Math.max(0, textLower.indexOf(p.toLowerCase()) - 20), 
                                textLower.indexOf(p.toLowerCase()) + p.length + 20));
        }
        return matched;
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
          const auth = await getLocalAuth().catch(() => null);
          const logHeaders = {};
          const apiKey = settings && settings.ocApiKey && String(settings.ocApiKey).trim();
          if (apiKey) {
            logHeaders["X-OC-API-KEY"] = apiKey;
          }
          if (auth && auth.token) {
            logHeaders.Authorization = `Bearer ${auth.token}`;
          }

          const maxPromptChars = 20000;
          const fullPrompt =
            typeof latestUserText === "string" ? latestUserText : String(latestUserText || "");
          const promptForLog = fullPrompt.length > maxPromptChars ? fullPrompt.substring(0, maxPromptChars) : fullPrompt;

          const logRes = await axios.post(`${settings.apiBase}/api/safety/log-block`, {
            blockType: "danger_command",
            ruleIds: hitRules.map((r) => r.id),
            patterns: hitRules.map((r) => r.command_pattern),
            prompt: promptForLog,
            timestamp: new Date().toISOString(),
          }, {
            headers: {
              ...logHeaders,
            },
            timeout: 3000,
            validateStatus: () => true,
          }).catch((err) => {
            console.log("[LLM Proxy] 日志记录请求异常:", err?.message);
            return null;
          });
          if (logRes && logRes.status >= 200 && logRes.status < 300) {
            console.log("[LLM Proxy] 拦截日志已记录");
          } else if (logRes) {
            console.log("[LLM Proxy] 拦截日志记录失败:", logRes.status, logRes.data?.error?.message || "unknown");
          }
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
    console.log("[LLM Proxy] 请求路径:", originalPath);
    console.log("[LLM Proxy] 路由模式:", llmRouteMode);
    console.log("[LLM Proxy] 路径片段:", segments);

    let upstreamUrl;
    let headers;
    let routeMode = llmRouteMode; // DIRECT / GATEWAY / MAPPING

    // GATEWAY 模式：直接转发到云端，由云端查映射表
    if (llmRouteMode === "GATEWAY" && segments.length > 0) {
      // 任何带前缀的请求都转发到云端 /api/llm/auth/{prefix}/...
      const auth = await getLocalAuth().catch(() => null);
      console.log("[LLM Proxy] GATEWAY 模式，auth 状态:", auth ? `已登录 (token 长度: ${auth.token?.length})` : "未登录");
      
      if (!auth || !auth.token) {
        res.status(401).json({ error: { message: "GATEWAY 模式需要登录" } });
        return;
      }
      
      routeMode = "GATEWAY";
      upstreamUrl = `${String(settings.apiBase || "").replace(/\/+$/, "")}/api/llm/auth${originalPath}`;
      headers = {
        "Content-Type": "application/json",
        "X-User-Token": `Bearer ${auth.token}`,
      };
      
      console.log("[LLM Proxy] 发送到云端:", upstreamUrl);
      console.log("[LLM Proxy] X-User-Token 长度:", headers["X-User-Token"]?.length);
      
      // 转发原始的 Authorization header（用于上游 LLM 认证）
      if (req.headers.authorization) {
        headers.Authorization = req.headers.authorization;
        console.log("[LLM Proxy] 转发 Authorization header (LLM API Key)");
      }
    }
    // DIRECT 模式：检查本地映射
    else if (llmRouteMode === "DIRECT" && segments.length > 0) {
      const mappings = await listLlmMappings();
      console.log("[LLM Proxy] 本地映射列表:", mappings.map(m => m.prefix));
      const hit = mappings.find((m) => m.prefix === segments[0]);
      console.log("[LLM Proxy] 映射匹配结果:", hit ? `匹配到 ${hit.prefix}` : "未匹配");
      
      if (hit) {
        routeMode = "MAPPING";
        // DIRECT + 映射：本地直接转发到 target_base
        const base = String(hit.target_base || "").replace(/\/+$/, "");
        const restPath = "/" + segments.slice(1).join("/");
        const tail = restPath === "/" ? "/" : restPath;
        upstreamUrl = base + tail;
        
        headers = { ...req.headers };
        delete headers.host;
        delete headers.connection;
        delete headers["content-length"];
        if (!headers["content-type"]) {
          headers["content-type"] = "application/json";
        }
      }
    }

    // 如果还没有确定 upstreamUrl，说明是无前缀的请求（如 /v1/chat/completions）
    if (!upstreamUrl) {
      if (llmRouteMode === "DIRECT") {
        if (!settings.llmKey) {
          res.status(400).json({ error: { message: "DIRECT 模式需要配置上游 LLM Key（或改用映射/网关模式）。" } });
          return;
        }
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
        // GATEWAY 模式但无前缀：这种情况不应该发生，因为 GATEWAY 模式必须有映射前缀
        res.status(400).json({ 
          error: { 
            message: "GATEWAY 模式需要使用映射前缀（如 /minimax/v1/...），请在云端映射配置中添加映射。" 
          } 
        });
        return;
      }
    }

    const upstreamRes = await axios.post(upstreamUrl, req.body, {
      headers,
      validateStatus: () => true,
    });

    // Token 账单：仅本地直连时由客户端估算后上报；云端中转（GATEWAY/GATEWAY+映射）由云端入库
    try {
      const isCloudRoute = routeMode === "GATEWAY" || (routeMode === "MAPPING" && llmRouteMode === "GATEWAY");
      if (!isCloudRoute) {
        const auth = await getLocalAuth().catch(() => null);
        if (auth?.token) {
          const usage = extractUsage(upstreamRes.data);
          const reqStr = JSON.stringify(req.body || {});
          const respStr = typeof upstreamRes.data === "string" ? upstreamRes.data : JSON.stringify(upstreamRes.data || {});
          const promptEst = estimateTokensFromString(reqStr);
          const completionEst = estimateTokensFromString(respStr);

          const promptTokens = usage?.promptTokens ?? promptEst;
          const completionTokens = usage?.completionTokens ?? completionEst;
          const totalTokens = usage?.totalTokens ?? (promptTokens + completionTokens);
          const estimated = usage ? usage.estimated : true;
          const model = usage?.model || (typeof req.body?.model === "string" ? req.body.model : null);

          await axios.post(
            `${String(settings.apiBase || "").replace(/\/+$/, "")}/api/billing/token-usages/ingest`,
            {
              clientId: `desktop-${os.hostname()}`,
              routeMode,
              upstreamBase: upstreamUrl,
              requestPath: originalPath,
              model,
              promptTokens,
              completionTokens,
              totalTokens,
              estimated,
            },
            {
              headers: { Authorization: `Bearer ${auth.token}` },
              timeout: 3000,
              validateStatus: () => true,
            }
          );
        }
      }
    } catch {
      // ignore billing failure
    }

    res.status(upstreamRes.status).set("Content-Type", "application/json").send(upstreamRes.data);
  } catch (e) {
    console.error("local desktop proxy error", e);
    res.status(500).json({ error: { message: "本地代理转发失败" } });
  }
}

module.exports = {
  forwardChatCompletions,
};
