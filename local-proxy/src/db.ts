import path from "path";
import os from "os";
import sqlite3 from "sqlite3";

export interface DangerCommandRow {
  id: number;
  command_pattern: string;
  system_type: string;
  category: string;
  risk_level: string;
  enabled: number;
}

let db: sqlite3.Database | null = null;

export interface LocalSettings {
  apiBase: string;
  ocApiKey: string;
  llmKey: string;
}

export interface UserSkillRow {
  slug: string;
  enabled: number;
}

export function getDb(): sqlite3.Database {
  if (db) return db;
  const dir = path.join(os.homedir(), ".clawheart");
  const fs = require("fs") as typeof import("fs");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const file = path.join(dir, "local-proxy.db");
  db = new sqlite3.Database(file);
  db.serialize(() => {
    db!.run(
      `CREATE TABLE IF NOT EXISTS danger_commands (
        id INTEGER PRIMARY KEY,
        command_pattern TEXT NOT NULL,
        system_type TEXT NOT NULL,
        category TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        enabled INTEGER NOT NULL
      )`
    );
    db!.run(
      `CREATE TABLE IF NOT EXISTS disabled_skills (
        slug TEXT PRIMARY KEY
      )`
    );
    db!.run(
      `CREATE TABLE IF NOT EXISTS deprecated_skills (
        slug TEXT PRIMARY KEY
      )`
    );
    db!.run(
      `CREATE TABLE IF NOT EXISTS local_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        api_base TEXT NOT NULL,
        oc_api_key TEXT NOT NULL,
        llm_key TEXT NOT NULL
      )`
    );
    db!.run(
      `CREATE TABLE IF NOT EXISTS user_skills (
        slug TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL
      )`
    );
  });
  return db;
}

export async function replaceDangerCommands(rows: DangerCommandRow[]): Promise<void> {
  const database = getDb();
  await new Promise<void>((resolve, reject) => {
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

export async function replaceDisabledSkills(slugs: string[]): Promise<void> {
  const database = getDb();
  await new Promise<void>((resolve, reject) => {
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

export async function replaceDeprecatedSkills(slugs: string[]): Promise<void> {
  const database = getDb();
  await new Promise<void>((resolve, reject) => {
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

export async function getLocalSettings(): Promise<LocalSettings | null> {
  const database = getDb();
  return await new Promise<LocalSettings | null>((resolve) => {
    database.get("SELECT api_base, oc_api_key, llm_key FROM local_settings WHERE id = 1", (err, row: any) => {
      if (err || !row) {
        resolve(null);
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

export async function saveLocalSettings(settings: LocalSettings): Promise<void> {
  const database = getDb();
  await new Promise<void>((resolve, reject) => {
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

export async function replaceUserSkills(rows: UserSkillRow[]): Promise<void> {
  const database = getDb();
  await new Promise<void>((resolve, reject) => {
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

