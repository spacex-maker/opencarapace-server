package com.opencarapace.server.safety;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SafetyEvaluationRepository extends JpaRepository<SafetyEvaluationRecord, Long> {
}

