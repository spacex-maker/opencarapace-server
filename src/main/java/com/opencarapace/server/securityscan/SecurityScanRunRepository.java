package com.opencarapace.server.securityscan;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SecurityScanRunRepository extends JpaRepository<SecurityScanRun, Long> {
    List<SecurityScanRun> findTop50ByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<SecurityScanRun> findByIdAndUserId(Long id, Long userId);
}

