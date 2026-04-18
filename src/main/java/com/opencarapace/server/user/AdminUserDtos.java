package com.opencarapace.server.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public final class AdminUserDtos {

    private AdminUserDtos() {
    }

    public record AdminUserRowDto(
            Long id,
            String email,
            String displayName,
            String role,
            String provider,
            boolean disabled,
            boolean passwordSet,
            Instant createdAt
    ) {
    }

    public record AdminUserPageResponse(
            int page,
            int size,
            long total,
            List<AdminUserRowDto> items
    ) {
    }

    public record CreateAdminUserRequest(
            @NotBlank @Email String email,
            @NotBlank @Size(min = 6, max = 100) String password,
            @Size(max = 255) String displayName,
            String role
    ) {
    }

    public record SetDisabledRequest(boolean disabled) {
    }

    public record SetRoleRequest(
            @NotBlank
            @Pattern(regexp = "(?i)(USER|ADMIN)", message = "角色只能是 USER 或 ADMIN")
            String role
    ) {
    }

    public record ResetPasswordRequest(
            @NotBlank @Size(min = 6, max = 100) String newPassword
    ) {
    }
}
