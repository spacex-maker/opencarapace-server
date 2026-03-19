package com.opencarapace.server.billing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

@Service
@RequiredArgsConstructor
public class TokenUsageService {

    private final ObjectMapper objectMapper = new ObjectMapper();

    public record Usage(Integer promptTokens, Integer completionTokens, Integer totalTokens, boolean estimated, String model) {}

    public Usage extractOrEstimate(String requestBody, String responseBody) {
        // 1) 优先使用上游返回的 usage（OpenAI 兼容）
        try {
            if (responseBody != null && !responseBody.isBlank()) {
                JsonNode root = objectMapper.readTree(responseBody);
                JsonNode usage = root.get("usage");
                if (usage != null && usage.isObject()) {
                    Integer prompt = asInt(usage.get("prompt_tokens"));
                    Integer completion = asInt(usage.get("completion_tokens"));
                    Integer total = asInt(usage.get("total_tokens"));
                    String model = asText(root.get("model"));
                    if (prompt != null || completion != null || total != null) {
                        Integer computedTotal = total != null ? total : safeSum(prompt, completion);
                        return new Usage(prompt, completion, computedTotal, false, model);
                    }
                }
                // Anthropic / OpenClaw 兼容：usage.input_tokens / output_tokens
                JsonNode usage2 = root.get("usage");
                if (usage2 != null && usage2.isObject()) {
                    Integer inTok = asInt(usage2.get("input_tokens"));
                    Integer outTok = asInt(usage2.get("output_tokens"));
                    if (inTok != null || outTok != null) {
                        return new Usage(inTok, outTok, safeSum(inTok, outTok), false, asText(root.get("model")));
                    }
                }
            }
        } catch (Exception ignored) {
        }

        // 2) 估算：用 utf8 字节数 / 4
        int promptBytes = requestBody == null ? 0 : requestBody.getBytes(StandardCharsets.UTF_8).length;
        int completionBytes = responseBody == null ? 0 : responseBody.getBytes(StandardCharsets.UTF_8).length;
        int prompt = estimateTokens(promptBytes);
        int completion = estimateTokens(completionBytes);
        String model = null;
        try {
            if (requestBody != null && !requestBody.isBlank()) {
                JsonNode req = objectMapper.readTree(requestBody);
                model = asText(req.get("model"));
            }
        } catch (Exception ignored) {}
        return new Usage(prompt, completion, prompt + completion, true, model);
    }

    private static int estimateTokens(int utf8Bytes) {
        if (utf8Bytes <= 0) return 0;
        return (utf8Bytes + 3) / 4;
    }

    private static Integer asInt(JsonNode n) {
        if (n == null || n.isNull()) return null;
        if (n.isInt() || n.isLong()) return n.asInt();
        if (n.isTextual()) {
            try { return Integer.parseInt(n.asText().trim()); } catch (Exception ignored) { return null; }
        }
        return null;
    }

    private static String asText(JsonNode n) {
        if (n == null || n.isNull()) return null;
        return n.asText();
    }

    private static Integer safeSum(Integer a, Integer b) {
        if (a == null && b == null) return null;
        return (a == null ? 0 : a) + (b == null ? 0 : b);
    }
}

