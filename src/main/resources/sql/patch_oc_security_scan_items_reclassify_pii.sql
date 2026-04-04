-- 若已执行过旧版 classification patch，可用本脚本单独把「历史 PII」挪到 AI 运行时 › 隐私分组。
SET NAMES utf8mb4;

UPDATE oc_security_scan_items
SET scan_section = 'AI_RUNTIME', scan_group = 'PRIVACY'
WHERE code = 'history_pii_sensitive_content';
