-- 各系统危险指令库：LINUX / DATABASE / SHELL / DOCKER / KUBERNETES / GIT / OTHER
-- 表: oc_danger_commands，(command_pattern, system_type) 唯一
-- 执行前: SET NAMES utf8mb4;
SET NAMES utf8mb4;

INSERT IGNORE INTO oc_danger_commands (command_pattern, system_type, category, risk_level, title, description, mitigation, tags, enabled, created_at, updated_at) VALUES

-- ========== LINUX ==========
('rm -rf /', 'LINUX', 'FILE_SYSTEM', 'CRITICAL', '递归强制删除根目录', '删除根目录及整个文件系统，系统立即不可用且不可恢复。', '禁止在脚本或交互中对 / 使用 rm -rf；删除前必须校验路径变量。', 'rm,recursive,force,linux', 1, NOW(6), NOW(6)),
('rm -rf /*', 'LINUX', 'FILE_SYSTEM', 'CRITICAL', '递归强制删除根下所有', '与 rm -rf / 等效，删除根下所有内容，系统崩溃。', '同 rm -rf /；严禁在根或未校验路径执行。', 'rm,linux,delete', 1, NOW(6), NOW(6)),
('rm -rf', 'LINUX', 'FILE_SYSTEM', 'CRITICAL', '递归强制删除', '递归强制删除指定路径，无确认。若路径为 / 或变量为空会酿成灾难。', '删除前校验路径非空且非 /；脚本中用 set -u 与路径校验。', 'rm,recursive,force', 1, NOW(6), NOW(6)),
('mkfs.', 'LINUX', 'FILE_SYSTEM', 'CRITICAL', '格式化块设备', 'mkfs.ext4/mkfs.xfs 等会格式化分区，该分区所有数据丢失。', '确认设备名（如 /dev/sdX）非系统盘；严禁未校验即格式化。', 'mkfs,format,linux', 1, NOW(6), NOW(6)),
('dd if=/dev/zero', 'LINUX', 'FILE_SYSTEM', 'CRITICAL', '向设备写零', '向块设备写零会清空整个设备，数据不可恢复。误用 of= 目标会毁掉磁盘。', '确认 if/of 参数；禁止对系统盘或数据盘未审批写零。', 'dd,wipe,disk', 1, NOW(6), NOW(6)),
('chmod -R 777', 'LINUX', 'PERMISSION', 'HIGH', '递归开放全部权限', '递归赋予所有人读写的写执行，敏感文件暴露，安全策略失效。', '仅对确需的目录最小范围使用；禁止对 /、/etc、/home 等整树 777。', 'chmod,permission,linux', 1, NOW(6), NOW(6)),
('chown -R', 'LINUX', 'PERMISSION', 'HIGH', '递归修改属主', '递归修改文件属主，误改系统文件属主会导致服务无法启动或提权。', '限定目录范围；避免对 /etc、/usr、根目录递归。', 'chown,ownership,linux', 1, NOW(6), NOW(6)),
('>:', 'LINUX', 'FILE_SYSTEM', 'HIGH', '重定向清空文件', '> file 或 :> file 会清空文件。误对重要配置或数据文件使用会导致服务异常或数据丢失。', '确认目标文件；重要文件先备份。', 'redirect,truncate,shell', 1, NOW(6), NOW(6)),
('systemctl disable', 'LINUX', 'PROCESS', 'HIGH', '禁用系统服务', '禁用服务开机启动。禁用关键服务（如 network、sshd）会导致无法远程或断网。', '仅对确认为冗余的服务操作；禁止禁用系统关键服务。', 'systemctl,service,linux', 1, NOW(6), NOW(6)),
('kill -9', 'LINUX', 'PROCESS', 'HIGH', '强制杀死进程', 'SIGKILL 不可捕获，立即终止进程。误杀系统关键进程（如 init、systemd）会导致宕机。', '确认 PID 对应进程；系统关键进程勿用 -9。', 'kill,sigkill,linux', 1, NOW(6), NOW(6)),
('iptables -F', 'LINUX', 'NETWORK', 'CRITICAL', '清空 iptables 规则', '清空所有链规则，防火墙失效，主机完全暴露。', '仅用于排障且临时；排障后立即恢复规则；生产禁止长期清空。', 'iptables,firewall,linux', 1, NOW(6), NOW(6)),
('iptables -P INPUT ACCEPT', 'LINUX', 'NETWORK', 'HIGH', '默认放行入站', '将 INPUT 链默认策略设为 ACCEPT，等同于开放所有入站。', '仅在测试或排障时临时使用；生产需配合具体规则。', 'iptables,firewall', 1, NOW(6), NOW(6)),
('useradd -o -u 0', 'LINUX', 'PERMISSION', 'CRITICAL', '创建 UID 0 用户', '创建与 root 同 UID 的用户，等效于增加一个 root 权限账户，严重提权。', '禁止在生产环境创建 UID 0 用户；审计 useradd。', 'useradd,root,uid 0', 1, NOW(6), NOW(6)),
('passwd -d root', 'LINUX', 'PERMISSION', 'CRITICAL', '删除 root 密码', '删除 root 账户密码，无密码即可 root 登录，极度危险。', '禁止在线上执行；仅用于恢复场景且立即重设密码。', 'passwd,root,password', 1, NOW(6), NOW(6)),
('curl | sh', 'LINUX', 'OTHER', 'HIGH', '管道下载并执行脚本', '从网络下载脚本并直接交给 shell 执行，若 URL 被篡改或中间人攻击会执行恶意代码。', '先下载、审计内容再执行；或使用可信源与校验和。', 'curl,pipe,security', 1, NOW(6), NOW(6)),
('wget -O - | sh', 'LINUX', 'OTHER', 'HIGH', '管道下载并执行脚本', '与 curl | sh 类似，下载并执行，存在供应链与篡改风险。', '同 curl | sh；避免未审计即执行远程脚本。', 'wget,pipe,shell', 1, NOW(6), NOW(6)),

