package com.opencarapace.server.billing;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface TokenUsageRepository extends JpaRepository<TokenUsageRecord, Long> {

    @Query("""
            SELECT r FROM TokenUsageRecord r
            WHERE r.user.id = :userId
              AND (:fromTs IS NULL OR r.createdAt >= :fromTs)
              AND (:toTs IS NULL OR r.createdAt <= :toTs)
            ORDER BY r.createdAt DESC
            """)
    Page<TokenUsageRecord> findByUser(
            @Param("userId") Long userId,
            @Param("fromTs") Instant fromTs,
            @Param("toTs") Instant toTs,
            Pageable pageable
    );

    @Query("""
            SELECT r.createdAt, SUM(r.totalTokens)
            FROM TokenUsageRecord r
            WHERE r.user.id = :userId
              AND r.createdAt >= :startTime
            GROUP BY r.createdAt
            ORDER BY r.createdAt ASC
            """)
    List<Object[]> findTokenUsageTimeline(
            @Param("userId") Long userId,
            @Param("startTime") Instant startTime
    );

    @Query("""
            SELECT COALESCE(SUM(r.totalTokens), 0)
            FROM TokenUsageRecord r
            WHERE r.user.id = :userId
              AND r.createdAt >= :startTime
            """)
    long sumTokensByUserIdSince(
            @Param("userId") Long userId,
            @Param("startTime") Instant startTime
    );
}

