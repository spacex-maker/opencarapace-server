package com.opencarapace.server.apikey;

import java.time.Instant;

/**
 * 列表展示用，不暴露 keyHash。
 */
public record ApiKeyDto(
    Long id,
    String label,
    String scopes,
    boolean active,
    Instant createdAt
) {
    public static ApiKeyDto from(ApiKey key) {
        return new ApiKeyDto(
            key.getId(),
            key.getLabel(),
            key.getScopes(),
            key.isActive(),
            key.getCreatedAt()
        );
    }
}
