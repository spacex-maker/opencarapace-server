package com.opencarapace.server.safety;

import com.opencarapace.server.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
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

    private static final String PROXY_BLOCK = "llm_proxy_block";

    private final SafetyEvaluationRepository safetyEvaluationRepository;

    @GetMapping
    public ResponseEntity<AdminBlockLogsResponse> list(
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
        int safeSize = Math.min(Math.max(size, 1), 200);
        int safePage = Math.max(page, 1);
        PageRequest pageable = PageRequest.of(safePage - 1, safeSize, Sort.by(Sort.Direction.DESC, "createdAt"));

        Specification<SafetyEvaluationRecord> spec = SafetyBlockLogAdminSpecifications.adminProxyBlockLogs(
                userId,
                email,
                blockType,
                riskLevel,
                from,
                to,
                keyword
        );

        Page<SafetyEvaluationRecord> p = safetyEvaluationRepository.findAll(spec, pageable);
        var items = p.getContent().stream().map(SafetyBlockLogAdminController::toRow).toList();

        return ResponseEntity.ok(new AdminBlockLogsResponse(safePage, safeSize, p.getTotalElements(), items));
    }

    @GetMapping("/{id}")
    public ResponseEntity<AdminBlockLogDetailDto> get(@PathVariable("id") Long id) {
        if (id == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
        SafetyEvaluationRecord r = safetyEvaluationRepository.findById(id).orElse(null);
        if (r == null || !PROXY_BLOCK.equals(r.getInputType())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        return ResponseEntity.ok(toDetail(r));
    }

    private static AdminBlockLogRowDto toRow(SafetyEvaluationRecord r) {
        User u = r.getUser();
        return new AdminBlockLogRowDto(
                r.getId(),
                u != null ? u.getId() : null,
                u != null ? u.getEmail() : null,
                r.getCreatedAt(),
                r.getInputSummary(),
                r.getRiskLevel(),
                r.getReasons(),
                truncate(r.getRawInput(), 200)
        );
    }

    private static AdminBlockLogDetailDto toDetail(SafetyEvaluationRecord r) {
        User u = r.getUser();
        return new AdminBlockLogDetailDto(
                r.getId(),
                u != null ? u.getId() : null,
                u != null ? u.getEmail() : null,
                r.getCreatedAt(),
                r.getInputSummary(),
                r.getRiskLevel(),
                r.getReasons(),
                r.getRawInput()
        );
    }

    private static String truncate(String s, int max) {
        if (s == null) {
            return null;
        }
        if (s.length() <= max) {
            return s;
        }
        return s.substring(0, max) + "…";
    }

    public record AdminBlockLogRowDto(
            Long id,
            Long userId,
            String userEmail,
            Instant createdAt,
            String blockType,
            String riskLevel,
            String reasons,
            String promptSnippet
    ) {
    }

    public record AdminBlockLogsResponse(
            int page,
            int size,
            long total,
            java.util.List<AdminBlockLogRowDto> items
    ) {
    }

    public record AdminBlockLogDetailDto(
            Long id,
            Long userId,
            String userEmail,
            Instant createdAt,
            String blockType,
            String riskLevel,
            String reasons,
            String rawInput
    ) {
    }
}
