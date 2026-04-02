package com.opencarapace.server.securityscan;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface SecurityScanItemRepository extends JpaRepository<SecurityScanItem, Long> {

    List<SecurityScanItem> findByEnabledTrueOrderBySortOrderAscIdAsc();

    List<SecurityScanItem> findByCodeInAndEnabledTrue(Collection<String> codes);
}
