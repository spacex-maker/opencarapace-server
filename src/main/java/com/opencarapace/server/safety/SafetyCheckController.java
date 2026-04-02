package com.opencarapace.server.safety;

import com.opencarapace.server.agent.ToolDefinition;
import com.opencarapace.server.agent.ToolDefinitionRepository;
import com.opencarapace.server.apikey.ApiKey;
import com.opencarapace.server.apikey.ApiKeyService;
import com.opencarapace.server.user.User;
import com.opencarapace.server.user.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;
import java.util.List;

@RestController
@RequestMapping("/api/safety")
public class SafetyCheckController {

    private final ApiKeyService apiKeyService;
    private final ToolDefinitionRepository toolDefinitionRepository;
    private final SafetyEvaluationRepository safetyEvaluationRepository;
    private final UserRepository userRepository;

    public SafetyCheckController(
            ApiKeyService apiKeyService,
            ToolDefinitionRepository toolDefinitionRepository,
            SafetyEvaluationRepository safetyEvaluationRepository,
            UserRepository userRepository
    ) {
        this.apiKeyService = apiKeyService;
        this.toolDefinitionRepository = toolDefinitionRepository;
        this.safetyEvaluationRepository = safetyEvaluationRepository;
        this.userRepository = userRepository;
    }

    @PostMapping("/check")
    public ResponseEntity<SafetyVerdictResponse> check(
            @RequestHeader(name = "X-OC-API-KEY", required = false) String apiKeyHeader,
            @Valid @RequestBody SafetyCheckRequest request,
            HttpServletRequest httpServletRequest
    ) {
        if (apiKeyHeader == null || apiKeyHeader.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        ApiKey apiKey = apiKeyService.authenticateByRawKey(apiKeyHeader);
        if (apiKey == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Optional<ToolDefinition> toolOpt = Optional.empty();
        if (request.toolName() != null && !request.toolName().isBlank()) {
            toolOpt = toolDefinitionRepository.findByName(request.toolName());
        }

        String verdict = "allow";
        String riskLevel = "low";
        StringBuilder reasons = new StringBuilder();

        if (toolOpt.isPresent()) {
            ToolDefinition tool = toolOpt.get();
            if (tool.getRiskLevel() != null) {
                riskLevel = tool.getRiskLevel();
            }
            if ("blocked".equalsIgnoreCase(tool.getApprovalStatus())) {
                verdict = "block";
                reasons.append("Tool is explicitly blocked in registry. ");
            } else if ("needs_review".equalsIgnoreCase(tool.getApprovalStatus())) {
                verdict = "review";
                reasons.append("Tool requires human review before execution. ");
            }
            if (tool.getPolicyHints() != null) {
                reasons.append("Policy hints: ").append(tool.getPolicyHints());
            }
        }

        if (request.command() != null && request.command().toLowerCase().contains("rm -rf")) {
            verdict = "block";
            riskLevel = "critical";
            reasons.append("Detected destructive shell command pattern. ");
        }

        if ("conversation".equalsIgnoreCase(request.type())) {
            if (request.content() != null && request.content().toLowerCase().contains("leak api key")) {
                verdict = "block";
                riskLevel = "high";
                reasons.append("Conversation appears to request credential exfiltration. ");
            }
        }

        SafetyEvaluationRecord record = new SafetyEvaluationRecord();
        record.setApiKey(apiKey);
        record.setUser(apiKey.getUser());
        record.setTool(toolOpt.orElse(null));
        record.setInputType(request.type());
        record.setInputSummary(request.toolName());
        record.setRawInput(request.content());
        record.setVerdict(verdict);
        record.setRiskLevel(riskLevel);
        record.setReasons(reasons.toString());
        record.setPoliciesTriggered(null);
        record.setLlmModel(null);
        record.setLlmScore(null);
        safetyEvaluationRepository.save(record);

        SafetyVerdictResponse response = new SafetyVerdictResponse(
                verdict,
                riskLevel,
                reasons.toString(),
                record.getId().toString()
        );
        return ResponseEntity.ok(response);
    }

    @PostMapping("/log-block")
    public ResponseEntity<Void> logBlock(
            @RequestHeader(name = "X-OC-API-KEY", required = false) String apiKeyHeader,
            @Valid @RequestBody LogBlockRequest request,
            HttpServletRequest httpServletRequest
    ) {
        ApiKey apiKey = null;
        if (apiKeyHeader != null && !apiKeyHeader.isBlank()) {
            apiKey = apiKeyService.authenticateByRawKey(apiKeyHeader);
            if (apiKey == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }
        }

        // 优先使用当前登录用户，避免“日志写到了 API Key 所属账号，当前账号查不到”。
        User currentUser = getCurrentUserOrNull();
        if (currentUser == null && apiKey != null) {
            currentUser = apiKey.getUser();
        }
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        SafetyEvaluationRecord record = new SafetyEvaluationRecord();
        record.setApiKey(apiKey);
        record.setUser(currentUser);
        record.setTool(null);
        record.setInputType("llm_proxy_block");
        record.setInputSummary(request.blockType());
        record.setRawInput(request.prompt());
        record.setVerdict("block");
        
        String riskLevel = "medium";
        StringBuilder reasons = new StringBuilder();
        
        if ("skill_disabled".equals(request.blockType())) {
            riskLevel = "low";
            reasons.append("Disabled skills: ").append(String.join(", ", request.skills() != null ? request.skills() : new java.util.ArrayList<>()));
        } else if ("danger_command".equals(request.blockType())) {
            riskLevel = "high";
            reasons.append("Danger command patterns: ").append(String.join(", ", request.patterns() != null ? request.patterns() : new java.util.ArrayList<>()));
        } else if ("budget_exceeded".equals(request.blockType())) {
            riskLevel = "medium";
            reasons.append("本地 Token 费用预算已用尽: ");
            if (request.patterns() != null && !request.patterns().isEmpty()) {
                reasons.append(String.join("; ", request.patterns()));
            } else {
                reasons.append("(无详情)");
            }
        }
        
        record.setRiskLevel(riskLevel);
        record.setReasons(reasons.toString());
        record.setPoliciesTriggered(null);
        record.setLlmModel(null);
        record.setLlmScore(null);
        
        safetyEvaluationRepository.save(record);

        return ResponseEntity.ok().build();
    }

    @GetMapping("/block-logs")
    public ResponseEntity<BlockLogsResponse> listBlockLogs(
            @RequestParam(name = "page", required = false, defaultValue = "1") int page,
            @RequestParam(name = "size", required = false, defaultValue = "50") int size,
            @RequestParam(name = "blockType", required = false) String blockType
    ) {
        Long userId = getCurrentUserId();

        int safeSize = Math.min(Math.max(size, 1), 200);
        int safePage = Math.max(page, 1);
        PageRequest pageable = PageRequest.of(safePage - 1, safeSize);

        Page<SafetyEvaluationRecord> p = safetyEvaluationRepository.findBlockLogsByUser(
                userId,
                "llm_proxy_block",
                (blockType == null || blockType.isBlank()) ? null : blockType,
                pageable
        );

        List<BlockLogDto> items = p.getContent().stream().map(r -> new BlockLogDto(
                r.getId(),
                r.getCreatedAt(),
                r.getInputSummary(),
                r.getRiskLevel(),
                r.getReasons(),
                r.getRawInput()
        )).toList();

        return ResponseEntity.ok(new BlockLogsResponse(
                safePage,
                safeSize,
                p.getTotalElements(),
                items
        ));
    }

    @GetMapping("/block-logs/{id}")
    public ResponseEntity<BlockLogDetailDto> getBlockLog(
            @PathVariable("id") Long id
    ) {
        Long userId = getCurrentUserId();
        if (id == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
        SafetyEvaluationRecord r = safetyEvaluationRepository.findOneByIdAndUserId(id, userId);
        if (r == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        return ResponseEntity.ok(new BlockLogDetailDto(
                r.getId(),
                r.getCreatedAt(),
                r.getInputSummary(),
                r.getRiskLevel(),
                r.getReasons(),
                r.getRawInput()
        ));
    }

    private Long getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            throw new IllegalStateException("Missing authentication");
        }
        return Long.parseLong(auth.getName());
    }

    private User getCurrentUserOrNull() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            return null;
        }
        try {
            Long userId = Long.parseLong(auth.getName());
            return userRepository.findById(userId).orElse(null);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    public record SafetyCheckRequest(
            @NotBlank String type,
            String toolName,
            String content,
            String command
    ) {
    }

    public record SafetyVerdictResponse(
            String verdict,
            String riskLevel,
            String reasons,
            String evaluationId
    ) {
    }
    
    public record LogBlockRequest(
            @NotBlank String blockType,
            java.util.List<String> skills,
            java.util.List<Integer> ruleIds,
            java.util.List<String> patterns,
            String prompt,
            String timestamp
    ) {
    }

    public record BlockLogDto(
            Long id,
            java.time.Instant createdAt,
            String blockType,
            String riskLevel,
            String reasons,
            String promptSnippet
    ) {
    }

    public record BlockLogsResponse(
            int page,
            int size,
            long total,
            java.util.List<BlockLogDto> items
    ) {
    }

    public record BlockLogDetailDto(
            Long id,
            java.time.Instant createdAt,
            String blockType,
            String riskLevel,
            String reasons,
            String rawInput
    ) {
    }
}

