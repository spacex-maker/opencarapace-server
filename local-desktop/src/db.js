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
        created_at TEXT
      )`
    );
    // 兼容老版本表结构，补充 created_at 列
    db.run("ALTER TABLE danger_commands ADD COLUMN created_at TEXT", () => {});
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
        "INSERT INTO danger_commands (id, command_pattern, system_type, category, risk_level, enabled) VALUES (?, ?, ?, ?, ?, ?)"
      );
      for (const r of rows) {
        stmt.run(r.id, r.command_pattern, r.system_type, r.category, r.risk_level, r.enabled, (err) => {
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

function upsertDangerCommands(rows) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.serialize(() => {
      const stmt = database.prepare(
        `INSERT INTO danger_commands (id, command_pattern, system_type, category, risk_level, enabled, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           command_pattern = excluded.command_pattern,
           system_type = excluded.system_type,
           category = excluded.category,
           risk_level = excluded.risk_level,
           enabled = excluded.enabled,
           created_at = excluded.created_at`
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
  replaceUserSkills,
   getLocalAuth,
   saveLocalAuth,
};

