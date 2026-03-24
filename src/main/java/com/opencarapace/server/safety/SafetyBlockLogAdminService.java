package com.opencarapace.server.safety;

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

/**
 * 管理员拦截日志：在 Service 事务内完成查询与 DTO 映射，避免 User 懒加载在无 Session 时初始化失败。
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SafetyBlockLogAdminService {

    private static final String PROXY_BLOCK = "llm_proxy_block";

    private final SafetyEvaluationRepository safetyEvaluationRepository;

    public AdminBlockLogsResponse listBlockLogs(
            int page,
            int size,
            Long userId,
            String email,
            String blockType,
            String riskLevel,
            Instant from,
            Instant to,
            String keyword
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
        List<AdminBlockLogRowDto> items = p.getContent().stream().map(SafetyBlockLogAdminService::toRow).toList();
        return new AdminBlockLogsResponse(safePage, safeSize, p.getTotalElements(), items);
    }

    public Optional<AdminBlockLogDetailDto> getBlockLogDetail(long id) {
        return safetyEvaluationRepository.findById(id)
                .filter(r -> PROXY_BLOCK.equals(r.getInputType()))
                .map(SafetyBlockLogAdminService::toDetail);
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
            List<AdminBlockLogRowDto> items
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
