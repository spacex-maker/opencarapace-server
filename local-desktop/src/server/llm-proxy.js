const axios = require("axios");
const os = require("os");
const {
  getDb,
  getLocalSettings,
  getLlmRouteMode,
  listLlmMappings,
  getLocalAuth,
  resolveLlmBudgetRow,
  evaluateLlmBudgetBlock,
  computeLlmCostUsd,
  insertLlmUsageCostEvent,
  updateLlmUsageEventCloudId,
  getSecurityScanPrivacy,
  insertConversationHistoryTurn,
} = require("../db.js");

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

function extractAssistantText(responseData) {
  try {
    const data = typeof responseData === "string" ? JSON.parse(responseData) : responseData;
    const choices = data?.choices;
    if (Array.isArray(choices) && choices.length > 0) {
      const c0 = choices[0] || {};
      const msg = c0.message;
      if (msg && typeof msg.content === "string") return msg.content;
      if (c0 && typeof c0.text === "string") return c0.text;
      if (msg && Array.isArray(msg.content)) {
        const texts = msg.content
          .map((x) => (x && x.type === "text" && typeof x.text === "string" ? x.text : ""))
          .filter(Boolean);
        if (texts.length > 0) return texts.join("\n");
      }
    }
    // 兜底：部分供应商可能把输出放到不同字段
    if (typeof data?.output_text === "string") return data.output_text;
    if (typeof data?.completion === "string") return data.completion;
    return null;
  } catch {
    return null;
  }
}

/**
 * 以标准 LLM API 响应格式（HTTP 200）回复拦截信息。
 * 外置 OpenClaw 等客户端收到后会在聊天框内显示 assistant 消息，
 * 而非把 403 归类为 auth 错误导致 WebUI 无反应。
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {object} body  已解析的请求体
 * @param {{ type: string; message: string }} blockInfo
 */
