const axios = require("axios");

function mergedSkillToLocalRow(s) {
  return {
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
    market_featured: s.marketFeatured === true,
    market_safe_recommended: s.marketSafeRecommended === true,
    hot_score: typeof s.hotScore === "number" ? s.hotScore : 0,
    download_count: typeof s.downloadCount === "number" ? s.downloadCount : Number(s.downloadCount || 0) || 0,
    favorite_count: typeof s.favoriteCount === "number" ? s.favoriteCount : Number(s.favoriteCount || 0) || 0,
    star_rating: s.starRating != null ? Number(s.starRating) : null,
    publisher_verified: s.publisherVerified === true,
    security_grade: s.securityGrade || null,
    published_at: s.publishedAt || null,
  };
}

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

/** 云端接口以 JWT 为主；仅在本地填写了 OC API Key 时再附带 X-OC-API-KEY（如 LLM 代理等场景）。 */
function cloudHeadersWithAuth(apiKey, auth) {
  const headers = {
    "Content-Type": "application/json",
  };
  const k = apiKey != null && String(apiKey).trim();
  if (k) {
    headers["X-OC-API-KEY"] = String(apiKey).trim();
  }
  if (auth && auth.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }
  return headers;
}

/**
 * @param {string} apiKey
 * @param {(p: { total: number; synced: number }) => void} [onProgress]
 * @param {{ forceFull?: boolean }} [options] forceFull=true 时不带 createdAfter，分页拉全量并 upsert（用于手动同步）
 */
async function syncDangerCommandsFromServer(apiKey, onProgress, options) {
  const settings = await getLocalSettings();
  const apiBase = (settings && settings.apiBase) || "https://api.clawheart.live";
  const auth = await getLocalAuth();

  // 取本地最新 created_at 作为增量起点；手动全量同步时跳过
  const db = getDb();
  const forceFull = options && options.forceFull === true;
  const lastCreatedAt = forceFull
    ? null
    : await new Promise((resolve) => {
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
    const headers = cloudHeadersWithAuth(apiKey, auth);
    const res = await axios.get(url, {
      headers,
      validateStatus: () => true,
    });
    if (res.status !== 200 || !res.data || !Array.isArray(res.data.content)) {
      if (res.status !== 200) {
        console.error(
          "[sync] danger-commands incremental failed:",
          res.status,
          typeof res.data === "string" ? res.data.slice(0, 200) : JSON.stringify(res.data || {}).slice(0, 200),
        );
      }
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
  const headers = cloudHeadersWithAuth(apiKey, auth);

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
      await replaceSkills(batch.map((s) => mergedSkillToLocalRow(s)));
    } else {
      await upsertSkills(batch.map((s) => mergedSkillToLocalRow(s)));
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
  const headers = cloudHeadersWithAuth(apiKey, auth);

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
  const headers = cloudHeadersWithAuth(apiKey, auth);

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

