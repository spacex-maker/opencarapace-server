package com.opencarapace.server.user;

import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;

public final class UserAdminSpecifications {

    private UserAdminSpecifications() {
    }

    private static String escapeLike(String raw) {
        return raw.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    public static Specification<User> filter(String emailQ, String role, Boolean disabled) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (emailQ != null && !emailQ.isBlank()) {
                String like = "%" + escapeLike(emailQ.trim().toLowerCase()) + "%";
                predicates.add(cb.like(cb.lower(root.get("email")), like, '\\'));
            }
            if (role != null && !role.isBlank()) {
                predicates.add(cb.equal(root.get("role"), role.trim().toUpperCase()));
            }
            if (disabled != null) {
                predicates.add(cb.equal(root.get("disabled"), disabled));
            }
            if (predicates.isEmpty()) {
                return cb.conjunction();
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
