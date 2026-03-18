package com.opencarapace.server.client;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

/**
 * 管理员查看客户端拦截日志的接口。
 */
@RestController
@RequestMapping("/api/admin/client-intercept-logs")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class ClientInterceptLogAdminController {

    private final ClientInterceptLogRepository repository;

    @GetMapping
    public List<ClientInterceptLogDto> list(@RequestParam(name = "limit", defaultValue = "100") int limit) {
        int size = Math.max(1, Math.min(limit, 500));
        Pageable pageable = PageRequest.of(0, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return repository.findAllByOrderByCreatedAtDesc(pageable)
                .stream()
                .map(ClientInterceptLogDto::from)
                .toList();
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

