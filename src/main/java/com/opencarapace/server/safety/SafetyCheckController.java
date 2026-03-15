package com.opencarapace.server.safety;

import com.opencarapace.server.agent.ToolDefinition;
import com.opencarapace.server.agent.ToolDefinitionRepository;
import com.opencarapace.server.apikey.ApiKey;
import com.opencarapace.server.apikey.ApiKeyService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

@RestController
@RequestMapping("/api/safety")
public class SafetyCheckController {

    private final ApiKeyService apiKeyService;
    private final ToolDefinitionRepository toolDefinitionRepository;
    private final SafetyEvaluationRepository safetyEvaluationRepository;

    public SafetyCheckController(
            ApiKeyService apiKeyService,
            ToolDefinitionRepository toolDefinitionRepository,
            SafetyEvaluationRepository safetyEvaluationRepository
    ) {
        this.apiKeyService = apiKeyService;
        this.toolDefinitionRepository = toolDefinitionRepository;
        this.safetyEvaluationRepository = safetyEvaluationRepository;
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
}

