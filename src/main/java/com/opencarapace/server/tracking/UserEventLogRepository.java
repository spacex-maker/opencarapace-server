package com.opencarapace.server.tracking;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;

public interface UserEventLogRepository extends JpaRepository<UserEventLog, Long>, JpaSpecificationExecutor<UserEventLog> {

    Optional<UserEventLog> findByEventId(String eventId);
}

