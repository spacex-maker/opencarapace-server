package com.opencarapace.server.user;

import com.opencarapace.server.config.SystemDataVersionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/user-settings")
public class UserSettingsVersionController {

    private final UserRepository userRepository;
    private final SystemDataVersionService systemDataVersionService;

    public UserSettingsVersionController(UserRepository userRepository,
                                        SystemDataVersionService systemDataVersionService) {
        this.userRepository = userRepository;
        this.systemDataVersionService = systemDataVersionService;
    }

    public record SettingsVersionDto(
            Long userSettingsVersion,
            Long skillsDataVersion,
            Long dangerCommandsDataVersion,
            Long combinedVersion
    ) {}

    @GetMapping("/version")
    public ResponseEntity<SettingsVersionDto> getSettingsVersion() {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        long userVer = user.getSettingsVersion();
        long skillsVer = systemDataVersionService.getSkillsDataVersion();
        long dangerVer = systemDataVersionService.getDangerCommandsDataVersion();
        long combined = userVer + skillsVer + dangerVer;
        
        return ResponseEntity.ok(new SettingsVersionDto(userVer, skillsVer, dangerVer, combined));
    }

    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            return null;
        }
        try {
            Long userId = Long.parseLong(auth.getName());
            return userRepository.findById(userId).orElse(null);
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
