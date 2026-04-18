package com.opencarapace.server.user;

import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    /** 当前登录用户信息（需认证） */
    @GetMapping("/me")
    public ResponseEntity<UserProfileDto> me() {
        return userService.getCurrentUser()
                .map(UserProfileDto::from)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(401).build());
    }

    /** 更新当前用户资料（displayName、avatarUrl） */
    @PatchMapping("/me")
    public ResponseEntity<UserProfileDto> updateMe(@RequestBody UpdateProfileRequest request) {
        return userService.updateProfile(request.displayName(), request.avatarUrl())
                .map(UserProfileDto::from)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(401).build());
    }

    public record UserProfileDto(
            Long id,
            String email,
            String displayName,
            String avatarUrl,
            String role,
            boolean disabled,
            java.time.Instant createdAt
    ) {
        static UserProfileDto from(User user) {
            return new UserProfileDto(
                    user.getId(),
                    user.getEmail(),
                    user.getDisplayName(),
                    user.getAvatarUrl(),
                    user.getRole(),
                    user.isDisabled(),
                    user.getCreatedAt()
            );
        }
    }

    public record UpdateProfileRequest(
            @Size(max = 255) String displayName,
            @Size(max = 512) String avatarUrl
    ) {}
}
