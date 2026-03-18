package com.opencarapace.server.danger;

import com.opencarapace.server.danger.DangerCommand.DangerCategory;
import com.opencarapace.server.danger.DangerCommand.RiskLevel;
import com.opencarapace.server.danger.DangerCommand.SystemType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface DangerCommandRepository extends JpaRepository<DangerCommand, Long> {

    /** 监管层：按风险等级拉取启用的危险指令（用于请求/响应文本匹配） */
    List<DangerCommand> findByEnabledTrueAndRiskLevelInOrderByRiskLevelAsc(List<RiskLevel> riskLevels);

    Optional<DangerCommand> findByCommandPatternAndSystemType(String commandPattern, SystemType systemType);

    List<DangerCommand> findByEnabledTrueOrderByRiskLevelAscCreatedAtDesc(Pageable pageable);

    List<DangerCommand> findBySystemTypeAndEnabledTrue(SystemType systemType, Pageable pageable);

    List<DangerCommand> findByCategoryAndEnabledTrue(DangerCategory category, Pageable pageable);

    List<DangerCommand> findByRiskLevelAndEnabledTrue(RiskLevel riskLevel, Pageable pageable);

    @Query("""
        SELECT d FROM DangerCommand d WHERE d.enabled = true
        AND (:systemType IS NULL OR d.systemType = :systemType)
        AND (:category IS NULL OR d.category = :category)
        AND (:riskLevel IS NULL OR d.riskLevel = :riskLevel)
        AND (:keyword IS NULL OR :keyword = '' OR LOWER(d.commandPattern) LIKE LOWER(CONCAT('%', :keyword, '%'))
            OR LOWER(d.title) LIKE LOWER(CONCAT('%', :keyword, '%'))
            OR LOWER(d.description) LIKE LOWER(CONCAT('%', :keyword, '%'))
            OR LOWER(d.tags) LIKE LOWER(CONCAT('%', :keyword, '%')))
        ORDER BY d.riskLevel ASC, d.createdAt DESC
        """)
    Page<DangerCommand> search(
        @Param("systemType") SystemType systemType,
        @Param("category") DangerCategory category,
        @Param("riskLevel") RiskLevel riskLevel,
        @Param("keyword") String keyword,
        Pageable pageable
    );

    Page<DangerCommand> findByEnabledTrueAndCreatedAtAfterOrderByCreatedAtAsc(Instant createdAt, Pageable pageable);
}
