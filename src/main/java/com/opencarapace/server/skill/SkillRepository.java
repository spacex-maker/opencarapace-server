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

    @Query("""
            select s from Skill s
            where (:status is null or s.status = :status)
              and (:type is null or lower(s.type) like lower(concat('%', :type, '%')))
              and (:category is null or lower(s.category) like lower(concat('%', :category, '%')))
              and (
                    :keyword is null
                 or lower(s.name) like lower(concat('%', :keyword, '%'))
                 or lower(s.slug) like lower(concat('%', :keyword, '%'))
                 or lower(coalesce(s.shortDesc, '')) like lower(concat('%', :keyword, '%'))
              )
            """)
    Page<Skill> search(
            @Param("status") String status,
            @Param("type") String type,
            @Param("category") String category,
            @Param("keyword") String keyword,
            Pageable pageable
    );
}

