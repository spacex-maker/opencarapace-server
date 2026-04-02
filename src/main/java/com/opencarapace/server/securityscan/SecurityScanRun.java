package com.opencarapace.server.securityscan;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "oc_security_scan_runs",
        indexes = {
                @Index(name = "idx_oc_security_scan_runs_user_created", columnList = "user_id, created_at")
        })
@Getter
@Setter
public class SecurityScanRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /**
     * PENDING / RUNNING / SUCCESS / FAILED
     */
    @Column(name = "status", nullable = false, length = 16)
    private String status;

    @Column(name = "phase", nullable = false, length = 256)
    private String phase;

    @Column(name = "total_items", nullable = false)
    private Integer totalItems;

    @Column(name = "done_items", nullable = false)
    private Integer doneItems;

    @Column(name = "request_item_codes_json", nullable = false, columnDefinition = "TEXT")
    private String requestItemCodesJson;

    @Column(name = "context_text", nullable = false, columnDefinition = "TEXT")
    private String contextText;

    @Column(name = "findings_json", columnDefinition = "LONGTEXT")
    private String findingsJson;

    @Column(name = "scanned_item_codes_json", columnDefinition = "TEXT")
    private String scannedItemCodesJson;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}

