package com.opencarapace.server.skill;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "oc_skills")
@Getter
@Setter
public class Skill {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_id", nullable = false)
    private SkillSource source;

    @Column(name = "external_id", nullable = false, length = 128)
    private String externalId;

    @Column(name = "name", nullable = false, columnDefinition = "TEXT")
    private String name;

    @Column(name = "slug", nullable = false, length = 255, unique = true)
    private String slug;

    @Column(name = "type", nullable = false, length = 64)
    private String type;

    @Column(name = "category", length = 128)
    private String category;

    @Column(name = "version", length = 64)
    private String version;

    @Column(name = "status", nullable = false, length = 32)
    private String status = "ACTIVE";

    @Column(name = "short_desc", columnDefinition = "TEXT")
    private String shortDesc;

    @Column(name = "long_desc", columnDefinition = "TEXT")
    private String longDesc;

    @Column(name = "tags", columnDefinition = "TEXT")
    private String tags;

    @Column(name = "homepage_url", columnDefinition = "TEXT")
    private String homepageUrl;

    @Column(name = "install_hint", columnDefinition = "TEXT")
    private String installHint;

    @Column(name = "safe_mark_count", nullable = false)
    private Long safeMarkCount = 0L;

    @Column(name = "unsafe_mark_count", nullable = false)
    private Long unsafeMarkCount = 0L;

    @Column(name = "manifest_json", columnDefinition = "JSON")
    private String manifestJson;

    @Column(name = "last_sync_at")
    private Instant lastSyncAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    /** 安全市场：官方精选 */
    @Column(name = "market_featured", nullable = false)
    private boolean marketFeatured = false;

    /** 安全市场：安全推荐位 */
    @Column(name = "market_safe_recommended", nullable = false)
    private boolean marketSafeRecommended = false;

    @Column(name = "hot_score", nullable = false)
    private double hotScore = 0.0;

    @Column(name = "download_count", nullable = false)
    private long downloadCount = 0L;

    /** 安全市场：收藏 / 关注量（统计字段，由运营或上游同步写入） */
    @Column(name = "favorite_count", nullable = false)
    private long favoriteCount = 0L;

    @Column(name = "star_rating")
    private Double starRating;

    @Column(name = "publisher_verified", nullable = false)
    private boolean publisherVerified = false;

    /** 安全等级展示用，如 A / B / C */
    @Column(name = "security_grade", length = 8)
    private String securityGrade;

    @Column(name = "published_at")
    private Instant publishedAt;
}

