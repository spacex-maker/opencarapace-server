package com.opencarapace.server.safety;

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

/**
 * 管理员查看全站用户的 LLM 代理拦截日志，支持多条件筛选与分页。
 */
@RestController
@RequestMapping("/api/admin/safety/block-logs")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class SafetyBlockLogAdminController {

    private final SafetyBlockLogAdminService safetyBlockLogAdminService;

    @GetMapping
    public ResponseEntity<SafetyBlockLogAdminService.AdminBlockLogsResponse> list(
            @RequestParam(name = "page", required = false, defaultValue = "1") int page,
            @RequestParam(name = "size", required = false, defaultValue = "50") int size,
            @RequestParam(name = "userId", required = false) Long userId,
            @RequestParam(name = "email", required = false) String email,
            @RequestParam(name = "blockType", required = false) String blockType,
            @RequestParam(name = "riskLevel", required = false) String riskLevel,
            @RequestParam(name = "from", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(name = "to", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(name = "keyword", required = false) String keyword
    ) {
        return ResponseEntity.ok(safetyBlockLogAdminService.listBlockLogs(
                page,
                size,
                userId,
                email,
                blockType,
                riskLevel,
                from,
                to,
                keyword
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SafetyBlockLogAdminService.AdminBlockLogDetailDto> get(@PathVariable("id") Long id) {
        if (id == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
        return safetyBlockLogAdminService.getBlockLogDetail(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }
}
