package com.opencarapace.server.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserSkillSafetyLabelRepository extends JpaRepository<UserSkillSafetyLabel, Long> {

    List<UserSkillSafetyLabel> findByUserId(Long userId);

    List<UserSkillSafetyLabel> findByUserIdAndSkillSlugIn(Long userId, List<String> skillSlugs);

    Optional<UserSkillSafetyLabel> findByUserIdAndSkillSlug(Long userId, String skillSlug);

    long countByUserIdAndLabel(Long userId, String label);
}
