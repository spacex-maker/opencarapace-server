package com.opencarapace.server.client;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ClientInterceptLogRepository extends JpaRepository<ClientInterceptLog, Long> {

    List<ClientInterceptLog> findAllByOrderByCreatedAtDesc(Pageable pageable);

    List<ClientInterceptLog> findAllByApiKey_User_IdOrderByCreatedAtDesc(Long userId, Pageable pageable);
}

