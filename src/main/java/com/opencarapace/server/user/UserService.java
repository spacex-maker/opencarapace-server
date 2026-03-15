package com.opencarapace.server.user;

import com.opencarapace.server.auth.GoogleAuthService;
import com.opencarapace.server.security.JwtTokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class UserService {

    private static final String PROVIDER_LOCAL = "local";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;

    /** 当前登录用户 ID（来自 JWT subject） */
    public Optional<Long> getCurrentUserId() {
        String name = SecurityContextHolder.getContext().getAuthentication().getName();
        if (name == null || name.isBlank()) return Optional.empty();
        try {
            return Optional.of(Long.parseLong(name));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    @Transactional(readOnly = true)
    public Optional<User> getCurrentUser() {
        return getCurrentUserId().flatMap(userRepository::findById);
    }

    @Transactional(readOnly = true)
    public Optional<User> findById(Long id) {
        return userRepository.findById(id);
    }

    /**
     * 邮箱+密码注册。邮箱不可与已有用户重复。
     */
    @Transactional
    public User register(String email, String password, String displayName) {
        if (userRepository.findByEmail(email).isPresent()) {
            throw new IllegalArgumentException("该邮箱已注册");
        }
        User user = new User();
        user.setEmail(email.trim().toLowerCase());
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setDisplayName(displayName != null && !displayName.isBlank() ? displayName.trim() : user.getEmail());
        user.setProvider(PROVIDER_LOCAL);
        user.setProviderId(user.getEmail());
        user.setRole("USER");
        return userRepository.save(user);
    }

    /**
     * 邮箱+密码登录，成功返回 JWT 及用户信息（与 Google 登录响应格式一致）。
     */
    @Transactional(readOnly = true)
    public GoogleAuthService.AuthResponse login(String email, String password) {
        User user = userRepository.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new IllegalArgumentException("邮箱或密码错误"));
        if (user.getPasswordHash() == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new IllegalArgumentException("邮箱或密码错误");
        }
        return buildAuthResponse(user);
    }

    /** 与 Google 登录一致的 JWT 与用户信息 */
    public GoogleAuthService.AuthResponse buildAuthResponse(User user) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("email", user.getEmail());
        claims.put("role", user.getRole());
        claims.put("uid", user.getId().toString());
        String jwt = jwtTokenService.generateToken(user.getId().toString(), claims);

        GoogleAuthService.AuthResponse response = new GoogleAuthService.AuthResponse();
        response.setToken(jwt);
        response.setEmail(user.getEmail());
        response.setDisplayName(user.getDisplayName());
        response.setAvatarUrl(user.getAvatarUrl());
        return response;
    }

    /**
     * 更新当前用户资料（仅 displayName、avatarUrl）。
     */
    @Transactional
    public Optional<User> updateProfile(String displayName, String avatarUrl) {
        return getCurrentUserId()
                .flatMap(userRepository::findById)
                .map(user -> {
                    if (displayName != null) user.setDisplayName(displayName.trim());
                    if (avatarUrl != null) user.setAvatarUrl(avatarUrl.trim());
                    return userRepository.save(user);
                });
    }
}
