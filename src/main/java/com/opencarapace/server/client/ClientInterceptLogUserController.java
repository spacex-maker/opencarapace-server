package com.opencarapace.server.client;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

/**
 * 普通用户查看“自己的”拦截日志：当前用户名下所有 API Key 的日志。
 */
@RestController
@RequestMapping("/api/client/intercept-logs")
@RequiredArgsConstructor
public class ClientInterceptLogUserController {

    private final ClientInterceptLogRepository repository;

    @GetMapping("/me")
    public List<ClientInterceptLogDto> myLogs(@RequestParam(name = "limit", defaultValue = "50") int limit) {
        Long userId = getCurrentUserId();
        int size = Math.max(1, Math.min(limit, 200));
        Pageable pageable = PageRequest.of(0, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return repository.findAllByApiKey_User_IdOrderByCreatedAtDesc(userId, pageable)
                .stream()
                .map(ClientInterceptLogDto::from)
                .toList();
    }

    private Long getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            throw new IllegalStateException("Missing authentication");
        }
        return Long.parseLong(auth.getName());
    }

    public record ClientInterceptLogDto(
            Long id,
            String clientId,
            String requestType,
            String upstream,
            String verdict,
            String riskLevel,
            String matchedRuleIds,
            String reason,
            String requestSnippet,
            Instant createdAt
    ) {
        public static ClientInterceptLogDto from(ClientInterceptLog log) {
            return new ClientInterceptLogDto(
                    log.getId(),
                    log.getClientId(),
                    log.getRequestType(),
                    log.getUpstream(),
                    log.getVerdict(),
                    log.getRiskLevel() != null ? log.getRiskLevel().name() : null,
                    log.getMatchedRuleIds(),
                    log.getReason(),
                    log.getRequestSnippet(),
                    log.getCreatedAt()
            );
        }
    }
}

