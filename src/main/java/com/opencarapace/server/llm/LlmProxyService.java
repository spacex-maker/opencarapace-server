package com.opencarapace.server.llm;

import com.opencarapace.server.apikey.ApiKey;
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

    /** 转发到上游 POST path，委托给透明代理。 */
    public ProxyResult forward(String path, String rawBody, String upstreamAuth, String upstreamBaseUrl, ApiKey caller) {
        return forwardRequest("POST", path, null, rawBody, upstreamAuth, upstreamBaseUrl, caller);
    }

    /** GET 转发（如 /v1/models），支持 X-LLM-Backend。 */
    public ProxyResult forwardGet(String path, String upstreamAuth, String upstreamBaseUrl, ApiKey caller) {
        return forwardRequest("GET", path, null, null, upstreamAuth, upstreamBaseUrl, caller);
    }

    /**
     * 透明代理：按 HTTP 方法、路径、查询串、请求体转发到上游，中间只做鉴权与日志。
     * 任意 path（如 /v1/chat/completions、/v1/embeddings、/v1/audio/...）均可转发。
     */
    public ProxyResult forwardRequest(String method, String path, String queryString, String body,
                                      String upstreamAuth, String upstreamBaseUrl, ApiKey caller) {
        String baseUrl = upstreamBaseUrl != null ? upstreamBaseUrl.trim() : "";
        if (baseUrl.isEmpty()) {
            String hint = "Missing X-LLM-Upstream-Url header (target LLM/base proxy URL is required)";
            return ProxyResult.error(400, "{\"error\":{\"message\":\"" + hint.replace("\"", "\\\"") + "\"}}");
        }
        String auth = resolveUpstreamAuthorization(upstreamAuth);
        if (auth == null || auth.isBlank()) {
            return ProxyResult.error(400, "{\"error\":{\"message\":\"Missing Authorization header (your LLM API key, e.g. Bearer sk-xxx)\"}}");
        }
        String normalizedPath = path != null && !path.startsWith("/") ? "/" + path : (path != null ? path : "/");
        String fullUrl = baseUrl.endsWith("/")
                ? baseUrl + normalizedPath.replaceFirst("^/", "")
                : baseUrl + normalizedPath;
        if (queryString != null && !queryString.isBlank()) {
            fullUrl = fullUrl + (fullUrl.contains("?") ? "&" : "?") + queryString;
        }

        if (caller != null) {
            log.info("LLM proxy: upstream={}, method={}, path={}, caller key id={}",
                    baseUrl, method, normalizedPath, caller.getId());
        }

        // 监管层 + 意图层：请求前校验（仅对 chat/completions 的 POST body）
        if (supervisionService.isSupervisionEnabled() && "POST".equalsIgnoreCase(method) && normalizedPath.contains("chat/completions") && body != null && !body.isBlank()) {
            LlmSupervisionService.SupervisionResult reqCheck = supervisionService.checkRequestWithIntent(body, caller, baseUrl, auth);
            if (!reqCheck.allowed()) {
                String msg = buildSupervisionBlockMessage(reqCheck, true);
                log.warn("LLM proxy supervision block (request): path={}, risk={}, matches={}", normalizedPath, reqCheck.riskLevel(), reqCheck.matches());
                return ProxyResult.error(403, msg);
            }
        }

        try {
            WebClient.RequestHeadersSpec<?> spec = webClientBuilder.build()
                    .method(HttpMethod.valueOf(method))
                    .uri(fullUrl)
                    .header(HttpHeaders.AUTHORIZATION, auth);

            if (body != null && !body.isBlank() && !"GET".equalsIgnoreCase(method) && !"DELETE".equalsIgnoreCase(method)) {
                spec = ((WebClient.RequestBodySpec) spec)
                        .contentType(MediaType.APPLICATION_JSON)
                        .bodyValue(body);
            }

            String responseBody = spec.retrieve()
                    .bodyToMono(String.class)
                    .block();

            // 监管层：响应后校验（仅对 chat/completions 的 assistant 内容）
            if (supervisionService.isSupervisionEnabled() && normalizedPath.contains("chat/completions") && responseBody != null && !responseBody.isBlank()) {
                LlmSupervisionService.SupervisionResult respCheck = supervisionService.checkResponse(responseBody, caller);
                if (!respCheck.allowed()) {
                    String msg = buildSupervisionBlockMessage(respCheck, false);
                    log.warn("LLM proxy supervision block (response): path={}, risk={}", normalizedPath, respCheck.riskLevel());
                    return ProxyResult.error(403, msg);
                }
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
