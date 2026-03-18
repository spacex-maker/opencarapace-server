const path = require("path");
const os = require("os");
const sqlite3 = require("sqlite3");

let db = null;

function getDb() {
  if (db) return db;
  const dir = path.join(os.homedir(), ".clawheart");
  const fs = require("fs");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const file = path.join(dir, "local-client.db");
  db = new sqlite3.Database(file);
  db.serialize(() => {
    db.run(
      `CREATE TABLE IF NOT EXISTS danger_commands (
        id INTEGER PRIMARY KEY,
        command_pattern TEXT NOT NULL,
        system_type TEXT NOT NULL,
        category TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        created_at TEXT,
        user_enabled INTEGER
      )`
    );
    // 兼容老版本表结构，补充 created_at / user_enabled 列
    db.run("ALTER TABLE danger_commands ADD COLUMN created_at TEXT", () => {});
    db.run("ALTER TABLE danger_commands ADD COLUMN user_enabled INTEGER", () => {});
    db.run(
      `CREATE TABLE IF NOT EXISTS disabled_skills (
        slug TEXT PRIMARY KEY
      )`
    );
    db.run(
      `CREATE TABLE IF NOT EXISTS deprecated_skills (
        slug TEXT PRIMARY KEY
      )`
    );
    db.run(
      `CREATE TABLE IF NOT EXISTS local_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        api_base TEXT NOT NULL,
        oc_api_key TEXT NOT NULL,
        llm_key TEXT NOT NULL
      )`
    );
    db.run(
      `CREATE TABLE IF NOT EXISTS local_user_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        llm_route_mode TEXT NOT NULL DEFAULT 'GATEWAY'
      )`
    );
    db.run(
      `CREATE TABLE IF NOT EXISTS local_llm_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prefix TEXT NOT NULL UNIQUE,
        target_base TEXT NOT NULL
      )`
    );
    db.run(
      `CREATE TABLE IF NOT EXISTS user_skills (
        slug TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL
      )`
    );
    db.run(
      `CREATE TABLE IF NOT EXISTS local_auth (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        email TEXT NOT NULL,
        token TEXT NOT NULL
      )`
    );
    db.run(
      `CREATE TABLE IF NOT EXISTS skills (
        id INTEGER,
        slug TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        updated_at TEXT
      )`
    );
    // 兼容老版本 skills 表结构，补充 id / updated_at 列
    db.run("ALTER TABLE skills ADD COLUMN id INTEGER", () => {});
    db.run("ALTER TABLE skills ADD COLUMN updated_at TEXT", () => {});
  });
  return db;
}

