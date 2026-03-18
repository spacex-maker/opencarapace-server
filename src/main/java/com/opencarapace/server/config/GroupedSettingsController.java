package com.opencarapace.server.config;

import com.opencarapace.server.config.GroupedSettingsService.GroupedSettingsDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 系统配置页专用卡片所需的分组配置，读写 oc_system_config 表。
 */
@RestController
@RequestMapping("/api/admin/settings/grouped")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class GroupedSettingsController {

    private final GroupedSettingsService groupedSettingsService;

    @GetMapping
    public ResponseEntity<GroupedSettingsDto> get() {
        return ResponseEntity.ok(groupedSettingsService.getGrouped());
    }

    @PutMapping
    public ResponseEntity<GroupedSettingsDto> put(@RequestBody GroupedSettingsDto body) {
        groupedSettingsService.putGrouped(body);
        return ResponseEntity.ok(groupedSettingsService.getGrouped());
    }
}
