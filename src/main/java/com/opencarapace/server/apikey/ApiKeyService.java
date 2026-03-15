package com.opencarapace.server.apikey;

import com.opencarapace.server.user.User;
import com.opencarapace.server.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;

@Service
public class ApiKeyService {

    private final ApiKeyRepository apiKeyRepository;
    private final UserRepository userRepository;
    private final SecureRandom secureRandom = new SecureRandom();

    public ApiKeyService(ApiKeyRepository apiKeyRepository, UserRepository userRepository) {
        this.apiKeyRepository = apiKeyRepository;
        this.userRepository = userRepository;
    }

    public ApiKeyWithPlainToken createKey(String label, String scopes) {
        User user = getCurrentUser();
        String rawKey = generateRawKey();
        String hash = hashKey(rawKey);

        ApiKey apiKey = new ApiKey();
        apiKey.setUser(user);
        apiKey.setLabel(label);
        apiKey.setScopes(scopes);
        apiKey.setKeyHash(hash);
        apiKeyRepository.save(apiKey);

        return new ApiKeyWithPlainToken(apiKey, rawKey);
    }

    public List<ApiKey> listActiveKeys() {
        User user = getCurrentUser();
        return apiKeyRepository.findByUserAndActiveIsTrue(user);
    }

    public void revokeKey(Long id) {
        ApiKey apiKey = apiKeyRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "API Key 不存在"));
        User user = getCurrentUser();
        if (!apiKey.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权操作该 API Key");
        }
        apiKey.setActive(false);
        apiKeyRepository.save(apiKey);
    }

    public ApiKey updateKey(Long id, String label, String scopes) {
        ApiKey apiKey = apiKeyRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "API Key 不存在"));
        User user = getCurrentUser();
        if (!apiKey.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权操作该 API Key");
        }
        if (label != null && !label.isBlank()) {
            apiKey.setLabel(label.trim());
        }
        if (scopes != null) {
            apiKey.setScopes(scopes.trim().isEmpty() ? null : scopes.trim());
        }
        return apiKeyRepository.save(apiKey);
    }

    public ApiKey authenticateByRawKey(String rawKey) {
        String hash = hashKey(rawKey);
        return apiKeyRepository.findByKeyHashAndActiveIsTrue(hash).orElse(null);
    }

    private String generateRawKey() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return "oc_" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hashKey(String rawKey) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(rawKey.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hashed);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            throw new IllegalStateException("Missing authentication");
        }
        Long userId = Long.parseLong(auth.getName());
        return userRepository.findById(userId).orElseThrow();
    }

    public record ApiKeyWithPlainToken(ApiKey apiKey, String plainToken) {
    }
}

