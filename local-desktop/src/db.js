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
        llm_route_mode TEXT NOT NULL DEFAULT 'GATEWAY',
        sync_user_skills_to_cloud INTEGER NOT NULL DEFAULT 1,
        sync_user_dangers_to_cloud INTEGER NOT NULL DEFAULT 1
      )`
    );
    db.run("ALTER TABLE local_user_settings ADD COLUMN sync_user_skills_to_cloud INTEGER NOT NULL DEFAULT 1", () => {});
    db.run("ALTER TABLE local_user_settings ADD COLUMN sync_user_dangers_to_cloud INTEGER NOT NULL DEFAULT 1", () => {});
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
      `CREATE TABLE IF NOT EXISTS user_skill_safety_labels (
        slug TEXT PRIMARY KEY,
        label TEXT NOT NULL
      )`
    );
    db.run(
      `CREATE TABLE IF NOT EXISTS local_auth (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        email TEXT NOT NULL,
        token TEXT NOT NULL
      )`
    );
    db.run("ALTER TABLE local_auth ADD COLUMN display_name TEXT", () => {});
    db.run(
      `CREATE TABLE IF NOT EXISTS local_sync_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_known_version INTEGER NOT NULL DEFAULT 0
      )`
    );
    db.run(
      `CREATE TABLE IF NOT EXISTS local_openclaw_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        ui_url TEXT NOT NULL DEFAULT 'http://localhost:18789',
        install_cmd TEXT NOT NULL DEFAULT ''
      )`
    );
    // 兼容老版本表结构：补充 openclaw 配置列
    db.run("ALTER TABLE local_openclaw_settings ADD COLUMN ui_url TEXT NOT NULL DEFAULT 'http://localhost:18789'", () => {});
    db.run("ALTER TABLE local_openclaw_settings ADD COLUMN install_cmd TEXT NOT NULL DEFAULT ''", () => {});
    db.run(
      `CREATE TABLE IF NOT EXISTS skills (
        id INTEGER,
        slug TEXT PRIMARY KEY,
        name TEXT,
        type TEXT,
        category TEXT,
        status TEXT NOT NULL,
        short_desc TEXT,
        updated_at TEXT,
        source_name TEXT
      )`
    );
    // 兼容老版本 skills 表结构，补充新增字段
    db.run("ALTER TABLE skills ADD COLUMN id INTEGER", () => {});
    db.run("ALTER TABLE skills ADD COLUMN updated_at TEXT", () => {});
    db.run("ALTER TABLE skills ADD COLUMN source_name TEXT", () => {});
    db.run("ALTER TABLE skills ADD COLUMN name TEXT", () => {});
    db.run("ALTER TABLE skills ADD COLUMN type TEXT", () => {});
    db.run("ALTER TABLE skills ADD COLUMN category TEXT", () => {});
    db.run("ALTER TABLE skills ADD COLUMN short_desc TEXT", () => {});
    db.run("ALTER TABLE skills ADD COLUMN safe_mark_count INTEGER NOT NULL DEFAULT 0", () => {});
    db.run("ALTER TABLE skills ADD COLUMN unsafe_mark_count INTEGER NOT NULL DEFAULT 0", () => {});
    db.run("ALTER TABLE skills ADD COLUMN user_safety_label TEXT", () => {});
    db.run("ALTER TABLE skills ADD COLUMN market_featured INTEGER NOT NULL DEFAULT 0", () => {});
    db.run("ALTER TABLE skills ADD COLUMN market_safe_recommended INTEGER NOT NULL DEFAULT 0", () => {});
    db.run("ALTER TABLE skills ADD COLUMN hot_score REAL NOT NULL DEFAULT 0", () => {});
    db.run("ALTER TABLE skills ADD COLUMN download_count INTEGER NOT NULL DEFAULT 0", () => {});
    db.run("ALTER TABLE skills ADD COLUMN favorite_count INTEGER NOT NULL DEFAULT 0", () => {});
    db.run("ALTER TABLE skills ADD COLUMN star_rating REAL", () => {});
    db.run("ALTER TABLE skills ADD COLUMN publisher_verified INTEGER NOT NULL DEFAULT 0", () => {});
    db.run("ALTER TABLE skills ADD COLUMN security_grade TEXT", () => {});
    db.run("ALTER TABLE skills ADD COLUMN published_at TEXT", () => {});
    db.run(
      `CREATE TABLE IF NOT EXISTS agent_platforms (
        code TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        accent TEXT NOT NULL DEFAULT '#3b82f6',
        sort_order INTEGER NOT NULL DEFAULT 0
      )`
    );
    db.run(
      `CREATE TABLE IF NOT EXISTS local_agent_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform_code TEXT NOT NULL,
        feature_type TEXT NOT NULL,
        name TEXT NOT NULL,
        subtitle TEXT,
        status_label TEXT,
        status_kind TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        meta_json TEXT,
        updated_at TEXT
      )`
    );
    db.run("CREATE INDEX IF NOT EXISTS idx_local_agent_items_pf ON local_agent_items (platform_code, feature_type)", () => {});
    db.run(
      `CREATE TABLE IF NOT EXISTS llm_budget_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_key TEXT NOT NULL,
        model_id TEXT NOT NULL,
        input_usd_per_1k REAL NOT NULL DEFAULT 0,
        output_usd_per_1k REAL NOT NULL DEFAULT 0,
        budget_day_usd REAL,
        budget_week_usd REAL,
        budget_month_usd REAL,
        enabled INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT,
        UNIQUE(provider_key, model_id)
      )`
    );
    db.run(
      `CREATE TABLE IF NOT EXISTS llm_usage_cost_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        provider_key TEXT NOT NULL,
        model_id TEXT NOT NULL,
        prompt_tokens INTEGER,
        completion_tokens INTEGER,
        total_tokens INTEGER,
        cost_usd REAL NOT NULL DEFAULT 0,
        route_mode TEXT,
        request_path TEXT,
        cloud_id INTEGER,
        upstream_base TEXT,
        client_id TEXT
      )`
    );
    db.run("ALTER TABLE llm_usage_cost_events ADD COLUMN cloud_id INTEGER", () => {});
    db.run("ALTER TABLE llm_usage_cost_events ADD COLUMN upstream_base TEXT", () => {});
    db.run("ALTER TABLE llm_usage_cost_events ADD COLUMN client_id TEXT", () => {});
    db.run("ALTER TABLE llm_usage_cost_events ADD COLUMN latency_ms INTEGER", () => {});
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_llm_usage_cost_created ON llm_usage_cost_events (created_at)",
      () => {}
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_llm_usage_cost_pm ON llm_usage_cost_events (provider_key, model_id)",
      () => {}
    );
    db.run(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_llm_usage_cloud_id ON llm_usage_cost_events(cloud_id) WHERE cloud_id IS NOT NULL",
      () => {}
    );
    db.run(
      `CREATE TABLE IF NOT EXISTS proxy_request_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        provider_key TEXT NOT NULL,
        model_id TEXT,
        route_mode TEXT,
        request_path TEXT,
        status_code INTEGER,
        block_type TEXT,
        prompt_tokens INTEGER,
        completion_tokens INTEGER,
        total_tokens INTEGER,
        cost_usd REAL NOT NULL DEFAULT 0,
        latency_ms INTEGER,
        error_snippet TEXT,
        client_id TEXT
      )`
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_proxy_request_created_at ON proxy_request_logs (created_at)",
      () => {}
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_proxy_request_provider_model ON proxy_request_logs (provider_key, model_id)",
      () => {}
    );
    db.run(
      "CREATE INDEX IF NOT EXISTS idx_proxy_request_block_type ON proxy_request_logs (block_type)",
      () => {}
    );
    db.get("SELECT COUNT(1) AS c FROM agent_platforms", (seedErr, seedRow) => {
      if (!seedErr && seedRow && Number(seedRow.c) === 0) {
        seedLocalAgentCatalog(db);
      }
    });
  });
  return db;
}

/** 首次初始化：与产品原型一致的 Agent 目录演示数据（可后续扩展同步/编辑） */
function seedLocalAgentCatalog(database) {
  const now = new Date().toISOString();
  const platforms = [
    ["claude", "Claude Code", "#3b82f6", 0],
    ["codex", "Codex", "#22c55e", 1],
    ["gemini", "Gemini CLI", "#d97706", 2],
    ["opencode", "OpenCode", "#7c3aed", 3],
    ["openclaw", "OpenClaw", "#dc2626", 4],
  ];
  const items = [
    ["claude", "providers", "Anthropic API", "api.anthropic.com", "活跃", "active", 0],
    ["claude", "providers", "OpenRouter", "openrouter.ai/api", "备用", "standby", 1],
    ["claude", "providers", "AWS Bedrock", "bedrock.us-east-1.amazonaws.com", "备用", "standby", 2],
    ["claude", "providers", "Google Vertex AI", "us-central1-aiplatform.googleapis.com", "备用", "standby", 3],
    ["claude", "skills", "commit-helper", "Git 提交信息生成器 · @anthropic", "已安装", "installed", 0],
    ["claude", "skills", "code-review", "自动代码审查工具 · @dev123", "已安装", "installed", 1],
    ["claude", "skills", "api-tester", "API 端点测试 · @openai", "有更新", "update", 2],
    ["claude", "skills", "doc-formatter", "文档格式化工具 · @community", "已安装", "installed", 3],
    ["claude", "prompts", "CLAUDE.md", "项目级系统提示 · 2.3 KB · 2小时前", "", "neutral", 0],
    ["claude", "prompts", "coding-standards.md", "编码规范指令 · 1.1 KB · 3天前", "", "neutral", 1],
    ["claude", "prompts", "review-rules.md", "代码审查规则 · 0.8 KB · 1周前", "", "neutral", 2],
    ["claude", "mcp", "filesystem-server", "npx @anthropic/fs-server ~/projects", "", "ok", 0],
    ["claude", "mcp", "github-server", "npx @anthropic/github-mcp", "", "ok", 1],
    ["claude", "mcp", "postgres-server", "npx @anthropic/postgres-mcp", "", "warn", 2],
    ["claude", "mcp", "browser-server", "npx @anthropic/browser-mcp", "", "ok", 3],
    ["claude", "sessions", "重构认证模块", "32 轮 · auth/ · opus-4", "18.7K", "neutral", 0],
    ["claude", "sessions", "修复支付回调 Bug", "12 轮 · payment/ · sonnet-4", "6.2K", "neutral", 1],
    ["claude", "sessions", "添加 Dashboard 图表", "25 轮 · components/ · opus-4", "14.1K", "neutral", 2],
    ["claude", "sessions", "数据库迁移脚本", "8 轮 · migrations/ · sonnet-4", "3.8K", "neutral", 3],
    ["codex", "providers", "OpenAI Codex", "api.openai.com", "活跃", "active", 0],
    ["codex", "providers", "Azure OpenAI", "eastus.api.cognitive.microsoft.com", "备用", "standby", 1],
    ["codex", "skills", "shell-helper", "Shell 辅助 · @community", "已安装", "installed", 0],
    ["codex", "mcp", "git-mcp", "npx @modelcontextprotocol/git", "", "ok", 0],
    ["codex", "mcp", "docker-mcp", "本地 Docker 控制", "", "ok", 1],
    ["codex", "sessions", "API 限流改造", "18 轮 · gateway/", "9.1K", "neutral", 0],
    ["codex", "sessions", "日志规范化", "9 轮 · logging/", "4.2K", "neutral", 1],
    ["codex", "sessions", "单元测试补齐", "22 轮 · tests/", "7.8K", "neutral", 2],
    ["codex", "sessions", "CI 流水线", "11 轮 · .github/", "5.0K", "neutral", 3],
    ["codex", "sessions", "依赖升级", "14 轮 · package.json", "6.4K", "neutral", 4],
    ["codex", "sessions", "文档同步", "7 轮 · docs/", "2.9K", "neutral", 5],
    ["gemini", "providers", "Google AI Studio", "generativelanguage.googleapis.com", "活跃", "active", 0],
    ["gemini", "mcp", "drive-mcp", "Google Drive 只读", "", "ok", 0],
    ["gemini", "mcp", "search-mcp", "联网搜索", "", "ok", 1],
    ["gemini", "mcp", "calendar-mcp", "日历事件", "", "warn", 2],
    ["opencode", "providers", "OpenCode Cloud", "connect.opencode.ai", "活跃", "active", 0],
    ["opencode", "providers", "本地 Ollama", "127.0.0.1:11434", "备用", "standby", 1],
    ["opencode", "providers", "Groq", "api.groq.com", "备用", "standby", 2],
    ["opencode", "sessions", "插件系统 PoC", "40 轮 · plugins/", "21.3K", "neutral", 0],
    ["opencode", "sessions", "主题与 i18n", "15 轮 · ui/", "5.6K", "neutral", 1],
    ["opencode", "sessions", "性能剖析", "19 轮 · perf/", "8.9K", "neutral", 2],
    ["opencode", "sessions", "快捷键绑定", "8 轮 · keymap/", "3.1K", "neutral", 3],
    ["opencode", "sessions", "终端集成", "12 轮 · terminal/", "4.7K", "neutral", 4],
    ["opencode", "sessions", "工作区索引", "26 轮 · index/", "11.2K", "neutral", 5],
    ["opencode", "sessions", "协作会话", "10 轮 · collab/", "4.0K", "neutral", 6],
    ["opencode", "sessions", "错误上报", "6 轮 · telemetry/", "2.2K", "neutral", 7],
    ["openclaw", "providers", "ClawHeart 网关", "api.clawheart.live", "活跃", "active", 0],
    ["openclaw", "providers", "直连上游", "自定义 base", "备用", "standby", 1],
    ["openclaw", "skills", "workspace-init", "工作区脚手架", "已安装", "installed", 0],
    ["openclaw", "skills", "security-audit", "依赖与密钥扫描", "已安装", "installed", 1],
    ["openclaw", "skills", "release-notes", "发版说明生成", "已安装", "installed", 2],
    ["openclaw", "skills", "openapi-lint", "OpenAPI 规范检查", "已安装", "installed", 3],
    ["openclaw", "skills", "docker-compose-gen", "Compose 草稿", "已安装", "installed", 4],
    ["openclaw", "mcp", "clawhub-bridge", "ClawHub 技能桥接", "", "ok", 0],
  ];
  database.serialize(() => {
    const ps = database.prepare(
      "INSERT INTO agent_platforms (code, display_name, accent, sort_order) VALUES (?, ?, ?, ?)"
    );
    for (const p of platforms) {
      ps.run(p[0], p[1], p[2], p[3]);
    }
    ps.finalize();
    const is = database.prepare(
      `INSERT INTO local_agent_items (platform_code, feature_type, name, subtitle, status_label, status_kind, sort_order, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const row of items) {
      is.run(row[0], row[1], row[2], row[3], row[4] || null, row[5] || null, row[6], now);
    }
    is.finalize();
  });
}

