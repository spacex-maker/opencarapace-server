package com.opencarapace.server.social;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(
        name = "oc_social_media_links",
        indexes = {
                @Index(name = "idx_oc_social_media_links_enabled_sort", columnList = "enabled,sort_order")
        }
)
@Getter
@Setter
public class SocialMediaLink {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String name;

    /** 图标关键字：如 x, github, linkedin, wechat, bilibili, custom */
    @Column(name = "icon_key", nullable = false, length = 48)
    private String iconKey;

    @Column(nullable = false, length = 1024)
    private String url;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "show_qr_code", nullable = false)
    private boolean showQrCode = true;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 100;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
