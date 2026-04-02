package com.opencarapace.server.safety;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LlmProxyRequestLogRepository extends JpaRepository<LlmProxyRequestLog, Long> {

    Page<LlmProxyRequestLog> findByUser_IdOrderByIdDesc(Long userId, Pageable pageable);
}
