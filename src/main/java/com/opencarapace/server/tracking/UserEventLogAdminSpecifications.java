package com.opencarapace.server.tracking;

import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public final class UserEventLogAdminSpecifications {

    private UserEventLogAdminSpecifications() {
    }

    private static String escapeLike(String raw) {
        return raw.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    public static Specification<UserEventLog> adminQuery(
            Long userId,
            String anonymousId,
            String sessionId,
            String eventName,
            String platform,
            String pageId,
            String module,
            Instant from,
            Instant to,
            String keyword
    ) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (userId != null) {
                predicates.add(cb.equal(root.get("user").get("id"), userId));
            }
            if (anonymousId != null && !anonymousId.isBlank()) {
                predicates.add(cb.equal(root.get("anonymousId"), anonymousId.trim()));
            }
            if (sessionId != null && !sessionId.isBlank()) {
                predicates.add(cb.equal(root.get("sessionId"), sessionId.trim()));
            }
            if (eventName != null && !eventName.isBlank()) {
                predicates.add(cb.equal(root.get("eventName"), eventName.trim()));
            }
            if (platform != null && !platform.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.get("platform")), platform.trim().toLowerCase()));
            }
            if (pageId != null && !pageId.isBlank()) {
                String like = "%" + escapeLike(pageId.trim().toLowerCase()) + "%";
                predicates.add(cb.like(cb.lower(root.get("pageId")), like, '\\'));
            }
            if (module != null && !module.isBlank()) {
                String like = "%" + escapeLike(module.trim().toLowerCase()) + "%";
                predicates.add(cb.like(cb.lower(root.get("module")), like, '\\'));
            }
            if (from != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("eventTime"), from));
            }
            if (to != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("eventTime"), to));
            }
            if (keyword != null && !keyword.isBlank()) {
                String like = "%" + escapeLike(keyword.trim().toLowerCase()) + "%";
                Predicate inEventProps = cb.like(cb.lower(root.get("eventPropsJson")), like, '\\');
                Predicate inContextProps = cb.like(cb.lower(root.get("contextPropsJson")), like, '\\');
                Predicate inPageId = cb.like(cb.lower(root.get("pageId")), like, '\\');
                Predicate inModule = cb.like(cb.lower(root.get("module")), like, '\\');
                predicates.add(cb.or(inEventProps, inContextProps, inPageId, inModule));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}

