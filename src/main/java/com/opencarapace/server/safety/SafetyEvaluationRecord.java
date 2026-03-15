package com.opencarapace.server.safety;

import com.opencarapace.server.agent.ToolDefinition;
import com.opencarapace.server.apikey.ApiKey;
import com.opencarapace.server.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "oc_safety_evaluations")
@Getter
@Setter
public class SafetyEvaluationRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "api_key_id")
    private ApiKey apiKey;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tool_id")
    private ToolDefinition tool;

    @Column(nullable = false, length = 64)
    private String inputType;

    @Column(length = 512)
    private String inputSummary;

    @Column(columnDefinition = "TEXT")
    private String rawInput;

    @Column(length = 64)
    private String verdict;

    @Column(length = 64)
    private String riskLevel;

    @Column(columnDefinition = "TEXT")
    private String reasons;

    @Column(length = 255)
    private String policiesTriggered;

    @Column(length = 255)
    private String llmModel;

    @Column(length = 64)
    private String llmScore;

    @CreationTimestamp
    private Instant createdAt;
}

