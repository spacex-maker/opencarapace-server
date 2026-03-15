package com.opencarapace.server.danger;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * 云端危险指令库条目：各类型系统中的危险指令，供快速查询与安全校验参考。
 * 主键采用自增 Long，符合常规单表主键规范。
 */
@Entity
@Table(
    name = "oc_danger_commands",
    uniqueConstraints = @UniqueConstraint(columnNames = {"command_pattern", "system_type"})
)
@Getter
@Setter
public class DangerCommand {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 指令或模式（如 rm -rf、DROP TABLE），支持简短正则/通配描述 */
    @Column(nullable = false, length = 512)
    private String commandPattern;

    /** 所属系统类型 */
    @Column(nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    private SystemType systemType;

    /** 危险分类 */
    @Column(nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    private DangerCategory category;

    /** 风险等级 */
    @Column(nullable = false, length = 16)
    @Enumerated(EnumType.STRING)
    private RiskLevel riskLevel;

    /** 简短标题 */
    @Column(nullable = false, length = 255)
    private String title;

    /** 说明：为何危险、典型场景 */
    @Column(columnDefinition = "TEXT")
    private String description;

    /** 缓解建议：替代方案、使用注意 */
    @Column(columnDefinition = "TEXT")
    private String mitigation;

    /** 标签，逗号分隔，便于检索 */
    @Column(length = 512)
    private String tags;

    @Column(nullable = false)
    private boolean enabled = true;

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;

    public enum SystemType {
        LINUX,
        WINDOWS,
        DATABASE,
        SHELL,
        DOCKER,
        KUBERNETES,
        GIT,
        OTHER
    }

    public enum DangerCategory {
        FILE_SYSTEM,   // 文件系统删除/格式化
        DATABASE,      // 数据库 DDL/DML 危险操作
        NETWORK,       // 网络/防火墙
        PROCESS,       // 进程/服务
        PERMISSION,    // 权限/用户
        CONTAINER,     // 容器/编排
        VERSION_CONTROL,
        OTHER
    }

    public enum RiskLevel {
        CRITICAL,  // 极易导致不可恢复损失
        HIGH,
        MEDIUM,
        LOW
    }
}
