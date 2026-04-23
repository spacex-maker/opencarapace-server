package com.opencarapace.server.social;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class SocialMediaDtos {

    private SocialMediaDtos() {
    }

    public record SocialMediaItemDto(
            Long id,
            String name,
            String iconKey,
            String url,
            boolean enabled,
            boolean showQrCode,
            Integer sortOrder,
            Instant createdAt,
            Instant updatedAt
    ) {
    }

    public record UpsertSocialMediaRequest(
            @NotBlank @Size(max = 64) String name,
            @NotBlank @Size(max = 48)
            @Pattern(regexp = "^[a-zA-Z0-9_-]+$", message = "iconKey 仅支持字母数字下划线和中划线")
            String iconKey,
            @NotBlank @Size(max = 1024) String url,
            @NotNull Boolean enabled,
            @NotNull Boolean showQrCode,
            @NotNull Integer sortOrder
    ) {
    }
}
