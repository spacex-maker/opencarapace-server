-- baseline_tls_files：静态项里原 remediation 偏 Windows（%APPDATA%），改为 Win/macOS/Linux 通用表述。
SET NAMES utf8mb4;

UPDATE oc_security_scan_items
SET spec_json = '{"staticFindings":[{"severity":"PASS","title":"建议启用 HTTPS 与校验证书","detail":"访问云端 API 时使用 HTTPS；避免在不可信网络下明文传输 Token。","remediation":"在设置中确认 apiBase 为 https:// 开头；系统时间准确以便校验证书。","location":"设置 › 云端基地址"},{"severity":"WARN","title":"本地配置目录权限","detail":"确保仅当前用户可读写本地数据库与 Token 存储目录；避免多用户共享配置路径。","remediation":"Windows：检查 %APPDATA% 下应用数据目录 ACL；macOS：检查 ~/Library/Application Support 与权限；类 Unix：检查 ~/.config 等目录权限。日常勿以管理员/root 身份运行客户端。","location":"本机文件系统"}]}',
    updated_at = NOW()
WHERE code = 'baseline_tls_files'
  AND scanner_type = 'STATIC_INFO';
