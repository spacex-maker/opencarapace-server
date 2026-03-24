package com.opencarapace.server.safety;

import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * 管理员查询全站 LLM 代理拦截日志（inputType = llm_proxy_block）的动态条件。
 */
public final class SafetyBlockLogAdminSpecifications {

    private SafetyBlockLogAdminSpecifications() {
    }

    private static String escapeLike(String raw) {
        return raw.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    public static Specification<SafetyEvaluationRecord> adminProxyBlockLogs(
            Long userId,
            String emailContains,
            String blockType,
            String riskLevel,
            Instant from,
            Instant to,
            String keyword
    ) {
        return (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            p.add(cb.equal(root.get("inputType"), "llm_proxy_block"));

            if (userId != null) {
                p.add(cb.equal(root.get("user").get("id"), userId));
            }
            if (emailContains != null && !emailContains.isBlank()) {
                String pattern = "%" + escapeLike(emailContains.trim()).toLowerCase() + "%";
                p.add(cb.like(cb.lower(root.get("user").get("email")), pattern, '\\'));
            }
            if (blockType != null && !blockType.isBlank()) {
                p.add(cb.equal(root.get("inputSummary"), blockType.trim()));
            }
            if (riskLevel != null && !riskLevel.isBlank()) {
                p.add(cb.equal(cb.lower(root.get("riskLevel")), riskLevel.trim().toLowerCase()));
            }
            if (from != null) {
                p.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from));
            }
            if (to != null) {
                p.add(cb.lessThanOrEqualTo(root.get("createdAt"), to));
            }
            if (keyword != null && !keyword.isBlank()) {
                String kwPattern = "%" + escapeLike(keyword.trim()).toLowerCase() + "%";
                Predicate inReasons = cb.like(cb.lower(root.get("reasons")), kwPattern, '\\');
                Predicate inRaw = cb.like(cb.lower(root.get("rawInput")), kwPattern, '\\');
                p.add(cb.or(inReasons, inRaw));
            }

            return cb.and(p.toArray(new Predicate[0]));
        };
    }
}