-- ========== DATABASE ==========
('DROP TABLE', 'DATABASE', 'DATABASE', 'CRITICAL', '删除表', '删除表结构及数据，不可恢复。误删业务表会导致服务不可用。', '删除前确认表名与环境；生产禁止未审批 DROP；先备份或软删除。', 'drop,table,sql', 1, NOW(6), NOW(6)),
('DROP DATABASE', 'DATABASE', 'DATABASE', 'CRITICAL', '删除数据库', '删除整个数据库，所有表与数据丢失。', '仅在有备份与审批时执行；禁止脚本中未确认即 DROP DATABASE。', 'drop,database,sql', 1, NOW(6), NOW(6)),
('DROP SCHEMA', 'DATABASE', 'DATABASE', 'CRITICAL', '删除 schema', '删除 schema 及其下对象，等同于删除命名空间内所有对象。', '同 DROP DATABASE；确认 schema 名与环境。', 'drop,schema,sql', 1, NOW(6), NOW(6)),
('TRUNCATE TABLE', 'DATABASE', 'DATABASE', 'CRITICAL', '清空表数据', '快速清空表内所有行，不写日志（多数实现），不可回滚。', '确认表名；生产需审批；重要表先备份。', 'truncate,table,sql', 1, NOW(6), NOW(6)),
('DELETE FROM', 'DATABASE', 'DATABASE', 'HIGH', '删除行', '无 WHERE 或 WHERE 过宽会删除大量或全部行，数据丢失。', '始终带明确 WHERE 条件；先 SELECT 确认范围再 DELETE。', 'delete,sql,dml', 1, NOW(6), NOW(6)),
('UPDATE SET', 'DATABASE', 'DATABASE', 'HIGH', '更新行', '无 WHERE 或 WHERE 错误会批量误改数据。', '始终带明确 WHERE；先 SELECT 再 UPDATE；必要时事务与备份。', 'update,sql,dml', 1, NOW(6), NOW(6)),
('ALTER TABLE ... DROP', 'DATABASE', 'DATABASE', 'HIGH', '删除列或约束', '删除列或约束，列数据不可恢复；误删导致应用报错。', '确认列名与依赖；生产变更需审批与回滚方案。', 'alter,drop column,sql', 1, NOW(6), NOW(6)),
('GRANT ALL', 'DATABASE', 'DATABASE', 'HIGH', '授予全部权限', '对用户或角色授予所有权限，权限过大易导致误操作或滥用。', '按最小权限授予具体权限；避免 GRANT ALL ON *.*。', 'grant,privilege,sql', 1, NOW(6), NOW(6)),
('REVOKE ALL', 'DATABASE', 'DATABASE', 'MEDIUM', '撤销全部权限', '撤销用户全部权限，可能导致应用或运维无法访问。', '确认影响范围；保留必要权限或替代账户。', 'revoke,privilege,sql', 1, NOW(6), NOW(6)),

