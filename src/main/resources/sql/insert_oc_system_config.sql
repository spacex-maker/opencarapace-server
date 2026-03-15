-- =============================================================================
-- 系统配置完整初始数据（与 SystemConfig 常量一致）
-- 执行前确保表 oc_system_config 已存在；INSERT IGNORE 避免重复插入
-- 执行示例：mysql --default-character-set=utf8mb4 -h HOST -P PORT -u USER -p DB < insert_oc_system_config.sql
-- =============================================================================

SET NAMES utf8mb4;

-- 危险指令库 AI 同步 | 大模型代理
INSERT IGNORE INTO oc_system_config (config_key, config_value, description, created_at, updated_at) VALUES
('deepseek.api_key', '', 'DeepSeek API Key，用于危险指令库 AI 解析与结构化提取', NOW(6), NOW(6)),
('tavily.api_key', '', 'Tavily API Key，用于互联网搜索获取危险指令相关数据', NOW(6), NOW(6)),
('danger_commands.sync.use_internet', 'false', '是否通过互联网（Tavily+DeepSeek）更新危险指令库，true=启用，false=仅使用本地/种子数据', NOW(6), NOW(6)),
('llm_proxy.upstream_url', '', '大模型代理：上游 API 地址，如 https://api.openai.com 或 https://api.deepseek.com', NOW(6), NOW(6)),
('llm_proxy.upstream_api_key', '', '大模型代理：上游 API Key（Bearer），留空保留原值', NOW(6), NOW(6)),
('llm_proxy.enabled', 'false', '大模型代理：是否启用中转，true=启用，false=关闭', NOW(6), NOW(6));
