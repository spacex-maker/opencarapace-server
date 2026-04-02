package com.opencarapace.server.securityscan;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * 通用安全扫描项：描述一类可执行的检查（AI 分析、静态说明等），具体行为由 {@link #specJson} 承载。
 */
@Entity
@Table(name = "oc_security_scan_items")
@Getter
@Setter
public class SecurityScanItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 唯一业务编码，客户端与 API 使用 */
    @Column(name = "code", nullable = false, length = 128, unique = true)
    private String code;

    @Column(name = "title", nullable = false, length = 512)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    /** 分组：CONFIG / MCP / SECRETS / NETWORK / COMPLIANCE / OTHER */
    @Column(name = "category", length = 64)
    private String category;

    /** 默认严重度提示（展示用）：INFO / WARN / CRITICAL */
    @Column(name = "default_severity", length = 32)
    private String defaultSeverity;

    /**
     * AI_PROMPT：调用服务端 DeepSeek（系统配置的 deepseek.api_key）执行分析；
     * STATIC_INFO：不调用模型，直接返回 spec 中的静态 findings。
     */
    @Column(name = "scanner_type", nullable = false, length = 32)
    private String scannerType;

    /**
     * JSON：AI_PROMPT 示例
     * {"systemPrompt":"...","userPromptTemplate":"扫描上下文：\n{{context}}\n\n检查重点：{{focus}}"}
     * STATIC_INFO 示例
     * {"staticFindings":[{"severity":"PASS","title":"...","detail":"...","remediation":"...","location":"..."}]}
     */
    @Column(name = "spec_json", nullable = false, columnDefinition = "TEXT")
    private String specJson;

    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
