-- 扫描项按客户端操作系统（Windows / macOS）适用范围过滤。
-- 手动执行；若 JPA 已建列可跳过 ALTER，仅作参考。
SET NAMES utf8mb4;

ALTER TABLE oc_security_scan_items
  ADD COLUMN client_os_scope VARCHAR(16) NOT NULL DEFAULT 'ALL'
    COMMENT 'ALL|WINDOWS|MACOS'
    AFTER scanner_type;

-- 以下为示例：将某编码改为仅 Windows（按需取消注释并改 code）
-- UPDATE oc_security_scan_items SET client_os_scope = 'WINDOWS' WHERE code = 'your_item_code';
-- UPDATE oc_security_scan_items SET client_os_scope = 'MACOS' WHERE code = 'your_item_code';
