package com.opencarapace.server.tracking;

import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
@RequestMapping("/api/admin/tracking/events")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class UserEventLogAdminController {

    private final UserEventLogAdminService userEventLogAdminService;

    @GetMapping
    public ResponseEntity<UserEventLogAdminService.AdminEventPageResponse> list(
            @RequestParam(name = "page", required = false, defaultValue = "1") int page,
            @RequestParam(name = "size", required = false, defaultValue = "50") int size,
            @RequestParam(name = "userId", required = false) Long userId,
            @RequestParam(name = "anonymousId", required = false) String anonymousId,
            @RequestParam(name = "sessionId", required = false) String sessionId,
            @RequestParam(name = "eventName", required = false) String eventName,
            @RequestParam(name = "platform", required = false) String platform,
            @RequestParam(name = "pageId", required = false) String pageId,
            @RequestParam(name = "module", required = false) String module,
            @RequestParam(name = "from", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(name = "to", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(name = "keyword", required = false) String keyword
    ) {
        return ResponseEntity.ok(userEventLogAdminService.list(
                page, size, userId, anonymousId, sessionId, eventName, platform, pageId, module, from, to, keyword
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserEventLogAdminService.AdminEventDetailDto> detail(@PathVariable("id") Long id) {
        if (id == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
        return userEventLogAdminService.detail(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }
}

