package com.opencarapace.server.danger;

import com.opencarapace.server.danger.DangerCommand.DangerCategory;
import com.opencarapace.server.danger.DangerCommand.RiskLevel;
import com.opencarapace.server.danger.DangerCommand.SystemType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 危险指令库初始数据：若库为空则插入常见危险指令，便于快速查询。
 */
@Component
@Order(100)
@RequiredArgsConstructor
@Slf4j
public class DangerCommandDataInitializer implements ApplicationRunner {

    private final DangerCommandRepository repository;

    @Override
    public void run(ApplicationArguments args) {
        if (repository.count() > 0) {
            return;
        }
        List<DangerCommand> seeds = List.of(
                // Linux / Shell
                danger("rm -rf /", SystemType.LINUX, DangerCategory.FILE_SYSTEM, RiskLevel.CRITICAL,
                        "递归强制删除根目录",
                        "会删除整个系统根目录及所有挂载点，导致系统不可恢复。常见误用：变量未设置时 rm -rf $VAR/ 会变成 rm -rf /。",
                        "避免在脚本中对根或重要路径使用 -r -f；删除前用 echo 打印目标；对关键目录使用 --no-preserve-root 以外的方式保护。"),
                danger("rm -rf /*", SystemType.LINUX, DangerCategory.FILE_SYSTEM, RiskLevel.CRITICAL,
                        "删除根下所有内容",
                        "与 rm -rf / 类似，删除根目录下所有内容，系统立即不可用。",
                        "同上；严禁在生产脚本中写死或通过未校验变量拼接。"),
                danger("mkfs.* /dev/sd*", SystemType.LINUX, DangerCategory.FILE_SYSTEM, RiskLevel.CRITICAL,
                        "格式化块设备",
                        "mkfs 会格式化指定块设备，所有数据丢失。误选错设备会格式化数据盘。",
                        "执行前务必用 lsblk/fdisk 确认设备；可先对设备做只读挂载或使用 wipefs 等更可控方式。"),
                danger("dd if=/dev/zero of=/dev/sd*", SystemType.LINUX, DangerCategory.FILE_SYSTEM, RiskLevel.CRITICAL,
                        "向块设备写零",
                        "用零覆盖整个磁盘，数据不可恢复。",
                        "确认 of= 目标设备；生产环境避免直接对数据盘执行。"),
                danger("chmod -R 777 /", SystemType.LINUX, DangerCategory.PERMISSION, RiskLevel.CRITICAL,
                        "递归放宽整个根目录权限",
                        "整个系统变为可写可执行，严重破坏安全与完整性。",
                        "仅对最小必要目录授权；使用 755/644 等最小权限。"),
                danger(":(){ :|:& };:", SystemType.LINUX, DangerCategory.PROCESS, RiskLevel.HIGH,
                        "Fork 炸弹",
                        "递归创建进程，短时间占满进程表导致系统不可用。",
                        "限制用户 nproc；使用 ulimit 或 cgroup 限制进程数。"),
                danger("> /dev/sda", SystemType.LINUX, DangerCategory.FILE_SYSTEM, RiskLevel.CRITICAL,
                        "重定向清空块设备",
                        "将空内容写入磁盘，破坏分区表与数据。",
                        "避免对块设备做重定向；脚本中禁止将未校验路径作为重定向目标。"),
                // Database
                danger("DROP DATABASE", SystemType.DATABASE, DangerCategory.DATABASE, RiskLevel.CRITICAL,
                        "删除整个数据库",
                        "删除数据库及其所有表和数据，无法通过常规方式恢复。",
                        "生产环境禁止直接执行；需备份与审批流程；使用 IF EXISTS 并限制权限。"),
                danger("DROP TABLE", SystemType.DATABASE, DangerCategory.DATABASE, RiskLevel.CRITICAL,
                        "删除表",
                        "删除表及数据，依赖该表的对象会失败。",
                        "先备份；在事务中先检查依赖；限制 DDL 权限。"),
                danger("TRUNCATE TABLE", SystemType.DATABASE, DangerCategory.DATABASE, RiskLevel.HIGH,
                        "清空表数据",
                        "快速清空表且通常不可回滚，易误操作。",
                        "确认表名与库；优先在测试环境执行；部分数据库支持 TRUNCATE ... CASCADE 需谨慎。"),
                danger("DELETE FROM table_name", SystemType.DATABASE, DangerCategory.DATABASE, RiskLevel.HIGH,
                        "无条件 DELETE",
                        "未带 WHERE 会删除全表数据。",
                        "始终带 WHERE；先用 SELECT 验证范围；考虑软删除。"),
                danger("UPDATE table_name SET col = ...", SystemType.DATABASE, DangerCategory.DATABASE, RiskLevel.HIGH,
                        "无条件 UPDATE",
                        "未带 WHERE 会更新全表。",
                        "始终带 WHERE；先 SELECT 再 UPDATE；在事务中执行。"),
                // Docker / K8s
                danger("docker run --rm -v /:/host", SystemType.DOCKER, DangerCategory.CONTAINER, RiskLevel.CRITICAL,
                        "挂载宿主机根到容器",
                        "容器内可修改宿主机整个根目录，等同于 root 写宿主机。",
                        "禁止将 / 或敏感路径挂载进不可信镜像；使用只读挂载或最小路径。"),
                danger("kubectl delete namespace", SystemType.KUBERNETES, DangerCategory.CONTAINER, RiskLevel.CRITICAL,
                        "删除命名空间",
                        "会删除该命名空间下所有资源（Pod、Service、PVC 等）。",
                        "确认 namespace 与环境；使用 --dry-run；重要环境加 RBAC 与审批。"),
                danger("kubectl delete -f .", SystemType.KUBERNETES, DangerCategory.CONTAINER, RiskLevel.HIGH,
                        "按目录删除所有资源",
                        "当前目录下所有清单会被删除，易误删生产资源。",
                        "先 kubectl get -f . 确认；避免在集群根或生产目录直接执行。"),
                // Windows
                danger("format C:", SystemType.WINDOWS, DangerCategory.FILE_SYSTEM, RiskLevel.CRITICAL,
                        "格式化 C 盘",
                        "格式化系统盘，导致系统与数据丢失。",
                        "确认盘符与环境；脚本中禁止对系统盘执行 format。"),
                danger("del /s /q *", SystemType.WINDOWS, DangerCategory.FILE_SYSTEM, RiskLevel.HIGH,
                        "递归静默删除当前目录及子目录",
                        "无确认删除大量文件，易误删关键目录。",
                        "先确认路径；避免在系统或数据根目录执行。"),
                // Git
                danger("git push --force", SystemType.GIT, DangerCategory.VERSION_CONTROL, RiskLevel.HIGH,
                        "强制覆盖远程分支",
                        "会覆盖远程历史，他人基于旧历史的提交会冲突或丢失。",
                        "仅在对分支有共识时使用；保护主干分支禁止 force push。"),
                danger("git reset --hard", SystemType.GIT, DangerCategory.VERSION_CONTROL, RiskLevel.MEDIUM,
                        "硬重置丢弃本地修改",
                        "未提交的修改与提交会丢失。",
                        "先 git status / stash；重要变更先备份或建分支。")
        );
        repository.saveAll(seeds);
        log.info("Danger command library initialized with {} entries.", seeds.size());
    }

    private static DangerCommand danger(String pattern, SystemType systemType, DangerCategory category,
                                       RiskLevel riskLevel, String title, String description, String mitigation) {
        DangerCommand c = new DangerCommand();
        c.setCommandPattern(pattern);
        c.setSystemType(systemType);
        c.setCategory(category);
        c.setRiskLevel(riskLevel);
        c.setTitle(title);
        c.setDescription(description);
        c.setMitigation(mitigation);
        c.setEnabled(true);
        return c;
    }
}
