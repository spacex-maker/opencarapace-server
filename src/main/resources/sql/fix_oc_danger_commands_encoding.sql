-- 修复 oc_danger_commands 表中乱码：将 title、description、mitigation、tags 更新为正确中文
-- 执行前必须：SET NAMES utf8mb4;
-- 文件请以 UTF-8 编码保存，执行：mysql --default-character-set=utf8mb4 -u root -p opencarapace < fix_oc_danger_commands_encoding.sql
SET NAMES utf8mb4;

UPDATE oc_danger_commands SET title='递归强制删除根目录', description='会删除整个系统根目录及所有挂载点，导致系统不可恢复。常见误用：变量未设置时 rm -rf $VAR/ 会变成 rm -rf /。', mitigation='避免在脚本中对根或重要路径使用 -r -f；删除前用 echo 打印目标；对关键目录使用 --no-preserve-root 以外的方式保护。', tags='rm,recursive,force,linux' WHERE id=1;

UPDATE oc_danger_commands SET title='删除根下所有内容', description='与 rm -rf / 类似，删除根目录下所有内容，系统立即不可用。', mitigation='同上；严禁在生产脚本中写死或通过未校验变量拼接。', tags='rm,linux,delete' WHERE id=2;

UPDATE oc_danger_commands SET title='格式化块设备', description='mkfs 会格式化指定块设备，所有数据丢失。误选错设备会格式化数据盘。', mitigation='执行前务必用 lsblk/fdisk 确认设备；可先对设备做只读挂载或使用 wipefs 等更可控方式。', tags='mkfs,format,linux' WHERE id=3;

UPDATE oc_danger_commands SET title='向块设备写零', description='用零覆盖整个磁盘，数据不可恢复。', mitigation='确认 of= 目标设备；生产环境避免直接对数据盘执行。', tags='dd,wipe,disk' WHERE id=4;

UPDATE oc_danger_commands SET title='递归放宽整个根目录权限', description='整个系统变为可写可执行，严重破坏安全与完整性。', mitigation='仅对最小必要目录授权；使用 755/644 等最小权限。', tags='chmod,permission,linux' WHERE id=5;

UPDATE oc_danger_commands SET title='Fork 炸弹', description='递归 fork 子进程，短时间内占满进程槽导致系统不可用。', mitigation='限制用户 nproc；使用 ulimit 或 cgroup 限制进程数。', tags='fork,bomb,shell' WHERE id=6;

UPDATE oc_danger_commands SET title='重定向清空块设备', description='将空内容写入磁盘，破坏分区表与数据。', mitigation='避免对块设备做重定向；脚本中禁止将未校验路径作为重定向目标。', tags='redirect,disk,linux' WHERE id=7;

UPDATE oc_danger_commands SET title='删除整个数据库', description='删除数据库及其所有表和数据，无法通过常规方式恢复。', mitigation='生产环境禁止直接执行；需备份与审批流程；使用 IF EXISTS 并限制权限。', tags='drop,database,sql' WHERE id=8;

UPDATE oc_danger_commands SET title='删除表', description='删除表及数据，依赖该表的对象会失效。', mitigation='先审批；在事务中先检查依赖；限制 DDL 权限。', tags='drop,table,sql' WHERE id=9;

UPDATE oc_danger_commands SET title='清空表数据', description='快速清空表内数据且通常不可回滚，易误操作。', mitigation='确认表名与库；优先在测试环境执行；部分数据库支持 TRUNCATE ... CASCADE 需谨慎。', tags='truncate,table,sql' WHERE id=10;

UPDATE oc_danger_commands SET title='无条件 DELETE', description='未带 WHERE 会删除全表数据。', mitigation='始终带 WHERE；先用 SELECT 验证范围；考虑软删除。', tags='delete,sql,dml' WHERE id=11;

UPDATE oc_danger_commands SET title='无条件 UPDATE', description='未带 WHERE 会更新全表。', mitigation='始终带 WHERE；先 SELECT 再 UPDATE；在事务中执行。', tags='update,sql,dml' WHERE id=12;

UPDATE oc_danger_commands SET title='挂载宿主机根到容器', description='容器内可修改宿主机整个根目录，等同于 root 写宿主机。', mitigation='禁止将 / 或敏感路径挂载进不可信镜像；使用只读挂载或最小路径。', tags='docker,volume,mount' WHERE id=13;

UPDATE oc_danger_commands SET title='删除命名空间', description='会删除该命名空间下所有资源（Pod、Service、PVC 等）。', mitigation='确认 namespace 与环境；使用 --dry-run；重要环境加 RBAC 与审批。', tags='kubectl,namespace,delete' WHERE id=14;

UPDATE oc_danger_commands SET title='按目录删除所有资源', description='当前目录下所有清单会被删除，易误删生产资源。', mitigation='先 kubectl get -f . 确认；避免在集群根或生产目录直接执行。', tags='kubectl,delete,yaml' WHERE id=15;

UPDATE oc_danger_commands SET title='格式化 C 盘', description='格式化系统盘，导致系统与数据丢失。', mitigation='确认盘符与环境；脚本中禁止对系统盘执行 format。', tags='format,disk,windows' WHERE id=16;

UPDATE oc_danger_commands SET title='递归静默删除当前目录及子目录', description='无确认删除大量文件，易误删关键目录。', mitigation='先确认路径；避免在系统或数据根目录执行。', tags='del,delete,windows' WHERE id=17;

UPDATE oc_danger_commands SET title='强制覆盖远程分支', description='会覆盖远程历史，他人基于旧历史的提交会冲突或丢失。', mitigation='仅在对分支有共识时使用；保护主干分支禁止 force push。', tags='git,push,force' WHERE id=18;

UPDATE oc_danger_commands SET title='硬重置丢弃本地修改', description='未提交的修改与提交会丢失。', mitigation='先 git status / stash；重要变更先备份或建分支。', tags='git,reset,hard' WHERE id=19;
