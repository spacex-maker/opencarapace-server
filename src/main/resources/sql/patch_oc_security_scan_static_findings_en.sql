-- 为 STATIC_INFO 扫描项增加 staticFindingsEn：locale=en 时返回英文静态文案（与桌面语言一致）。
SET NAMES utf8mb4;

UPDATE oc_security_scan_items
SET spec_json = '{"staticFindings":[{"severity":"PASS","title":"建议启用 HTTPS 与校验证书","detail":"访问云端 API 时使用 HTTPS；避免在不可信网络下明文传输 Token。","remediation":"在设置中确认 apiBase 为 https:// 开头；系统时间准确以便校验证书。","location":"设置 › 云端基地址"},{"severity":"WARN","title":"本地配置目录权限","detail":"确保仅当前用户可读写本地数据库与 Token 存储目录；避免多用户共享配置路径。","remediation":"Windows：检查 %APPDATA% 下应用数据目录 ACL；macOS：检查 ~/Library/Application Support 与权限；类 Unix：检查 ~/.config 等目录权限。日常勿以管理员/root 身份运行客户端。","location":"本机文件系统"}],"staticFindingsEn":[{"severity":"PASS","title":"Use HTTPS and verify certificates","detail":"Use HTTPS when calling cloud APIs; avoid sending tokens in plaintext on untrusted networks.","remediation":"Confirm apiBase uses https:// in settings; keep system time accurate for certificate validation.","location":"Settings › Cloud API base URL"},{"severity":"WARN","title":"Local configuration directory permissions","detail":"Ensure only the current user can read/write the local database and token storage paths; avoid sharing config directories across users.","remediation":"Windows: check ACLs under %APPDATA%; macOS: check ~/Library/Application Support; Unix-like: check ~/.config. Do not run the client as Administrator/root for daily work.","location":"Local filesystem"}]}',
    updated_at = NOW(6)
WHERE code = 'baseline_tls_files'
  AND scanner_type = 'STATIC_INFO';

UPDATE oc_security_scan_items
SET spec_json = '{"staticFindings":[{"severity":"PASS","title":"保持依赖与运行时更新","detail":"定期更新应用依赖（含传递依赖）与 Node/Electron/运行时，关注安全公告（CVE）。","remediation":"在维护窗口执行更新与回归测试；生产环境避免长期锁定存在已知漏洞的版本。","location":"构建与部署流程"},{"severity":"WARN","title":"操作系统与安全补丁","detail":"宿主操作系统补丁滞后可能扩大本地提权或恶意软件面。","remediation":"启用自动安全更新或定期补丁策略；扫描机与办公机分区管理。","location":"本机系统更新"}],"staticFindingsEn":[{"severity":"PASS","title":"Keep dependencies and runtimes updated","detail":"Regularly update app dependencies (including transitive) and Node/Electron/runtimes; monitor security advisories (CVEs).","remediation":"Apply updates during maintenance windows with regression testing; avoid pinning known-vulnerable versions in production.","location":"Build and deploy pipeline"},{"severity":"WARN","title":"Operating system security patches","detail":"An outdated host OS expands the surface for local privilege escalation or malware.","remediation":"Enable automatic security updates or a regular patch cadence; separate scan machines from general office workstations.","location":"Host OS updates"}]}',
    updated_at = NOW(6)
WHERE code = 'baseline_updates_static'
  AND scanner_type = 'STATIC_INFO';
