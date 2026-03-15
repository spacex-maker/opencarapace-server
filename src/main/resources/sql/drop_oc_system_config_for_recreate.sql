-- 若 oc_system_config 仍是 config_key 主键（无 id 列），先执行本脚本再重启应用，
-- 以便 Hibernate 按实体重新建表（id 自增主键 + config_key 唯一）。

SET NAMES utf8mb4;
DROP TABLE IF EXISTS oc_system_config;
