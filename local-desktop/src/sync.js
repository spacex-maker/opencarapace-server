const axios = require("axios");
const {
  replaceDangerCommands,
  upsertDangerCommands,
  replaceDisabledSkills,
  replaceDeprecatedSkills,
  replaceUserSkills,
  replaceSkills,
  upsertSkills,
  getLocalSettings,
  getLocalAuth,
  getDb,
  saveLastKnownVersion,
} = require("./db");

async function syncDangerCommandsFromServer(apiKey, onProgress) {
  const settings = await getLocalSettings();
  const apiBase = (settings && settings.apiBase) || "https://api.clawheart.live";
  const auth = await getLocalAuth();

  // 取本地最新 created_at，作为增量起点
  const db = getDb();
  const lastCreatedAt = await new Promise((resolve) => {
    db.get("SELECT created_at FROM danger_commands ORDER BY created_at DESC LIMIT 1", (err, row) => {
      if (err || !row || !row.created_at) {
        resolve(null);
      } else {
        resolve(row.created_at);
      }
    });
  });

  let page = 0;
  const size = 10;
  let total = null;
  let synced = 0;

  for (;;) {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("size", String(size));
    if (lastCreatedAt) {
      params.set("createdAfter", lastCreatedAt);
    }
    const url = `${apiBase}/api/danger-commands/incremental?${params.toString()}`;
    const headers = {
      "Content-Type": "application/json",
      "X-OC-API-KEY": apiKey,
    };
    if (auth && auth.token) {
      headers.Authorization = `Bearer ${auth.token}`;
    }
    const res = await axios.get(url, {
      headers,
      validateStatus: () => true,
    });
    if (res.status !== 200 || !res.data || !Array.isArray(res.data.content)) {
      break;
    }
    if (total === null && typeof res.data.totalElements === "number") {
      total = res.data.totalElements;
    }
    const batch = res.data.content;
    if (batch.length === 0) {
      break;
    }

    await upsertDangerCommands(
      batch.map((c) => ({
        id: c.id,
        command_pattern: c.commandPattern,
        system_type: c.systemType,
        category: c.category,
        risk_level: c.riskLevel,
        enabled: c.enabled ? 1 : 0,
        created_at: c.createdAt || null,
      }))
    );

    synced += batch.length;
    if (onProgress) {
      try {
        onProgress({ total: total ?? synced, synced });
      } catch {
        // ignore callback errors
      }
    }

    if (res.data.last || res.data.number + 1 >= res.data.totalPages) {
      break;
    }
    page += 1;
  }

  // total 可能为 null（服务端没返回），此时用 synced 兜底
  return { total: total ?? synced, synced };
}

async function syncSystemSkillsStatusFromServer(apiKey, onProgress) {
  const settings = await getLocalSettings();
  const apiBase = (settings && settings.apiBase) || "https://api.clawheart.live";
  const auth = await getLocalAuth();
  const headers = {
    "Content-Type": "application/json",
    "X-OC-API-KEY": apiKey,
  };
  if (auth && auth.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }

  const db = getDb();
  // 取本地最新 updated_at，作为增量起点
  const lastUpdatedAt = await new Promise((resolve) => {
    db.get("SELECT updated_at FROM skills ORDER BY updated_at DESC LIMIT 1", (err, row) => {
      if (err || !row || !row.updated_at) {
        resolve(null);
      } else {
        resolve(row.updated_at);
      }
    });
  });

  // 先从官方 skills + 用户偏好合并视图增量分页拉取
  let page = 0;
  const size = 200;
  let total = null;
  let synced = 0;
  for (;;) {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("size", String(size));
    if (lastUpdatedAt) {
      params.set("updatedAfter", lastUpdatedAt);
    }
    const url = `${apiBase}/api/skills/merged/incremental?${params.toString()}`;
    const res = await axios.get(url, { headers, validateStatus: () => true });
    if (res.status !== 200 || !res.data || !Array.isArray(res.data.content)) {
      break;
    }
    const batch = res.data.content;
    if (batch.length === 0) break;
    if (total === null && typeof res.data.totalElements === "number") {
      total = res.data.totalElements;
    }

    synced += batch.length;
    if (onProgress) {
      try {
        onProgress({ total: total ?? synced, synced });
      } catch {
        // ignore
      }
    }

    // 写入/更新本地 skills 表（与 Web 端字段保持一致）
    if (lastUpdatedAt == null && page === 0) {
      await replaceSkills(
        batch.map((s) => ({
          id: s.id,
          slug: s.slug,
          name: s.name || null,
          type: s.type || null,
          category: s.category || null,
          status: s.status || "ACTIVE",
          short_desc: s.shortDesc || null,
          updated_at: s.updatedAt || null,
          source_name: s.sourceName || null,
          safe_mark_count: s.safeMarkCount || 0,
          unsafe_mark_count: s.unsafeMarkCount || 0,
          user_safety_label: s.userSafetyLabel || null,
        }))
      );
    } else {
      await upsertSkills(
        batch.map((s) => ({
          id: s.id,
          slug: s.slug,
          name: s.name || null,
          type: s.type || null,
          category: s.category || null,
          status: s.status || "ACTIVE",
          short_desc: s.shortDesc || null,
          updated_at: s.updatedAt || null,
          source_name: s.sourceName || null,
          safe_mark_count: s.safeMarkCount || 0,
          unsafe_mark_count: s.unsafeMarkCount || 0,
          user_safety_label: s.userSafetyLabel || null,
        }))
      );
    }

    if (res.data.last || res.data.number + 1 >= res.data.totalPages) break;
    page += 1;
  }

  // 同步系统禁用/不推荐列表，方便拦截和聚合视图
  const allSkills = await new Promise((resolve) => {
    db.all("SELECT slug, status FROM skills", (err, rows = []) => {
      if (err) resolve([]);
      else resolve(rows);
    });
  });
  const disabledSlugs = allSkills.filter((s) => s.status === "DISABLED").map((s) => s.slug);
  const deprecatedSlugs = allSkills.filter((s) => s.status === "DEPRECATED").map((s) => s.slug);

  await replaceDisabledSkills(disabledSlugs);
  await replaceDeprecatedSkills(deprecatedSlugs);

  // totalSkills 用最终 synced/total 兜底
  return { totalSkills: total ?? synced, disabled: disabledSlugs.length, deprecated: deprecatedSlugs.length };
}

