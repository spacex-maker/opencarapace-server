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
              AND (:routeMode IS NULL OR r.routeMode = :routeMode)
              AND (:modelPattern IS NULL OR LOWER(r.model) LIKE :modelPattern)
              AND (:keywordPattern IS NULL OR (
                    LOWER(r.model) LIKE :keywordPattern
                 OR LOWER(r.upstreamBase) LIKE :keywordPattern
                 OR LOWER(COALESCE(r.requestPath, '')) LIKE :keywordPattern
                 OR LOWER(COALESCE(r.providerKey, '')) LIKE :keywordPattern
              ))
              AND (:estimated IS NULL OR r.estimated = :estimated)
            ORDER BY r.createdAt DESC
            """)
    Page<TokenUsageRecord> findByUserFiltered(
            @Param("userId") Long userId,
            @Param("fromTs") Instant fromTs,
            @Param("toTs") Instant toTs,
            @Param("routeMode") String routeMode,
            @Param("modelPattern") String modelPattern,
            @Param("keywordPattern") String keywordPattern,
            @Param("estimated") Boolean estimated,
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

    Page<TokenUsageRecord> findByUser_IdAndIdGreaterThanOrderByIdAsc(Long userId, Long id, Pageable pageable);
}

