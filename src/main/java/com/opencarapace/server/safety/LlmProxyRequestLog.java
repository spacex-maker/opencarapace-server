package com.opencarapace.server.safety;

import com.opencarapace.server.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * 桌面/网关 LLM 中转代理的每一次请求（含拦截与上游错误），与本地 proxy_request_logs 对齐。
 */
@Entity
@Table(name = "oc_llm_proxy_request_logs")
@Getter
@Setter
public class LlmProxyRequestLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(length = 128)
    private String clientId;

    @Column(name = "provider_key", length = 128)
    private String providerKey;

    @Column(length = 256)
    private String model;

    @Column(length = 32)
    private String routeMode;

    @Column(length = 512)
    private String requestPath;

    private Integer statusCode;

    @Column(length = 64)
    private String blockType;

    private Integer promptTokens;
    private Integer completionTokens;
    private Integer totalTokens;

    @Column(name = "cost_usd")
    private Double costUsd;

    private Integer latencyMs;

    @Column(length = 512)
    private String errorSnippet;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
