const {
  startOfUtcDayIso,
  aggregateLlmUsageSince,
  listLlmUsageCostEventsPaged,
  countLlmUsageCostEvents,
} = require("../db.js");

function toProxyRequestLogDto(r) {
  return {
    id: r.id,
    createdAt: r.created_at,
    providerKey: r.provider_key,
    model: r.model_id,
    routeMode: r.route_mode,
    requestPath: r.request_path,
    statusCode: null,
    blockType: null,
    promptTokens: r.prompt_tokens,
    completionTokens: r.completion_tokens,
    totalTokens: r.total_tokens,
    costUsd: Number(r.cost_usd || 0),
    latencyMs: r.latency_ms != null ? Number(r.latency_ms) : null,
    errorSnippet: null,
    clientId: r.client_id != null ? String(r.client_id) : null,
  };
}

function registerProxyRequestLogsRoutes(app) {
  app.get("/api/intercept-request-logs/summary", async (_req, res) => {
    try {
      const sinceIso = startOfUtcDayIso(new Date());
      const s = await aggregateLlmUsageSince(sinceIso);
      res.status(200).json({
        todayToken: s.totalTokens,
        todayCostUsd: s.costUsd,
        requestCount: s.requestCount,
        avgLatencyMs: s.avgLatencyMs,
      });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "读取实时概览失败" } });
    }
  });

  app.get("/api/intercept-request-logs", async (req, res) => {
    try {
      const page = Number(req.query.page || 1);
      const size = Number(req.query.size || 50);
      const total = await countLlmUsageCostEvents();
      const { rows } = await listLlmUsageCostEventsPaged(page, size);
      res.status(200).json({
        page: Math.max(1, Number(page || 1)),
        size: Math.max(1, Number(size || 50)),
        total,
        items: rows.map(toProxyRequestLogDto),
      });
    } catch (e) {
      res.status(500).json({ error: { message: e?.message ?? "读取请求日志失败" } });
    }
  });
}

module.exports = {
  registerProxyRequestLogsRoutes,
};

