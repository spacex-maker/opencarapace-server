-- 系统配置表：存储 API Key 等键值对（如 deepseek.api_key、tavily.api_key）
-- 与 JPA 实体 oc_system_config 一致，主键自增 id，config_key 唯一

CREATE TABLE IF NOT EXISTS oc_system_config (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    config_key   VARCHAR(255) NOT NULL,
    config_value TEXT,
    description  VARCHAR(512),
    created_at   DATETIME(6),
    updated_at   DATETIME(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_oc_system_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
