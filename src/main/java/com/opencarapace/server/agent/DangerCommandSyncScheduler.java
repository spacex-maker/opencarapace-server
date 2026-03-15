package com.opencarapace.server.agent;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 危险指令库定时同步：使用 Tavily + DeepSeek 按系统类型从互联网更新数据。
 * 默认每天凌晨 3 点执行；可通过 opencarapace.sync.danger-commands.cron 修改，enabled=false 可关闭。
 */
@Component
@ConditionalOnProperty(name = "opencarapace.sync.danger-commands.enabled", havingValue = "true", matchIfMissing = false)
@RequiredArgsConstructor
@Slf4j
public class DangerCommandSyncScheduler {

    private final DangerCommandSyncService syncService;

    @Scheduled(cron = "${opencarapace.sync.danger-commands.cron:0 0 3 * * ?}")
    public void runSync() {
        log.info("DangerCommand sync job started");
        try {
            DangerCommandSyncService.SyncResult result = syncService.sync();
            log.info("DangerCommand sync job finished: added={}, updated={}", result.added(), result.updated());
        } catch (Exception e) {
            log.error("DangerCommand sync job failed", e);
        }
    }
}
