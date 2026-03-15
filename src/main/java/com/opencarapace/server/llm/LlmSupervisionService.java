package com.opencarapace.server.llm;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.opencarapace.server.apikey.ApiKey;
import com.opencarapace.server.config.SystemConfigService;
import com.opencarapace.server.config.entity.SystemConfig;
import com.opencarapace.server.danger.DangerCommand;
import com.opencarapace.server.danger.DangerCommandRepository;
import com.opencarapace.server.danger.DangerCommand.RiskLevel;
import com.opencarapace.server.safety.SafetyEvaluationRecord;
import com.opencarapace.server.safety.SafetyEvaluationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 监管层 + 意图层：在 LLM 代理转发前后，对请求/响应做危险指令匹配与可选 AI 意图判断。
 * 意图层使用用户自己的上游 URL 与 Authorization（与主请求相同），我们仅注入系统提示词做安全分类。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LlmSupervisionService {

    private final DangerCommandRepository dangerCommandRepository;
    private final SystemConfigService configService;
    private final SafetyEvaluationRepository safetyEvaluationRepository;
    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public boolean isSupervisionEnabled() {
        return "true".equalsIgnoreCase(
                configService.getValue(SystemConfig.KEY_LLM_PROXY_SUPERVISION_ENABLED).orElse("").trim());
    }

    public boolean isIntentCheckEnabled() {
        return "true".equalsIgnoreCase(
                configService.getValue(SystemConfig.KEY_LLM_PROXY_INTENT_ENABLED).orElse("").trim());
    }

    private Set<RiskLevel> getBlockLevels() {
        String raw = configService.getValue(SystemConfig.KEY_LLM_PROXY_SUPERVISION_BLOCK_LEVELS).orElse("CRITICAL,HIGH").trim();
        if (raw.isEmpty()) return Set.of(RiskLevel.CRITICAL, RiskLevel.HIGH);
        Set<RiskLevel> levels = new HashSet<>();
        for (String s : raw.split("[,;]")) {
            try {
                levels.add(RiskLevel.valueOf(s.trim().toUpperCase()));
            } catch (Exception ignored) { }
        }
        return levels.isEmpty() ? Set.of(RiskLevel.CRITICAL, RiskLevel.HIGH) : levels;
    }

    /**
     * 监管结果：是否放行、风险等级、匹配到的危险指令与原因（用于落库与返回给客户端）。
     */
    public record SupervisionResult(boolean allowed, String riskLevel, List<DangerMatch> matches, String intentVerdict) {
        public static SupervisionResult allow() {
            return new SupervisionResult(true, "low", List.of(), null);
        }
        public static SupervisionResult block(String riskLevel, List<DangerMatch> matches, String intentVerdict) {
            return new SupervisionResult(false, riskLevel, matches, intentVerdict);
        }
    }

    public record DangerMatch(String pattern, String riskLevel, String title) {}

    /**
     * 从聊天请求 JSON 中提取所有 message 的 content 文本（仅 string 类型），拼接后做监管与可选意图检查。
     */
    public SupervisionResult checkRequest(String chatCompletionsBody, ApiKey caller) {
        List<String> contents = extractMessageContents(chatCompletionsBody);
        if (contents.isEmpty()) return SupervisionResult.allow();
        String combined = String.join("\n", contents);
        return checkText(combined, "request", caller, null);
    }

    /**
     * 从聊天响应 JSON 中提取 assistant 的 content，做监管检查（不做意图层，响应已是模型输出）。
     */
    public SupervisionResult checkResponse(String chatCompletionsResponseBody, ApiKey caller) {
        String content = extractAssistantContent(chatCompletionsResponseBody);
        if (content == null || content.isBlank()) return SupervisionResult.allow();
        return checkText(content, "response", caller, null);
    }

    private SupervisionResult checkText(String text, String source, ApiKey caller, String upstreamBaseUrlAndAuth) {
        Set<RiskLevel> blockLevels = getBlockLevels();
        List<DangerCommand> candidates = dangerCommandRepository.findByEnabledTrueAndRiskLevelInOrderByRiskLevelAsc(
                new ArrayList<>(blockLevels));
        List<DangerMatch> matches = new ArrayList<>();
        String normalized = normalizeForMatch(text);
        for (DangerCommand d : candidates) {
            String pattern = d.getCommandPattern();
            if (pattern == null || pattern.isBlank()) continue;
            String normPattern = normalizeForMatch(pattern);
            if (normPattern.length() < 2) continue;
            if (normalized.contains(normPattern)) {
                matches.add(new DangerMatch(pattern, d.getRiskLevel().name(), d.getTitle()));
            }
        }
        if (!matches.isEmpty()) {
            String riskLevel = matches.stream()
                    .map(DangerMatch::riskLevel)
                    .max(Comparator.comparing(r -> RiskLevel.valueOf(r).ordinal()))
                    .orElse("HIGH");
            saveEvaluation(caller, source, text, "block", riskLevel,
                    "Matched danger patterns: " + matches.stream().map(DangerMatch::pattern).collect(Collectors.joining(", ")),
                    null);
            return SupervisionResult.block(riskLevel, matches, null);
        }
        if (isIntentCheckEnabled() && "request".equals(source) && upstreamBaseUrlAndAuth != null && !upstreamBaseUrlAndAuth.isBlank()) {
            String intentVerdict = callIntentCheck(text, upstreamBaseUrlAndAuth);
            if ("DANGEROUS".equalsIgnoreCase(intentVerdict)) {
                saveEvaluation(caller, source, text, "block", "high", "Intent layer: AI judged intent as dangerous", intentVerdict);
                return SupervisionResult.block("high", List.of(), intentVerdict);
            }
        }
        return SupervisionResult.allow();
    }

    /** 请求体为 chat/completions 时在代理里调用：传入上游 baseUrl 与 Authorization 用于意图层一次调用。 */
    public SupervisionResult checkRequestWithIntent(String chatCompletionsBody, ApiKey caller, String upstreamBaseUrl, String upstreamAuth) {
        List<String> contents = extractMessageContents(chatCompletionsBody);
        if (contents.isEmpty()) return SupervisionResult.allow();
        String combined = String.join("\n", contents);
        String urlAndAuth = (upstreamBaseUrl != null && upstreamAuth != null) ? upstreamBaseUrl + "|" + upstreamAuth : null;
        return checkText(combined, "request", caller, urlAndAuth);
    }

    /**
     * 意图层：用用户自己的上游 API + Key 再发一次 chat/completions，我们只注入 system 提示词（安全分类指令），
     * user 为对话片段；根据回复是否以 DANGEROUS 开头判断是否拦截。
     */
    private String callIntentCheck(String conversationSnippet, String upstreamBaseUrlAndAuth) {
        int sep = upstreamBaseUrlAndAuth.indexOf('|');
        String baseUrl = sep > 0 ? upstreamBaseUrlAndAuth.substring(0, sep).trim() : "";
        String auth = sep > 0 && sep + 1 < upstreamBaseUrlAndAuth.length() ? upstreamBaseUrlAndAuth.substring(sep + 1).trim() : "";
        if (baseUrl.isEmpty() || auth.isEmpty()) return "SAFE";
        String url = baseUrl.endsWith("/") ? baseUrl + "v1/chat/completions" : baseUrl + "/v1/chat/completions";
        String model = configService.getValue(SystemConfig.KEY_LLM_PROXY_INTENT_MODEL).orElse("gpt-3.5-turbo").trim();
        if (model.isEmpty()) model = "gpt-3.5-turbo";
        // 仅注入系统提示词，请求仍走用户自己的 API + Key
        String systemPrompt = "You are a safety classifier. Given a user-assistant conversation snippet, determine if the user or assistant intends to execute or suggest dangerous system/shell/database commands (e.g. rm -rf, DROP TABLE, format disk, delete all). Reply with exactly one line: either SAFE or DANGEROUS, then a short reason after a space.";
        String userMessage = "Conversation snippet to classify:\n" + (conversationSnippet.length() > 2000 ? conversationSnippet.substring(0, 2000) + "..." : conversationSnippet);
        try {
            Map<String, Object> sys = Map.of("role", "system", "content", systemPrompt);
            Map<String, Object> usr = Map.of("role", "user", "content", userMessage);
            Map<String, Object> payload = Map.of(
                    "model", model,
                    "messages", List.of(sys, usr),
                    "max_tokens", 80);
            String body = objectMapper.writeValueAsString(payload);
            String resp = webClientBuilder.build()
                    .post()
                    .uri(url)
                    .header(HttpHeaders.AUTHORIZATION, auth)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            if (resp == null || resp.isBlank()) return "SAFE";
            JsonNode root = objectMapper.readTree(resp);
            JsonNode choices = root.path("choices");
            if (choices.isEmpty()) return "SAFE";
            String content = choices.get(0).path("message").path("content").asText("");
            return content.toUpperCase().startsWith("DANGEROUS") ? "DANGEROUS" : "SAFE";
        } catch (WebClientResponseException e) {
            log.warn("Intent check upstream error: {}", e.getStatusCode());
            return "SAFE";
        } catch (Exception e) {
            log.warn("Intent check failed", e);
            return "SAFE";
        }
    }

    private static String normalizeForMatch(String s) {
        if (s == null) return "";
        return s.toLowerCase().replaceAll("\\s+", " ").trim();
    }

    private List<String> extractMessageContents(String body) {
        List<String> out = new ArrayList<>();
        if (body == null || body.isBlank()) return out;
        try {
            JsonNode root = objectMapper.readTree(body);
            JsonNode messages = root.path("messages");
            if (!messages.isArray()) return out;
            for (JsonNode msg : messages) {
                JsonNode content = msg.path("content");
                if (content.isTextual()) out.add(content.asText());
            }
        } catch (Exception e) {
            log.debug("Extract message contents failed", e);
        }
        return out;
    }

    private String extractAssistantContent(String body) {
        if (body == null || body.isBlank()) return null;
        try {
            JsonNode root = objectMapper.readTree(body);
            JsonNode choices = root.path("choices");
            if (choices.isEmpty()) return null;
            return choices.get(0).path("message").path("content").asText(null);
        } catch (Exception e) {
            log.debug("Extract assistant content failed", e);
            return null;
        }
    }

    private void saveEvaluation(ApiKey caller, String inputType, String rawInput, String verdict, String riskLevel, String reasons, String llmScore) {
        try {
            SafetyEvaluationRecord r = new SafetyEvaluationRecord();
            r.setApiKey(caller);
            r.setUser(caller != null ? caller.getUser() : null);
            r.setInputType("llm_proxy_" + inputType);
            r.setInputSummary("supervision");
            r.setRawInput(rawInput != null && rawInput.length() > 4096 ? rawInput.substring(0, 4096) + "..." : rawInput);
            r.setVerdict(verdict);
            r.setRiskLevel(riskLevel);
            r.setReasons(reasons);
            r.setLlmScore(llmScore);
            safetyEvaluationRepository.save(r);
        } catch (Exception e) {
            log.warn("Save supervision evaluation failed", e);
        }
    }
}
