package com.opencarapace.server.llm;

import com.opencarapace.server.apikey.ApiKey;
import com.opencarapace.server.billing.TokenUsageRecord;
import com.opencarapace.server.billing.TokenUsageRepository;
import com.opencarapace.server.billing.TokenUsageService;
import com.opencarapace.server.config.SystemConfigService;
import com.opencarapace.server.config.entity.SystemConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.Optional;
import java.util.Objects;
import java.util.Locale;

/**
 * 大模型 API 中转代理：将请求转发到调用方指定的上游地址，并在中间做监管（日志、可扩展策略）。
 * 上游一般为 OpenAI 兼容接口（如 OpenAI、DeepSeek、本地部署、第三方中转等）。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LlmProxyService {

    private final SystemConfigService configService;
    private final WebClient.Builder webClientBuilder;
    private final LlmSupervisionService supervisionService;
    private final TokenUsageRepository tokenUsageRepository;
    private final TokenUsageService tokenUsageService;
    private final UserLlmMappingRepository userLlmMappingRepository;

    /** 是否启用代理且已配置上游地址 */
    public boolean isEnabled() {
        return getDisabledReason() == null;
    }

    /** 若未启用则返回原因，用于错误提示；已启用返回 null */
    public String getDisabledReason() {
        if (!"true".equalsIgnoreCase(getConfigValue(SystemConfig.KEY_LLM_PROXY_ENABLED).orElse("").trim())) {
            return "请在【系统配置】将 llm_proxy.enabled 设为 true";
        }
        return null;
    }

    /** 解析上游 Authorization：直接使用调用方传入的 Authorization 头 */
    private String resolveUpstreamAuthorization(String requestAuthHeader) {
        if (requestAuthHeader != null && !requestAuthHeader.isBlank()) {
            return requestAuthHeader.trim();
        }
        return null;
    }

    /**
     * 使用 API Key 认证的代理转发
     */
    public ProxyResult forwardRequestWithApiKey(String method, String path, String queryString, String body,
                                                String upstreamAuth, ApiKey caller) {
        if (caller == null || caller.getUser() == null) {
            return ProxyResult.error(401, "{\"error\":{\"message\":\"Invalid API Key\"}}");
        }
        return forwardRequestInternal(method, path, queryString, body, upstreamAuth, caller.getUser(), caller);
    }

    /**
     * 使用登录状态（JWT）认证的代理转发
     */
    public ProxyResult forwardRequestWithUser(String method, String path, String queryString, String body,
                                              String upstreamAuth, com.opencarapace.server.user.User user) {
        if (user == null) {
            return ProxyResult.error(401, "{\"error\":{\"message\":\"Invalid user\"}}");
        }
        return forwardRequestInternal(method, path, queryString, body, upstreamAuth, user, null);
    }

    /**
     * 内部实现：透明代理转发逻辑
     * 支持映射前缀：如 path=/minimax/v1/chat/completions，会查用户映射表 prefix=minimax -> targetBase
     */
    private ProxyResult forwardRequestInternal(String method, String path, String queryString, String body,
                                               String upstreamAuth, com.opencarapace.server.user.User user, ApiKey apiKey) {
        String baseUrl = "";
        String actualPath = path;
        
        // 映射前缀逻辑：从 path 提取前缀并查映射表
        if (user != null) {
            String[] segments = (path != null ? path : "").split("/");
            if (segments.length > 1 && !segments[1].isEmpty()) {
                String prefix = segments[1];
                Optional<UserLlmMapping> mapping = userLlmMappingRepository.findByUserIdAndPrefix(user.getId(), prefix);
                if (mapping.isPresent()) {
                    baseUrl = mapping.get().getTargetBase();
                    // 重构路径：去掉前缀，保留后续部分
                    StringBuilder sb = new StringBuilder();
                    for (int i = 2; i < segments.length; i++) {
                        sb.append("/").append(segments[i]);
                    }
                    actualPath = sb.length() > 0 ? sb.toString() : "/";
                    log.info("LLM proxy: mapping prefix={} -> targetBase={}, actualPath={}", prefix, baseUrl, actualPath);
                }
            }
        }
        
        if (baseUrl.isEmpty()) {
            String hint = "No valid mapping prefix found. Please configure LLM mapping in settings (e.g. prefix=minimax -> targetBase=https://api.minimax.chat)";
            return ProxyResult.error(400, "{\"error\":{\"message\":\"" + hint.replace("\"", "\\\"") + "\"}}");
        }
        String auth = resolveUpstreamAuthorization(upstreamAuth);
        if (auth == null || auth.isBlank()) {
            return ProxyResult.error(400, "{\"error\":{\"message\":\"Missing Authorization header (your LLM API key, e.g. Bearer sk-xxx)\"}}");
        }
        String normalizedPath = actualPath != null && !actualPath.startsWith("/") ? "/" + actualPath : (actualPath != null ? actualPath : "/");
        String fullUrl = baseUrl.endsWith("/")
                ? baseUrl + normalizedPath.replaceFirst("^/", "")
                : baseUrl + normalizedPath;
        if (queryString != null && !queryString.isBlank()) {
            fullUrl = fullUrl + (fullUrl.contains("?") ? "&" : "?") + queryString;
        }

        if (apiKey != null) {
            log.info("LLM proxy: upstream={}, method={}, path={}, caller key id={}",
                    baseUrl, method, normalizedPath, apiKey.getId());
        } else if (user != null) {
            log.info("LLM proxy: upstream={}, method={}, path={}, user id={}",
                    baseUrl, method, normalizedPath, user.getId());
        }

        // 监管层 + 意图层：请求前校验（仅对 chat/completions 的 POST body）
        if (supervisionService.isSupervisionEnabled() && "POST".equalsIgnoreCase(method) && normalizedPath.contains("chat/completions") && body != null && !body.isBlank()) {
            LlmSupervisionService.SupervisionResult reqCheck = supervisionService.checkRequestWithIntent(body, apiKey, baseUrl, auth);
            if (!reqCheck.allowed()) {
                String msg = buildSupervisionBlockMessage(reqCheck, true);
                log.warn("LLM proxy supervision block (request): path={}, risk={}, matches={}", normalizedPath, reqCheck.riskLevel(), reqCheck.matches());
                return ProxyResult.error(403, msg);
            }
        }

        try {
            String authHeader = Objects.requireNonNull(auth, "upstream Authorization must not be null here");
            @SuppressWarnings("DataFlowIssue")
            String methodUpper = Objects.requireNonNull(method, "method must not be null").toUpperCase(Locale.ROOT);
            @SuppressWarnings({"DataFlowIssue", "null"})
            HttpMethod httpMethod = HttpMethod.valueOf(methodUpper);
            WebClient.RequestHeadersSpec<?> spec = webClientBuilder.build()
                    .method(httpMethod)
                    .uri(fullUrl)
                    .header(HttpHeaders.AUTHORIZATION, authHeader);

            if (body != null && !body.isBlank() && !"GET".equalsIgnoreCase(method) && !"DELETE".equalsIgnoreCase(method)) {
                spec = ((WebClient.RequestBodySpec) spec)
                        .contentType(Objects.requireNonNull(MediaType.APPLICATION_JSON))
                        .bodyValue(body);
            }

            String responseBody = spec.retrieve()
                    .bodyToMono(String.class)
                    .block();

            // 监管层：响应后校验（仅对 chat/completions 的 assistant 内容）
            if (supervisionService.isSupervisionEnabled() && normalizedPath.contains("chat/completions") && responseBody != null && !responseBody.isBlank()) {
                LlmSupervisionService.SupervisionResult respCheck = supervisionService.checkResponse(responseBody, apiKey);
                if (!respCheck.allowed()) {
                    String msg = buildSupervisionBlockMessage(respCheck, false);
                    log.warn("LLM proxy supervision block (response): path={}, risk={}", normalizedPath, respCheck.riskLevel());
                    return ProxyResult.error(403, msg);
                }
            }

            // Token 账单：云端中转时由后端计算并入库
            try {
                if (user != null) {
                    TokenUsageService.Usage usage = tokenUsageService.extractOrEstimate(body, responseBody);
                    TokenUsageRecord r = new TokenUsageRecord();
                    r.setUser(user);
                    r.setApiKey(apiKey);
                    r.setClientId(null);
                    r.setRouteMode("GATEWAY");
                    r.setUpstreamBase(baseUrl);
                    r.setRequestPath(normalizedPath);
                    r.setModel(usage.model());
                    r.setPromptTokens(usage.promptTokens());
                    r.setCompletionTokens(usage.completionTokens());
                    r.setTotalTokens(usage.totalTokens());
                    r.setEstimated(usage.estimated());
                    tokenUsageRepository.save(r);
                }
            } catch (Exception ignored) {
            }

            return ProxyResult.ok(200, responseBody != null ? responseBody : "{}");
        } catch (WebClientResponseException e) {
            int status = e.getStatusCode().value();
            String respBody = e.getResponseBodyAsString();
            log.warn("LLM proxy upstream error: method={} path={} status={}", method, normalizedPath, status);
            return ProxyResult.error(status, respBody != null && !respBody.isBlank() ? respBody : "{\"error\":{\"message\":\"Upstream error\"}}");
        } catch (Exception e) {
            log.error("LLM proxy forward error", e);
            return ProxyResult.error(502, "{\"error\":{\"message\":\"Proxy gateway error: " + e.getMessage() + "\"}}");
        }
    }

    public Optional<String> getConfigValue(String key) {
        return configService.getValue(key);
    }

    private static String buildSupervisionBlockMessage(LlmSupervisionService.SupervisionResult result, boolean isRequest) {
        String part = isRequest ? "Request" : "Response";
        String reason = "dangerous content or intent detected (risk: " + result.riskLevel() + ")";
        if (!result.matches().isEmpty()) {
            reason = "matched danger pattern(s): " + result.riskLevel();
        }
        if (result.intentVerdict() != null && !result.intentVerdict().isBlank()) {
            reason = reason + "; intent: " + result.intentVerdict();
        }
        String msg = "OpenCarapace supervision blocked " + part + ": " + reason;
        String escaped = msg.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
        return "{\"error\":{\"message\":\"" + escaped + "\",\"code\":\"supervision_blocked\"}}";
    }

    public record ProxyResult(int status, String body, boolean ok) {
        static ProxyResult ok(int status, String body) {
            return new ProxyResult(status, body, true);
        }
        static ProxyResult error(int status, String body) {
            return new ProxyResult(status, body, false);
        }
    }
}
