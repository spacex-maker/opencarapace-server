package com.opencarapace.server.user;

import com.opencarapace.server.user.UserSettings.LlmRouteMode;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserSettingsService {

    private final UserRepository userRepository;
    private final UserSettingsRepository settingsRepository;

    public UserSettingsService(UserRepository userRepository, UserSettingsRepository settingsRepository) {
        this.userRepository = userRepository;
        this.settingsRepository = settingsRepository;
    }

    @Transactional(readOnly = true)
    public UserSettings getForCurrentUser() {
        User user = getCurrentUser();
        return settingsRepository.findByUserId(user.getId())
                .orElseGet(() -> {
                    UserSettings s = new UserSettings();
                    s.setUser(user);
                    s.setLlmRouteMode(LlmRouteMode.GATEWAY);
                    return s;
                });
    }

    @Transactional
    public UserSettings updateLlmRouteMode(LlmRouteMode mode) {
        User user = getCurrentUser();
        UserSettings settings = settingsRepository.findByUserId(user.getId())
                .orElseGet(() -> {
                    UserSettings s = new UserSettings();
                    s.setUser(user);
                    return s;
                });
        settings.setLlmRouteMode(mode != null ? mode : LlmRouteMode.GATEWAY);
        return settingsRepository.save(settings);
    }

    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            throw new IllegalStateException("Missing authentication");
        }
        Long userId = Long.parseLong(auth.getName());
        return userRepository.findById(userId).orElseThrow();
    }
}

