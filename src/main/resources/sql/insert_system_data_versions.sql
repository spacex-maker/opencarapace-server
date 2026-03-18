-- 初始化系统数据版本号配置
INSERT INTO oc_system_config (config_key, config_value, description)
VALUES 
  ('system.skills_data_version', '0', 'Skills 系统数据版本号，用于客户端轮询检测系统级变更'),
  ('system.danger_commands_data_version', '0', '危险指令系统数据版本号，用于客户端轮询检测系统级变更')
ON CONFLICT (config_key) DO NOTHING;
