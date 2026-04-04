package com.opencarapace.server.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserSkillRepository extends JpaRepository<UserSkill, Long> {

    List<UserSkill> findByUserId(Long userId);

    Optional<UserSkill> findByUserIdAndSkillSlug(Long userId, String skillSlug);

    @Query("select count(u) from UserSkill u where u.user.id = :userId and u.enabled = :enabled")
    long countByUserIdAndEnabled(@Param("userId") Long userId, @Param("enabled") boolean enabled);
}

