import express from "express";
import axios from "axios";
import os from "os";
import { getDb, getLocalSettings, saveLocalSettings } from "./db";
import { syncDangerCommandsFromServer, syncSystemSkillsStatusFromServer, syncUserSkillsFromServer } from "./sync";

const PORT = 11434;

function getClientId(): string {
  const hostname = os.hostname();
  return `desktop-${hostname}`;
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
      res.status(500).json({ error: { message: "本地客户端尚未配置后端地址与密钥，请先在设置页完成配置。" } });
      return;
    }

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

      const systemDisabled: string[] = await new Promise((resolve) => {
        db.all(
          `SELECT slug FROM disabled_skills WHERE slug IN (${placeholders})`,
          skillSlugs,
          (_err: any, rows: any[] = []) => {
            resolve(rows.map((r) => r.slug as string));
          }
        );
      });

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

    const body = req.body as any;
    let combinedText = "";
    if (Array.isArray(body?.messages)) {
      combinedText = body.messages
        .map((m: any) => (typeof m?.content === "string" ? m.content : ""))
        .filter(Boolean)
        .join("\n");
    } else if (typeof body?.prompt === "string") {
      combinedText = body.prompt;
    }

    if (combinedText) {
      type DangerRow = { id: number; command_pattern: string; enabled: number };
      const dangerRows: DangerRow[] = await new Promise((resolve) => {
        db.all(
          "SELECT id, command_pattern, enabled FROM danger_commands WHERE enabled = 1",
          (_err: any, rows: any[] = []) => resolve(rows as DangerRow[])
        );
      });

      const textLower = combinedText.toLowerCase();
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
    console.error("local desktop proxy error", e);
    res.status(500).json({ error: { message: "本地代理转发失败" } });
  }
}

export async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  const clientId = getClientId();
  console.log(`ClawHeart local desktop proxy starting on port ${PORT}, clientId=${clientId}`);

  // 初始化本地数据库
  getDb();

  // JSON 状态接口，给 React UI 使用
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

  // 保存本地设置并触发一次规则同步
  app.post("/api/settings", async (req, res) => {
    try {
      const { apiBase, ocApiKey, llmKey } = req.body || {};
      if (!apiBase || !ocApiKey || !llmKey) {
        res.status(400).json({ error: { message: "apiBase / ocApiKey / llmKey 均为必填项" } });
        return;
      }
      await saveLocalSettings({ apiBase: String(apiBase), ocApiKey: String(ocApiKey), llmKey: String(llmKey) });
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
    console.log(`ClawHeart local desktop proxy listening at http://127.0.0.1:${PORT}`);
  });
}

