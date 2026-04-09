package com.opencarapace.server.tracking;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/track")
public class UserEventTrackingController {

    private final UserEventTrackingService trackingService;

    public UserEventTrackingController(UserEventTrackingService trackingService) {
        this.trackingService = trackingService;
    }

    @PostMapping("/events")
    public ResponseEntity<TrackEventsResponse> trackEvents(
            @Valid @RequestBody TrackEventsRequest request,
            HttpServletRequest httpServletRequest
    ) {
        TrackEventsResult result = trackingService.saveEvents(request.events(), httpServletRequest);
        return ResponseEntity.ok(new TrackEventsResponse(
                result.acceptedCount(),
                result.invalidCount(),
                result.invalidReasons()
        ));
    }

    public record TrackEventsRequest(
            @NotEmpty List<TrackEventPayload> events
    ) {
    }

    public record TrackEventsResponse(
            int acceptedCount,
            int invalidCount,
            List<String> invalidReasons
    ) {
    }
}

record TrackEventPayload(
        String eventId,
        String eventName,
        Long eventTime,
        String anonymousId,
        String sessionId,
        String platform,
        String appVersion,
        String pageId,
        String module,
        Map<String, Object> eventProps,
        Map<String, Object> contextProps
) {
}

record TrackEventsResult(
        int acceptedCount,
        int invalidCount,
        List<String> invalidReasons
) {
}

