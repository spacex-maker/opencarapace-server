package com.opencarapace.server.config;

import com.opencarapace.server.config.entity.SystemConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 装机/客户端拉取的公开默认值（无登录）。管理员在「系统配置」中维护对应键。
 */
@RestController
@RequestMapping("/api/public/client-defaults")
@RequiredArgsConstructor
public class PublicClientDefaultsController {

    private final SystemConfigService systemConfigService;

    @GetMapping("/minimax-api-key")
    public Map<String, String> minimaxApiKey() {
        String key = systemConfigService.getValue(SystemConfig.KEY_CLIENT_DEFAULT_MINIMAX_API_KEY).orElse("").trim();
        return Map.of("apiKey", key);
    }
}
