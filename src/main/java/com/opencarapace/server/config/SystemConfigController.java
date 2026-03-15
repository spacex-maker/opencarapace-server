package com.opencarapace.server.config;

import com.opencarapace.server.config.entity.SystemConfig;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 系统配置 API：仅管理员可读写，用于配置 DeepSeek、Tavily 等 API Key。
 */
@RestController
@RequestMapping("/api/admin/system-config")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class SystemConfigController {

    private final SystemConfigService systemConfigService;

    @GetMapping
    public List<SystemConfig> list() {
        return systemConfigService.listAllMasked();
    }

    @GetMapping("/{key}")
    public ResponseEntity<SystemConfig> get(@PathVariable String key) {
        return systemConfigService.getMasked(key)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{key}")
    public ResponseEntity<SystemConfig> set(
            @PathVariable String key,
            @RequestBody SetConfigRequest request) {
        SystemConfig c = systemConfigService.set(key, request.value(), request.description());
        return ResponseEntity.ok(systemConfigService.getMasked(key).orElse(c));
    }

    public record SetConfigRequest(String value, String description) {}
}
