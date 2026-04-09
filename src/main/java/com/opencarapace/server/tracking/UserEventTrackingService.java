package com.opencarapace.server.tracking;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.opencarapace.server.user.User;
import com.opencarapace.server.user.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class UserEventTrackingService {

    private static final int MAX_EVENTS_PER_BATCH = 200;

    private final UserEventLogRepository userEventLogRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public TrackEventsResult saveEvents(List<TrackEventPayload> events, HttpServletRequest request) {
        if (events == null || events.isEmpty()) {
            return new TrackEventsResult(0, 0, List.of("events is empty"));
        }
        if (events.size() > MAX_EVENTS_PER_BATCH) {
            return new TrackEventsResult(0, events.size(),
                    List.of("batch size exceeds " + MAX_EVENTS_PER_BATCH));
        }

        User currentUser = resolveCurrentUser();
        int acceptedCount = 0;
        int invalidCount = 0;
        List<String> invalidReasons = new ArrayList<>();

        String clientIp = extractClientIp(request);
        String userAgent = truncate(request.getHeader("User-Agent"), 512);

        for (TrackEventPayload payload : events) {
            if (payload == null) {
                invalidCount++;
                invalidReasons.add("event payload is null");
                continue;
            }

            String validationError = validatePayload(payload);
            if (validationError != null) {
                invalidCount++;
                invalidReasons.add(validationError);
                continue;
            }

            if (userEventLogRepository.findByEventId(payload.eventId()).isPresent()) {
                continue;
            }

            UserEventLog log = new UserEventLog();
            log.setEventId(payload.eventId().trim());
            log.setEventName(payload.eventName().trim());
            log.setEventTime(resolveEventTime(payload.eventTime()));
            log.setAnonymousId(payload.anonymousId().trim());
            log.setSessionId(payload.sessionId().trim());
            log.setPlatform(payload.platform().trim().toLowerCase());
            log.setAppVersion(truncate(payload.appVersion(), 32));
            log.setPageId(truncate(payload.pageId(), 128));
            log.setModule(truncate(payload.module(), 64));
            log.setEventPropsJson(toJson(payload.eventProps()));
            log.setContextPropsJson(toJson(payload.contextProps()));
            log.setIp(clientIp);
            log.setUserAgent(userAgent);
            log.setValid(true);
            log.setUser(currentUser);

            userEventLogRepository.save(log);
            acceptedCount++;
        }

        return new TrackEventsResult(acceptedCount, invalidCount, invalidReasons);
    }

    private Instant resolveEventTime(Long eventTimeMs) {
        if (eventTimeMs == null || eventTimeMs <= 0) {
            return Instant.now();
        }
        return Instant.ofEpochMilli(eventTimeMs);
    }

    private String validatePayload(TrackEventPayload payload) {
        if (isBlank(payload.eventId())) return "eventId is required";
        if (isBlank(payload.eventName())) return "eventName is required";
        if (isBlank(payload.anonymousId())) return "anonymousId is required";
        if (isBlank(payload.sessionId())) return "sessionId is required";
        if (isBlank(payload.platform())) return "platform is required";
        if (payload.eventId().length() > 64) return "eventId too long";
        if (payload.eventName().length() > 64) return "eventName too long";
        if (payload.anonymousId().length() > 64) return "anonymousId too long";
        if (payload.sessionId().length() > 64) return "sessionId too long";
        if (payload.platform().length() > 16) return "platform too long";
        return null;
    }

    private String toJson(Map<String, Object> data) {
        if (data == null || data.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(data);
        } catch (JsonProcessingException e) {
            return "{\"_error\":\"invalid_json_payload\"}";
        }
    }

    private User resolveCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null || "anonymousUser".equals(auth.getName())) {
            return null;
        }
        try {
            Long userId = Long.parseLong(auth.getName());
            return userRepository.findById(userId).orElse(null);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private String extractClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (!isBlank(forwarded)) {
            String[] parts = forwarded.split(",");
            return truncate(parts[0].trim(), 64);
        }
        return truncate(request.getRemoteAddr(), 64);
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        if (value.length() <= max) {
            return value;
        }
        return value.substring(0, max);
    }
}

