package com.opencarapace.server.safety;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

import java.util.List;

public interface SafetyEvaluationRepository extends JpaRepository<SafetyEvaluationRecord, Long> {
    @Query("""
            SELECT r FROM SafetyEvaluationRecord r
            WHERE r.user.id = :userId
              AND r.inputType = :inputType
              AND (:blockType IS NULL OR r.inputSummary = :blockType)
            ORDER BY r.createdAt DESC
            """)
    Page<SafetyEvaluationRecord> findBlockLogsByUser(
            @Param("userId") Long userId,
            @Param("inputType") String inputType,
            @Param("blockType") String blockType,
            Pageable pageable
    );

    @Query("""
            SELECT r FROM SafetyEvaluationRecord r
            WHERE r.user.id = :userId
              AND r.id = :id
            """)
    SafetyEvaluationRecord findOneByIdAndUserId(
            @Param("id") Long id,
            @Param("userId") Long userId
    );

    long countByUserId(Long userId);

    List<SafetyEvaluationRecord> findByUserId(Long userId);

    @Query("""
            SELECT r.createdAt, COUNT(r)
            FROM SafetyEvaluationRecord r
            WHERE r.user.id = :userId
              AND r.createdAt >= :startTime
            GROUP BY r.createdAt
            ORDER BY r.createdAt ASC
            """)
    List<Object[]> findInterceptTimeline(
            @Param("userId") Long userId,
            @Param("startTime") Instant startTime
    );

    @Query("""
            SELECT COUNT(r)
            FROM SafetyEvaluationRecord r
            WHERE r.user.id = :userId
              AND r.createdAt >= :startTime
            """)
    long countByUserIdSince(
            @Param("userId") Long userId,
            @Param("startTime") Instant startTime
    );
}

