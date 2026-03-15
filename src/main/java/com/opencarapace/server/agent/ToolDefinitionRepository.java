package com.opencarapace.server.agent;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ToolDefinitionRepository extends JpaRepository<ToolDefinition, Long> {

    Optional<ToolDefinition> findByName(String name);

    List<ToolDefinition> findByTagsContainingIgnoreCase(String tag);
}