-- ========== SHELL (通用 Shell / Bash 等) ==========
('rm -rf', 'SHELL', 'FILE_SYSTEM', 'CRITICAL', '递归强制删除', '跨平台常见写法，递归强制删除，路径错误会导致灾难。', '校验路径非空且非根；脚本中 set -u 与路径校验。', 'rm,shell,bash', 1, NOW(6), NOW(6)),
('rm -rf $', 'SHELL', 'FILE_SYSTEM', 'CRITICAL', '变量展开后递归删除', '变量未设或为空时可能展开为 rm -rf，删除当前目录或根。', '脚本中 set -u；删除前检查变量非空且路径合法。', 'rm,variable,shell', 1, NOW(6), NOW(6)),
('sudo rm -rf', 'SHELL', 'FILE_SYSTEM', 'CRITICAL', '提权后递归删除', '以 root 权限执行 rm -rf，误用会删除系统关键目录。', '避免 sudo rm -rf 未校验路径；尽量用 root 最小权限。', 'sudo,rm,shell', 1, NOW(6), NOW(6)),
('exec rm', 'SHELL', 'FILE_SYSTEM', 'CRITICAL', 'exec 执行删除', 'exec 替换当前进程执行 rm，脚本中误用会终止脚本并执行危险删除。', '确认 exec 参数；避免 exec 与未校验路径组合。', 'exec,rm,shell', 1, NOW(6), NOW(6)),
('eval ', 'SHELL', 'OTHER', 'HIGH', 'eval 执行字符串', '将字符串当作命令执行，若字符串来自外部输入会导致命令注入。', '禁止对用户输入或未校验字符串使用 eval；用安全数据结构替代。', 'eval,injection,shell', 1, NOW(6), NOW(6)),
('curl ', 'SHELL', 'NETWORK', 'MEDIUM', 'curl 请求', '若 URL 或参数来自不可信输入，可能触发 SSRF 或执行恶意响应。', '校验 URL 与参数；禁止 curl $(...) 未校验即执行。', 'curl,ssrf,shell', 1, NOW(6), NOW(6)),

-- ========== DOCKER ==========
('docker rm -f', 'DOCKER', 'CONTAINER', 'HIGH', '强制删除容器', '强制删除运行中或已停止的容器，数据卷未备份则容器内改动丢失。', '确认容器名/ID；重要数据先 commit 或卷备份。', 'docker,rm,container', 1, NOW(6), NOW(6)),
('docker rmi -f', 'DOCKER', 'CONTAINER', 'HIGH', '强制删除镜像', '强制删除镜像，若有容器依赖会留下悬空容器；误删基础镜像影响构建。', '确认镜像 ID/名；避免对正在使用的基础镜像 -f。', 'docker,rmi,image', 1, NOW(6), NOW(6)),
('docker system prune -a', 'DOCKER', 'CONTAINER', 'CRITICAL', '清理所有未使用资源', '删除所有未使用的容器、网络、镜像（含悬空），大规模清理不可恢复。', '仅在确定可清理时使用；生产慎用 -a；先 docker system df 查看。', 'docker,prune,system', 1, NOW(6), NOW(6)),
('docker volume rm', 'DOCKER', 'CONTAINER', 'CRITICAL', '删除数据卷', '删除指定卷，卷内数据不可恢复。', '确认卷名与业务；有数据的卷先备份再删。', 'docker,volume,delete', 1, NOW(6), NOW(6)),
('docker run --rm -v', 'DOCKER', 'CONTAINER', 'HIGH', '挂载卷并运行后删除', '--rm 使容器退出后自动删除；若 -v 挂载错路径会覆盖宿主机目录。', '确认卷映射源与目标；避免将宿主机关键目录挂载为容器可写。', 'docker,run,volume', 1, NOW(6), NOW(6)),
('docker exec', 'DOCKER', 'CONTAINER', 'MEDIUM', '在容器内执行命令', '在运行中容器内执行任意命令，若命令来自不可信输入存在注入与逃逸风险。', '避免将用户输入直接拼进 docker exec；校验命令与参数。', 'docker,exec,container', 1, NOW(6), NOW(6)),

-- ========== KUBERNETES ==========
('kubectl delete namespace', 'KUBERNETES', 'CONTAINER', 'CRITICAL', '删除命名空间', '删除整个 namespace 及其下所有资源（Pod、Service、PVC 等），不可恢复。', '确认 namespace 名与集群；生产禁止未审批删除 namespace。', 'kubectl,namespace,delete', 1, NOW(6), NOW(6)),
('kubectl delete --all', 'KUBERNETES', 'CONTAINER', 'CRITICAL', '删除命名空间内全部资源', '删除当前 namespace 下所有指定类型资源，误选 namespace 会清空该空间。', '确认 context 与 namespace；避免 kubectl delete all --all 等宽泛用法。', 'kubectl,delete,all', 1, NOW(6), NOW(6)),
('kubectl delete pv', 'KUBERNETES', 'CONTAINER', 'HIGH', '删除持久卷', '删除 PV，若仍有 PVC 绑定会导致数据不可用；误删会丢数据。', '确认无 PVC 绑定或先删 PVC；有数据先备份。', 'kubectl,pv,delete', 1, NOW(6), NOW(6)),
('kubectl drain', 'KUBERNETES', 'CONTAINER', 'HIGH', '排空节点', '驱逐节点上所有 Pod，若未设置 PDB 或副本不足会导致服务中断。', '确认集群副本与 PDB；分批 drain；生产需审批。', 'kubectl,drain,node', 1, NOW(6), NOW(6)),
('kubectl apply -f', 'KUBERNETES', 'CONTAINER', 'MEDIUM', '应用清单文件', '应用 YAML 定义的资源，若文件错误或来自不可信源会创建错误或恶意资源。', '先 kubectl apply --dry-run=client -f 校验；禁止对不可信 YAML 直接 apply。', 'kubectl,apply,yaml', 1, NOW(6), NOW(6)),
('kubectl exec', 'KUBERNETES', 'CONTAINER', 'MEDIUM', '在 Pod 中执行命令', '在 Pod 内执行命令，若命令来自不可信输入存在注入与逃逸风险。', '避免用户输入直接拼进 kubectl exec；校验命令。', 'kubectl,exec,pod', 1, NOW(6), NOW(6)),

