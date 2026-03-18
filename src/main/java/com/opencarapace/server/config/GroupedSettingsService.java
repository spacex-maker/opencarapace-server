package com.opencarapace.server.config;

import com.opencarapace.server.config.entity.SystemConfig;
import com.opencarapace.server.config.entity.SystemConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 为系统配置页专用 UI 卡片提供分组配置的读写，底层仍用 oc_system_config 表。
 */
@Service
@RequiredArgsConstructor
public class GroupedSettingsService {

    private final SystemConfigRepository repository;

    @Transactional(readOnly = true)
    public GroupedSettingsDto getGrouped() {
        Map<String, String> all = repository.findAll().stream()
                .collect(Collectors.toMap(SystemConfig::getConfigKey, c -> c.getConfigValue() != null ? c.getConfigValue() : ""));

        boolean useInternet = "true".equalsIgnoreCase(all.getOrDefault(SystemConfig.KEY_DANGER_COMMANDS_USE_INTERNET, "false"));
        boolean deepseekSet = isValueSet(all.get(SystemConfig.KEY_DEEPSEEK_API_KEY));
        boolean tavilySet = isValueSet(all.get(SystemConfig.KEY_TAVILY_API_KEY));
        GroupedSettingsDto.DangerCommandsDto dangerCommands = new GroupedSettingsDto.DangerCommandsDto(useInternet, deepseekSet, tavilySet, null, null);

        boolean llmEnabled = "true".equalsIgnoreCase(all.getOrDefault(SystemConfig.KEY_LLM_PROXY_ENABLED, "true"));
        GroupedSettingsDto.LlmProxyDto llmProxy = new GroupedSettingsDto.LlmProxyDto(llmEnabled);

        boolean supervisionEnabled = "true".equalsIgnoreCase(all.getOrDefault(SystemConfig.KEY_LLM_PROXY_SUPERVISION_ENABLED, "true"));
        String blockLevels = all.getOrDefault(SystemConfig.KEY_LLM_PROXY_SUPERVISION_BLOCK_LEVELS, "CRITICAL,HIGH");
        GroupedSettingsDto.SupervisionDto supervision = new GroupedSettingsDto.SupervisionDto(supervisionEnabled, blockLevels);

        boolean intentEnabled = "true".equalsIgnoreCase(all.getOrDefault(SystemConfig.KEY_LLM_PROXY_INTENT_ENABLED, "false"));
        String intentModel = all.getOrDefault(SystemConfig.KEY_LLM_PROXY_INTENT_MODEL, "deepseek-chat");
        GroupedSettingsDto.IntentDto intent = new GroupedSettingsDto.IntentDto(intentEnabled, intentModel);

        return new GroupedSettingsDto(dangerCommands, llmProxy, supervision, intent);
    }

    private static boolean isValueSet(String v) {
        return v != null && !v.isBlank() && !"***".equals(v);
    }

    @Transactional
    public void putGrouped(GroupedSettingsDto dto) {
        if (dto.dangerCommands() != null) {
            var dc = dto.dangerCommands();
            set(SystemConfig.KEY_DANGER_COMMANDS_USE_INTERNET, String.valueOf(dc.useInternet()), null);
            if (dc.deepseekApiKey() != null && !dc.deepseekApiKey().isBlank()) {
                set(SystemConfig.KEY_DEEPSEEK_API_KEY, dc.deepseekApiKey(), null);
            }
            if (dc.tavilyApiKey() != null && !dc.tavilyApiKey().isBlank()) {
                set(SystemConfig.KEY_TAVILY_API_KEY, dc.tavilyApiKey(), null);
            }
        }
        if (dto.llmProxy() != null) {
            var p = dto.llmProxy();
            set(SystemConfig.KEY_LLM_PROXY_ENABLED, String.valueOf(p.enabled()), null);
        }
        if (dto.supervision() != null) {
            set(SystemConfig.KEY_LLM_PROXY_SUPERVISION_ENABLED, String.valueOf(dto.supervision().enabled()), null);
            set(SystemConfig.KEY_LLM_PROXY_SUPERVISION_BLOCK_LEVELS, dto.supervision().blockLevels() != null ? dto.supervision().blockLevels() : "CRITICAL,HIGH", null);
        }
        if (dto.intent() != null) {
            set(SystemConfig.KEY_LLM_PROXY_INTENT_ENABLED, String.valueOf(dto.intent().enabled()), null);
            set(SystemConfig.KEY_LLM_PROXY_INTENT_MODEL, dto.intent().model() != null ? dto.intent().model() : "deepseek-chat", null);
        }
    }

    private void set(String key, String value, String description) {
        SystemConfig c = repository.findByConfigKey(key).orElseGet(() -> {
            SystemConfig n = new SystemConfig();
            n.setConfigKey(key);
            return n;
        });
        if (value != null && !value.isBlank()) c.setConfigValue(value);
        if (description != null) c.setDescription(description);
        repository.save(c);
    }

    /** 分组配置 DTO，与前端卡片一一对应 */
    public record GroupedSettingsDto(
            DangerCommandsDto dangerCommands,
            LlmProxyDto llmProxy,
            SupervisionDto supervision,
            IntentDto intent
    ) {
        /** GET 时 *ApiKeySet 表示是否已配置；PUT 时 *ApiKey 非空则更新 */
        public record DangerCommandsDto(boolean useInternet, boolean deepseekApiKeySet, boolean tavilyApiKeySet, String deepseekApiKey, String tavilyApiKey) {}
        /** 大模型代理仅保留总开关，具体上游由调用方在请求头中传入 */
        public record LlmProxyDto(
                boolean enabled
        ) {}
        public record SupervisionDto(boolean enabled, String blockLevels) {}
        public record IntentDto(boolean enabled, String model) {}
    }
}
