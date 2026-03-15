package com.opencarapace.server.agent;

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
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "oc_tool_definitions")
@Getter
@Setter
public class ToolDefinition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false, length = 64)
    private String type;

    @Column(length = 512)
    private String description;

    @Column(length = 255)
    private String provider;

    @Column(length = 255)
    private String sourceSystem;

    @Column(length = 255)
    private String category;

    @Column(length = 1024)
    private String tags;

    @Column(length = 64)
    private String riskLevel;

    @Column(length = 64)
    private String approvalStatus;

    @Column(columnDefinition = "TEXT")
    private String inputSchema;

    @Column(columnDefinition = "TEXT")
    private String outputSchema;

    @Column(columnDefinition = "TEXT")
    private String exampleUsage;

    @Column(columnDefinition = "TEXT")
    private String policyHints;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private User owner;

    private Instant lastReviewedAt;

    @Column(length = 255)
    private String lastReviewedBy;

    @Column(length = 255)
    private String externalReference;

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;
}

