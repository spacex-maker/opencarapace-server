CREATE TABLE IF NOT EXISTS oc_skill_sources (
    id         BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code       VARCHAR(64)  NOT NULL UNIQUE COMMENT '来源编码，如 CLAWHUB、LOCAL',
    name       VARCHAR(128) NOT NULL COMMENT '来源名称',
    base_url   VARCHAR(512) NULL COMMENT '基础 URL（可选）',
    enabled    TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '是否启用',
    created_at DATETIME(6)  NULL,
    updated_at DATETIME(6)  NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='技能来源';

CREATE TABLE IF NOT EXISTS oc_skills (
    id            BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    source_id     BIGINT       NOT NULL COMMENT 'oc_skill_sources.id',
    external_id   VARCHAR(128) NOT NULL COMMENT '来源侧的唯一 ID',
    name          TEXT         NOT NULL COMMENT '名称',
    slug          VARCHAR(255) NOT NULL COMMENT '唯一标识',
    type          VARCHAR(64)  NOT NULL COMMENT '类型：SKILL、TOOL、AGENT 等',
    category      VARCHAR(128) NULL COMMENT '分类',
    version       VARCHAR(64)  NULL COMMENT '版本',
    status        VARCHAR(32)  NOT NULL DEFAULT 'ACTIVE' COMMENT '状态：ACTIVE/DEPRECATED/DISABLED',
    short_desc    TEXT         NULL COMMENT '短描述',
    long_desc     TEXT         NULL COMMENT '长描述',
    tags          TEXT         NULL COMMENT '标签',
    homepage_url  TEXT         NULL COMMENT '详情/文档地址',
    install_hint  TEXT         NULL COMMENT '安装提示，如 npx @clawheart/xxx',
    manifest_json JSON         NULL COMMENT '原始 manifest（JSON）',
    last_sync_at  DATETIME(6)  NULL COMMENT '最近同步时间',
    created_at    DATETIME(6)  NULL,
    updated_at    DATETIME(6)  NULL,
    UNIQUE KEY uk_source_external (source_id, external_id),
    UNIQUE KEY uk_slug (slug),
    CONSTRAINT fk_oc_skills_source FOREIGN KEY (source_id) REFERENCES oc_skill_sources (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='通用技能/能力表';

CREATE TABLE IF NOT EXISTS oc_user_skills (
    id         BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id    BIGINT       NOT NULL COMMENT 'oc_users.id',
    skill_slug VARCHAR(255) NOT NULL COMMENT 'oc_skills.slug',
    enabled    TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '是否启用该技能',
    created_at DATETIME(6)  NULL,
    updated_at DATETIME(6)  NULL,
    UNIQUE KEY uk_user_skill (user_id, skill_slug),
    CONSTRAINT fk_oc_user_skills_user FOREIGN KEY (user_id) REFERENCES oc_users (id),
    CONSTRAINT fk_oc_user_skills_skill_slug FOREIGN KEY (skill_slug) REFERENCES oc_skills (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户自定义技能启用设置';

