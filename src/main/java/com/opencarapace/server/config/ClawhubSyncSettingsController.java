package com.opencarapace.server.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * ClawHub 技能同步的开关与频次（专用接口与 UI，存 oc_system_config 固定 key）。
 */
@RestController
@RequestMapping("/api/admin/settings/clawhub-sync")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class ClawhubSyncSettingsController {

    private final ClawhubSyncSettingsService clawhubSyncSettingsService;

    @GetMapping
    public ResponseEntity<ClawhubSyncSettingsService.ClawhubSyncSettingsDto> get() {
        return ResponseEntity.ok(clawhubSyncSettingsService.get());
    }

    @PutMapping
    public ResponseEntity<ClawhubSyncSettingsService.ClawhubSyncSettingsDto> update(
            @Valid @RequestBody PutClawhubSyncRequest body) {
        clawhubSyncSettingsService.update(body.enabled(), body.cronExpression());
        return ResponseEntity.ok(clawhubSyncSettingsService.get());
    }

    public record PutClawhubSyncRequest(
            @NotNull Boolean enabled,
            @NotBlank String cronExpression
    ) {}
}
