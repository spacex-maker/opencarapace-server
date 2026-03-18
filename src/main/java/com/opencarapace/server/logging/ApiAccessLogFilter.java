package com.opencarapace.server.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

/**
 * 输出 /api/** 的访问日志（不打印敏感头）。
 */
@Slf4j
@Component
public class ApiAccessLogFilter extends OncePerRequestFilter {

    private static final Set<String> IGNORE_PREFIX = Set.of(
            "/api/sync-status"
    );

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        if (uri == null) return true;
        if (!uri.startsWith("/api/")) return true;
        for (String p : IGNORE_PREFIX) {
            if (uri.startsWith(p)) return true;
        }
        return false;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        long startNs = System.nanoTime();
        try {
            filterChain.doFilter(request, response);
        } finally {
            long costMs = (System.nanoTime() - startNs) / 1_000_000;
            String method = request.getMethod();
            String uri = request.getRequestURI();
            String qs = request.getQueryString();
            int status = response.getStatus();
            String ip = request.getRemoteAddr();
            String ua = request.getHeader("User-Agent");

            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            String userId = (auth != null && auth.isAuthenticated()) ? auth.getName() : null;

            // 尽量结构化输出，便于后续日志采集解析
            log.info("api_access method={} path={}{} status={} costMs={} ip={} user={} ua={}",
                    method,
                    uri,
                    (qs == null || qs.isBlank()) ? "" : ("?" + qs),
                    status,
                    costMs,
                    ip,
                    (userId == null || userId.isBlank()) ? "-" : userId,
                    (ua == null || ua.isBlank()) ? "-" : ua
            );
        }
    }
}

