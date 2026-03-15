-- =============================================================================
-- 初始用户数据（仅当表为空或需要种子数据时执行）
-- 密码均为 123456（BCrypt 哈希，与 Spring Security 默认强度一致）
-- 执行前请确保 oc_users 表已存在；建议：mysql ... opencarapace < insert_oc_users_initial.sql
-- =============================================================================

SET NAMES utf8mb4;

-- 密码 123456 的 BCrypt 哈希（cost 10）
-- 若需修改密码，可用应用注册接口或 BCrypt 重新生成后替换下方 hash
INSERT IGNORE INTO oc_users (email, display_name, avatar_url, provider, provider_id, role, password_hash, created_at, updated_at) VALUES
('admin@example.com',  '管理员',   NULL, 'local', 'admin@example.com',  'ADMIN', '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', NOW(6), NOW(6)),
('user1@example.com',  '测试用户1', NULL, 'local', 'user1@example.com',  'USER',  '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', NOW(6), NOW(6)),
('user2@example.com',  '测试用户2', NULL, 'local', 'user2@example.com',  'USER',  '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', NOW(6), NOW(6));
