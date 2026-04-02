package com.opencarapace.server.agentmgmt;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserAgentItemRepository extends JpaRepository<UserAgentItem, Long> {

    long countByUser_IdAndPlatformCodeAndFeatureType(Long userId, String platformCode, String featureType);

    List<UserAgentItem> findByUser_IdAndPlatformCodeAndFeatureTypeOrderBySortOrderAscIdAsc(
            Long userId, String platformCode, String featureType);
}
