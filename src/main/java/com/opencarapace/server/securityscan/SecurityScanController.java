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
    private final SecurityScanRunService securityScanRunService;
    private final JwtTokenService jwtTokenService;
    private final UserRepository userRepository;

    public SecurityScanController(SecurityScanService securityScanService,
                                  SecurityScanRunService securityScanRunService,
                                  JwtTokenService jwtTokenService,
                                  UserRepository userRepository) {
        this.securityScanService = securityScanService;
        this.securityScanRunService = securityScanRunService;
        this.jwtTokenService = jwtTokenService;
        this.userRepository = userRepository;
    }

    @GetMapping("/items")
    public ResponseEntity<?> listItems(@RequestHeader(value = "Authorization", required = false) String authHeader,
                                       @RequestParam(value = "clientOs", required = false) String clientOs) {
        User user = resolveUser(authHeader);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "未授权"));
        }
        return ResponseEntity.ok(Map.of("items", securityScanService.listItemsForClient(clientOs)));
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
        String clientOs = body.get("clientOs") != null ? String.valueOf(body.get("clientOs")) : null;
        String locale = body.get("locale") != null ? String.valueOf(body.get("locale")) : "";
        try {
            return ResponseEntity.ok(securityScanService.runScan(user, codes, context, clientOs, locale));
        } catch (org.springframework.web.server.ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", Map.of("message", e.getReason() != null ? e.getReason() : "请求失败")));
        }
    }

    /**
     * 异步扫描：返回 runId，客户端轮询 /runs/{id} 获取进度与结果。
     */
    @PostMapping("/runs")
    public ResponseEntity<?> startRun(@RequestHeader(value = "Authorization", required = false) String authHeader,
                                      @RequestBody Map<String, Object> body) {
        User user = resolveUser(authHeader);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "未授权"));
        }
        @SuppressWarnings("unchecked")
        List<String> codes = (List<String>) body.get("itemCodes");
        String context = body.get("context") != null ? String.valueOf(body.get("context")) : "";
        String clientOs = body.get("clientOs") != null ? String.valueOf(body.get("clientOs")) : null;
        String locale = body.get("locale") != null ? String.valueOf(body.get("locale")) : "";
        try {
            return ResponseEntity.ok(securityScanRunService.startAsync(user, codes, context, clientOs, locale));
        } catch (org.springframework.web.server.ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode())
                    .body(Map.of("error", Map.of("message", e.getReason() != null ? e.getReason() : "请求失败")));
        }
    }

    @GetMapping("/runs")
    public ResponseEntity<?> listRuns(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        User user = resolveUser(authHeader);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "未授权"));
        }
        return ResponseEntity.ok(Map.of("runs", securityScanRunService.listForUser(user)));
    }

    @GetMapping("/runs/{id}")
    public ResponseEntity<?> getRun(@RequestHeader(value = "Authorization", required = false) String authHeader,
                                    @PathVariable("id") Long id) {
        User user = resolveUser(authHeader);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "未授权"));
        }
        try {
            return ResponseEntity.ok(securityScanRunService.getForUser(user, id));
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
