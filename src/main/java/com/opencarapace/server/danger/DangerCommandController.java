package com.opencarapace.server.danger;

import com.opencarapace.server.danger.DangerCommand.DangerCategory;
import com.opencarapace.server.danger.DangerCommand.RiskLevel;
import com.opencarapace.server.danger.DangerCommand.SystemType;
import com.opencarapace.server.user.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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
    private final UserDangerCommandRepository userDangerCommandRepository;
    private final UserRepository userRepository;

    public record DangerCommandViewDto(
            Long id,
            String commandPattern,
            String systemType,
            String category,
            String riskLevel,
            String title,
            String description,
            String mitigation,
            String tags,
            boolean enabled,
            /**
             * 用户级启用状态：
             * true/false = 用户有显式配置；null = 未配置（默认启用）
             */
            Boolean userEnabled
    ) {
        static DangerCommandViewDto from(DangerCommand d, Boolean userEnabled) {
            return new DangerCommandViewDto(
                    d.getId(),
                    d.getCommandPattern(),
                    d.getSystemType().name(),
                    d.getCategory().name(),
                    d.getRiskLevel().name(),
                    d.getTitle(),
                    d.getDescription(),
                    d.getMitigation(),
                    d.getTags(),
                    d.isEnabled(),
                    userEnabled
            );
        }
    }

    /** 获取危险指令库元数据（枚举定义） */
    @GetMapping("/meta")
    public ResponseEntity<Map<String, List<String>>> getMeta() {
        Map<String, List<String>> meta = new HashMap<>();
        meta.put("systemTypes", List.of(
                SystemType.LINUX.name(),
                SystemType.WINDOWS.name(),
                SystemType.DATABASE.name(),
                SystemType.SHELL.name(),
                SystemType.DOCKER.name(),
                SystemType.KUBERNETES.name(),
                SystemType.GIT.name(),
                SystemType.OTHER.name()
        ));
        meta.put("categories", List.of(
                DangerCategory.FILE_SYSTEM.name(),
                DangerCategory.DATABASE.name(),
                DangerCategory.NETWORK.name(),
                DangerCategory.PROCESS.name(),
                DangerCategory.PERMISSION.name(),
                DangerCategory.CONTAINER.name(),
                DangerCategory.VERSION_CONTROL.name(),
                DangerCategory.OTHER.name()
        ));
        meta.put("riskLevels", List.of(
                RiskLevel.CRITICAL.name(),
                RiskLevel.HIGH.name(),
                RiskLevel.MEDIUM.name(),
                RiskLevel.LOW.name()
        ));
        return ResponseEntity.ok(meta);
    }

    /** 分页查询，支持按系统类型、分类、风险等级、关键词 + 用户级启用状态筛选（登录用户可见） */
    @GetMapping
    public Page<DangerCommandViewDto> search(
            @RequestParam(name = "systemType", required = false) SystemType systemType,
            @RequestParam(name = "category", required = false) DangerCategory category,
            @RequestParam(name = "riskLevel", required = false) RiskLevel riskLevel,
            @RequestParam(name = "keyword", required = false) String keyword,
            @RequestParam(name = "userEnabled", required = false) String userEnabled,
            @PageableDefault(size = 20, sort = "createdAt") Pageable pageable) {
        Page<DangerCommand> page = dangerCommandService.search(systemType, category, riskLevel, keyword, pageable);

        Long userId = getCurrentUserId();
        Map<Long, Boolean> userMap = new HashMap<>();
        if (userId != null) {
            List<UserDangerCommand> list = userDangerCommandRepository.findByUserId(userId);
            for (UserDangerCommand udc : list) {
                if (udc.getDangerCommand() != null) {
                    userMap.put(udc.getDangerCommand().getId(), udc.isEnabled());
                }
            }
        }
        String ueFilter = (userEnabled == null || userEnabled.isBlank()) ? null : userEnabled;

        List<DangerCommandViewDto> dtos = page.getContent().stream()
                .map(d -> {
                    Boolean ue = userMap.get(d.getId());
                    return DangerCommandViewDto.from(d, ue);
                })
                .filter(dto -> {
                    if (ueFilter == null) return true;
                    Boolean ue = dto.userEnabled();
                    if ("ENABLED".equalsIgnoreCase(ueFilter)) {
                        // 启用：显式启用或未配置（默认启用）
                        return ue == null || ue;
                    }
                    if ("DISABLED".equalsIgnoreCase(ueFilter)) {
                        // 禁用：仅显式禁用
                        return Boolean.FALSE.equals(ue);
                    }
                    return true;
                })
                .toList();

        return new PageImpl<>(dtos, pageable, page.getTotalElements());
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
    public ResponseEntity<DangerCommandViewDto> getById(@PathVariable("id") Long id) {
        Long userId = getCurrentUserId();
        Map<Long, Boolean> userMap = new HashMap<>();
        if (userId != null) {
            List<UserDangerCommand> list = userDangerCommandRepository.findByUserId(userId);
            for (UserDangerCommand udc : list) {
                if (udc.getDangerCommand() != null) {
                    userMap.put(udc.getDangerCommand().getId(), udc.isEnabled());
                }
            }
        }
        return dangerCommandService.findById(id)
                .map(d -> DangerCommandViewDto.from(d, userMap.get(d.getId())))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    private Long getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            return null;
        }
        try {
            return Long.parseLong(auth.getName());
        } catch (NumberFormatException ex) {
            return null;
        }
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
    public ResponseEntity<DangerCommand> update(@PathVariable("id") Long id, @Valid @RequestBody DangerCommandDto dto) {
        DangerCommand entity = toEntity(dto);
        return dangerCommandService.update(id, entity)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** 删除危险指令（仅管理员） */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable("id") Long id) {
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
