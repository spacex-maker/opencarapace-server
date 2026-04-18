package com.opencarapace.server.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "oc_users")
@Getter
@Setter
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(length = 255)
    private String displayName;

    @Column(length = 512)
    private String avatarUrl;

    @Column(length = 64)
    private String provider;

    @Column(length = 255)
    private String providerId;

    @Column(length = 64)
    private String role;

    /** 仅邮箱密码用户：BCrypt 哈希，OAuth 用户为 null */
    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    @Column(name = "settings_version", nullable = false)
    private Long settingsVersion = 0L;

    /** 为 true 时禁止登录（邮箱密码与 Google 均拦截） */
    @Column(nullable = false)
    private boolean disabled = false;

    @CreationTimestamp
    private Instant createdAt;


    @UpdateTimestamp
    private Instant updatedAt;
}

