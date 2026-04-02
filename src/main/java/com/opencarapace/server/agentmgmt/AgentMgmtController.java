package com.opencarapace.server.agentmgmt;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * 云端「Agent 管理」：按用户隔离的配置条目。桌面端默认走本地 SQLite；登录后可扩展双向同步。
 */
@RestController
@RequestMapping("/api/agent-mgmt")
public class AgentMgmtController {

    private static final Set<String> FEATURES = Set.of("providers", "skills", "prompts", "mcp", "sessions");

    private final UserAgentItemRepository itemRepository;
    private final ObjectMapper objectMapper;

    public AgentMgmtController(UserAgentItemRepository itemRepository, ObjectMapper objectMapper) {
        this.itemRepository = itemRepository;
        this.objectMapper = objectMapper;
    }

    private record PlatformDef(String code, String displayName, String accent, int sortOrder, List<String> features) {}

    private static final List<PlatformDef> PLATFORM_DEFS = List.of(
            new PlatformDef("claude", "Claude Code", "#3b82f6", 0, List.of("providers", "skills", "prompts", "mcp", "sessions")),
            new PlatformDef("codex", "Codex", "#22c55e", 1, List.of("providers", "skills", "mcp", "sessions")),
            new PlatformDef("gemini", "Gemini CLI", "#d97706", 2, List.of("providers", "mcp")),
            new PlatformDef("opencode", "OpenCode", "#7c3aed", 3, List.of("providers", "sessions")),
            new PlatformDef("openclaw", "OpenClaw", "#dc2626", 4, List.of("providers", "skills", "mcp"))
    );

    public record FeatureCountDto(String featureType, long count) {}

    public record PlatformSummaryDto(
            String code,
            String displayName,
            String accent,
            int sortOrder,
            List<FeatureCountDto> featureCounts
    ) {}

    public record SummaryResponse(List<PlatformSummaryDto> platforms) {}

    @GetMapping("/me/summary")
    public ResponseEntity<SummaryResponse> mySummary() {
        Long userId = getCurrentUserId();
        List<PlatformSummaryDto> platforms = new ArrayList<>();
        for (PlatformDef d : PLATFORM_DEFS) {
            List<FeatureCountDto> fc = new ArrayList<>();
            for (String ft : d.features()) {
                long c = itemRepository.countByUser_IdAndPlatformCodeAndFeatureType(userId, d.code(), ft);
                fc.add(new FeatureCountDto(ft, c));
            }
            platforms.add(new PlatformSummaryDto(d.code(), d.displayName(), d.accent(), d.sortOrder(), fc));
        }
        return ResponseEntity.ok(new SummaryResponse(platforms));
    }

    public record AgentItemDto(
            Long id,
            String platformCode,
            String featureType,
            String name,
            String subtitle,
            String statusLabel,
            String statusKind,
            int sortOrder,
            JsonNode meta,
            String updatedAt
    ) {}

    @GetMapping("/me/items")
    public ResponseEntity<List<AgentItemDto>> myItems(
            @RequestParam("platform") String platform,
            @RequestParam("feature") String feature
    ) {
        String p = platform == null ? "" : platform.trim();
        String f = feature == null ? "" : feature.trim();
        if (p.isEmpty() || f.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        if (!FEATURES.contains(f)) {
            return ResponseEntity.badRequest().build();
        }
        boolean platformOk = PLATFORM_DEFS.stream().anyMatch(d -> d.code().equals(p) && d.features().contains(f));
        if (!platformOk) {
            return ResponseEntity.badRequest().build();
        }
        Long userId = getCurrentUserId();
        List<UserAgentItem> rows =
                itemRepository.findByUser_IdAndPlatformCodeAndFeatureTypeOrderBySortOrderAscIdAsc(userId, p, f);
        List<AgentItemDto> out = new ArrayList<>();
        for (UserAgentItem r : rows) {
            JsonNode meta = null;
            if (r.getMetaJson() != null && !r.getMetaJson().isBlank()) {
                try {
                    meta = objectMapper.readTree(r.getMetaJson());
                } catch (JsonProcessingException ignored) {
                    meta = null;
                }
            }
            out.add(new AgentItemDto(
                    r.getId(),
                    r.getPlatformCode(),
                    r.getFeatureType(),
                    r.getName(),
                    r.getSubtitle(),
                    r.getStatusLabel(),
                    r.getStatusKind(),
                    r.getSortOrder(),
                    meta,
                    r.getUpdatedAt() != null ? r.getUpdatedAt().toString() : null
            ));
        }
        return ResponseEntity.ok(out);
    }

    private Long getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            throw new IllegalStateException("Missing authentication");
        }
        return Long.parseLong(auth.getName());
    }
}
