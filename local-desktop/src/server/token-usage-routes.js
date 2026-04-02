const axios = require("axios");
const {
  getLocalSettings,
  getLocalAuth,
  listPendingTokenUsagePush,
  updateLlmUsageEventCloudId,
  getMaxCloudIdForLocalTokenUsages,
  insertLlmUsageFromCloudPull,
} = require("../db.js");

function rowToSyncPushItem(row) {
  return {
    localId: row.id,
    clientId: row.client_id || null,
    routeMode: row.route_mode || "DIRECT",
    upstreamBase: row.upstream_base || null,
    requestPath: row.request_path || null,
    providerKey: row.provider_key || "default",
    model: row.model_id || null,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    totalTokens: row.total_tokens,
    estimated: true,
    costUsd: row.cost_usd != null ? Number(row.cost_usd) : 0,
  };
}

function registerTokenUsageRoutes(app) {
  /** 可选：仍可从云端直接查询（与本地表无自动一致） */
  app.get("/api/token-usages", async (req, res) => {
    try {
      const settings = await getLocalSettings();
      const apiBase = String(settings?.apiBase || "").replace(/\/+$/, "");
      const auth = await getLocalAuth().catch(() => null);
      if (!apiBase) {
        res.status(400).json({ error: { message: "未配置 API Base" } });
        return;
      }
      if (!auth?.token) {
        res.status(401).json({ error: { message: "请先登录云端账户后再查看 Token 账单。" } });
        return;
      }

      const params = new URLSearchParams();
      if (req.query.page) params.set("page", String(req.query.page));
      if (req.query.size) params.set("size", String(req.query.size));
      if (req.query.from) params.set("from", String(req.query.from));
      if (req.query.to) params.set("to", String(req.query.to));

      const url = `${apiBase}/api/billing/token-usages/me?${params.toString()}`;
      const headers = { Authorization: `Bearer ${auth.token}` };
      const upstream = await axios.get(url, { headers, validateStatus: () => true });
      res.status(upstream.status).json(upstream.data);
    } catch (e) {
      console.error("token usages proxy error", e);
      res.status(500).json({ error: { message: "读取 Token 账单失败" } });
    }
  });

  /**
   * 与云端 oc_token_usages 对齐：先上送本地 cloud_id 为空的行，再拉取云端 id 大于本地最大 cloud_id 的记录。
   * 桌面 UI 以本地 llm_usage_cost_events 为准，同步后两库语义一致（同一条对应同一 cloud_id）。
   */
  app.post("/api/token-usages/sync", async (_req, res) => {
    try {
      const settings = await getLocalSettings();
      const apiBase = String(settings?.apiBase || "").replace(/\/+$/, "");
      const auth = await getLocalAuth().catch(() => null);
      if (!apiBase) {
        res.status(400).json({ error: { message: "未配置 API Base" } });
        return;
      }
      if (!auth?.token) {
        res.status(401).json({ error: { message: "请先登录云端账户后再同步。" } });
        return;
      }
      const headers = { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" };

      let pushed = 0;
      let idMappingsApplied = 0;

      const pending = await listPendingTokenUsagePush(200);
      if (pending.length > 0) {
        const pushRes = await axios.post(
          `${apiBase}/api/billing/token-usages/sync/push`,
          { items: pending.map(rowToSyncPushItem) },
          { headers, validateStatus: () => true, timeout: 120000 }
        );
        if (pushRes.status < 200 || pushRes.status >= 300) {
          const msg =
            (pushRes.data && (pushRes.data.message || pushRes.data.error)) ||
            (typeof pushRes.data === "string" ? pushRes.data : null) ||
            "上送同步失败";
          res.status(pushRes.status >= 400 ? pushRes.status : 502).json({ error: { message: String(msg) } });
          return;
        }
        pushed = pending.length;
        const mappings = Array.isArray(pushRes.data?.idMappings) ? pushRes.data.idMappings : [];
        for (const m of mappings) {
          await updateLlmUsageEventCloudId(m.localId, m.cloudId).catch(() => {});
          idMappingsApplied++;
        }
      }

      let afterId = await getMaxCloudIdForLocalTokenUsages();
      let pulled = 0;
      for (;;) {
        const pullRes = await axios.get(`${apiBase}/api/billing/token-usages/sync/pull`, {
          params: { afterId, limit: 200 },
          headers,
          validateStatus: () => true,
          timeout: 120000,
        });
        if (pullRes.status < 200 || pullRes.status >= 300) {
          break;
        }
        const items = Array.isArray(pullRes.data?.items) ? pullRes.data.items : [];
        if (items.length === 0) break;
        for (const it of items) {
          const r = await insertLlmUsageFromCloudPull(it);
          if (r.inserted) pulled++;
        }
        afterId =
          pullRes.data?.nextAfterId != null
            ? Number(pullRes.data.nextAfterId)
            : items.length > 0
              ? Number(items[items.length - 1].id)
              : afterId;
        if (items.length < 200) break;
      }

      res.status(200).json({ ok: true, pushed, idMappingsApplied, pulled });
    } catch (e) {
      console.error("token usages sync", e);
      res.status(500).json({ error: { message: e?.message ?? "同步失败" } });
    }
  });
}

module.exports = {
  registerTokenUsageRoutes,
};
