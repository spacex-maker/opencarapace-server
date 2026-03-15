package com.opencarapace.server.auth;

import com.opencarapace.server.user.UserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final GoogleAuthService googleAuthService;
    private final UserService userService;

    public AuthController(GoogleAuthService googleAuthService, UserService userService) {
        this.googleAuthService = googleAuthService;
        this.userService = userService;
    }

    @PostMapping("/google")
    public Mono<ResponseEntity<GoogleAuthService.AuthResponse>> googleLogin(
            @Valid @RequestBody GoogleLoginRequest request
    ) {
        return googleAuthService.authenticateWithIdToken(request.idToken())
                .map(ResponseEntity::ok);
    }

    /** 邮箱+密码注册 */
    @PostMapping("/register")
    public ResponseEntity<GoogleAuthService.AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        var user = userService.register(request.email(), request.password(), request.displayName());
        return ResponseEntity.status(201).body(userService.buildAuthResponse(user));
    }

    /** 邮箱+密码登录 */
    @PostMapping("/login")
    public ResponseEntity<GoogleAuthService.AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(userService.login(request.email(), request.password()));
    }

    public record GoogleLoginRequest(@NotBlank String idToken) {}

    public record RegisterRequest(
            @NotBlank @jakarta.validation.constraints.Email String email,
            @NotBlank @Size(min = 6, max = 100) String password,
            @Size(max = 255) String displayName
    ) {}

    public record LoginRequest(
            @NotBlank String email,
            @NotBlank String password
    ) {}
}

