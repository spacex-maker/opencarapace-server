package com.opencarapace.server.danger;

import com.opencarapace.server.danger.DangerCommand.DangerCategory;
import com.opencarapace.server.danger.DangerCommand.RiskLevel;
import com.opencarapace.server.danger.DangerCommand.SystemType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.format.DateTimeParseException;

/**
 * 云端危险指令库 API。
 * - 登录用户：可查询列表与详情
 * - 管理员：额外支持新增 / 更新 / 删除
 */
@RestController
@RequestMapping("/api/danger-commands")
@RequiredArgsConstructor
public class DangerCommandController {

    private final DangerCommandService dangerCommandService;

    /** 分页查询，支持按系统类型、分类、风险等级、关键词筛选（登录用户可见） */
    @GetMapping
    public Page<DangerCommand> search(
            @RequestParam(name = "systemType", required = false) SystemType systemType,
            @RequestParam(name = "category", required = false) DangerCategory category,
            @RequestParam(name = "riskLevel", required = false) RiskLevel riskLevel,
            @RequestParam(name = "keyword", required = false) String keyword,
            @PageableDefault(size = 20, sort = "createdAt") Pageable pageable) {
        return dangerCommandService.search(systemType, category, riskLevel, keyword, pageable);
    }

    /**
     * 增量同步接口：按创建时间拉取新增的危险指令。
     * createdAfter 传 ISO-8601 字符串（如 2026-03-17T00:00:00Z），为空则表示全量。
     */
    @GetMapping("/incremental")
    public Page<DangerCommand> incremental(
            @RequestParam(name = "createdAfter", required = false) String createdAfter,
            @PageableDefault(size = 10, sort = "createdAt") Pageable pageable
    ) {
        Instant instant = null;
        if (createdAfter != null && !createdAfter.isBlank()) {
            try {
                instant = Instant.parse(createdAfter);
            } catch (DateTimeParseException ignored) {
                // 非法格式直接视为 null，相当于全量
                instant = null;
            }
        }
        return dangerCommandService.incremental(instant, pageable);
    }

    /** 按 ID 查询单条（登录用户可见） */
    @GetMapping("/{id}")
    public ResponseEntity<DangerCommand> getById(@PathVariable Long id) {
        return dangerCommandService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** 新增危险指令（仅管理员） */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DangerCommand> create(@Valid @RequestBody DangerCommandDto dto) {
        DangerCommand entity = toEntity(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(dangerCommandService.create(entity));
    }

    /** 更新危险指令（仅管理员） */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DangerCommand> update(@PathVariable Long id, @Valid @RequestBody DangerCommandDto dto) {
        DangerCommand entity = toEntity(dto);
        return dangerCommandService.update(id, entity)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** 删除危险指令（仅管理员） */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        return dangerCommandService.deleteById(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }

    private static DangerCommand toEntity(DangerCommandDto dto) {
        DangerCommand c = new DangerCommand();
        c.setCommandPattern(dto.commandPattern());
        c.setSystemType(dto.systemType());
        c.setCategory(dto.category());
        c.setRiskLevel(dto.riskLevel());
        c.setTitle(dto.title());
        c.setDescription(dto.description());
        c.setMitigation(dto.mitigation());
        c.setTags(dto.tags());
        c.setEnabled(Boolean.TRUE.equals(dto.enabled()));
        return c;
    }

    public record DangerCommandDto(
            @NotBlank String commandPattern,
            @NotNull SystemType systemType,
            @NotNull DangerCategory category,
            @NotNull RiskLevel riskLevel,
            @NotBlank String title,
            String description,
            String mitigation,
            String tags,
            Boolean enabled
    ) {
        public DangerCommandDto {
            if (enabled == null) enabled = true;
        }
    }
}