function getOpenClawSettings() {
  const database = getDb();
  return new Promise((resolve) => {
    database.get("SELECT ui_url, install_cmd FROM local_openclaw_settings WHERE id = 1", (err, row) => {
      if (err || !row) {
        resolve({
          uiUrl: "http://localhost:3000",
          installCmd: "",
        });
      } else {
        resolve({
          uiUrl: row.ui_url || "http://localhost:3000",
          installCmd: row.install_cmd || "",
        });
      }
    });
  });
}

function saveOpenClawSettings(settings) {
  const database = getDb();
  const uiUrl = String(settings?.uiUrl || "http://localhost:3000");
  const installCmd = String(settings?.installCmd || "");
  return new Promise((resolve, reject) => {
    database.run(
      `INSERT INTO local_openclaw_settings (id, ui_url, install_cmd)
       VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET ui_url = excluded.ui_url, install_cmd = excluded.install_cmd`,
      [uiUrl, installCmd],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
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

function updateUserDangerCommand(id, enabled) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.run(
      `UPDATE danger_commands SET user_enabled = ? WHERE id = ?`,
      [enabled ? 1 : 0, id],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function getSyncUserDangersToCloud() {
  const database = getDb();
  return new Promise((resolve) => {
    database.get("SELECT sync_user_dangers_to_cloud FROM local_user_settings WHERE id = 1", (err, row) => {
      if (err || !row || typeof row.sync_user_dangers_to_cloud !== "number") {
        resolve(1);
      } else {
        resolve(row.sync_user_dangers_to_cloud);
      }
    });
  });
}

function saveSyncUserDangersToCloud(value) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.run(
      `INSERT INTO local_user_settings (id, sync_user_dangers_to_cloud)
       VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET sync_user_dangers_to_cloud = excluded.sync_user_dangers_to_cloud`,
      [value ? 1 : 0],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function getLastKnownVersion() {
  const database = getDb();
  return new Promise((resolve) => {
    database.get("SELECT last_known_version FROM local_sync_state WHERE id = 1", (err, row) => {
      if (err || !row) {
        resolve(0);
      } else {
        resolve(row.last_known_version || 0);
      }
    });
  });
}

function saveLastKnownVersion(version) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.run(
      `INSERT INTO local_sync_state (id, last_known_version)
       VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET last_known_version = excluded.last_known_version`,
      [version],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
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
      const stmt = database.prepare(
        "INSERT INTO skills (id, slug, name, type, category, status, short_desc, updated_at, source_name, safe_mark_count, unsafe_mark_count, user_safety_label, market_featured, market_safe_recommended, hot_score, download_count, favorite_count, star_rating, publisher_verified, security_grade, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      for (const r of rows) {
        stmt.run(
          r.id || null,
          r.slug,
          r.name || null,
          r.type || null,
          r.category || null,
          r.status,
          r.short_desc || null,
          r.updated_at || null,
          r.source_name || null,
          r.safe_mark_count || 0,
          r.unsafe_mark_count || 0,
          r.user_safety_label || null,
          r.market_featured ? 1 : 0,
          r.market_safe_recommended ? 1 : 0,
          typeof r.hot_score === "number" ? r.hot_score : 0,
          r.download_count || 0,
          r.favorite_count || 0,
          r.star_rating != null && r.star_rating !== "" ? Number(r.star_rating) : null,
          r.publisher_verified ? 1 : 0,
          r.security_grade || null,
          r.published_at || null,
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

function upsertSkills(rows) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.serialize(() => {
      const stmt = database.prepare(
        `INSERT INTO skills (id, slug, name, type, category, status, short_desc, updated_at, source_name, safe_mark_count, unsafe_mark_count, user_safety_label, market_featured, market_safe_recommended, hot_score, download_count, favorite_count, star_rating, publisher_verified, security_grade, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(slug) DO UPDATE SET
           id = excluded.id,
           name = excluded.name,
           type = excluded.type,
           category = excluded.category,
           status = excluded.status,
           short_desc = excluded.short_desc,
           updated_at = excluded.updated_at,
           source_name = excluded.source_name,
           safe_mark_count = excluded.safe_mark_count,
           unsafe_mark_count = excluded.unsafe_mark_count,
           user_safety_label = excluded.user_safety_label,
           market_featured = excluded.market_featured,
           market_safe_recommended = excluded.market_safe_recommended,
           hot_score = excluded.hot_score,
           download_count = excluded.download_count,
           favorite_count = excluded.favorite_count,
           star_rating = excluded.star_rating,
           publisher_verified = excluded.publisher_verified,
           security_grade = excluded.security_grade,
           published_at = excluded.published_at`
      );
      for (const r of rows) {
        stmt.run(
          r.id || null,
          r.slug,
          r.name || null,
          r.type || null,
          r.category || null,
          r.status,
          r.short_desc || null,
          r.updated_at || null,
          r.source_name || null,
          r.safe_mark_count || 0,
          r.unsafe_mark_count || 0,
          r.user_safety_label || null,
          r.market_featured ? 1 : 0,
          r.market_safe_recommended ? 1 : 0,
          typeof r.hot_score === "number" ? r.hot_score : 0,
          r.download_count || 0,
          r.favorite_count || 0,
          r.star_rating != null && r.star_rating !== "" ? Number(r.star_rating) : null,
          r.publisher_verified ? 1 : 0,
          r.security_grade || null,
          r.published_at || null,
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

function getLocalSettings() {
  const database = getDb();
  return new Promise((resolve) => {
    database.get("SELECT api_base, oc_api_key, llm_key FROM local_settings WHERE id = 1", (err, row) => {
      if (err || !row) {
        // 默认回退到本机 Spring Boot 端口 8080，避免用户必须手动配置
        resolve({
          apiBase: "https://api.clawheart.live",
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

function upsertUserSkill(slug, enabled) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.run(
      `INSERT INTO user_skills (slug, enabled)
       VALUES (?, ?)
       ON CONFLICT(slug) DO UPDATE SET enabled = excluded.enabled`,
      [slug, enabled ? 1 : 0],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function upsertUserSkillSafetyLabel(slug, label) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.run(
      `INSERT INTO user_skill_safety_labels (slug, label)
       VALUES (?, ?)
       ON CONFLICT(slug) DO UPDATE SET label = excluded.label`,
      [slug, String(label || "").toUpperCase()],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function getSyncUserSkillsToCloud() {
  const database = getDb();
  return new Promise((resolve) => {
    database.get("SELECT sync_user_skills_to_cloud FROM local_user_settings WHERE id = 1", (err, row) => {
      if (err || !row || typeof row.sync_user_skills_to_cloud !== "number") {
        resolve(1);
      } else {
        resolve(row.sync_user_skills_to_cloud);
      }
    });
  });
}

function saveSyncUserSkillsToCloud(value) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.run(
      `INSERT INTO local_user_settings (id, sync_user_skills_to_cloud)
       VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET sync_user_skills_to_cloud = excluded.sync_user_skills_to_cloud`,
      [value ? 1 : 0],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function getLocalAuth() {
  const database = getDb();
  return new Promise((resolve) => {
    database.get("SELECT email, token, display_name FROM local_auth WHERE id = 1", (err, row) => {
      if (err || !row) {
        resolve(null);
      } else {
        const dn = row.display_name != null && String(row.display_name).trim() ? String(row.display_name).trim() : null;
        resolve({
          email: row.email,
          token: row.token,
          displayName: dn,
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

function ensureDefaultLlmMappings() {
  const database = getDb();
  const defaults = [
    { prefix: "openai", target_base: "https://api.openai.com" },
    { prefix: "deepseek", target_base: "https://api.deepseek.com" },
    { prefix: "anthropic", target_base: "https://api.anthropic.com" },
    { prefix: "gemini", target_base: "https://generativelanguage.googleapis.com" },
  ];
  return new Promise((resolve, reject) => {
    database.serialize(() => {
      database.get("SELECT COUNT(1) AS c FROM local_llm_mappings", (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        const count = row?.c ?? 0;
        if (count > 0) {
          resolve(false);
          return;
        }
        const stmt = database.prepare(
          "INSERT OR IGNORE INTO local_llm_mappings (prefix, target_base) VALUES (?, ?)"
        );
        for (const d of defaults) {
          stmt.run(d.prefix, d.target_base, (e) => {
            if (e) reject(e);
          });
        }
        stmt.finalize((e) => {
          if (e) reject(e);
          else resolve(true);
        });
      });
    });
  });
}

function saveLocalAuth(auth) {
  const database = getDb();
  const displayName =
    auth.displayName != null && String(auth.displayName).trim() ? String(auth.displayName).trim() : null;
  return new Promise((resolve, reject) => {
    database.run(
      `INSERT INTO local_auth (id, email, token, display_name)
       VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET email = excluded.email, token = excluded.token, display_name = excluded.display_name`,
      [auth.email, auth.token, displayName],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function clearLocalAuth() {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.run("DELETE FROM local_auth WHERE id = 1", (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function clearLocalUserScopedState() {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.serialize(() => {
      database.run("DELETE FROM user_skills");
      database.run("DELETE FROM user_skill_safety_labels");
      database.run("UPDATE danger_commands SET user_enabled = NULL");
      database.run("UPDATE skills SET user_safety_label = NULL", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function startOfUtcDayIso(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

function startOfUtcWeekIso(d = new Date()) {
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff)).toISOString();
}

function startOfUtcMonthIso(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

function listLlmBudgetSettings() {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.all(
      "SELECT * FROM llm_budget_settings ORDER BY provider_key COLLATE NOCASE, model_id COLLATE NOCASE",
      (err, rows = []) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function upsertLlmBudgetSetting(row) {
  const database = getDb();
  const now = new Date().toISOString();
  const provider_key = String(row.provider_key || "default").trim() || "default";
  const model_id = String(row.model_id || "*").trim() || "*";
  const input_usd_per_1k = Number(row.input_usd_per_1k) || 0;
  const output_usd_per_1k = Number(row.output_usd_per_1k) || 0;
  const budget_day_usd =
    row.budget_day_usd === null || row.budget_day_usd === undefined || row.budget_day_usd === ""
      ? null
      : Number(row.budget_day_usd);
  const budget_week_usd =
    row.budget_week_usd === null || row.budget_week_usd === undefined || row.budget_week_usd === ""
      ? null
      : Number(row.budget_week_usd);
  const budget_month_usd =
    row.budget_month_usd === null || row.budget_month_usd === undefined || row.budget_month_usd === ""
      ? null
      : Number(row.budget_month_usd);
  const enabled = row.enabled === false || row.enabled === 0 ? 0 : 1;

  return new Promise((resolve, reject) => {
    database.run(
      `INSERT INTO llm_budget_settings (
        provider_key, model_id, input_usd_per_1k, output_usd_per_1k,
        budget_day_usd, budget_week_usd, budget_month_usd, enabled, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider_key, model_id) DO UPDATE SET
        input_usd_per_1k = excluded.input_usd_per_1k,
        output_usd_per_1k = excluded.output_usd_per_1k,
        budget_day_usd = excluded.budget_day_usd,
        budget_week_usd = excluded.budget_week_usd,
        budget_month_usd = excluded.budget_month_usd,
        enabled = excluded.enabled,
        updated_at = excluded.updated_at`,
      [
        provider_key,
        model_id,
        input_usd_per_1k,
        output_usd_per_1k,
        Number.isFinite(budget_day_usd) ? budget_day_usd : null,
        Number.isFinite(budget_week_usd) ? budget_week_usd : null,
        Number.isFinite(budget_month_usd) ? budget_month_usd : null,
        enabled,
        now,
      ],
      function (err) {
        if (err) reject(err);
        else {
          database.get(
            "SELECT id FROM llm_budget_settings WHERE provider_key = ? AND model_id = ?",
            [provider_key, model_id],
            (e2, r2) => {
              if (e2) reject(e2);
              else resolve({ id: r2?.id, provider_key, model_id });
            }
          );
        }
      }
    );
  });
}

function deleteLlmBudgetSetting(id) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.run("DELETE FROM llm_budget_settings WHERE id = ?", [Number(id)], function (err) {
      if (err) reject(err);
      else resolve({ changes: this.changes });
    });
  });
}

function sumLlmUsageCostSince(provider_key, modelPattern, sinceIso) {
  const database = getDb();
  const pk = String(provider_key || "default");
  const sql =
    modelPattern === "*"
      ? `SELECT COALESCE(SUM(cost_usd), 0) AS s FROM llm_usage_cost_events
         WHERE provider_key = ? AND datetime(created_at) >= datetime(?)`
      : `SELECT COALESCE(SUM(cost_usd), 0) AS s FROM llm_usage_cost_events
         WHERE provider_key = ? AND model_id = ? AND datetime(created_at) >= datetime(?)`;
  const params = modelPattern === "*" ? [pk, sinceIso] : [pk, String(modelPattern), sinceIso];
  return new Promise((resolve, reject) => {
    database.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(Number(row?.s || 0));
    });
  });
}

function insertLlmUsageCostEvent(ev) {
  const database = getDb();
  const created_at = ev.created_at || new Date().toISOString();
  return new Promise((resolve, reject) => {
    database.run(
      `INSERT INTO llm_usage_cost_events (
        created_at, provider_key, model_id, prompt_tokens, completion_tokens, total_tokens, cost_usd, route_mode, request_path,
        latency_ms,
        cloud_id, upstream_base, client_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        created_at,
        String(ev.provider_key || "default"),
        String(ev.model_id || ""),
        ev.prompt_tokens != null ? Number(ev.prompt_tokens) : null,
        ev.completion_tokens != null ? Number(ev.completion_tokens) : null,
        ev.total_tokens != null ? Number(ev.total_tokens) : null,
        Number(ev.cost_usd) || 0,
        ev.route_mode != null ? String(ev.route_mode) : null,
        ev.request_path != null ? String(ev.request_path) : null,
        ev.latency_ms != null ? Number(ev.latency_ms) : null,
        ev.cloud_id != null && ev.cloud_id !== "" ? Number(ev.cloud_id) : null,
        ev.upstream_base != null ? String(ev.upstream_base) : null,
        ev.client_id != null ? String(ev.client_id) : null,
      ],
      function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
}

function updateLlmUsageEventCloudId(localId, cloudId) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.run(
      "UPDATE llm_usage_cost_events SET cloud_id = ? WHERE id = ?",
      [Number(cloudId), Number(localId)],
      function (err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      }
    );
  });
}

function listPendingTokenUsagePush(limit = 200) {
  const database = getDb();
  const n = Math.min(500, Math.max(1, Number(limit) || 200));
  return new Promise((resolve, reject) => {
    database.all(
      "SELECT * FROM llm_usage_cost_events WHERE cloud_id IS NULL ORDER BY id ASC LIMIT ?",
      [n],
      (err, rows = []) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function getMaxCloudIdForLocalTokenUsages() {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.get("SELECT COALESCE(MAX(cloud_id), 0) AS m FROM llm_usage_cost_events", (err, row) => {
      if (err) reject(err);
      else resolve(Number(row?.m || 0));
    });
  });
}

/** 自云端 sync/pull 下行：按 cloud_id 去重 */
function insertLlmUsageFromCloudPull(row) {
  const cloudId = Number(row.id);
  if (!Number.isFinite(cloudId)) {
    return Promise.resolve({ inserted: false, reason: "bad_id" });
  }
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.get("SELECT id FROM llm_usage_cost_events WHERE cloud_id = ?", [cloudId], (err, existing) => {
      if (err) {
        reject(err);
        return;
      }
      if (existing) {
        resolve({ inserted: false });
        return;
      }
      database.run(
        `INSERT INTO llm_usage_cost_events (
          created_at, provider_key, model_id, prompt_tokens, completion_tokens, total_tokens, cost_usd, route_mode, request_path,
          latency_ms,
          cloud_id, upstream_base, client_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.createdAt && String(row.createdAt).trim() ? String(row.createdAt) : new Date().toISOString(),
          String(row.providerKey || "default"),
          String(row.model || ""),
          row.promptTokens != null ? Number(row.promptTokens) : null,
          row.completionTokens != null ? Number(row.completionTokens) : null,
          row.totalTokens != null ? Number(row.totalTokens) : null,
          row.costUsd != null ? Number(row.costUsd) : 0,
          row.routeMode != null ? String(row.routeMode) : null,
          row.requestPath != null ? String(row.requestPath) : null,
          null,
          cloudId,
          row.upstreamBase != null ? String(row.upstreamBase) : null,
          row.clientId != null ? String(row.clientId) : null,
        ],
        function (e2) {
          if (e2) reject(e2);
          else resolve({ inserted: true, localId: this.lastID });
        }
      );
    });
  });
}

function listLlmUsageCostEventsRecent(limit = 50) {
  const database = getDb();
  const n = Math.min(200, Math.max(1, Number(limit) || 50));
  return new Promise((resolve, reject) => {
    database.all(
      `SELECT * FROM llm_usage_cost_events ORDER BY datetime(created_at) DESC, id DESC LIMIT ?`,
      [n],
      (err, rows = []) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function countLlmUsageCostEvents() {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.get(`SELECT COUNT(1) AS c FROM llm_usage_cost_events`, (err, row) => {
      if (err) reject(err);
      else resolve(Number(row?.c || 0));
    });
  });
}

/** page 从 1 开始 */
function listLlmUsageCostEventsPaged(page, size) {
  const database = getDb();
  const safeSize = Math.min(200, Math.max(1, Number(size) || 50));
  const safePage = Math.max(1, Number(page) || 1);
  const offset = (safePage - 1) * safeSize;
  return new Promise((resolve, reject) => {
    database.all(
      `SELECT * FROM llm_usage_cost_events ORDER BY datetime(created_at) DESC, id DESC LIMIT ? OFFSET ?`,
      [safeSize, offset],
      (err, rows = []) => {
        if (err) reject(err);
        else resolve({ rows, page: safePage, size: safeSize });
      }
    );
  });
}

function aggregateLlmUsageSince(sinceIso) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.get(
      `SELECT
        COALESCE(SUM(cost_usd), 0) AS cost_usd,
        COALESCE(SUM(total_tokens), 0) AS total_tokens,
        COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
        COALESCE(SUM(completion_tokens), 0) AS completion_tokens,
        COUNT(1) AS request_count,
        COUNT(latency_ms) AS latency_count,
        AVG(latency_ms) AS avg_latency_ms
       FROM llm_usage_cost_events
       WHERE datetime(created_at) >= datetime(?)`,
      [sinceIso],
      (err, row) => {
        if (err) reject(err);
        else
          resolve({
            costUsd: Number(row?.cost_usd || 0),
            totalTokens: Number(row?.total_tokens || 0),
            promptTokens: Number(row?.prompt_tokens || 0),
            completionTokens: Number(row?.completion_tokens || 0),
            requestCount: Number(row?.request_count || 0),
            avgLatencyMs: Number(row?.latency_count || 0) > 0 ? Number(row?.avg_latency_ms) : null,
          });
      }
    );
  });
}

function insertProxyRequestLog(ev) {
  const database = getDb();
  const created_at = ev.created_at || new Date().toISOString();
  return new Promise((resolve, reject) => {
    database.run(
      `INSERT INTO proxy_request_logs (
        created_at, provider_key, model_id, route_mode, request_path, status_code, block_type,
        prompt_tokens, completion_tokens, total_tokens, cost_usd, latency_ms, error_snippet, client_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        created_at,
        String(ev.provider_key || "default"),
        ev.model_id != null ? String(ev.model_id) : null,
        ev.route_mode != null ? String(ev.route_mode) : null,
        ev.request_path != null ? String(ev.request_path) : null,
        ev.status_code != null ? Number(ev.status_code) : null,
        ev.block_type != null ? String(ev.block_type) : null,
        ev.prompt_tokens != null ? Number(ev.prompt_tokens) : null,
        ev.completion_tokens != null ? Number(ev.completion_tokens) : null,
        ev.total_tokens != null ? Number(ev.total_tokens) : null,
        Number(ev.cost_usd) || 0,
        ev.latency_ms != null ? Number(ev.latency_ms) : null,
        ev.error_snippet != null ? String(ev.error_snippet) : null,
        ev.client_id != null ? String(ev.client_id) : null,
      ],
      function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
}

function summaryProxyRequestLogsSince(sinceIso) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.get(
      `SELECT
        COALESCE(SUM(COALESCE(total_tokens, 0)), 0) AS total_tokens,
        COALESCE(SUM(COALESCE(cost_usd, 0)), 0) AS cost_usd,
        COUNT(1) AS request_count,
        COALESCE(AVG(COALESCE(latency_ms, 0)), 0) AS avg_latency_ms
       FROM proxy_request_logs
       WHERE datetime(created_at) >= datetime(?)`,
      [sinceIso],
      (err, row) => {
        if (err) reject(err);
        else
          resolve({
            totalTokens: Number(row?.total_tokens || 0),
            costUsd: Number(row?.cost_usd || 0),
            requestCount: Number(row?.request_count || 0),
            avgLatencyMs: Number(row?.avg_latency_ms || 0),
          });
      }
    );
  });
}

function countProxyRequestLogs(blockType = null) {
  const database = getDb();
  return new Promise((resolve, reject) => {
    const where = !blockType ? "" : " WHERE block_type = ?";
    const params = !blockType ? [] : [String(blockType)];
    database.get(`SELECT COUNT(1) AS c FROM proxy_request_logs${where}`, params, (err, row) => {
      if (err) reject(err);
      else resolve(Number(row?.c || 0));
    });
  });
}

/** page 从 1 开始 */
function listProxyRequestLogsPaged(page, size, blockType = null) {
  const database = getDb();
  const safeSize = Math.min(200, Math.max(1, Number(size) || 50));
  const safePage = Math.max(1, Number(page) || 1);
  const offset = (safePage - 1) * safeSize;
  const where = !blockType ? "" : " WHERE block_type = ?";
  const params = !blockType ? [] : [String(blockType)];
  return new Promise((resolve, reject) => {
    database.all(
      `SELECT
        id, created_at, provider_key, model_id, route_mode, request_path, status_code, block_type,
        prompt_tokens, completion_tokens, total_tokens, cost_usd, latency_ms, error_snippet, client_id
       FROM proxy_request_logs${where}
       ORDER BY datetime(created_at) DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...params, safeSize, offset],
      (err, rows = []) => {
        if (err) reject(err);
        else resolve({ rows, page: safePage, size: safeSize });
      }
    );
  });
}

/** 优先精确 model，其次同 provider 下 model_id='*' */
function resolveLlmBudgetRow(provider_key, model_id) {
  const database = getDb();
  const pk = String(provider_key || "default");
  const mid = String(model_id || "").trim() || "unknown";
  return new Promise((resolve, reject) => {
    database.get(
      `SELECT * FROM llm_budget_settings WHERE provider_key = ? AND model_id = ? AND enabled = 1`,
      [pk, mid],
      (err, exact) => {
        if (err) {
          reject(err);
          return;
        }
        if (exact) {
          resolve({ row: exact, match: "exact" });
          return;
        }
        database.get(
          `SELECT * FROM llm_budget_settings WHERE provider_key = ? AND model_id = '*' AND enabled = 1`,
          [pk],
          (e2, wild) => {
            if (e2) reject(e2);
            else resolve({ row: wild || null, match: wild ? "wildcard" : "none" });
          }
        );
      }
    );
  });
}

/**
 * 若已超出任一已启用预算则返回 { blocked, period, spent, limit, ... }
 * sumPattern: wildcard 行用 '*' 汇总该 provider 下全部 model 费用
 */
async function evaluateLlmBudgetBlock(provider_key, actual_model_id, row) {
  if (!row) return { blocked: false };
  const now = new Date();
  const dayStart = startOfUtcDayIso(now);
  const weekStart = startOfUtcWeekIso(now);
  const monthStart = startOfUtcMonthIso(now);
  const sumPattern = row.model_id === "*" ? "*" : actual_model_id;

  const checks = [
    { key: "day", limit: row.budget_day_usd, since: dayStart },
    { key: "week", limit: row.budget_week_usd, since: weekStart },
    { key: "month", limit: row.budget_month_usd, since: monthStart },
  ];
  for (const c of checks) {
    const lim = c.limit;
    if (lim == null || !Number.isFinite(Number(lim)) || Number(lim) <= 0) continue;
    const spent = await sumLlmUsageCostSince(provider_key, sumPattern, c.since);
    if (spent >= Number(lim)) {
      return {
        blocked: true,
        period: c.key,
        spent,
        limit: Number(lim),
        provider_key,
        model_id: actual_model_id,
        rule_model_id: row.model_id,
      };
    }
  }
  return { blocked: false };
}

function computeLlmCostUsd(row, promptTokens, completionTokens) {
  if (!row) return 0;
  const pi = Number(row.input_usd_per_1k) || 0;
  const po = Number(row.output_usd_per_1k) || 0;
  const p = Math.max(0, Number(promptTokens) || 0);
  const c = Math.max(0, Number(completionTokens) || 0);
  return (p / 1000) * pi + (c / 1000) * po;
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
  getOpenClawSettings,
  saveOpenClawSettings,
  getLlmRouteMode,
  saveLlmRouteMode,
  listLlmMappings,
  upsertLlmMapping,
  deleteLlmMapping,
  ensureDefaultLlmMappings,
  replaceUserSkills,
  upsertUserSkill,
  upsertUserSkillSafetyLabel,
  getSyncUserSkillsToCloud,
  saveSyncUserSkillsToCloud,
  getLocalAuth,
  saveLocalAuth,
  clearLocalAuth,
  clearLocalUserScopedState,
  applyUserDangerPrefs,
  updateUserDangerCommand,
  getSyncUserDangersToCloud,
  saveSyncUserDangersToCloud,
  getLastKnownVersion,
  saveLastKnownVersion,
  startOfUtcDayIso,
  startOfUtcWeekIso,
  startOfUtcMonthIso,
  listLlmBudgetSettings,
  upsertLlmBudgetSetting,
  deleteLlmBudgetSetting,
  sumLlmUsageCostSince,
  insertLlmUsageCostEvent,
  updateLlmUsageEventCloudId,
  listPendingTokenUsagePush,
  getMaxCloudIdForLocalTokenUsages,
  insertLlmUsageFromCloudPull,
  listLlmUsageCostEventsRecent,
  countLlmUsageCostEvents,
  listLlmUsageCostEventsPaged,
  aggregateLlmUsageSince,
  insertProxyRequestLog,
  summaryProxyRequestLogsSince,
  countProxyRequestLogs,
  listProxyRequestLogsPaged,
  resolveLlmBudgetRow,
  evaluateLlmBudgetBlock,
  computeLlmCostUsd,
};

