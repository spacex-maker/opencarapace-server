-- 为 oc_users 表添加 settings_version 字段，用于多端同步
ALTER TABLE oc_users ADD COLUMN settings_version BIGINT NOT NULL DEFAULT 0;
