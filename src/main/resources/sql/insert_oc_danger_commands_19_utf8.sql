-- 19 条危险指令完整插入（UTF-8 中文，避免乱码）
-- 执行前：SET NAMES utf8mb4; 建议：mysql --default-character-set=utf8mb4 ...
-- 若需完全替换现有数据可先：DELETE FROM oc_danger_commands; 或 TRUNCATE oc_danger_commands;
SET NAMES utf8mb4;

INSERT INTO oc_danger_commands (id, command_pattern, system_type, category, risk_level, title, description, mitigation, tags, enabled, created_at, updated_at) VALUES
(1, 'rm -rf /', 'LINUX', 'FILE_SYSTEM', 'CRITICAL', '递归强制删除根目录', '会删除整个系统根目录及所有挂载点，导致系统不可恢复。常见误用：变量未设置时 rm -rf $VAR/ 会变成 rm -rf /。', '避免在脚本中对根或重要路径使用 -r -f；删除前用 echo 打印目标；对关键目录使用 --no-preserve-root 以外的方式保护。', 'rm,recursive,force,linux', 1, NOW(6), NOW(6)),
(2, 'rm -rf /*', 'LINUX', 'FILE_SYSTEM', 'CRITICAL', '删除根下所有内容', '与 rm -rf / 类似，删除根目录下所有内容，系统立即不可用。', '同上；严禁在生产脚本中写死或通过未校验变量拼接。', 'rm,linux,delete', 1, NOW(6), NOW(6)),
(3, 'mkfs.* /dev/sd*', 'LINUX', 'FILE_SYSTEM', 'CRITICAL', '格式化块设备', 'mkfs 会格式化指定块设备，所有数据丢失。误选错设备会格式化数据盘。', '执行前务必用 lsblk/fdisk 确认设备；可先对设备做只读挂载或使用 wipefs 等更可控方式。', 'mkfs,format,linux', 1, NOW(6), NOW(6)),
(4, 'dd if=/dev/zero of=/dev/sd*', 'LINUX', 'FILE_SYSTEM', 'CRITICAL', '向块设备写零', '用零覆盖整个磁盘，数据不可恢复。', '确认 of= 目标设备；生产环境避免直接对数据盘执行。', 'dd,wipe,disk', 1, NOW(6), NOW(6)),
(5, 'chmod -R 777 /', 'LINUX', 'PERMISSION', 'CRITICAL', '递归放宽整个根目录权限', '整个系统变为可写可执行，严重破坏安全与完整性。', '仅对最小必要目录授权；使用 755/644 等最小权限。', 'chmod,permission,linux', 1, NOW(6), NOW(6)),
(6, ':(){ :|:& };:', 'LINUX', 'PROCESS', 'HIGH', 'Fork 炸弹', '递归 fork 子进程，短时间内占满进程槽导致系统不可用。', '限制用户 nproc；使用 ulimit 或 cgroup 限制进程数。', 'fork,bomb,shell', 1, NOW(6), NOW(6)),
(7, '> /dev/sda', 'LINUX', 'FILE_SYSTEM', 'CRITICAL', '重定向清空块设备', '将空内容写入磁盘，破坏分区表与数据。', '避免对块设备做重定向；脚本中禁止将未校验路径作为重定向目标。', 'redirect,disk,linux', 1, NOW(6), NOW(6)),
(8, 'DROP DATABASE', 'DATABASE', 'DATABASE', 'CRITICAL', '删除整个数据库', '删除数据库及其所有表和数据，无法通过常规方式恢复。', '生产环境禁止直接执行；需备份与审批流程；使用 IF EXISTS 并限制权限。', 'drop,database,sql', 1, NOW(6), NOW(6)),
(9, 'DROP TABLE', 'DATABASE', 'DATABASE', 'CRITICAL', '删除表', '删除表及数据，依赖该表的对象会失效。', '先审批；在事务中先检查依赖；限制 DDL 权限。', 'drop,table,sql', 1, NOW(6), NOW(6)),
(10, 'TRUNCATE TABLE', 'DATABASE', 'DATABASE', 'HIGH', '清空表数据', '快速清空表内数据且通常不可回滚，易误操作。', '确认表名与库；优先在测试环境执行；部分数据库支持 TRUNCATE ... CASCADE 需谨慎。', 'truncate,table,sql', 1, NOW(6), NOW(6)),
(11, 'DELETE FROM table_name', 'DATABASE', 'DATABASE', 'HIGH', '无条件 DELETE', '未带 WHERE 会删除全表数据。', '始终带 WHERE；先用 SELECT 验证范围；考虑软删除。', 'delete,sql,dml', 1, NOW(6), NOW(6)),
(12, 'UPDATE table_name SET col = ...', 'DATABASE', 'DATABASE', 'HIGH', '无条件 UPDATE', '未带 WHERE 会更新全表。', '始终带 WHERE；先 SELECT 再 UPDATE；在事务中执行。', 'update,sql,dml', 1, NOW(6), NOW(6)),
(13, 'docker run --rm -v /:/host', 'DOCKER', 'CONTAINER', 'CRITICAL', '挂载宿主机根到容器', '容器内可修改宿主机整个根目录，等同于 root 写宿主机。', '禁止将 / 或敏感路径挂载进不可信镜像；使用只读挂载或最小路径。', 'docker,volume,mount', 1, NOW(6), NOW(6)),
(14, 'kubectl delete namespace', 'KUBERNETES', 'CONTAINER', 'CRITICAL', '删除命名空间', '会删除该命名空间下所有资源（Pod、Service、PVC 等）。', '确认 namespace 与环境；使用 --dry-run；重要环境加 RBAC 与审批。', 'kubectl,namespace,delete', 1, NOW(6), NOW(6)),
(15, 'kubectl delete -f .', 'KUBERNETES', 'CONTAINER', 'HIGH', '按目录删除所有资源', '当前目录下所有清单会被删除，易误删生产资源。', '先 kubectl get -f . 确认；避免在集群根或生产目录直接执行。', 'kubectl,delete,yaml', 1, NOW(6), NOW(6)),
(16, 'format C:', 'WINDOWS', 'FILE_SYSTEM', 'CRITICAL', '格式化 C 盘', '格式化系统盘，导致系统与数据丢失。', '确认盘符与环境；脚本中禁止对系统盘执行 format。', 'format,disk,windows', 1, NOW(6), NOW(6)),
(17, 'del /s /q *', 'WINDOWS', 'FILE_SYSTEM', 'HIGH', '递归静默删除当前目录及子目录', '无确认删除大量文件，易误删关键目录。', '先确认路径；避免在系统或数据根目录执行。', 'del,delete,windows', 1, NOW(6), NOW(6)),
(18, 'git push --force', 'GIT', 'VERSION_CONTROL', 'HIGH', '强制覆盖远程分支', '会覆盖远程历史，他人基于旧历史的提交会冲突或丢失。', '仅在对分支有共识时使用；保护主干分支禁止 force push。', 'git,push,force', 1, NOW(6), NOW(6)),
(19, 'git reset --hard', 'GIT', 'VERSION_CONTROL', 'MEDIUM', '硬重置丢弃本地修改', '未提交的修改与提交会丢失。', '先 git status / stash；重要变更先备份或建分支。', 'git,reset,hard', 1, NOW(6), NOW(6))
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  description = VALUES(description),
  mitigation = VALUES(mitigation),
  tags = VALUES(tags),
  updated_at = NOW(6);
