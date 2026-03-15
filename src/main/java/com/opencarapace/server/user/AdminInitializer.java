package com.opencarapace.server.user;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * 若配置了 opencarapace.admin.email，则将该邮箱对应用户的角色设为 ADMIN。
 * 未配置或为空时跳过。
 */
@Component
@Order(50)
@RequiredArgsConstructor
@Slf4j
public class AdminInitializer implements ApplicationRunner {

    private final UserRepository userRepository;

    @Value("${opencarapace.admin.email:}")
    private String adminEmail;

    @Override
    public void run(ApplicationArguments args) {
        if (adminEmail == null || adminEmail.isBlank()) {
            return;
        }
        String email = adminEmail.trim().toLowerCase();
        userRepository.findByEmail(email).ifPresent(user -> {
            if (!"ADMIN".equals(user.getRole())) {
                user.setRole("ADMIN");
                userRepository.save(user);
                log.info("Set user {} as ADMIN", email);
            }
        });
    }
}
