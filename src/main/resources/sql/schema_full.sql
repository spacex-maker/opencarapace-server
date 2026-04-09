-- =============================================================================
-- OpenCarapace 全量建表脚本（与 JPA 实体一致，含注释）
-- 执行前请确保数据库已创建；建议：mysql ... opencarapace < schema_full.sql
-- 字符集：SET NAMES utf8mb4; 执行时建议加 --default-character-set=utf8mb4
-- =============================================================================

SET NAMES utf8mb4;

-- -----------------------------------------------------------------------------
-- 1. 用户表
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS oc_users (
    id              BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    email           VARCHAR(255) NOT NULL                COMMENT '邮箱，唯一',
    display_name    VARCHAR(255) DEFAULT NULL            COMMENT '显示名称',
    avatar_url      VARCHAR(512) DEFAULT NULL            COMMENT '头像 URL',
    provider        VARCHAR(64)  DEFAULT NULL            COMMENT '登录来源：local / google 等',
    provider_id     VARCHAR(255) DEFAULT NULL            COMMENT '第三方 provider 下的用户 ID',
    role            VARCHAR(64)  DEFAULT NULL            COMMENT '角色：USER / ADMIN',
    password_hash   VARCHAR(255) DEFAULT NULL            COMMENT '仅邮箱密码用户：BCrypt 哈希，OAuth 用户为 null',
    created_at      DATETIME(6)  DEFAULT NULL            COMMENT '创建时间',
    updated_at      DATETIME(6)  DEFAULT NULL            COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_oc_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户表';

-- -----------------------------------------------------------------------------
-- 2. 系统配置表（API Key、开关等键值对）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS oc_system_config (
    id           BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    config_key   VARCHAR(255) NOT NULL                COMMENT '配置键，如 deepseek.api_key、tavily.api_key',
    config_value TEXT         DEFAULT NULL            COMMENT '配置值',
    description  VARCHAR(512) DEFAULT NULL           COMMENT '说明',
    created_at   DATETIME(6)  DEFAULT NULL             COMMENT '创建时间',
    updated_at   DATETIME(6)  DEFAULT NULL             COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_oc_system_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='系统配置表';

-- -----------------------------------------------------------------------------
-- 3. 危险指令库表
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS oc_danger_commands (
    id               BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    command_pattern  VARCHAR(512) NOT NULL                COMMENT '指令或模式，如 rm -rf、DROP TABLE',
    system_type      VARCHAR(32)  NOT NULL                COMMENT '系统类型：LINUX,WINDOWS,DATABASE,SHELL,DOCKER,KUBERNETES,GIT,OTHER',
    category         VARCHAR(32)  NOT NULL                COMMENT '危险分类：FILE_SYSTEM,DATABASE,NETWORK,PROCESS,PERMISSION,CONTAINER,VERSION_CONTROL,OTHER',
    risk_level       VARCHAR(16)  NOT NULL                COMMENT '风险等级：CRITICAL,HIGH,MEDIUM,LOW',
    title            VARCHAR(255) NOT NULL                COMMENT '简短标题',
    description      TEXT         DEFAULT NULL            COMMENT '说明：为何危险、典型场景',
    mitigation       TEXT         DEFAULT NULL            COMMENT '缓解建议：替代方案、使用注意',
    tags             VARCHAR(512) DEFAULT NULL            COMMENT '标签，逗号分隔',
    enabled          TINYINT(1)   NOT NULL DEFAULT 1      COMMENT '是否启用：1=是，0=否',
    created_at       DATETIME(6)  DEFAULT NULL            COMMENT '创建时间',
    updated_at       DATETIME(6)  DEFAULT NULL            COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_oc_danger_commands_pattern_system (command_pattern, system_type),
    KEY idx_oc_danger_commands_system_type (system_type),
    KEY idx_oc_danger_commands_category (category),
    KEY idx_oc_danger_commands_risk_level (risk_level),
    KEY idx_oc_danger_commands_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='云端危险指令库';

-- -----------------------------------------------------------------------------
-- 3.1 用户级危险指令配置表（用户个性化启用/禁用）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS oc_user_danger_commands (
    id                 BIGINT      NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id            BIGINT      NOT NULL COMMENT 'oc_users.id',
    danger_command_id  BIGINT      NOT NULL COMMENT 'oc_danger_commands.id',
    enabled            TINYINT(1)  NOT NULL DEFAULT 1 COMMENT '用户是否启用该危险指令',
    created_at         DATETIME(6) DEFAULT NULL,
    updated_at         DATETIME(6) DEFAULT NULL,
    UNIQUE KEY uk_user_danger (user_id, danger_command_id),
    CONSTRAINT fk_oc_user_danger_user FOREIGN KEY (user_id) REFERENCES oc_users (id),
    CONSTRAINT fk_oc_user_danger_command FOREIGN KEY (danger_command_id) REFERENCES oc_danger_commands (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户自定义危险指令启用设置';

-- -----------------------------------------------------------------------------
-- 4. API Key 表（依赖 oc_users）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS oc_api_keys (
    id          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    user_id     BIGINT       NOT NULL                COMMENT '所属用户 id',
    key_hash    VARCHAR(255) NOT NULL                COMMENT 'Key 的 SHA-256 哈希，唯一',
    label       VARCHAR(128) NOT NULL               COMMENT '描述/标签',
    scopes      VARCHAR(255) DEFAULT NULL           COMMENT '权限范围，逗号分隔',
    active      TINYINT(1)   NOT NULL DEFAULT 1      COMMENT '是否启用：1=是，0=否',
    expires_at  DATETIME(6)  DEFAULT NULL            COMMENT '过期时间',
    last_used_at DATETIME(6) DEFAULT NULL            COMMENT '最后使用时间',
    created_at  DATETIME(6)  DEFAULT NULL            COMMENT '创建时间',
    updated_at  DATETIME(6)  DEFAULT NULL            COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_oc_api_keys_key_hash (key_hash),
    KEY idx_oc_api_keys_user_id (user_id),
    CONSTRAINT fk_oc_api_keys_user FOREIGN KEY (user_id) REFERENCES oc_users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='API Key 表';

-- -----------------------------------------------------------------------------
-- 5. 工具定义表（依赖 oc_users）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS oc_tool_definitions (
    id                  BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    name                VARCHAR(255) NOT NULL                COMMENT '工具名称',
    type                VARCHAR(64)  NOT NULL                COMMENT '类型',
    description         VARCHAR(512) DEFAULT NULL             COMMENT '描述',
    provider            VARCHAR(255) DEFAULT NULL             COMMENT '提供方',
    source_system       VARCHAR(255) DEFAULT NULL             COMMENT '来源系统',
    category            VARCHAR(255) DEFAULT NULL             COMMENT '分类',
    tags                VARCHAR(1024) DEFAULT NULL            COMMENT '标签',
    risk_level          VARCHAR(64)  DEFAULT NULL             COMMENT '风险等级',
    approval_status     VARCHAR(64)  DEFAULT NULL             COMMENT '审批状态',
    input_schema        TEXT         DEFAULT NULL             COMMENT '输入 schema',
    output_schema       TEXT         DEFAULT NULL             COMMENT '输出 schema',
    example_usage       TEXT         DEFAULT NULL             COMMENT '示例用法',
    policy_hints        TEXT         DEFAULT NULL             COMMENT '策略提示',
    owner_id            BIGINT       DEFAULT NULL             COMMENT '负责人用户 id',
    last_reviewed_at    DATETIME(6)  DEFAULT NULL             COMMENT '最后审核时间',
    last_reviewed_by    VARCHAR(255) DEFAULT NULL             COMMENT '最后审核人',
    external_reference  VARCHAR(255) DEFAULT NULL             COMMENT '外部引用',
    created_at          DATETIME(6)  DEFAULT NULL             COMMENT '创建时间',
    updated_at          DATETIME(6)  DEFAULT NULL             COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_oc_tool_definitions_owner_id (owner_id),
    CONSTRAINT fk_oc_tool_definitions_owner FOREIGN KEY (owner_id) REFERENCES oc_users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='工具定义表';

-- -----------------------------------------------------------------------------
-- 6. 安全评估记录表（依赖 oc_users, oc_api_keys, oc_tool_definitions）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS oc_safety_evaluations (
    id                 BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    user_id            BIGINT       DEFAULT NULL            COMMENT '触发用户 id',
    api_key_id         BIGINT       DEFAULT NULL            COMMENT '使用的 API Key id',
    tool_id            BIGINT       DEFAULT NULL            COMMENT '涉及工具 id',
    input_type         VARCHAR(64)  NOT NULL                COMMENT '输入类型',
    input_summary      VARCHAR(512) DEFAULT NULL             COMMENT '输入摘要',
    raw_input          TEXT         DEFAULT NULL             COMMENT '原始输入',
    verdict            VARCHAR(64)  DEFAULT NULL             COMMENT '结论',
    risk_level         VARCHAR(64)  DEFAULT NULL             COMMENT '风险等级',
    reasons            TEXT         DEFAULT NULL             COMMENT '原因说明',
    policies_triggered VARCHAR(255) DEFAULT NULL             COMMENT '触发的策略',
    llm_model         VARCHAR(255) DEFAULT NULL              COMMENT '使用的 LLM 模型',
    llm_score         VARCHAR(64)  DEFAULT NULL              COMMENT 'LLM 评分',
    created_at         DATETIME(6)  DEFAULT NULL              COMMENT '创建时间',
    PRIMARY KEY (id),
    KEY idx_oc_safety_evaluations_user_id (user_id),
    KEY idx_oc_safety_evaluations_api_key_id (api_key_id),
    KEY idx_oc_safety_evaluations_tool_id (tool_id),
    CONSTRAINT fk_oc_safety_evaluations_user    FOREIGN KEY (user_id)    REFERENCES oc_users (id),
    CONSTRAINT fk_oc_safety_evaluations_api_key FOREIGN KEY (api_key_id) REFERENCES oc_api_keys (id),
    CONSTRAINT fk_oc_safety_evaluations_tool   FOREIGN KEY (tool_id)    REFERENCES oc_tool_definitions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='安全评估记录表';

-- -----------------------------------------------------------------------------
-- 7. 全端埋点事件表（Web + 客户端）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS oc_user_event_logs (
    id                 BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    event_id           VARCHAR(64)  NOT NULL                COMMENT '事件唯一 ID（幂等去重）',
    event_name         VARCHAR(64)  NOT NULL                COMMENT '事件名，例如 page_view',
    event_time         DATETIME(6)  NOT NULL                COMMENT '事件发生时间（客户端时间）',
    anonymous_id       VARCHAR(64)  NOT NULL                COMMENT '匿名标识（设备/浏览器）',
    session_id         VARCHAR(64)  NOT NULL                COMMENT '会话 ID',
    platform           VARCHAR(16)  NOT NULL                COMMENT 'web/desktop/android/ios',
    app_version        VARCHAR(32)  DEFAULT NULL            COMMENT '应用版本',
    page_id            VARCHAR(128) DEFAULT NULL            COMMENT '页面或窗口标识',
    module             VARCHAR(64)  DEFAULT NULL            COMMENT '业务模块',
    event_props_json   TEXT         DEFAULT NULL            COMMENT '事件属性 JSON',
    context_props_json TEXT         DEFAULT NULL            COMMENT '上下文属性 JSON',
    ip                 VARCHAR(64)  DEFAULT NULL            COMMENT '客户端 IP',
    user_agent         VARCHAR(512) DEFAULT NULL            COMMENT 'UA',
    valid              TINYINT(1)   NOT NULL DEFAULT 1      COMMENT '事件是否有效',
    user_id            BIGINT       DEFAULT NULL            COMMENT '登录用户 ID（匿名为 null）',
    created_at         DATETIME(6)  DEFAULT NULL            COMMENT '服务端入库时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_oc_user_event_logs_event_id (event_id),
    KEY idx_oc_user_event_logs_event_name_time (event_name, event_time),
    KEY idx_oc_user_event_logs_user_time (user_id, event_time),
    KEY idx_oc_user_event_logs_anonymous_time (anonymous_id, event_time),
    KEY idx_oc_user_event_logs_session_time (session_id, event_time),
    KEY idx_oc_user_event_logs_platform_time (platform, event_time),
    CONSTRAINT fk_oc_user_event_logs_user FOREIGN KEY (user_id) REFERENCES oc_users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='全端埋点事件表';
