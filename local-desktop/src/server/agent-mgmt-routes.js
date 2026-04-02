const { getDb } = require("../db.js");

function registerAgentMgmtRoutes(app) {
  app.get("/api/agent-mgmt/summary", (_req, res) => {
    const database = getDb();
    database.serialize(() => {
      database.all(
        "SELECT code, display_name AS displayName, accent, sort_order AS sortOrder FROM agent_platforms ORDER BY sort_order ASC, code ASC",
        (e0, platforms = []) => {
          if (e0) {
            res.status(500).json({ error: { message: e0.message || "读取 Agent 平台失败" } });
            return;
          }
          database.all(
            "SELECT platform_code AS platformCode, feature_type AS featureType, COUNT(1) AS cnt FROM local_agent_items GROUP BY platform_code, feature_type",
            (e1, countRows = []) => {
              if (e1) {
                res.status(500).json({ error: { message: e1.message || "读取统计失败" } });
                return;
              }
              const countMap = new Map();
              for (const r of countRows) {
                countMap.set(`${r.platformCode}\0${r.featureType}`, Number(r.cnt || 0));
              }
              const withCounts = platforms.map((p) => ({
                code: p.code,
                displayName: p.displayName,
                accent: p.accent,
                sortOrder: p.sortOrder,
                featureCounts: ["providers", "skills", "prompts", "mcp", "sessions"].map((ft) => ({
                  featureType: ft,
                  count: countMap.get(`${p.code}\0${ft}`) || 0,
                })),
              }));
              res.status(200).json({ platforms: withCounts });
            }
          );
        }
      );
    });
  });

  app.get("/api/agent-mgmt/items", (req, res) => {
    const platform = typeof req.query.platform === "string" ? req.query.platform.trim() : "";
    const feature = typeof req.query.feature === "string" ? req.query.feature.trim() : "";
    if (!platform || !feature) {
      res.status(400).json({ error: { message: "缺少 platform 或 feature 参数" } });
      return;
    }
    const allowed = new Set(["providers", "skills", "prompts", "mcp", "sessions"]);
    if (!allowed.has(feature)) {
      res.status(400).json({ error: { message: "feature 无效" } });
      return;
    }
    const database = getDb();
    database.all(
      `SELECT id, platform_code AS platformCode, feature_type AS featureType, name, subtitle, status_label AS statusLabel, status_kind AS statusKind, sort_order AS sortOrder, meta_json AS metaJson, updated_at AS updatedAt
       FROM local_agent_items WHERE platform_code = ? AND feature_type = ? ORDER BY sort_order ASC, id ASC`,
      [platform, feature],
      (err, rows = []) => {
        if (err) {
          res.status(500).json({ error: { message: err.message || "读取条目失败" } });
          return;
        }
        const items = rows.map((r) => {
          let meta = null;
          if (r.metaJson) {
            try {
              meta = JSON.parse(r.metaJson);
            } catch {
              meta = null;
            }
          }
          return {
            id: r.id,
            platformCode: r.platformCode,
            featureType: r.featureType,
            name: r.name,
            subtitle: r.subtitle || null,
            statusLabel: r.statusLabel || null,
            statusKind: r.statusKind || null,
            sortOrder: r.sortOrder,
            meta,
            updatedAt: r.updatedAt || null,
          };
        });
        res.status(200).json({ items });
      }
    );
  });
}

module.exports = { registerAgentMgmtRoutes };