function replyBlockedAsLlmResponse(req, res, body, blockInfo) {
  const reqPath = (req.path || "").toLowerCase();
  // Anthropic Messages API：路径含 /messages
  const isAnthropic = reqPath.includes("/messages");
  // OpenAI completions API：路径含 /completions
  const isOpenAI = reqPath.includes("/completions");
  // 流式判断：
  //   - Anthropic 交互聊天必然是 streaming，不管 body.stream 是否存在都按流式处理
  //   - OpenAI 格式：显式 stream=true 才用 SSE，否则用普通 JSON
  const isStream = isAnthropic ? true : (body && body.stream === true);
  console.log(`[LLM Proxy] replyBlockedAsLlmResponse type=${blockInfo.type} path=${req.path} isAnthropic=${isAnthropic} isStream=${isStream}`);

  const msgText = `⚠️ [ClawHeart 安全拦截]\n\n${blockInfo.message}`;
  const modelHint = (body && typeof body.model === "string" ? body.model : null) || "assistant";
  const msgId = `msg_blocked_${Date.now()}`;

  if (isAnthropic) {
    // ── Anthropic Messages API 流式 SSE ──────────────────────────────────────
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "close");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    const sendEvent = (eventType, obj) => {
      res.write(`event: ${eventType}\ndata: ${JSON.stringify(obj)}\n\n`);
    };
    const outTokens = Math.ceil(msgText.length / 4);
    sendEvent("message_start", {
      type: "message_start",
      message: {
        id: msgId, type: "message", role: "assistant", content: [],
        model: modelHint, stop_reason: null, stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 1 },
      },
    });
    sendEvent("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
    sendEvent("ping", { type: "ping" });
    sendEvent("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: msgText } });
    sendEvent("content_block_stop", { type: "content_block_stop", index: 0 });
    sendEvent("message_delta", {
      type: "message_delta",
      delta: { stop_reason: "end_turn", stop_sequence: null },
      usage: { output_tokens: outTokens },
    });
    sendEvent("message_stop", { type: "message_stop" });
    res.end();
    return;
  }

  // ── OpenAI Chat Completions API ───────────────────────────────────────────
  const created = Math.floor(Date.now() / 1000);
  if (isStream) {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "close");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    const chunkId = `chatcmpl-blocked-${Date.now()}`;
    const sendChunk = (delta, finish) =>
      res.write(`data: ${JSON.stringify({ id: chunkId, object: "chat.completion.chunk", created, model: modelHint, choices: [{ index: 0, delta, finish_reason: finish ?? null }] })}\n\n`);
    sendChunk({ role: "assistant", content: msgText }, null);
    sendChunk({}, "stop");
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }

  // 非流式 JSON（兜底）
  res.status(200).json({
    id: `chatcmpl-blocked-${Date.now()}`,
    object: "chat.completion",
    created,
    model: modelHint,
    choices: [{ index: 0, message: { role: "assistant", content: msgText }, finish_reason: "stop" }],
    usage: { prompt_tokens: 0, completion_tokens: Math.ceil(msgText.length / 4), total_tokens: Math.ceil(msgText.length / 4) },
  });
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
    const proxyStartMs = Date.now();

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
        
        replyBlockedAsLlmResponse(req, res, body, {
          type: "skill_disabled",
          message: `请求中包含被禁用的技能，已被本地安全规则阻断。\n\n禁用技能：${disabledHits.join("、")}\n\n如需调整，请前往 ClawHeart「技能市场」页面。`,
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
        
        replyBlockedAsLlmResponse(req, res, body, {
          type: "danger_command_blocked",
          message: `本次请求包含危险指令，已被本地安全规则阻断。\n\n命中规则：${hitRules.map((r) => `${r.command_pattern}（规则 #${r.id}）`).join("、")}\n\n如需调整拦截策略，请前往 ClawHeart「安全规则」页面。`,
        });
        return;
      }
    }

    const originalPath = req.path || "/";
    const segments = originalPath.split("/").filter(Boolean);
    const providerKeyForBudget = segments.length > 0 ? segments[0] : "default";
    const modelForBudget =
      typeof body.model === "string" && body.model.trim() ? body.model.trim() : "unknown";

    try {
      const { row: budgetRow } = await resolveLlmBudgetRow(providerKeyForBudget, modelForBudget);
      const budgetHit = await evaluateLlmBudgetBlock(providerKeyForBudget, modelForBudget, budgetRow);
      if (budgetHit.blocked) {
        const periodLabel =
          budgetHit.period === "day" ? "今日" : budgetHit.period === "week" ? "本周" : budgetHit.period === "month" ? "本月" : String(budgetHit.period || "");
        try {
          const auth = await getLocalAuth().catch(() => null);
          const logHeaders = {};
          const apiKey = settings && settings.ocApiKey && String(settings.ocApiKey).trim();
          if (apiKey) logHeaders["X-OC-API-KEY"] = apiKey;
          if (auth && auth.token) logHeaders.Authorization = `Bearer ${auth.token}`;
          const maxPromptChars = 20000;
          const fullPrompt =
            typeof latestUserText === "string" && latestUserText
              ? latestUserText
              : typeof combinedText === "string"
                ? combinedText
                : "";
          const promptForLog = fullPrompt.length > maxPromptChars ? fullPrompt.substring(0, maxPromptChars) : fullPrompt;
          await axios
            .post(
              `${settings.apiBase}/api/safety/log-block`,
              {
                blockType: "budget_exceeded",
                skills: [],
                ruleIds: [],
                patterns: [
                  `period=${budgetHit.period}`,
                  `spent=${budgetHit.spent.toFixed(4)}`,
                  `limit=${budgetHit.limit}`,
                  `provider=${budgetHit.provider_key}`,
                  `model=${budgetHit.model_id}`,
                ],
                prompt: promptForLog,
                timestamp: new Date().toISOString(),
              },
              { headers: logHeaders, timeout: 3000, validateStatus: () => true }
            )
            .catch(() => null);
        } catch {
          // ignore log failure
        }

        replyBlockedAsLlmResponse(req, res, body, {
          type: "budget_exceeded",
          message: `已超出${periodLabel}费用预算上限（已用 $${budgetHit.spent.toFixed(4)} / 上限 $${budgetHit.limit}），本次请求已被拦截。\n\n如需调整预算，请前往 ClawHeart「用量与预算」页面。`,
        });
        return;
      }
    } catch (budgetErr) {
      console.error("[LLM Proxy] 预算检查异常:", budgetErr?.message || budgetErr);
    }

    const llmRouteMode = await getLlmRouteMode();
    console.log("[LLM Proxy] 请求路径:", originalPath);
    console.log("[LLM Proxy] 路由模式:", llmRouteMode);
    console.log("[LLM Proxy] 路径片段:", segments);

    let upstreamUrl;
    let headers;
    let routeMode = llmRouteMode; // DIRECT / GATEWAY / MAPPING

    // ─── Step 1: 优先匹配本地映射表（安全监控写入的 ocmon-* 等前缀）────────────────────────
    // 无论全局路由模式是 DIRECT 还是 GATEWAY，本地映射始终优先就地直转，
    // 避免 GATEWAY 模式下把监控前缀转发到云端（云端不认识 ocmon-* → 400）。
    if (segments.length > 0) {
      const localMappings = await listLlmMappings();
      console.log("[LLM Proxy] 本地映射列表:", localMappings.map(m => m.prefix));
      const localHit = localMappings.find((m) => m.prefix === segments[0]);
      console.log("[LLM Proxy] 本地映射匹配:", localHit ? `命中 ${localHit.prefix}` : "未命中");
      if (localHit) {
        routeMode = "MAPPING";
        const base = String(localHit.target_base || "").replace(/\/+$/, "");
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
        console.log("[LLM Proxy] 本地映射直转:", upstreamUrl);
      }
    }

    // ─── Step 2: 无本地映射命中，按全局路由模式处理 ──────────────────────────────────────

    // GATEWAY 模式：转发到云端，由云端查映射表
    if (!upstreamUrl && llmRouteMode === "GATEWAY" && segments.length > 0) {
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
    // DIRECT 模式下本地映射已在 Step 1 处理，此分支无需重复查询

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

    // 本地 oc_token_usages 镜像表 llm_usage_cost_events：先写本地，非 GATEWAY 时再 ingest 云端并回写 cloud_id
    try {
      const usage = extractUsage(upstreamRes.data);
      const reqStr = JSON.stringify(req.body || {});
      const respStr = typeof upstreamRes.data === "string" ? upstreamRes.data : JSON.stringify(upstreamRes.data || {});
      const promptEst = estimateTokensFromString(reqStr);
      const completionEst = estimateTokensFromString(respStr);
      const promptTokens = usage?.promptTokens ?? promptEst;
      const completionTokens = usage?.completionTokens ?? completionEst;
      const totalTokens = usage?.totalTokens ?? (promptTokens + completionTokens);
      const modelResolved = usage?.model || modelForBudget;
      const { row: costRow } = await resolveLlmBudgetRow(providerKeyForBudget, modelResolved).catch(() => ({ row: null }));
      const costUsd = computeLlmCostUsd(costRow, promptTokens, completionTokens);
      const clientTag = `desktop-${os.hostname()}`;

      const latencyMs = Date.now() - proxyStartMs;
      const errorSnippet =
        upstreamRes.status >= 400
          ? String(respStr || "").substring(0, 512)
          : null;

      let ins = null;
      if (upstreamRes.status >= 200 && upstreamRes.status < 300) {
        ins = await insertLlmUsageCostEvent({
          provider_key: providerKeyForBudget,
          model_id: modelResolved,
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: totalTokens,
          cost_usd: costUsd,
          route_mode: routeMode,
          request_path: originalPath,
          latency_ms: latencyMs,
          upstream_base: upstreamUrl,
          client_id: clientTag,
        });

        // 当用户开启“共享对话历史用于安全扫描”时，落库最后一条 user + 对应 assistant 输出
        try {
          const privacy = await getSecurityScanPrivacy();
          const wantHistory = !!privacy?.shareHistoryEnabled;
          const userText = typeof latestUserText === "string" ? latestUserText.trim() : "";
          if (wantHistory && userText) {
            const assistantText = extractAssistantText(upstreamRes.data);
            if (typeof assistantText === "string" && assistantText.trim()) {
              await insertConversationHistoryTurn({
                clientId: clientTag,
                createdAtIso: new Date().toISOString(),
                providerKey: providerKeyForBudget,
                modelId: modelResolved,
                routeMode,
                requestPath: originalPath,
                userText,
                assistantText: assistantText.trim(),
              });
            }
          }
        } catch (historyErr) {
          // 落库失败不应影响主链路
          console.warn("[LLM Proxy] conversation_history 写入失败:", historyErr?.message || historyErr);
        }

        const isCloudRoute = routeMode === "GATEWAY" || (routeMode === "MAPPING" && llmRouteMode === "GATEWAY");
        const auth = await getLocalAuth().catch(() => null);
        if (!isCloudRoute && auth?.token) {
          const estimated = usage ? usage.estimated : true;
          const ingestRes = await axios.post(
            `${String(settings.apiBase || "").replace(/\/+$/, "")}/api/billing/token-usages/ingest`,
            {
              clientId: clientTag,
              routeMode,
              upstreamBase: upstreamUrl,
              requestPath: originalPath,
              providerKey: providerKeyForBudget,
              model: modelResolved,
              promptTokens,
              completionTokens,
              totalTokens,
              estimated,
              costUsd,
            },
            {
              headers: { Authorization: `Bearer ${auth.token}` },
              timeout: 3000,
              validateStatus: () => true,
            }
          );
          if (
            ingestRes.status >= 200 &&
            ingestRes.status < 300 &&
            ingestRes.data &&
            ingestRes.data.id != null
          ) {
            await updateLlmUsageEventCloudId(ins.id, ingestRes.data.id).catch(() => {});
          }
        }
      }
    } catch (ledgerErr) {
      console.warn("[LLM Proxy] 本地/云端 token 记账失败:", ledgerErr?.message || ledgerErr);
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
