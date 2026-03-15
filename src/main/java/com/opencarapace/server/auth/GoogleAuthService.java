package com.opencarapace.server.auth;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.opencarapace.server.security.JwtTokenService;
import com.opencarapace.server.user.User;
import com.opencarapace.server.user.UserRepository;
import jakarta.validation.constraints.NotBlank;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.HashMap;
import java.util.Map;

@Service
@Validated
public class GoogleAuthService {

    private final WebClient webClient;
    private final String googleClientId;
    private final UserRepository userRepository;
    private final JwtTokenService jwtTokenService;

    public GoogleAuthService(
            @Value("${google.oauth.client-id}") String googleClientId,
            UserRepository userRepository,
            JwtTokenService jwtTokenService
    ) {
        this.webClient = WebClient.builder().baseUrl("https://oauth2.googleapis.com").build();
        this.googleClientId = googleClientId;
        this.userRepository = userRepository;
        this.jwtTokenService = jwtTokenService;
    }

    public Mono<AuthResponse> authenticateWithIdToken(@NotBlank String idToken) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("id_token", idToken);

        return webClient.post()
                .uri("/tokeninfo")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(BodyInserters.fromFormData(form))
                .retrieve()
                .bodyToMono(GoogleTokenInfo.class)
                .flatMap(this::handleTokenInfo);
    }

    private Mono<AuthResponse> handleTokenInfo(GoogleTokenInfo tokenInfo) {
        if (!googleClientId.equals(tokenInfo.aud)) {
            return Mono.error(new IllegalArgumentException("Invalid audience for Google token"));
        }
        User user = userRepository
                .findByProviderAndProviderId("google", tokenInfo.sub)
                .orElseGet(() -> {
                    User u = new User();
                    u.setProvider("google");
                    u.setProviderId(tokenInfo.sub);
                    u.setEmail(tokenInfo.email);
                    u.setDisplayName(tokenInfo.name);
                    u.setAvatarUrl(tokenInfo.picture);
                    u.setRole("USER");
                    return u;
                });
        user.setEmail(tokenInfo.email);
        user.setDisplayName(tokenInfo.name);
        user.setAvatarUrl(tokenInfo.picture);
        userRepository.save(user);

        Map<String, Object> claims = new HashMap<>();
        claims.put("email", user.getEmail());
        claims.put("role", user.getRole());
        claims.put("uid", user.getId().toString());
        String jwt = jwtTokenService.generateToken(user.getId().toString(), claims);

        AuthResponse response = new AuthResponse();
        response.setToken(jwt);
        response.setEmail(user.getEmail());
        response.setDisplayName(user.getDisplayName());
        response.setAvatarUrl(user.getAvatarUrl());
        return Mono.just(response);
    }

    public static class GoogleTokenInfo {
        public String iss;
        public String aud;
        public String sub;
        public String email;
        @JsonProperty("email_verified")
        public String emailVerified;
        public String name;
        public String picture;
    }

    public static class AuthResponse {
        private String token;
        private String email;
        private String displayName;
        private String avatarUrl;

        public String getToken() {
            return token;
        }

        public void setToken(String token) {
            this.token = token;
        }

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }

        public String getDisplayName() {
            return displayName;
        }

        public void setDisplayName(String displayName) {
            this.displayName = displayName;
        }

        public String getAvatarUrl() {
            return avatarUrl;
        }

        public void setAvatarUrl(String avatarUrl) {
            this.avatarUrl = avatarUrl;
        }
    }
}

