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

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * 大模型 API 中转代理：将请求转发到后台配置的上游地址，并在中间做监管（日志、可扩展策略）。
 * 上游一般为 OpenAI 兼容接口（如 OpenAI、DeepSeek、本地部署等）。
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
        String url = getConfigValue(SystemConfig.KEY_LLM_PROXY_UPSTREAM_URL).orElse("").trim();
        if (url.isEmpty()) {
            return "请在【系统配置】填写 llm_proxy.upstream_url（如 https://api.deepseek.com）";
        }
        return null;
    }

    /** 多后端配置键前缀：llm_proxy.backend.{name}.url / llm_proxy.backend.{name}.api_key */
    public static final String BACKEND_CONFIG_PREFIX = "llm_proxy.backend.";

    /**
     * 解析后端：不传或 default 使用默认上游；否则用 llm_proxy.backend.{name}.url。
     * @return BackendConfig 或 null（表示未找到该后端）
     */
    public BackendConfig resolveBackend(String backendName) {
        if (backendName == null || backendName.isBlank() || "default".equalsIgnoreCase(backendName.trim())) {
            String url = getConfigValue(SystemConfig.KEY_LLM_PROXY_UPSTREAM_URL).orElse("").trim();
            if (url.isEmpty()) return null;
            String key = getConfigValue(SystemConfig.KEY_LLM_PROXY_UPSTREAM_API_KEY).orElse("").trim();
            return new BackendConfig(url, key.isEmpty() ? null : "Bearer " + key, "default");
        }
        String name = backendName.trim().toLowerCase();
        if (!name.matches("[a-z0-9_-]+")) {
            return null;
        }
        String url = getConfigValue(BACKEND_CONFIG_PREFIX + name + ".url").orElse("").trim();
        if (url.isEmpty()) return null;
        String key = getConfigValue(BACKEND_CONFIG_PREFIX + name + ".api_key").orElse("").trim();
        return new BackendConfig(url, key.isEmpty() ? null : "Bearer " + key, name);
    }

    /** 单个后端的 baseUrl + 可选默认 Authorization */
    public record BackendConfig(String baseUrl, String defaultAuth, String backendName) {}

    /** 解析上游 Authorization：优先请求头，否则用该后端的 defaultAuth */
    private String resolveUpstreamAuthorization(String requestAuthHeader, String backendDefaultAuth) {
        if (requestAuthHeader != null && !requestAuthHeader.isBlank()) {
            return requestAuthHeader.trim();
        }
        return backendDefaultAuth;
    }

    /** 转发到上游 POST path，委托给透明代理。 */
    public ProxyResult forward(String path, String rawBody, String upstreamAuth, String backendName, ApiKey caller) {
        return forwardRequest("POST", path, null, rawBody, upstreamAuth, backendName, caller);
    }

    /** GET 转发（如 /v1/models），支持 X-LLM-Backend。 */
    public ProxyResult forwardGet(String path, String upstreamAuth, String backendName, ApiKey caller) {
        return forwardRequest("GET", path, null, null, upstreamAuth, backendName, caller);
    }

    /**
     * 透明代理：按 HTTP 方法、路径、查询串、请求体转发到上游，中间只做鉴权与日志。
     * 任意 path（如 /v1/chat/completions、/v1/embeddings、/v1/audio/...）均可转发。
     */
    public ProxyResult forwardRequest(String method, String path, String queryString, String body,
                                      String upstreamAuth, String backendName, ApiKey caller) {
        BackendConfig backend = resolveBackend(backendName);
        if (backend == null) {
            String hint = (backendName == null || backendName.isBlank() || "default".equalsIgnoreCase(backendName.trim()))
                    ? "默认上游未配置，请填写 llm_proxy.upstream_url"
                    : "未知后端: " + backendName;
            return ProxyResult.error(400, "{\"error\":{\"message\":\"" + hint.replace("\"", "\\\"") + "\"}}");
        }
        String auth = resolveUpstreamAuthorization(upstreamAuth, backend.defaultAuth());
        if (auth == null || auth.isBlank()) {
            return ProxyResult.error(400, "{\"error\":{\"message\":\"Missing Authorization header (your LLM API key, e.g. Bearer sk-xxx)\"}}");
        }
        String normalizedPath = path != null && !path.startsWith("/") ? "/" + path : (path != null ? path : "/");
        String fullUrl = backend.baseUrl().endsWith("/")
                ? backend.baseUrl() + normalizedPath.replaceFirst("^/", "")
                : backend.baseUrl() + normalizedPath;
        if (queryString != null && !queryString.isBlank()) {
            fullUrl = fullUrl + (fullUrl.contains("?") ? "&" : "?") + queryString;
        }

        if (caller != null) {
            log.info("LLM proxy: backend={}, method={}, path={}, caller key id={}",
                    backend.backendName(), method, normalizedPath, caller.getId());
        }

        // 监管层 + 意图层：请求前校验（仅对 chat/completions 的 POST body）
        if (supervisionService.isSupervisionEnabled() && "POST".equalsIgnoreCase(method) && normalizedPath.contains("chat/completions") && body != null && !body.isBlank()) {
            LlmSupervisionService.SupervisionResult reqCheck = supervisionService.checkRequestWithIntent(body, caller, backend.baseUrl(), auth);
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

    /** 返回可用后端名：default + 所有已配置的 llm_proxy.backend.{name}.url 的 name */
    public List<String> listBackendNames() {
        List<String> out = new ArrayList<>();
        out.add("default");
        for (com.opencarapace.server.config.entity.SystemConfig c : configService.listAllMasked()) {
            String k = c.getConfigKey();
            if (k != null && k.startsWith(BACKEND_CONFIG_PREFIX) && k.endsWith(".url")) {
                String name = k.substring(BACKEND_CONFIG_PREFIX.length(), k.length() - 4);
                if (!name.isEmpty() && !out.contains(name)) out.add(name);
            }
        }
        return out;
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
