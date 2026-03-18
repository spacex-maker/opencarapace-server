package com.opencarapace.server.config;

import com.opencarapace.server.config.entity.SystemConfig;
import com.opencarapace.server.config.entity.SystemConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class SystemConfigService {

    private final SystemConfigRepository repository;

    @Transactional(readOnly = true)
    public Optional<String> getValue(String configKey) {
        return repository.findByConfigKey(configKey).map(SystemConfig::getConfigValue);
    }

    @Transactional(readOnly = true)
    public Optional<SystemConfig> get(String configKey) {
        return repository.findByConfigKey(configKey);
    }

    /** 不在 KV 列表中展示，仅由专用卡片 API/UI 管理的 key 或前缀 */
    private static final java.util.Set<String> HIDDEN_KEYS = java.util.Set.of(
            SystemConfig.KEY_CLAWHUB_SYNC_ENABLED,
            SystemConfig.KEY_CLAWHUB_SYNC_CRON,
            SystemConfig.KEY_CLAWHUB_SYNC_LAST_RUN_AT,
            SystemConfig.KEY_DANGER_COMMANDS_USE_INTERNET,
            SystemConfig.KEY_DEEPSEEK_API_KEY,
            SystemConfig.KEY_TAVILY_API_KEY
    );
    private static final String HIDDEN_PREFIX = "llm_proxy.";

    @Transactional(readOnly = true)
    public List<SystemConfig> listAllMasked() {
        return repository.findAll().stream()
                .filter(c -> !HIDDEN_KEYS.contains(c.getConfigKey()) && !c.getConfigKey().startsWith(HIDDEN_PREFIX))
                .map(c -> isSecretKey(c.getConfigKey()) && c.getConfigValue() != null && !c.getConfigValue().isBlank()
                        ? maskConfig(c)
                        : c)
                .toList();
    }

    private static SystemConfig maskConfig(SystemConfig c) {
        SystemConfig m = new SystemConfig();
        m.setId(c.getId());
        m.setConfigKey(c.getConfigKey());
        m.setConfigValue("***");
        m.setDescription(c.getDescription());
        m.setCreatedAt(c.getCreatedAt());
        m.setUpdatedAt(c.getUpdatedAt());
        return m;
    }

    /** 获取配置值，若为敏感 key 则返回是否已配置（不返回明文）。 */
    @Transactional(readOnly = true)
    public Optional<SystemConfig> getMasked(String configKey) {
        return repository.findByConfigKey(configKey).map(c ->
            isSecretKey(c.getConfigKey()) && c.getConfigValue() != null && !c.getConfigValue().isBlank()
                    ? maskConfig(c) : c);
    }

    /** 设置配置。value 为空且记录已存在时不修改 value（便于前端“留空保留原值”）；description 为 null 时不改描述。 */
    @Transactional
    public SystemConfig set(String configKey, String configValue, String description) {
        SystemConfig c = repository.findByConfigKey(configKey).orElseGet(() -> {
            SystemConfig newOne = new SystemConfig();
            newOne.setConfigKey(configKey);
            return newOne;
        });
        if (configValue != null && !configValue.isBlank()) c.setConfigValue(configValue);
        if (description != null) c.setDescription(description);
        return repository.save(c);
    }

    private static boolean isSecretKey(String key) {
        return key != null && (key.endsWith(".api_key") || key.endsWith(".secret") || key.contains("password"));
    }
}
