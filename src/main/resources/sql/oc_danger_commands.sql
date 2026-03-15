-- 云端危险指令库表（与 JPA 实体一致，主键自增）
-- id 为 BIGINT 自增；(command_pattern, system_type) 唯一，用于去重

CREATE TABLE IF NOT EXISTS oc_danger_commands (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    command_pattern VARCHAR(512) NOT NULL COMMENT '指令或模式，如 rm -rf、DROP TABLE',
    system_type     VARCHAR(32)  NOT NULL COMMENT '系统类型: LINUX,WINDOWS,DATABASE,SHELL,DOCKER,KUBERNETES,GIT,OTHER',
    category        VARCHAR(32)  NOT NULL COMMENT '危险分类: FILE_SYSTEM,DATABASE,NETWORK,PROCESS,PERMISSION,CONTAINER,VERSION_CONTROL,OTHER',
    risk_level      VARCHAR(16)  NOT NULL COMMENT '风险等级: CRITICAL,HIGH,MEDIUM,LOW',
    title           VARCHAR(255) NOT NULL COMMENT '简短标题',
    description     TEXT                  COMMENT '说明：为何危险、典型场景',
    mitigation      TEXT                  COMMENT '缓解建议：替代方案、使用注意',
    tags            VARCHAR(512)          COMMENT '标签，逗号分隔',
    enabled         TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '是否启用',
    created_at      DATETIME(6)           COMMENT '创建时间',
    updated_at      DATETIME(6)           COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_danger_commands_pattern_system (command_pattern, system_type),
    KEY idx_oc_danger_commands_system_type (system_type),
    KEY idx_oc_danger_commands_category (category),
    KEY idx_oc_danger_commands_risk_level (risk_level),
    KEY idx_oc_danger_commands_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
