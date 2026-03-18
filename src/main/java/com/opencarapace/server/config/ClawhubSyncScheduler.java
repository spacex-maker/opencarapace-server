package com.opencarapace.server.config;

import com.opencarapace.server.config.ClawhubSyncSettingsService.ClawhubSyncSettingsDto;
import com.opencarapace.server.skill.SkillSyncService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * ClawHub 技能定时同步：根据 oc_system_config 中 clawhub.sync.* 的开关与 cron 执行。
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ClawhubSyncScheduler {

    private final ClawhubSyncSettingsService clawhubSyncSettingsService;
    private final SkillSyncService skillSyncService;

    /** 每 5 分钟检查一次是否到达 cron 触发时间 */
    @Scheduled(cron = "0 */5 * * * ?")
    public void runIfScheduled() {
        ClawhubSyncSettingsDto s = clawhubSyncSettingsService.get();
        if (!s.enabled()) {
            return;
        }
        String cron = s.cronExpression();
        if (cron == null || cron.isBlank()) {
            return;
        }
        try {
            CronExpression expression = CronExpression.parse(cron);
            Instant lastRun = s.lastRunAt() != null ? Instant.parse(s.lastRunAt()) : null;
            // 首次启动且从未记录过 lastRunAt：按系统配置的 cron 等待下一次触发，不在启动瞬间就跑一遍
            if (lastRun == null) {
                clawhubSyncSettingsService.recordRun();
                log.info("Clawhub skills sync scheduler initialized, will run on cron: {}", cron);
                return;
            }
            LocalDateTime from = lastRun.atZone(ZoneId.systemDefault()).toLocalDateTime();
            LocalDateTime next = expression.next(from);
            if (next == null) {
                return;
            }
            Instant nextInstant = next.atZone(ZoneId.systemDefault()).toInstant();
            if (Instant.now().isBefore(nextInstant)) {
                return;
            }
            log.info("Clawhub skills sync job started (cron: {})", cron);
            int count = skillSyncService.syncFromClawhubApi();
            clawhubSyncSettingsService.recordRun();
            log.info("Clawhub skills sync job finished: synced={}", count);
        } catch (Exception e) {
            log.error("Clawhub skills sync job failed", e);
        }
    }
}
