package com.opencarapace.server.agent;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 管理员手动触发危险指令库同步（Tavily + DeepSeek）。
 */
@RestController
@RequestMapping("/api/admin/danger-commands")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class DangerCommandSyncController {

    private final DangerCommandSyncService syncService;

    @PostMapping("/sync")
    public ResponseEntity<Map<String, Object>> triggerSync() {
        DangerCommandSyncService.SyncResult result = syncService.sync();
        return ResponseEntity.ok(Map.of(
                "added", result.added(),
                "updated", result.updated(),
                "error", result.error() != null ? result.error() : ""
        ));
    }
}
