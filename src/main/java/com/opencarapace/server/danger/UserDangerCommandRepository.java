package com.opencarapace.server.danger;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserDangerCommandRepository extends JpaRepository<UserDangerCommand, Long> {

    List<UserDangerCommand> findByUserId(Long userId);

    Optional<UserDangerCommand> findByUserIdAndDangerCommandId(Long userId, Long dangerCommandId);
}

