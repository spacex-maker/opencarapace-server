-- =============================================================================
-- 删除 OpenCarapace 全部表（按外键依赖逆序，避免约束错误）
-- 执行前请确认数据库与备份；建议：mysql ... opencarapace < drop_all_tables.sql
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS oc_safety_evaluations;
DROP TABLE IF EXISTS oc_api_keys;
DROP TABLE IF EXISTS oc_tool_definitions;
DROP TABLE IF EXISTS oc_danger_commands;
DROP TABLE IF EXISTS oc_system_config;
DROP TABLE IF EXISTS oc_users;

SET FOREIGN_KEY_CHECKS = 1;
