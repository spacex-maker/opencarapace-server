package com.opencarapace.server.securityscan;

import com.opencarapace.server.security.JwtTokenService;
import com.opencarapace.server.user.User;
import com.opencarapace.server.user.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/security-scan")
public class SecurityScanController {

    private final SecurityScanService securityScanService;
    private final JwtTokenService jwtTokenService;
    private final UserRepository userRepository;

    public SecurityScanController(SecurityScanService securityScanService,
                                  JwtTokenService jwtTokenService,
                                  UserRepository userRepository) {
        this.securityScanService = securityScanService;
        this.jwtTokenService = jwtTokenService;
        this.userRepository = userRepository;
    }

    @GetMapping("/items")
    public ResponseEntity<?> listItems(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        User user = resolveUser(authHeader);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "未授权"));
        }
        return ResponseEntity.ok(Map.of("items", securityScanService.listItemsForClient()));
    }

    @PostMapping("/ai-run")
    public ResponseEntity<?> runAi(@RequestHeader(value = "Authorization", required = false) String authHeader,
                                   @RequestBody Map<String, Object> body) {
        User user = resolveUser(authHeader);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "未授权"));
        }
        @SuppressWarnings("unchecked")
        List<String> codes = (List<String>) body.get("itemCodes");
        String context = body.get("context") != null ? String.valueOf(body.get("context")) : "";
        try {
            return ResponseEntity.ok(securityScanService.runScan(user, codes, context));
        } catch (org.springframework.web.server.ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", Map.of("message", e.getReason() != null ? e.getReason() : "请求失败")));
        }
    }

    private User resolveUser(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return null;
        }
        String token = authHeader.substring(7);
        try {
            var claims = jwtTokenService.parseToken(token);
            Long userId = Long.parseLong(claims.getSubject());
            return userRepository.findById(userId).orElse(null);
        } catch (Exception e) {
            return null;
        }
    }
}
