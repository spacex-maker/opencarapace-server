-- 为已有 oc_system_config 表增加自增 id 主键（若表已是 id 主键可跳过）
-- 执行前请备份数据；若表当前主键为 config_key，按顺序执行下面两步

SET NAMES utf8mb4;

-- 第一步：增加自增 id 列
ALTER TABLE oc_system_config ADD COLUMN id BIGINT NOT NULL AUTO_INCREMENT FIRST;

-- 第二步：改为 id 主键，config_key 唯一
ALTER TABLE oc_system_config
    DROP PRIMARY KEY,
    ADD PRIMARY KEY (id),
    ADD UNIQUE KEY uk_oc_system_config_key (config_key);
