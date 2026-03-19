package com.opencarapace.server.billing;

import com.opencarapace.server.apikey.ApiKey;
import com.opencarapace.server.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "oc_token_usages")
@Getter
@Setter
public class TokenUsageRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** 可空：本地直连上报时未必能关联到某个 API Key */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "api_key_id")
    private ApiKey apiKey;

    @Column(length = 128)
    private String clientId;

    @Column(length = 32)
    private String routeMode; // DIRECT / GATEWAY / MAPPING

    @Column(length = 512)
    private String upstreamBase;

    @Column(length = 128)
    private String model;

    private Integer promptTokens;
    private Integer completionTokens;
    private Integer totalTokens;

    @Column(nullable = false)
    private boolean estimated;

    @Column(length = 512)
    private String requestPath;

    @CreationTimestamp
    private Instant createdAt;
}

