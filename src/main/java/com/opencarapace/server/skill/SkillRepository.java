package com.opencarapace.server.skill;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface SkillRepository extends JpaRepository<Skill, Long> {

    Optional<Skill> findBySourceIdAndExternalId(Long sourceId, String externalId);

    @Query("select s.slug from Skill s where s.status = :status")
    List<String> findSlugsByStatus(@Param("status") String status);

    Page<Skill> findByUpdatedAtAfterOrderByUpdatedAtAsc(Instant updatedAt, Pageable pageable);
}