async function syncUserSkillsFromServer(apiKey) {
  const settings = await getLocalSettings();
  const apiBase = (settings && settings.apiBase) || "https://api.clawheart.live";
  const auth = await getLocalAuth();
  const headers = {
    "Content-Type": "application/json",
    "X-OC-API-KEY": apiKey,
  };
  if (auth && auth.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }

  const url = `${apiBase}/api/user-skills/me`;
  const res = await axios.get(url, { headers, validateStatus: () => true });
  if (res.status !== 200 || !Array.isArray(res.data)) {
    return 0;
  }

  const rows = res.data.map((u) => ({
    slug: u.slug,
    enabled: u.enabled ? 1 : 0,
  }));

  await replaceUserSkills(rows);

  const versionRes = await axios.get(`${apiBase}/api/user-settings/version`, {
    headers,
    validateStatus: () => true,
  });
  if (versionRes.status === 200 && versionRes.data && typeof versionRes.data.combinedVersion === "number") {
    await saveLastKnownVersion(versionRes.data.combinedVersion);
  }

  return rows.length;
}

async function syncUserDangerCommandsFromServer(apiKey) {
  const settings = await getLocalSettings();
  const apiBase = (settings && settings.apiBase) || "https://api.clawheart.live";
  const auth = await getLocalAuth();
  const headers = {
    "Content-Type": "application/json",
    "X-OC-API-KEY": apiKey,
  };
  if (auth && auth.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }

  const url = `${apiBase}/api/user-danger-commands/me?onlyDisabled=true`;
  const res = await axios.get(url, { headers, validateStatus: () => true });
  if (res.status !== 200 || !Array.isArray(res.data)) {
    return 0;
  }

  const rows = res.data.map((u) => ({
    danger_command_id: u.dangerCommandId,
    enabled: u.enabled ? 1 : 0,
  }));

  // 只记录显式禁用；未出现在列表里的规则视为默认启用（user_enabled=null）
  const db = getDb();
  await new Promise((resolve) => {
    db.run("UPDATE danger_commands SET user_enabled = NULL", () => resolve());
  });
  await require("./db").applyUserDangerPrefs(rows);

  const versionRes = await axios.get(`${apiBase}/api/user-settings/version`, {
    headers,
    validateStatus: () => true,
  });
  if (versionRes.status === 200 && versionRes.data && typeof versionRes.data.combinedVersion === "number") {
    await saveLastKnownVersion(versionRes.data.combinedVersion);
  }

  return rows.length;
}

module.exports = {
  syncDangerCommandsFromServer,
  syncSystemSkillsStatusFromServer,
  syncUserSkillsFromServer,
  syncUserDangerCommandsFromServer,
};

