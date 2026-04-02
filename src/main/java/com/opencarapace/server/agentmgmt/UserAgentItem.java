package com.opencarapace.server.agentmgmt;

import com.opencarapace.server.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * 用户在「Agent 管理」中为各平台登记的条目（Provider / Skill / Prompt / MCP / Session 等）。
 */
@Entity
@Table(name = "oc_user_agent_items")
@Getter
@Setter
public class UserAgentItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "platform_code", nullable = false, length = 64)
    private String platformCode;

    @Column(name = "feature_type", nullable = false, length = 32)
    private String featureType;

    @Column(name = "name", nullable = false, columnDefinition = "TEXT")
    private String name;

    @Column(name = "subtitle", columnDefinition = "TEXT")
    private String subtitle;

    @Column(name = "status_label", length = 64)
    private String statusLabel;

    @Column(name = "status_kind", length = 32)
    private String statusKind;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @Column(name = "meta_json", columnDefinition = "JSON")
    private String metaJson;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
