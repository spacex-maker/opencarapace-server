package com.opencarapace.server.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserSkillRepository extends JpaRepository<UserSkill, Long> {

    List<UserSkill> findByUserId(Long userId);

    Optional<UserSkill> findByUserIdAndSkillSlug(Long userId, String skillSlug);

    long countByUserIdAndEnabled(Long userId, boolean enabled);
}

