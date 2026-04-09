package com.opencarapace.server.tracking;

import com.opencarapace.server.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserEventLogAdminService {

    private final UserEventLogRepository userEventLogRepository;

    public AdminEventPageResponse list(
            int page,
            int size,
            Long userId,
            String anonymousId,
            String sessionId,
            String eventName,
            String platform,
            String pageId,
            String module,
            Instant from,
            Instant to,
            String keyword
    ) {
        int safeSize = Math.min(Math.max(size, 1), 200);
        int safePage = Math.max(page, 1);
        PageRequest pageable = PageRequest.of(safePage - 1, safeSize, Sort.by(Sort.Direction.DESC, "eventTime"));
        Specification<UserEventLog> spec = UserEventLogAdminSpecifications.adminQuery(
                userId, anonymousId, sessionId, eventName, platform, pageId, module, from, to, keyword
        );
        Page<UserEventLog> p = userEventLogRepository.findAll(spec, pageable);
        List<AdminEventRowDto> items = p.getContent().stream().map(UserEventLogAdminService::toRow).toList();
        return new AdminEventPageResponse(safePage, safeSize, p.getTotalElements(), items);
    }

    public Optional<AdminEventDetailDto> detail(long id) {
        return userEventLogRepository.findById(id).map(UserEventLogAdminService::toDetail);
    }

    private static AdminEventRowDto toRow(UserEventLog log) {
        User user = log.getUser();
        return new AdminEventRowDto(
                log.getId(),
                user != null ? user.getId() : null,
                user != null ? user.getEmail() : null,
                log.getEventName(),
                log.getEventTime(),
                log.getPlatform(),
                log.getPageId(),
                log.getModule(),
                truncate(log.getEventPropsJson(), 200)
        );
    }

    private static AdminEventDetailDto toDetail(UserEventLog log) {
        User user = log.getUser();
        return new AdminEventDetailDto(
                log.getId(),
                log.getEventId(),
                user != null ? user.getId() : null,
                user != null ? user.getEmail() : null,
                log.getAnonymousId(),
                log.getSessionId(),
                log.getEventName(),
                log.getEventTime(),
                log.getPlatform(),
                log.getPageId(),
                log.getModule(),
                log.getAppVersion(),
                log.getIp(),
                log.getUserAgent(),
                log.getEventPropsJson(),
                log.getContextPropsJson()
        );
    }

    private static String truncate(String value, int max) {
        if (value == null || value.length() <= max) {
            return value;
        }
        return value.substring(0, max) + "…";
    }

    public record AdminEventRowDto(
            Long id,
            Long userId,
            String userEmail,
            String eventName,
            Instant eventTime,
            String platform,
            String pageId,
            String module,
            String eventPropsSnippet
    ) {
    }

    public record AdminEventPageResponse(
            int page,
            int size,
            long total,
            List<AdminEventRowDto> items
    ) {
    }

    public record AdminEventDetailDto(
            Long id,
            String eventId,
            Long userId,
            String userEmail,
            String anonymousId,
            String sessionId,
            String eventName,
            Instant eventTime,
            String platform,
            String pageId,
            String module,
            String appVersion,
            String ip,
            String userAgent,
            String eventPropsJson,
            String contextPropsJson
    ) {
    }
}

