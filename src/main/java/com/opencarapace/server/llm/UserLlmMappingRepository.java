package com.opencarapace.server.llm;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserLlmMappingRepository extends JpaRepository<UserLlmMapping, Long> {

    @Query("SELECT m FROM UserLlmMapping m WHERE m.user.id = :userId ORDER BY m.createdAt DESC")
    List<UserLlmMapping> findByUserId(@Param("userId") Long userId);

    @Query("SELECT m FROM UserLlmMapping m WHERE m.user.id = :userId AND m.prefix = :prefix")
    Optional<UserLlmMapping> findByUserIdAndPrefix(@Param("userId") Long userId, @Param("prefix") String prefix);
}
