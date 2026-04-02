const {
  listLlmBudgetSettings,
  upsertLlmBudgetSetting,
  deleteLlmBudgetSetting,
  listLlmUsageCostEventsRecent,
  countLlmUsageCostEvents,
  listLlmUsageCostEventsPaged,
  aggregateLlmUsageSince,
  sumLlmUsageCostSince,
  startOfUtcDayIso,
  startOfUtcWeekIso,
  startOfUtcMonthIso,
} = require("../db.js");

function usageEventRowToClient(r) {
  return {
    id: r.id,
    createdAt: r.created_at,
    providerKey: r.provider_key,
    model: r.model_id,
    routeMode: r.route_mode,
    requestPath: r.request_path,
    promptTokens: r.prompt_tokens,
    completionTokens: r.completion_tokens,
    totalTokens: r.total_tokens,
    costUsd: r.cost_usd,
    cloudId: r.cloud_id != null ? Number(r.cloud_id) : null,
    upstreamBase: r.upstream_base ?? null,
    clientId: r.client_id ?? null,
  };
}

function pct(spent, limit) {
  if (!limit || limit <= 0) return null;
  return Math.min(100, Math.round((spent / limit) * 1000) / 10);
}

function registerBudgetRoutes(app) {
  app.get("/api/llm-budget/settings", async (_req, res) => {
    try {
      const items = await listLlmBudgetSettings();
      res.status(200).json({ items });
    } catch (e) {
      console.error("list llm budget settings", e);
      res.status(500).json({ error: { message: e?.message ?? "读取预算设置失败" } });
    }
  });

  app.post("/api/llm-budget/settings", async (req, res) => {
    try {
      const body = req.body || {};
      const out = await upsertLlmBudgetSetting(body);
      res.status(200).json(out);
    } catch (e) {
      console.error("upsert llm budget settings", e);
      res.status(500).json({ error: { message: e?.message ?? "保存失败" } });
    }
  });

  app.delete("/api/llm-budget/settings/:id", async (req, res) => {
    try {
      const r = await deleteLlmBudgetSetting(req.params.id);
      if (!r.changes) {
        res.status(404).json({ error: { message: "记录不存在" } });
        return;
      }
      res.status(200).json({ ok: true });
    } catch (e) {
      console.error("delete llm budget settings", e);
      res.status(500).json({ error: { message: e?.message ?? "删除失败" } });
    }
  });

  /** 与「拦截监控 → 用量与预算 → 最近费用流水」同源：本地 llm_usage_cost_events */
  app.get("/api/llm-budget/usage-events", async (req, res) => {
    try {
      const page = Number(req.query.page) || 1;
      const size = Number(req.query.size) || 50;
      const total = await countLlmUsageCostEvents();
      const { rows, page: p, size: s } = await listLlmUsageCostEventsPaged(page, size);
      res.status(200).json({
        page: p,
        size: s,
        total,
        items: rows.map(usageEventRowToClient),
      });
    } catch (e) {
      console.error("llm usage events list", e);
      res.status(500).json({ error: { message: e?.message ?? "读取费用流水失败" } });
    }
  });

  app.get("/api/llm-budget/summary", async (req, res) => {
    try {
      const now = new Date();
      const dayStart = startOfUtcDayIso(now);
      const weekStart = startOfUtcWeekIso(now);
      const monthStart = startOfUtcMonthIso(now);

      const [todayAgg, weekAgg, monthAgg, settings, recent] = await Promise.all([
        aggregateLlmUsageSince(dayStart),
        aggregateLlmUsageSince(weekStart),
        aggregateLlmUsageSince(monthStart),
        listLlmBudgetSettings(),
        listLlmUsageCostEventsRecent(Number(req.query.recentLimit) || 30),
      ]);

      const budgetProgress = [];
      for (const s of settings) {
        if (!s.enabled) continue;
        const sumPattern = s.model_id === "*" ? "*" : s.model_id;
        const [spentDay, spentWeek, spentMonth] = await Promise.all([
          sumLlmUsageCostSince(s.provider_key, sumPattern, dayStart),
          sumLlmUsageCostSince(s.provider_key, sumPattern, weekStart),
          sumLlmUsageCostSince(s.provider_key, sumPattern, monthStart),
        ]);
        budgetProgress.push({
          id: s.id,
          provider_key: s.provider_key,
          model_id: s.model_id,
          input_usd_per_1k: s.input_usd_per_1k,
          output_usd_per_1k: s.output_usd_per_1k,
          budget_day_usd: s.budget_day_usd,
          budget_week_usd: s.budget_week_usd,
          budget_month_usd: s.budget_month_usd,
          enabled: s.enabled,
          spentDay,
          spentWeek,
          spentMonth,
          pctDay: pct(spentDay, s.budget_day_usd),
          pctWeek: pct(spentWeek, s.budget_week_usd),
          pctMonth: pct(spentMonth, s.budget_month_usd),
        });
      }

      res.status(200).json({
        windows: { dayStart, weekStart, monthStart },
        today: todayAgg,
        week: weekAgg,
        month: monthAgg,
        budgetProgress,
        recentEvents: recent.map(usageEventRowToClient),
      });
    } catch (e) {
      console.error("llm budget summary", e);
      res.status(500).json({ error: { message: e?.message ?? "汇总失败" } });
    }
  });
}

module.exports = { registerBudgetRoutes };
