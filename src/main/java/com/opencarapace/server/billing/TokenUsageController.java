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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

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

    /** 桌面端“本地直连/映射”时上报：按当前登录用户入库，返回云端主键供本地回写 cloud_id */
    @PostMapping("/ingest")
    public ResponseEntity<Map<String, Long>> ingest(@Valid @RequestBody IngestRequest request) {
        Long userId = getCurrentUserId();
        var user = userRepository.findById(userId.longValue()).orElseThrow(() -> new IllegalStateException("User not found"));

        TokenUsageRecord r = new TokenUsageRecord();
        r.setUser(user);
        r.setApiKey(null);
        r.setClientId(request.clientId());
        r.setRouteMode(request.routeMode());
        r.setUpstreamBase(request.upstreamBase());
        r.setRequestPath(request.requestPath() != null ? request.requestPath() : null);
        r.setProviderKey(request.providerKey() != null && !request.providerKey().isBlank() ? request.providerKey().trim() : null);
        r.setModel(request.model());
        r.setPromptTokens(request.promptTokens());
        r.setCompletionTokens(request.completionTokens());
        r.setTotalTokens(request.totalTokens());
        r.setEstimated(Boolean.TRUE.equals(request.estimated()));
        r.setCostUsd(request.costUsd());
        repository.save(r);
        return ResponseEntity.ok(Map.of("id", r.getId()));
    }

    /**
     * 批量上送本地尚未同步的行（cloud_id 为空），用于与云端 oc_token_usages 对齐。
     */
    @PostMapping("/sync/push")
    public ResponseEntity<SyncPushResponse> syncPush(@Valid @RequestBody SyncPushRequest request) {
        Long userId = getCurrentUserId();
        var user = userRepository.findById(userId.longValue()).orElseThrow(() -> new IllegalStateException("User not found"));

        List<SyncIdMapping> idMappings = new ArrayList<>();
        for (SyncPushItem item : request.items()) {
            TokenUsageRecord r = new TokenUsageRecord();
            r.setUser(user);
            r.setApiKey(null);
            r.setClientId(item.clientId());
            r.setRouteMode(item.routeMode());
            r.setUpstreamBase(item.upstreamBase());
            r.setRequestPath(item.requestPath());
            r.setProviderKey(item.providerKey() != null && !item.providerKey().isBlank() ? item.providerKey().trim() : null);
            r.setModel(item.model());
            r.setPromptTokens(item.promptTokens());
            r.setCompletionTokens(item.completionTokens());
            r.setTotalTokens(item.totalTokens());
            r.setEstimated(item.estimated() == null || item.estimated());
            r.setCostUsd(item.costUsd());
            repository.save(r);
            if (item.localId() != null) {
                idMappings.add(new SyncIdMapping(item.localId(), r.getId()));
            }
        }
        return ResponseEntity.ok(new SyncPushResponse(idMappings));
    }

    /** 拉取当前用户在云端 id 大于 afterId 的记录，用于合并到其他设备/网关产生的账单 */
    @GetMapping("/sync/pull")
    public ResponseEntity<SyncPullResponse> syncPull(
            @RequestParam(name = "afterId", defaultValue = "0") long afterId,
            @RequestParam(name = "limit", defaultValue = "200") int limit
    ) {
        Long userId = getCurrentUserId();
        int safeLimit = Math.min(Math.max(limit, 1), 500);
        var page = repository.findByUser_IdAndIdGreaterThanOrderByIdAsc(userId, afterId, PageRequest.of(0, safeLimit));
        List<TokenUsageSyncRow> items = page.getContent().stream().map(TokenUsageSyncRow::from).toList();
        long nextAfterId = items.isEmpty() ? afterId : items.get(items.size() - 1).id();
        return ResponseEntity.ok(new SyncPullResponse(items, nextAfterId));
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
            String providerKey,
            String model,
            Integer promptTokens,
            Integer completionTokens,
            Integer totalTokens,
            Boolean estimated,
            Double costUsd
    ) {}

    public record SyncPushRequest(
            @jakarta.validation.constraints.NotNull
            @jakarta.validation.constraints.Size(max = 200)
            List<@Valid SyncPushItem> items
    ) {}

    public record SyncPushItem(
            Long localId,
            String clientId,
            @NotBlank String routeMode,
            String upstreamBase,
            String requestPath,
            String providerKey,
            String model,
            Integer promptTokens,
            Integer completionTokens,
            Integer totalTokens,
            Boolean estimated,
            Double costUsd
    ) {}

    public record SyncPushResponse(
            List<SyncIdMapping> idMappings
    ) {}

    public record SyncIdMapping(
            long localId,
            long cloudId
    ) {}

    public record TokenUsageSyncRow(
            long id,
            String createdAt,
            String clientId,
            String routeMode,
            String upstreamBase,
            String requestPath,
            String providerKey,
            String model,
            Integer promptTokens,
            Integer completionTokens,
            Integer totalTokens,
            boolean estimated,
            Double costUsd
    ) {
        static TokenUsageSyncRow from(TokenUsageRecord r) {
            return new TokenUsageSyncRow(
                    r.getId(),
                    r.getCreatedAt() != null ? r.getCreatedAt().toString() : null,
                    r.getClientId(),
                    r.getRouteMode(),
                    r.getUpstreamBase(),
                    r.getRequestPath(),
                    r.getProviderKey(),
                    r.getModel(),
                    r.getPromptTokens(),
                    r.getCompletionTokens(),
                    r.getTotalTokens(),
                    r.isEstimated(),
                    r.getCostUsd()
            );
        }
    }

    public record SyncPullResponse(
            List<TokenUsageSyncRow> items,
            long nextAfterId
    ) {}

    public record TokenUsageItem(
            Long id,
            String createdAt,
            String routeMode,
            String upstreamBase,
            String requestPath,
            String providerKey,
            String model,
            Integer promptTokens,
            Integer completionTokens,
            Integer totalTokens,
            boolean estimated,
            Double costUsd
    ) {
        static TokenUsageItem from(TokenUsageRecord r) {
            return new TokenUsageItem(
                    r.getId(),
                    r.getCreatedAt() != null ? r.getCreatedAt().toString() : null,
                    r.getRouteMode(),
                    r.getUpstreamBase(),
                    r.getRequestPath(),
                    r.getProviderKey(),
                    r.getModel(),
                    r.getPromptTokens(),
                    r.getCompletionTokens(),
                    r.getTotalTokens(),
                    r.isEstimated(),
                    r.getCostUsd()
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

