package com.opencarapace.server.dashboard;

import com.opencarapace.server.security.JwtTokenService;
import com.opencarapace.server.user.User;
import com.opencarapace.server.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    @Autowired
    private DashboardService dashboardService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenService jwtTokenService;

    @GetMapping("/skills-stats")
    public ResponseEntity<?> getSkillsStats(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        User user = getUserFromAuth(authHeader);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "未授权"));
        }
        return ResponseEntity.ok(dashboardService.getSkillsStats(user.getId()));
    }

    @GetMapping("/danger-stats")
    public ResponseEntity<?> getDangerStats(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        User user = getUserFromAuth(authHeader);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "未授权"));
        }
        return ResponseEntity.ok(dashboardService.getDangerCommandStats());
    }

    @GetMapping("/intercept-risk-stats")
    public ResponseEntity<?> getInterceptRiskStats(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        User user = getUserFromAuth(authHeader);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "未授权"));
        }
        return ResponseEntity.ok(dashboardService.getInterceptRiskStats(user.getId()));
    }

    @GetMapping("/token-usage-timeline")
    public ResponseEntity<?> getTokenUsageTimeline(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(name = "range", defaultValue = "24h") String range,
            @RequestParam(name = "granularity", defaultValue = "hour") String granularity) {
        User user = getUserFromAuth(authHeader);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "未授权"));
        }
        return ResponseEntity.ok(dashboardService.getTokenUsageTimeline(user.getId(), range, granularity));
    }

    @GetMapping("/intercept-timeline")
    public ResponseEntity<?> getInterceptTimeline(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(name = "range", defaultValue = "24h") String range,
            @RequestParam(name = "granularity", defaultValue = "hour") String granularity) {
        User user = getUserFromAuth(authHeader);
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "未授权"));
        }
        return ResponseEntity.ok(dashboardService.getInterceptTimeline(user.getId(), range, granularity));
    }

    private User getUserFromAuth(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return null;
        }
        String token = authHeader.substring(7);
        try {
            var claims = jwtTokenService.parseToken(token);
            String userIdStr = claims.getSubject();
            Long userId = Long.parseLong(userIdStr);
            return userRepository.findById(userId).orElse(null);
        } catch (Exception e) {
            return null;
        }
    }
}
