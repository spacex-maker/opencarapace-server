package com.opencarapace.server.llm;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.opencarapace.server.apikey.ApiKey;
import com.opencarapace.server.apikey.ApiKeyService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import java.util.stream.Stream;

/**
 * 大模型 API 透明代理：客户端只认本机为「唯一入口」，路径与请求原样转发到上游。
 * - OpenCarapace 鉴权：请求头 X-OC-API-KEY，或查询参数 api_key / x_oc_api_key（Agent 无法自定义头时可将 Key 写在 URL）
 * - Authorization：用户自己的 LLM Key；不传则使用系统配置中的上游 Key
 * - X-LLM-Backend：可选，指定后端（如 deepseek、openai）
 */
@RestController
@RequestMapping("/api/llm")
public class LlmProxyController {

    private final LlmProxyService proxyService;
    private final ApiKeyService apiKeyService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public LlmProxyController(LlmProxyService proxyService, ApiKeyService apiKeyService) {
        this.proxyService = proxyService;
        this.apiKeyService = apiKeyService;
    }

    /** 列出可用后端名，便于客户端选择 X-LLM-Backend */
    @GetMapping(value = "/backends", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> backends(
            @RequestHeader(name = "X-OC-API-KEY", required = false) String apiKeyHeader,
            @RequestParam(name = "api_key", required = false) String apiKeyParam,
            @RequestParam(name = "x_oc_api_key", required = false) String xOcApiKeyParam) {
        ApiKey caller = resolveCaller(apiKeyHeader, apiKeyParam != null ? apiKeyParam : xOcApiKeyParam);
        if (caller == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body("{\"error\":{\"message\":\"Missing or invalid X-OC-API-KEY\"}}");
        }
        try {
            String json = objectMapper.writeValueAsString(Map.of("backends", proxyService.listBackendNames()));
            return ResponseEntity.ok(json);
        } catch (JsonProcessingException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("{\"error\":{\"message\":\"Internal error\"}}");
        }
    }

    /**
     * 透明代理：任意路径、任意方法（GET/POST/PUT/PATCH/DELETE）均转发到上游，路径与查询串、请求体原样透传。
     * 用法：把原先的 baseUrl 换成你的 OpenCarapace 地址（如 https://your-server.com/api/llm），其余不变。
     */
    @RequestMapping(value = "/{*path}", method = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.PATCH, RequestMethod.DELETE})
    public ResponseEntity<String> proxy(
            @PathVariable("path") String path,
            HttpServletRequest request,
            @RequestHeader(name = "X-OC-API-KEY", required = false) String apiKeyHeader,
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader,
            @RequestHeader(name = "X-LLM-Backend", required = false) String backendHeader,
            @RequestBody(required = false) String body
    ) {
        String apiKeyFromParam = request.getParameter("api_key");
        if (apiKeyFromParam == null || apiKeyFromParam.isBlank()) {
            apiKeyFromParam = request.getParameter("x_oc_api_key");
        }
        ApiKey caller = resolveCaller(apiKeyHeader, apiKeyFromParam);
        if (caller == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body("{\"error\":{\"message\":\"Missing or invalid X-OC-API-KEY (or query param api_key)\"}}");
        }
        String disabledReason = proxyService.getDisabledReason();
        if (disabledReason != null) {
            String msg = "{\"error\":{\"message\":\"" + escapeJson(disabledReason) + "\"}}";
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(msg);
        }
        String method = request.getMethod();
        String queryString = stripProxyQueryParams(request.getQueryString());
        String pathWithSlash = path.startsWith("/") ? path : "/" + path;
        LlmProxyService.ProxyResult result = proxyService.forwardRequest(method, pathWithSlash, queryString, body, authorizationHeader, backendHeader, caller);
        return ResponseEntity.status(result.status())
                .contentType(MediaType.APPLICATION_JSON)
                .body(result.body());
    }

    /** 鉴权：优先请求头 X-OC-API-KEY，否则用查询参数 api_key / x_oc_api_key（便于无法自定义头的 Agent） */
    private ApiKey resolveCaller(String apiKeyHeader, String apiKeyFromQuery) {
        String raw = (apiKeyHeader != null && !apiKeyHeader.isBlank()) ? apiKeyHeader.trim() : (apiKeyFromQuery != null && !apiKeyFromQuery.isBlank() ? apiKeyFromQuery.trim() : null);
        if (raw == null) return null;
        return apiKeyService.authenticateByRawKey(raw);
    }

    /** 转发给上游时去掉仅用于本代理的查询参数，避免泄露 */
    private static String stripProxyQueryParams(String queryString) {
        if (queryString == null || queryString.isBlank()) return null;
        String[] pairs = queryString.split("&");
        String filtered = Stream.of(pairs)
                .filter(p -> {
                    int eq = p.indexOf('=');
                    String key = eq >= 0 ? p.substring(0, eq) : p;
                    return !("api_key".equalsIgnoreCase(key) || "x_oc_api_key".equalsIgnoreCase(key));
                })
                .reduce((a, b) -> a + "&" + b)
                .orElse(null);
        return (filtered != null && !filtered.isBlank()) ? filtered : null;
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
    }
}
