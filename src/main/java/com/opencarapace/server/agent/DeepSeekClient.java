package com.opencarapace.server.agent;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.Collections;
import java.util.List;

/**
 * DeepSeek 对话 API 客户端：用于将 Tavily 检索内容解析为结构化危险指令条目。
 * 文档: https://api-docs.deepseek.com/api/create-chat-completion/
 */
@Component
@RequiredArgsConstructor
public class DeepSeekClient {

    private static final String DEEPSEEK_CHAT_URL = "https://api.deepseek.com/v1/chat/completions";
    private static final String MODEL = "deepseek-chat";

    private final WebClient.Builder webClientBuilder;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public String chat(String apiKey, String systemPrompt, String userMessage) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalArgumentException("DeepSeek API key is required");
        }
        WebClient client = webClientBuilder
                .baseUrl(DEEPSEEK_CHAT_URL)
                .defaultHeader("Authorization", "Bearer " + apiKey.trim())
                .build();
        try {
            DeepSeekRequest req = new DeepSeekRequest(MODEL, List.of(
                    new DeepSeekMessage("system", systemPrompt),
                    new DeepSeekMessage("user", userMessage)
            ), 4096, new ResponseFormat("json_object"));
            DeepSeekResponse resp = client.post()
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(req)
                    .retrieve()
                    .bodyToMono(DeepSeekResponse.class)
                    .block();
            if (resp == null || resp.getChoices() == null || resp.getChoices().isEmpty()) {
                return null;
            }
            return resp.getChoices().get(0).getMessage().getContent();
        } catch (WebClientResponseException e) {
            throw new RuntimeException("DeepSeek chat failed: " + e.getStatusCode() + " " + e.getResponseBodyAsString(), e);
        }
    }

    /** 解析 AI 返回的 JSON 为危险指令 DTO 列表（仅解析，不校验枚举）。 */
    public List<DangerCommandDto> parseDangerCommandsJson(String json) {
        if (json == null || json.isBlank()) return Collections.emptyList();
        try {
            String trimmed = json.trim();
            if (trimmed.startsWith("```")) {
                int start = trimmed.indexOf("{");
                int end = trimmed.lastIndexOf("}");
                if (start >= 0 && end > start) trimmed = trimmed.substring(start, end + 1);
            }
            JsonNode root = objectMapper.readTree(trimmed);
            JsonNode list = root.has("items") ? root.get("items") : root.has("commands") ? root.get("commands") : root;
            if (list != null && list.isArray()) {
                return objectMapper.convertValue(list, objectMapper.getTypeFactory().constructCollectionType(List.class, DangerCommandDto.class));
            }
            return Collections.emptyList();
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DeepSeekRequest {
        private String model;
        private List<DeepSeekMessage> messages;
        @JsonProperty("max_tokens")
        private Integer maxTokens;
        @JsonProperty("response_format")
        private ResponseFormat responseFormat;

        public DeepSeekRequest(String model, List<DeepSeekMessage> messages, int maxTokens, ResponseFormat responseFormat) {
            this.model = model;
            this.messages = messages;
            this.maxTokens = maxTokens;
            this.responseFormat = responseFormat;
        }
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DeepSeekMessage {
        private String role;
        private String content;

        public DeepSeekMessage(String role, String content) {
            this.role = role;
            this.content = content;
        }
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ResponseFormat {
        private String type;
        public ResponseFormat(String type) { this.type = type; }
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DeepSeekResponse {
        private List<Choice> choices;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Choice {
        private DeepSeekMessage message;
    }

    /** AI 返回的单条危险指令结构（与 DangerCommand 字段对应）。 */
    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DangerCommandDto {
        @JsonProperty("command_pattern")
        private String commandPattern;
        @JsonProperty("system_type")
        private String systemType;
        @JsonProperty("category")
        private String category;
        @JsonProperty("risk_level")
        private String riskLevel;
        private String title;
        private String description;
        private String mitigation;
        private String tags;
    }
}
