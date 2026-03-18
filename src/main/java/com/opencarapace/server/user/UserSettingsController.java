package com.opencarapace.server.user;

import com.opencarapace.server.user.UserSettings.LlmRouteMode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/user-settings")
public class UserSettingsController {

    private final UserSettingsService userSettingsService;

    public UserSettingsController(UserSettingsService userSettingsService) {
        this.userSettingsService = userSettingsService;
    }

    @GetMapping("/me")
    public ResponseEntity<UserSettingsDto> me() {
        UserSettings settings = userSettingsService.getForCurrentUser();
        return ResponseEntity.ok(UserSettingsDto.from(settings));
    }

    @PutMapping("/me/llm-route-mode")
    public ResponseEntity<UserSettingsDto> updateLlmRoute(@RequestBody UpdateLlmRouteRequest request) {
        UserSettings updated = userSettingsService.updateLlmRouteMode(request.llmRouteMode());
        return ResponseEntity.ok(UserSettingsDto.from(updated));
    }

    public record UserSettingsDto(
            LlmRouteMode llmRouteMode
    ) {
        public static UserSettingsDto from(UserSettings s) {
            return new UserSettingsDto(s.getLlmRouteMode());
        }
    }

    public record UpdateLlmRouteRequest(
            LlmRouteMode llmRouteMode
    ) {
    }
}

