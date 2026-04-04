-- 为已有库增加「大区 + 二级分组」列，并写入与 seed_oc_security_scan_items.sql 一致的分类。
-- 在 Navicat 等客户端手动执行；若列已存在（例如已由 JPA ddl-auto 创建），可删掉 ALTER 段仅保留 UPDATE。
SET NAMES utf8mb4;

ALTER TABLE oc_security_scan_items
  ADD COLUMN scan_section VARCHAR(64) NULL COMMENT 'SANDBOX_POLICY|AI_RUNTIME|AI_VULNERABILITY|OTHER' AFTER category,
  ADD COLUMN scan_group VARCHAR(64) NULL COMMENT '二级分组' AFTER scan_section;

UPDATE oc_security_scan_items SET scan_section = 'SANDBOX_POLICY', scan_group = 'SYSTEM_PROTECTION' WHERE code = 'secrets_api_key';
UPDATE oc_security_scan_items SET scan_section = 'SANDBOX_POLICY', scan_group = 'SYSTEM_PROTECTION' WHERE code = 'mcp_privilege';
UPDATE oc_security_scan_items SET scan_section = 'SANDBOX_POLICY', scan_group = 'NETWORK_ACCESS' WHERE code = 'routing_llm';
UPDATE oc_security_scan_items SET scan_section = 'AI_RUNTIME', scan_group = 'SKILLS_SECURITY' WHERE code = 'skills_governance';
UPDATE oc_security_scan_items SET scan_section = 'AI_VULNERABILITY', scan_group = 'FIREWALL_BASELINE' WHERE code = 'baseline_tls_files';
UPDATE oc_security_scan_items SET scan_section = 'AI_RUNTIME', scan_group = 'PROMPT_SECURITY' WHERE code = 'history_secrets_exposure';
UPDATE oc_security_scan_items SET scan_section = 'AI_RUNTIME', scan_group = 'SCRIPT_EXECUTION' WHERE code = 'history_danger_command_suggestion';
UPDATE oc_security_scan_items SET scan_section = 'AI_RUNTIME', scan_group = 'PROMPT_SECURITY' WHERE code = 'history_prompt_injection_risk';
UPDATE oc_security_scan_items SET scan_section = 'AI_VULNERABILITY', scan_group = 'VULNERABILITY_SCAN' WHERE code = 'supply_chain_dependencies';
UPDATE oc_security_scan_items SET scan_section = 'SANDBOX_POLICY', scan_group = 'SYSTEM_PROTECTION' WHERE code = 'logging_observability_leak';
UPDATE oc_security_scan_items SET scan_section = 'AI_RUNTIME', scan_group = 'SKILLS_SECURITY' WHERE code = 'agent_tools_scope';
UPDATE oc_security_scan_items SET scan_section = 'SANDBOX_POLICY', scan_group = 'NETWORK_ACCESS' WHERE code = 'network_egress_exposure';
UPDATE oc_security_scan_items SET scan_section = 'AI_VULNERABILITY', scan_group = 'VULNERABILITY_SCAN' WHERE code = 'baseline_updates_static';
-- 历史对话 PII：属运行时对话内容，归入 AI_RUNTIME › PRIVACY（沙箱大区下的 PRIVACY 保留给策略/同意等）
UPDATE oc_security_scan_items SET scan_section = 'AI_RUNTIME', scan_group = 'PRIVACY' WHERE code = 'history_pii_sensitive_content';
UPDATE oc_security_scan_items SET scan_section = 'AI_RUNTIME', scan_group = 'SCRIPT_EXECUTION' WHERE code = 'history_external_link_trust';
