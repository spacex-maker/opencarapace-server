package com.opencarapace.server.social;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SocialMediaLinkRepository extends JpaRepository<SocialMediaLink, Long> {

    List<SocialMediaLink> findAllByEnabledTrueOrderBySortOrderAscIdAsc();
}
