package com.opencarapace.server.billing;

import com.opencarapace.server.user.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/billing/token-usages")
@RequiredArgsConstructor
public class TokenUsageController {

    private final TokenUsageRepository repository;
    private final UserRepository userRepository;

    @GetMapping("/me")
    public ResponseEntity<TokenUsagePage> myTokenUsages(
            @RequestParam(name = "page", defaultValue = "1") int page,
            @RequestParam(name = "size", defaultValue = "50") int size,
            @RequestParam(name = "from", required = false) String from,
            @RequestParam(name = "to", required = false) String to,
            @RequestParam(name = "routeMode", required = false) String routeMode,
            @RequestParam(name = "model", required = false) String model,
            @RequestParam(name = "keyword", required = false) String keyword,
            @RequestParam(name = "estimated", required = false) Boolean estimated
    ) {
        Long userId = getCurrentUserId();
        int safeSize = Math.min(Math.max(size, 1), 200);
        int safePage = Math.max(page, 1);
        Instant fromTs = parseInstant(from);
        Instant toTs = parseInstant(to);

        String route = (routeMode == null || routeMode.isBlank()) ? null : routeMode.trim();
        String modelPat = likePattern(model);
        String keywordPat = likePattern(keyword);

        Page<TokenUsageRecord> p = repository.findByUserFiltered(
                userId,
                fromTs,
                toTs,
                route,
                modelPat,
                keywordPat,
                estimated,
                PageRequest.of(safePage - 1, safeSize)
        );
        List<TokenUsageItem> items = p.getContent().stream().map(TokenUsageItem::from).toList();
        return ResponseEntity.ok(new TokenUsagePage(safePage, safeSize, p.getTotalElements(), items));
    }

    /** 桌面端“本地直连/映射”时上报：按当前登录用户入库 */
    @PostMapping("/ingest")
    public ResponseEntity<Void> ingest(@Valid @RequestBody IngestRequest request) {
        Long userId = getCurrentUserId();
        var user = userRepository.findById(userId.longValue()).orElseThrow(() -> new IllegalStateException("User not found"));

        TokenUsageRecord r = new TokenUsageRecord();
        r.setUser(user);
        r.setApiKey(null);
        r.setClientId(request.clientId());
        r.setRouteMode(request.routeMode());
        r.setUpstreamBase(request.upstreamBase());
        r.setModel(request.model());
        r.setPromptTokens(request.promptTokens());
        r.setCompletionTokens(request.completionTokens());
        r.setTotalTokens(request.totalTokens());
        r.setEstimated(Boolean.TRUE.equals(request.estimated()));
        r.setRequestPath(request.requestPath() != null ? request.requestPath() : null);
        repository.save(r);
        return ResponseEntity.ok().build();
    }

    private static Instant parseInstant(String s) {
        if (s == null || s.isBlank()) return null;
        try { return Instant.parse(s.trim()); } catch (Exception ignored) { return null; }
    }

    /** JPQL LIKE：小写子串匹配；去掉 % _ 避免通配注入 */
    private static String likePattern(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String t = raw.trim().toLowerCase().replace("%", "").replace("_", "");
        if (t.isEmpty()) {
            return null;
        }
        return "%" + t + "%";
    }

    private Long getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            throw new IllegalStateException("Missing authentication");
        }
        return Long.parseLong(auth.getName());
    }

    public record IngestRequest(
            String clientId,
            @NotBlank String routeMode,
            String upstreamBase,
            String requestPath,
            String model,
            Integer promptTokens,
            Integer completionTokens,
            Integer totalTokens,
            Boolean estimated
    ) {}

    public record TokenUsageItem(
            Long id,
            String createdAt,
            String routeMode,
            String upstreamBase,
            String model,
            Integer promptTokens,
            Integer completionTokens,
            Integer totalTokens,
            boolean estimated
    ) {
        static TokenUsageItem from(TokenUsageRecord r) {
            return new TokenUsageItem(
                    r.getId(),
                    r.getCreatedAt() != null ? r.getCreatedAt().toString() : null,
                    r.getRouteMode(),
                    r.getUpstreamBase(),
                    r.getModel(),
                    r.getPromptTokens(),
                    r.getCompletionTokens(),
                    r.getTotalTokens(),
                    r.isEstimated()
            );
        }
    }

    public record TokenUsagePage(
            int page,
            int size,
            long total,
            List<TokenUsageItem> items
    ) {}
}

