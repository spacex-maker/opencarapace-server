#!/usr/bin/env node

import express from "express";
import axios from "axios";
import os from "os";
import { getDb, getLocalSettings, saveLocalSettings } from "./db.js";
import { syncDangerCommandsFromServer, syncSystemSkillsStatusFromServer, syncUserSkillsFromServer } from "./sync.js";

const PORT = Number(process.env.CLAWHEART_PROXY_PORT ?? 11434);

function getClientId(): string {
  const hostname = os.hostname();
  return `node-${hostname}`;
}

function messageContentToString(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c: any) => (c && c.type === "text" && typeof c.text === "string" ? c.text : ""))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

/** 仅最后一条 user 消息，用于危险指令匹配（避免整段历史误拦）。 */
function extractLatestUserMessageText(body: any): string {
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

async function getLocalStatus() {
  const db = getDb();
  const counts: { danger: number; disabled: number; deprecated: number } = {
    danger: 0,
    disabled: 0,
    deprecated: 0,
  };
  await new Promise<void>((resolve) => {
    db.serialize(() => {
      db.get("SELECT COUNT(1) AS c FROM danger_commands", (err, row: any) => {
        counts.danger = err ? 0 : row?.c ?? 0;
      });
      db.get("SELECT COUNT(1) AS c FROM disabled_skills", (err, row: any) => {
        counts.disabled = err ? 0 : row?.c ?? 0;
      });
      db.get("SELECT COUNT(1) AS c FROM deprecated_skills", (err, row: any) => {
        counts.deprecated = err ? 0 : row?.c ?? 0;
      });
      resolve();
    });
  });
  return counts;
}

async function forwardChatCompletions(req: express.Request, res: express.Response) {
  try {
    const settings = await getLocalSettings();
    if (!settings) {
      res.status(500).json({ error: { message: "本地客户端尚未配置后端地址与密钥，请在浏览器中打开本服务并完成配置。" } });
      return;
    }

    // 从请求头中读取本次调用涉及的技能列表：X-OC-SKILLS: slug1,slug2
    const skillsHeader = (req.headers["x-oc-skills"] || req.headers["X-OC-SKILLS"]) as string | string[] | undefined;
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

      // 系统禁用技能
      const systemDisabled: string[] = await new Promise((resolve) => {
        db.all(
          `SELECT slug FROM disabled_skills WHERE slug IN (${placeholders})`,
          skillSlugs,
          (_err: any, rows: any[] = []) => {
            resolve(rows.map((r) => r.slug as string));
          }
        );
      });

      // 用户级禁用技能（user_skills.enabled = 0）
      const userDisabled: string[] = await new Promise((resolve) => {
        db.all(
          `SELECT slug FROM user_skills WHERE enabled = 0 AND slug IN (${placeholders})`,
          skillSlugs,
          (_err: any, rows: any[] = []) => {
            resolve(rows.map((r) => r.slug as string));
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

      // 检查是否命中系统不推荐技能（仅告警，不强制阻断）
      const deprecatedHits: string[] = await new Promise((resolve) => {
        db.all(
          `SELECT slug FROM deprecated_skills WHERE slug IN (${placeholders})`,
          skillSlugs,
          (_err: any, rows: any[] = []) => {
            resolve(rows.map((r) => r.slug as string));
          }
        );
      });

      if (deprecatedHits.length > 0) {
        (req as any)._ocSkillWarnings = {
          deprecatedSkills: deprecatedHits,
        };
      }
    }

    // 简单的本地危险指令匹配：将本次请求的文本内容与已启用规则做包含匹配
    const body = req.body as any;
    const latestUserText = extractLatestUserMessageText(body);

    if (latestUserText) {
      type DangerRow = { id: number; command_pattern: string; enabled: number };
      const dangerRows: DangerRow[] = await new Promise((resolve) => {
        db.all(
          "SELECT id, command_pattern, enabled FROM danger_commands WHERE enabled = 1",
          (_err: any, rows: any[] = []) => resolve(rows as DangerRow[])
        );
      });

      const textLower = latestUserText.toLowerCase();
      const hitRules = dangerRows.filter((r) => {
        const p = r.command_pattern?.trim();
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

    const upstreamUrl = `${settings.apiBase}/api/llm/v1/chat/completions`;
    const upstreamRes = await axios.post(
      upstreamUrl,
      req.body,
      {
        headers: {
          "Content-Type": "application/json",
          "X-OC-API-KEY": settings.ocApiKey,
          Authorization: settings.llmKey.startsWith("Bearer ") ? settings.llmKey : `Bearer ${settings.llmKey}`,
        },
        validateStatus: () => true,
      }
    );
    res.status(upstreamRes.status).set("Content-Type", "application/json").send(upstreamRes.data);
  } catch (e) {
    console.error("clawheart local proxy error", e);
    res.status(500).json({ error: { message: "本地代理转发失败" } });
  }
}

export async function startServer() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  const clientId = getClientId();
  console.log(`ClawHeart local proxy starting on port ${PORT}, clientId=${clientId}`);

  // 初始化本地数据库
  getDb();

  // 提供 JSON 状态接口，给桌面 React UI 使用
  app.get("/api/status", async (_req, res) => {
    try {
      const { danger, disabled, deprecated } = await getLocalStatus();
      const settings = await getLocalSettings();
      res.status(200).json({
        danger,
        disabled,
        deprecated,
        settings,
      });
    } catch (e: any) {
      res.status(500).json({ error: { message: e?.message ?? "读取本地状态失败" } });
    }
  });

  // 简单浏览器客户端首页：展示配置表单和当前本地规则同步情况
  app.get("/", async (_req, res) => {
    try {
      const { danger, disabled, deprecated } = await getLocalStatus();
      const settings = await getLocalSettings();
      res
        .status(200)
        .set("Content-Type", "text/html; charset=utf-8")
        .send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>ClawHeart 本地客户端</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:#020617; color:#e5e7eb; margin:0; padding:40px; }
    .card { max-width:640px; margin:0 auto; background:#020617; border-radius:16px; padding:24px 28px; border:1px solid #1f2937; box-shadow:0 20px 40px rgba(15,23,42,0.6); }
    h1 { font-size:20px; margin:0 0 4px; color:#f9fafb; }
    p { margin:4px 0 16px; color:#9ca3af; font-size:13px; }
    .stat-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-top:16px; }
    .stat { padding:10px 12px; border-radius:10px; background:rgba(15,23,42,0.9); border:1px solid #1f2937; }
    .stat-label { font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:#6b7280; margin-bottom:4px; }
    .stat-value { font-size:18px; font-weight:600; color:#e5e7eb; }
    .badge { display:inline-flex; align-items:center; gap:6px; font-size:11px; padding:4px 9px; border-radius:999px; background:#0f172a; border:1px solid #1f2937; color:#9ca3af; margin-top:4px; }
    .badge-dot { width:7px; height:7px; border-radius:999px; background:#22c55e; box-shadow:0 0 0 4px rgba(34,197,94,0.15); }
    code { font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size:12px; background:#020617; padding:2px 5px; border-radius:4px; border:1px solid #111827; color:#e5e7eb; }
    .hint { margin-top:18px; font-size:12px; color:#6b7280; line-height:1.6; }
    .form { margin-top:20px; padding-top:16px; border-top:1px solid #1f2937; }
    label { display:block; font-size:12px; color:#9ca3af; margin-bottom:4px; }
    input { width:100%; padding:7px 9px; border-radius:8px; border:1px solid #1f2937; background:#020617; color:#e5e7eb; font-size:13px; }
    input:focus { outline:none; border-color:#22c55e; box-shadow:0 0 0 1px rgba(34,197,94,0.5); }
    .field { margin-bottom:10px; }
    button { margin-top:6px; padding:8px 14px; border-radius:999px; border:none; background:#22c55e; color:#022c22; font-size:13px; font-weight:600; cursor:pointer; }
    button:disabled { opacity:.6; cursor:not-allowed; }
    .msg { margin-top:8px; font-size:12px; }
    .msg.ok { color:#4ade80; }
    .msg.err { color:#f97373; }
  </style>
</head>
<body>
  <div class="card">
    <h1>ClawHeart 本地客户端</h1>
    <p>本地已同步的安全规则，可用于离线危险指令拦截与技能启用控制。</p>
    <div class="badge">
      <span class="badge-dot"></span>
      本地代理运行中 · clientId: <code>${clientId}</code>
    </div>
    <div class="stat-grid">
      <div class="stat">
        <div class="stat-label">危险指令规则</div>
        <div class="stat-value">${danger}</div>
      </div>
      <div class="stat">
        <div class="stat-label">禁用技能（系统）</div>
        <div class="stat-value">${disabled}</div>
      </div>
      <div class="stat">
        <div class="stat-label">不推荐技能（系统）</div>
        <div class="stat-value">${deprecated}</div>
      </div>
    </div>
    <div class="form">
      <h2 style="font-size:14px;margin:0 0 6px;color:#e5e7eb;">连接配置</h2>
      <p style="margin:0 0 10px;font-size:12px;color:#6b7280;">在这里配置云端服务地址与密钥，本地代理会使用这些配置进行规则同步与 LLM 调用。</p>
      <div class="field">
        <label>API Base（后端地址，如 https://api.clawheart.live 或 http://localhost:8080）</label>
        <input id="apiBase" value="${settings?.apiBase ?? "https://api.clawheart.live"}" />
      </div>
      <div class="field">
        <label>ClawHeart API Key（用于访问危险指令库与技能状态）</label>
        <input id="ocApiKey" value="${settings?.ocApiKey ?? ""}" />
      </div>
      <div class="field">
        <label>上游 LLM Key（用于实际模型调用）</label>
        <input id="llmKey" value="${settings?.llmKey ?? ""}" />
      </div>
      <button id="saveBtn">保存并同步规则</button>
      <div id="msg" class="msg"></div>
    </div>
    <div class="hint">
      提示：保存配置后，本地会自动从云端同步危险指令库与系统级技能状态；稍后你可以直接将 OpenAI 兼容客户端指向 <code>http://127.0.0.1:${PORT}/v1/chat/completions</code> 使用。
    </div>
  </div>
  <script>
    const $ = (id) => document.getElementById(id);
    const btn = $("saveBtn");
    const msg = $("msg");
    btn.onclick = async () => {
      btn.disabled = true;
      msg.textContent = "保存中...";
      msg.className = "msg";
      try {
        const res = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiBase: $("apiBase").value.trim(),
            ocApiKey: $("ocApiKey").value.trim(),
            llmKey: $("llmKey").value.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          msg.textContent = data?.error?.message || "保存失败";
          msg.className = "msg err";
        } else {
          msg.textContent = "保存成功，正在后台同步规则...";
          msg.className = "msg ok";
        }
      } catch (e) {
        msg.textContent = "请求失败：" + (e.message || e);
        msg.className = "msg err";
      } finally {
        btn.disabled = false;
      }
    };
  </script>
</body>
</html>`);
    } catch (e: any) {
      res.status(500).json({ error: { message: e?.message ?? "读取本地状态失败" } });
    }
  });

  // 保存本地设置并触发一次规则同步
  app.post("/api/settings", async (req, res) => {
    try {
      const { apiBase, ocApiKey, llmKey } = req.body || {};
      if (!apiBase || !ocApiKey || !llmKey) {
        res.status(400).json({ error: { message: "apiBase / ocApiKey / llmKey 均为必填项" } });
        return;
      }
      await saveLocalSettings({ apiBase: String(apiBase), ocApiKey: String(ocApiKey), llmKey: String(llmKey) });
      // 后台异步同步规则
      syncDangerCommandsFromServer(String(ocApiKey))
        .then(() => syncSystemSkillsStatusFromServer(String(ocApiKey)))
        .then(() => syncUserSkillsFromServer(String(ocApiKey)))
        .catch(() => {});
      res.status(200).json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: { message: e?.message ?? "保存设置失败" } });
    }
  });

  // OpenAI 兼容路径：仅示例 chat/completions，其他路径可按需扩展
  app.post("/v1/chat/completions", forwardChatCompletions);

  app.listen(PORT, () => {
    console.log(`ClawHeart local proxy listening at http://127.0.0.1:${PORT}`);
  });
}

// 直接通过 node 执行时，启动服务
if (require.main === module) {
  startServer().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

