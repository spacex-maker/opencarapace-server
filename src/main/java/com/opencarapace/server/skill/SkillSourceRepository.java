package com.opencarapace.server.skill;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SkillSourceRepository extends JpaRepository<SkillSource, Long> {

    Optional<SkillSource> findByCode(String code);
}

