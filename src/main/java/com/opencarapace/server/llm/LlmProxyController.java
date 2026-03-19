package com.opencarapace.server.llm;

import com.opencarapace.server.apikey.ApiKey;
import com.opencarapace.server.apikey.ApiKeyService;
import com.opencarapace.server.security.JwtTokenService;
import com.opencarapace.server.user.User;
import com.opencarapace.server.user.UserRepository;
import io.jsonwebtoken.Claims;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.util.stream.Stream;

/**
 * 大模型 API 透明代理：客户端只认本机为「唯一入口」，路径与请求原样转发到上游。
 * 
 * 两种认证方式：
 * 1. 登录状态（/api/llm/auth/**）：使用 Authorization: Bearer <token>，从 JWT 获取用户身份
 * 2. API Key（/api/llm/**）：使用 X-OC-API-KEY 或查询参数 api_key
 * 
 * - 支持映射前缀：如 /api/llm/minimax/v1/chat/completions，会从用户映射表查 minimax -> targetBase
 * - Authorization 头会原样转发到上游 LLM（用于上游认证）
 */
@RestController
@RequestMapping("/api/llm")
public class LlmProxyController {

    private final LlmProxyService proxyService;
    private final ApiKeyService apiKeyService;
    private final UserRepository userRepository;
    private final JwtTokenService jwtTokenService;
    
    public LlmProxyController(LlmProxyService proxyService, ApiKeyService apiKeyService, UserRepository userRepository, JwtTokenService jwtTokenService) {
        this.proxyService = proxyService;
        this.apiKeyService = apiKeyService;
        this.userRepository = userRepository;
        this.jwtTokenService = jwtTokenService;
    }

    /**
     * 登录状态代理：使用 X-User-Token 认证用户身份
     * 路径：/api/llm/auth/{prefix}/...
     * Authorization 头会原样转发到上游 LLM（用于上游 LLM 认证）
     * X-User-Token 用于 ClawHeart 用户认证（不会转发到上游）
     */
    @RequestMapping(value = "/auth/{*path}", method = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.PATCH, RequestMethod.DELETE})
    public ResponseEntity<String> proxyWithAuth(
            @PathVariable("path") String path,
            HttpServletRequest request,
            @RequestHeader(name = "X-User-Token", required = false) String userToken,
            @RequestHeader(name = "X-OC-API-KEY", required = false) String apiKeyHeader,
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader,
            @RequestBody(required = false) String body
    ) {
        // 调试日志
        System.out.println("[LLM Proxy Auth] 收到请求: " + request.getMethod() + " " + path);
        System.out.println("[LLM Proxy Auth] X-User-Token: " + (userToken != null ? "存在 (长度: " + userToken.length() + ")" : "null"));
        System.out.println("[LLM Proxy Auth] X-OC-API-KEY: " + (apiKeyHeader != null ? "存在 (长度: " + apiKeyHeader.length() + ")" : "null"));
        System.out.println("[LLM Proxy Auth] Authorization: " + (authorizationHeader != null ? "存在 (长度: " + authorizationHeader.length() + ")" : "null"));
        
        User user = null;
        ApiKey apiKey = null;
        
        // 方式1：使用 X-User-Token 验证（本地代理转发）
        if (userToken != null && !userToken.isBlank()) {
            Long userId = validateUserToken(userToken);
            if (userId == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":{\"message\":\"Invalid or expired X-User-Token\"}}");
            }
            user = userRepository.findById(userId).orElse(null);
            if (user == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":{\"message\":\"User not found\"}}");
            }
        }
        // 方式2：使用 X-OC-API-KEY 验证（OpenClaw 直接调用）
        else if (apiKeyHeader != null && !apiKeyHeader.isBlank()) {
            apiKey = apiKeyService.authenticateByRawKey(apiKeyHeader.trim());
            if (apiKey == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":{\"message\":\"Invalid or revoked X-OC-API-KEY\"}}");
            }
            user = apiKey.getUser();
        }
        // 都没有提供
        else {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body("{\"error\":{\"message\":\"X-User-Token or X-OC-API-KEY header is required\"}}");
        }
        
        String disabledReason = proxyService.getDisabledReason();
        if (disabledReason != null) {
            String msg = "{\"error\":{\"message\":\"" + escapeJson(disabledReason) + "\"}}";
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(msg);
        }
        
        String method = request.getMethod();
        String queryString = request.getQueryString();
        String pathWithSlash = path.startsWith("/") ? path : "/" + path;
        LlmProxyService.ProxyResult result = proxyService.forwardRequestWithUser(method, pathWithSlash, queryString, body, authorizationHeader, user);
        return ResponseEntity.status(result.status())
                .contentType(MediaType.APPLICATION_JSON)
                .body(result.body());
    }

    /**
     * API Key 代理：使用 X-OC-API-KEY 认证
     * 路径：/api/llm/{prefix}/...
     * Authorization 头会原样转发到上游 LLM（用于上游认证）
     */
    @RequestMapping(value = "/{*path}", method = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.PATCH, RequestMethod.DELETE})
    public ResponseEntity<String> proxyWithApiKey(
            @PathVariable("path") String path,
            HttpServletRequest request,
            @RequestHeader(name = "X-OC-API-KEY", required = false) String apiKeyHeader,
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader,
            @RequestBody(required = false) String body
    ) {
        String apiKeyFromParam = request.getParameter("api_key");
        if (apiKeyFromParam == null || apiKeyFromParam.isBlank()) {
            apiKeyFromParam = request.getParameter("x_oc_api_key");
        }
        if (apiKeyFromParam != null) {
            apiKeyFromParam = apiKeyFromParam.trim();
        }
        ApiKey caller = resolveCaller(apiKeyHeader, apiKeyFromParam);
        if (caller == null) {
            String raw = (apiKeyHeader != null && !apiKeyHeader.isBlank()) ? apiKeyHeader.trim() : apiKeyFromParam;
            String message = (raw == null || raw.isBlank())
                    ? "X-OC-API-KEY is required (header or query param api_key)"
                    : "X-OC-API-KEY is invalid or revoked (check key in user dashboard)";
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body("{\"error\":{\"message\":\"" + escapeJson(message) + "\"}}");
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
        LlmProxyService.ProxyResult result = proxyService.forwardRequestWithApiKey(method, pathWithSlash, queryString, body, authorizationHeader, caller);
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

    /**
     * 验证用户 token 并返回 userId
     */
    private Long validateUserToken(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }
        
        // 移除 "Bearer " 前缀（如果有）
        String actualToken = token.startsWith("Bearer ") ? token.substring(7) : token;
        
        try {
            Claims claims = jwtTokenService.parseToken(actualToken);
            String subject = claims.getSubject();
            return Long.parseLong(subject);
        } catch (Exception e) {
            return null;
        }
    }
}
