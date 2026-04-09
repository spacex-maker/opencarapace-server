package com.opencarapace.server.tracking;

import com.opencarapace.server.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(
        name = "oc_user_event_logs",
        indexes = {
                @Index(name = "idx_oc_user_event_logs_event_name_time", columnList = "event_name,event_time"),
                @Index(name = "idx_oc_user_event_logs_user_time", columnList = "user_id,event_time"),
                @Index(name = "idx_oc_user_event_logs_anonymous_time", columnList = "anonymous_id,event_time"),
                @Index(name = "idx_oc_user_event_logs_session_time", columnList = "session_id,event_time"),
                @Index(name = "idx_oc_user_event_logs_platform_time", columnList = "platform,event_time")
        },
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_oc_user_event_logs_event_id", columnNames = "event_id")
        }
)
@Getter
@Setter
public class UserEventLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_id", nullable = false, unique = true, length = 64)
    private String eventId;

    @Column(name = "event_name", nullable = false, length = 64)
    private String eventName;

    @Column(name = "event_time", nullable = false)
    private Instant eventTime;

    @Column(name = "anonymous_id", nullable = false, length = 64)
    private String anonymousId;

    @Column(name = "session_id", nullable = false, length = 64)
    private String sessionId;

    @Column(nullable = false, length = 16)
    private String platform;

    @Column(name = "app_version", length = 32)
    private String appVersion;

    @Column(name = "page_id", length = 128)
    private String pageId;

    @Column(length = 64)
    private String module;

    @Column(name = "event_props_json", columnDefinition = "TEXT")
    private String eventPropsJson;

    @Column(name = "context_props_json", columnDefinition = "TEXT")
    private String contextPropsJson;

    @Column(length = 64)
    private String ip;

    @Column(name = "user_agent", length = 512)
    private String userAgent;

    @Column(name = "valid", nullable = false)
    private boolean valid = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @CreationTimestamp
    @Column(name = "created_at")
    private Instant createdAt;
}