-- ========== GIT ==========
('git push --force', 'GIT', 'VERSION_CONTROL', 'CRITICAL', '强制推送', '覆盖远程分支历史，他人基于旧历史的提交会冲突或丢失。', '仅对个人分支或发布流程明确时使用；禁止对共享/主分支 --force。', 'git,push,force', 1, NOW(6), NOW(6)),
('git reset --hard', 'GIT', 'VERSION_CONTROL', 'HIGH', '硬重置', '丢弃工作区与暂存区及指定提交之后的历史，不可恢复。', '确认提交与分支；重要分支先备份或备份 ref；避免对共享分支 reset --hard。', 'git,reset,hard', 1, NOW(6), NOW(6)),
('git clean -fd', 'GIT', 'FILE_SYSTEM', 'HIGH', '清理未跟踪文件', '删除未跟踪的文件与目录，误在错误目录执行会删掉未入库的改动。', '先 git clean -n -fd 预览；确认目录与未跟踪文件范围。', 'git,clean,untracked', 1, NOW(6), NOW(6)),
('git filter-branch', 'GIT', 'VERSION_CONTROL', 'HIGH', '重写历史', '批量重写提交历史，错误使用会破坏仓库或丢失提交。', '仅在有明确需求时使用；先完整备份仓库；考虑 git filter-repo 替代。', 'git,filter-branch,history', 1, NOW(6), NOW(6)),
('git push origin --delete', 'GIT', 'VERSION_CONTROL', 'HIGH', '删除远程分支', '删除远程分支，依赖该分支的流水线或他人会失败。', '确认分支名与影响；通知协作者；保留必要分支。', 'git,push,delete branch', 1, NOW(6), NOW(6)),

-- ========== OTHER ==========
('mv ', 'OTHER', 'FILE_SYSTEM', 'HIGH', '移动文件/目录', '跨设备或覆盖移动会删除目标；误将系统文件移走会导致无法启动。', '确认源与目标；避免 mv /* 或 mv 系统关键路径。', 'mv,move,shell', 1, NOW(6), NOW(6)),
('find . -delete', 'OTHER', 'FILE_SYSTEM', 'CRITICAL', 'find 删除', '按条件递归删除，条件过宽或路径错误会大规模误删。', '先用 find ... -print 确认；避免对根或大范围 -delete。', 'find,delete,recursive', 1, NOW(6), NOW(6)),
('xargs rm', 'OTHER', 'FILE_SYSTEM', 'CRITICAL', 'xargs 管道删除', '将前序命令输出作为 rm 参数，输出异常或未校验会误删错误目标。', '先去掉 rm 试跑确认输出；或使用 xargs -p 确认。', 'xargs,rm,pipe', 1, NOW(6), NOW(6)),
('mongo --eval', 'OTHER', 'DATABASE', 'HIGH', 'Mongo 命令行执行', '在 shell 中执行 JS，若字符串来自不可信输入存在注入与误操作风险。', '避免不可信输入拼进 --eval；优先用驱动或脚本校验后执行。', 'mongo,eval,injection', 1, NOW(6), NOW(6)),
('redis-cli FLUSHALL', 'OTHER', 'DATABASE', 'CRITICAL', '清空所有 Redis 数据', '清空当前 Redis 实例所有库数据，不可恢复。', '仅在有备份与审批时执行；禁止生产未确认 FLUSHALL。', 'redis,flushall,flush', 1, NOW(6), NOW(6)),
('redis-cli FLUSHDB', 'OTHER', 'DATABASE', 'HIGH', '清空当前库', '清空当前选中库数据，不可恢复。', '确认当前 DB 与业务；生产需审批。', 'redis,flushdb', 1, NOW(6), NOW(6))
;
