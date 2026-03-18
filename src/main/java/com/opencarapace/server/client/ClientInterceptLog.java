package com.opencarapace.server.client;

import com.opencarapace.server.apikey.ApiKey;
import com.opencarapace.server.danger.DangerCommand;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * 本地 npx 代理或其他客户端上报的拦截/通过日志。
 */
@Entity
@Table(name = "oc_client_intercept_logs")
@Getter
@Setter
public class ClientInterceptLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 对应的云端 API Key（由 X-OC-API-KEY 解析），便于按 Key / 用户筛选。
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "api_key_id")
    private ApiKey apiKey;

    /**
     * 客户端标识：本地代理安装 ID / 机器 ID。
     */
    @Column(length = 128)
    private String clientId;

    /**
     * 请求类型：chat.completion / embeddings / other。
     */
    @Column(length = 64)
    private String requestType;

    /**
     * 上游模型/厂商标识，例如 deepseek:deepseek-chat / openai:gpt-4o。
     */
    @Column(length = 128)
    private String upstream;

    /**
     * 判定结果：ALLOW / BLOCK。
     */
    @Column(nullable = false, length = 16)
    private String verdict;

    /**
     * 命中的最高风险等级，仅在 BLOCK 时有意义。
     */
    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private DangerCommand.RiskLevel riskLevel;

    /**
     * 命中的规则 ID 列表，逗号分隔（如 "1,5,9"），仅在 BLOCK 时有意义。
     */
    @Column(length = 512)
    private String matchedRuleIds;

    /**
     * 拦截原因说明：来自客户端本地规则匹配或大致摘要。
     */
    @Column(columnDefinition = "TEXT")
    private String reason;

    /**
     * 截断后的请求内容，便于回溯（例如用户消息前 1-2KB）。
     */
    @Column(columnDefinition = "TEXT")
    private String requestSnippet;

    @CreationTimestamp
    private Instant createdAt;
}

