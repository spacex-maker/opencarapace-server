package com.opencarapace.server.config;

import com.opencarapace.server.config.entity.SystemConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * ClawHub 技能同步的开关与频次，读写 oc_system_config 表中的固定 key，对外暴露专用 DTO。
 */
@Service
@RequiredArgsConstructor
public class ClawhubSyncSettingsService {

    private static final String DEFAULT_CRON = "0 0 2 * * ?";

    private final SystemConfigService systemConfigService;

    @Transactional(readOnly = true)
    public ClawhubSyncSettingsDto get() {
        boolean enabled = "true".equalsIgnoreCase(
                systemConfigService.getValue(SystemConfig.KEY_CLAWHUB_SYNC_ENABLED).orElse("false"));
        String cron = systemConfigService.getValue(SystemConfig.KEY_CLAWHUB_SYNC_CRON).orElse(DEFAULT_CRON);
        String lastRunAt = systemConfigService.getValue(SystemConfig.KEY_CLAWHUB_SYNC_LAST_RUN_AT).orElse(null);
        return new ClawhubSyncSettingsDto(enabled, cron, lastRunAt);
    }

    @Transactional
    public ClawhubSyncSettingsDto update(boolean enabled, String cronExpression) {
        systemConfigService.set(SystemConfig.KEY_CLAWHUB_SYNC_ENABLED, String.valueOf(enabled), null);
        if (cronExpression != null && !cronExpression.isBlank()) {
            systemConfigService.set(SystemConfig.KEY_CLAWHUB_SYNC_CRON, cronExpression.trim(), null);
        }
        return get();
    }

    @Transactional
    public void recordRun() {
        systemConfigService.set(SystemConfig.KEY_CLAWHUB_SYNC_LAST_RUN_AT, Instant.now().toString(), null);
    }

    public record ClawhubSyncSettingsDto(boolean enabled, String cronExpression, String lastRunAt) {}
}