function replaceDangerCommands(rows) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.serialize(() => {
      database.run("DELETE FROM danger_commands");
      const stmt = database.prepare(
        "INSERT INTO danger_commands (id, command_pattern, system_type, category, risk_level, enabled, created_at, user_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      );
      for (const r of rows) {
        stmt.run(
          r.id,
          r.command_pattern,
          r.system_type,
          r.category,
          r.risk_level,
          r.enabled,
          r.created_at || null,
          r.user_enabled ?? null,
          (err) => {
          if (err) reject(err);
          }
        );
      }
      stmt.finalize((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function upsertDangerCommands(rows) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.serialize(() => {
      const stmt = database.prepare(
        `INSERT INTO danger_commands (id, command_pattern, system_type, category, risk_level, enabled, created_at, user_enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           command_pattern = excluded.command_pattern,
           system_type = excluded.system_type,
           category = excluded.category,
           risk_level = excluded.risk_level,
           enabled = excluded.enabled,
           created_at = excluded.created_at,
           user_enabled = COALESCE(excluded.user_enabled, danger_commands.user_enabled)`
      );
      for (const r of rows) {
        stmt.run(
          r.id,
          r.command_pattern,
          r.system_type,
          r.category,
          r.risk_level,
          r.enabled,
          r.created_at || null,
          (err) => {
            if (err) reject(err);
          }
        );
      }
      stmt.finalize((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function applyUserDangerPrefs(rows) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.serialize(() => {
      const stmt = database.prepare(
        `UPDATE danger_commands SET user_enabled = ? WHERE id = ?`
      );
      for (const r of rows) {
        stmt.run(r.enabled, r.danger_command_id, (err) => {
          if (err) reject(err);
        });
      }
      stmt.finalize((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function replaceDisabledSkills(slugs) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.serialize(() => {
      database.run("DELETE FROM disabled_skills");
      const stmt = database.prepare("INSERT INTO disabled_skills (slug) VALUES (?)");
      for (const slug of slugs) {
        stmt.run(slug, (err) => {
          if (err) reject(err);
        });
      }
      stmt.finalize((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function replaceDeprecatedSkills(slugs) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.serialize(() => {
      database.run("DELETE FROM deprecated_skills");
      const stmt = database.prepare("INSERT INTO deprecated_skills (slug) VALUES (?)");
      for (const slug of slugs) {
        stmt.run(slug, (err) => {
          if (err) reject(err);
        });
      }
      stmt.finalize((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function replaceSkills(rows) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.serialize(() => {
      database.run("DELETE FROM skills");
      const stmt = database.prepare("INSERT INTO skills (id, slug, status, updated_at) VALUES (?, ?, ?, ?)");
      for (const r of rows) {
        stmt.run(r.id || null, r.slug, r.status, r.updated_at || null, (err) => {
          if (err) reject(err);
        });
      }
      stmt.finalize((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function upsertSkills(rows) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.serialize(() => {
      const stmt = database.prepare(
        `INSERT INTO skills (id, slug, status, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(slug) DO UPDATE SET
           id = excluded.id,
           status = excluded.status,
           updated_at = excluded.updated_at`
      );
      for (const r of rows) {
        stmt.run(r.id || null, r.slug, r.status, r.updated_at || null, (err) => {
          if (err) reject(err);
        });
      }
      stmt.finalize((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function getLocalSettings() {
  const database = getDb();
  return new Promise((resolve) => {
    database.get("SELECT api_base, oc_api_key, llm_key FROM local_settings WHERE id = 1", (err, row) => {
      if (err || !row) {
        // 默认回退到本机 Spring Boot 端口 8080，避免用户必须手动配置
        resolve({
          apiBase: "http://localhost:8080",
          ocApiKey: "",
          llmKey: "",
        });
      } else {
        resolve({
          apiBase: row.api_base,
          ocApiKey: row.oc_api_key,
          llmKey: row.llm_key,
        });
      }
    });
  });
}

function saveLocalSettings(settings) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.run(
      `INSERT INTO local_settings (id, api_base, oc_api_key, llm_key)
       VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET api_base = excluded.api_base, oc_api_key = excluded.oc_api_key, llm_key = excluded.llm_key`,
      [settings.apiBase, settings.ocApiKey, settings.llmKey],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function getLlmRouteMode() {
  const database = getDb();
  return new Promise((resolve) => {
    database.get("SELECT llm_route_mode FROM local_user_settings WHERE id = 1", (err, row) => {
      if (err || !row || !row.llm_route_mode) {
        resolve("GATEWAY");
      } else {
        resolve(row.llm_route_mode);
      }
    });
  });
}

function saveLlmRouteMode(mode) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.run(
      `INSERT INTO local_user_settings (id, llm_route_mode)
       VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET llm_route_mode = excluded.llm_route_mode`,
      [mode || "GATEWAY"],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function replaceUserSkills(rows) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.serialize(() => {
      database.run("DELETE FROM user_skills");
      const stmt = database.prepare("INSERT INTO user_skills (slug, enabled) VALUES (?, ?)");
      for (const r of rows) {
        stmt.run(r.slug, r.enabled, (err) => {
          if (err) reject(err);
        });
      }
      stmt.finalize((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function getLocalAuth() {
  const database = getDb();
  return new Promise((resolve) => {
    database.get("SELECT email, token FROM local_auth WHERE id = 1", (err, row) => {
      if (err || !row) {
        resolve(null);
      } else {
        resolve({
          email: row.email,
          token: row.token,
        });
      }
    });
  });
}

function listLlmMappings() {
  const database = getDb();
  return new Promise((resolve) => {
    database.all("SELECT id, prefix, target_base FROM local_llm_mappings ORDER BY id", (err, rows = []) => {
      if (err) resolve([]);
      else resolve(rows);
    });
  });
}

function upsertLlmMapping(mapping) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.run(
      `INSERT INTO local_llm_mappings (prefix, target_base)
       VALUES (?, ?)
       ON CONFLICT(prefix) DO UPDATE SET target_base = excluded.target_base`,
      [mapping.prefix, mapping.target_base],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function deleteLlmMapping(id) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.run("DELETE FROM local_llm_mappings WHERE id = ?", [id], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function saveLocalAuth(auth) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.run(
      `INSERT INTO local_auth (id, email, token)
       VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET email = excluded.email, token = excluded.token`,
      [auth.email, auth.token],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

module.exports = {
  getDb,
  replaceDangerCommands,
  upsertDangerCommands,
  replaceDisabledSkills,
  replaceDeprecatedSkills,
  replaceSkills,
  upsertSkills,
  getLocalSettings,
  saveLocalSettings,
  getLlmRouteMode,
  saveLlmRouteMode,
  listLlmMappings,
  upsertLlmMapping,
  deleteLlmMapping,
  replaceUserSkills,
  getLocalAuth,
  saveLocalAuth,
  applyUserDangerPrefs,
};

