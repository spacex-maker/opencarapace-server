package com.opencarapace.server.skill;

import com.opencarapace.server.user.UserSkill;
import com.opencarapace.server.user.UserSkillSafetyLabel;
import com.opencarapace.server.user.UserSkillSafetyLabelRepository;
import com.opencarapace.server.user.UserSkillRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.format.DateTimeParseException;

/**
 * 已同步技能的只读查询接口：所有登录用户可见。
 */
@RestController
@RequestMapping("/api/skills")
public class SkillController {

    private final SkillRepository skillRepository;
    private final UserSkillRepository userSkillRepository;
    private final UserSkillSafetyLabelRepository userSkillSafetyLabelRepository;

    public SkillController(SkillRepository skillRepository,
                           UserSkillRepository userSkillRepository,
                           UserSkillSafetyLabelRepository userSkillSafetyLabelRepository) {
        this.skillRepository = skillRepository;
        this.userSkillRepository = userSkillRepository;
        this.userSkillSafetyLabelRepository = userSkillSafetyLabelRepository;
    }

    public record SkillDto(
            Long id,
            String name,
            String slug,
            String type,
            String category,
            String status,
            String shortDesc,
            String tags,
            String homepageUrl,
            String installHint,
            String sourceName,
            String version,
            String lastSyncAt,
            String createdAt,
            String updatedAt,
            Long safeMarkCount,
            Long unsafeMarkCount,
            String userSafetyLabel,
            /**
             * 当前登录用户是否启用该 skill：
             * - true/false：有显式用户配置
             * - null：没有用户配置（前端可理解为“默认启用”）
             */
            Boolean userEnabled
    ) {
        static SkillDto fromEntity(Skill s, Boolean userEnabled, String userSafetyLabel) {
            String sourceName = null;
            if (s.getSource() != null) {
                sourceName = s.getSource().getName();
            }
            return new SkillDto(
                    s.getId(),
                    s.getName(),
                    s.getSlug(),
                    s.getType(),
                    s.getCategory(),
                    s.getStatus(),
                    s.getShortDesc(),
                    s.getTags(),
                    s.getHomepageUrl(),
                    s.getInstallHint(),
                    sourceName,
                    s.getVersion(),
                    s.getLastSyncAt() != null ? s.getLastSyncAt().toString() : null,
                    s.getCreatedAt() != null ? s.getCreatedAt().toString() : null,
                    s.getUpdatedAt() != null ? s.getUpdatedAt().toString() : null,
                    s.getSafeMarkCount() != null ? s.getSafeMarkCount() : 0L,
                    s.getUnsafeMarkCount() != null ? s.getUnsafeMarkCount() : 0L,
                    userSafetyLabel,
                    userEnabled
            );
        }
    }

    public record MergedSkillDto(
            Long id,
            String name,
            String slug,
            String type,
            String category,
            String status,
            String shortDesc,
            String tags,
            String homepageUrl,
            String installHint,
            String sourceName,
            String version,
            Long safeMarkCount,
            Long unsafeMarkCount,
            String userSafetyLabel,
            Boolean userEnabled
    ) {
        static MergedSkillDto from(Skill s, Boolean userEnabled, String userSafetyLabel) {
            String sourceName = null;
            if (s.getSource() != null) {
                sourceName = s.getSource().getName();
            }
            return new MergedSkillDto(
                    s.getId(),
                    s.getName(),
                    s.getSlug(),
                    s.getType(),
                    s.getCategory(),
                    s.getStatus(),
                    s.getShortDesc(),
                    s.getTags(),
                    s.getHomepageUrl(),
                    s.getInstallHint(),
                    sourceName,
                    s.getVersion(),
                    s.getSafeMarkCount() != null ? s.getSafeMarkCount() : 0L,
                    s.getUnsafeMarkCount() != null ? s.getUnsafeMarkCount() : 0L,
                    userSafetyLabel,
                    userEnabled
            );
        }
    }

    @GetMapping
    @Transactional(readOnly = true)
    public Page<SkillDto> list(
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "type", required = false) String type,
            @RequestParam(name = "category", required = false) String category,
            @RequestParam(name = "keyword", required = false) String keyword,
            @RequestParam(name = "userEnabled", required = false) String userEnabled,
            @PageableDefault(size = 20, sort = "name") Pageable pageable
    ) {
        Long userId = getCurrentUserId();
        java.util.Map<String, Boolean> userMap = java.util.Collections.emptyMap();
        if (userId != null) {
            java.util.List<UserSkill> list = userSkillRepository.findByUserId(userId);
            userMap = new java.util.HashMap<>();
            for (UserSkill us : list) {
                userMap.put(us.getSkillSlug(), us.isEnabled());
            }
        }
        java.util.Map<String, Boolean> finalUserMap = userMap;
        java.util.Map<String, String> userSafetyLabelMap = java.util.Collections.emptyMap();
        if (userId != null) {
            java.util.List<UserSkillSafetyLabel> labels = userSkillSafetyLabelRepository.findByUserId(userId);
            userSafetyLabelMap = new java.util.HashMap<>();
            for (UserSkillSafetyLabel label : labels) {
                userSafetyLabelMap.put(label.getSkillSlug(), label.getLabel());
            }
        }
        java.util.Map<String, String> finalUserSafetyLabelMap = userSafetyLabelMap;

        String normalizedStatus = (status == null || status.isBlank()) ? null : status;
        String normalizedType = (type == null || type.isBlank()) ? null : type;
        String normalizedCategory = (category == null || category.isBlank()) ? null : category;
        String normalizedKeyword = (keyword == null || keyword.isBlank()) ? null : keyword;
        String ueFilter = (userEnabled == null || userEnabled.isBlank()) ? null : userEnabled;

        Page<Skill> page = skillRepository.search(normalizedStatus, normalizedType, normalizedCategory, normalizedKeyword, pageable);
        java.util.List<SkillDto> dtos = page.getContent().stream()
                .map(s -> {
                    Boolean ue = finalUserMap.get(s.getSlug());
                    String label = finalUserSafetyLabelMap.get(s.getSlug());
                    return SkillDto.fromEntity(s, ue, label);
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
     * 返回“官方 skills + 当前登录用户偏好”的合并视图。
     * - status 直接来自 oc_skills.status
     * - userEnabled 为 null 表示该 skill 未配置用户级偏好（客户端可理解为“默认启用”）
     */
    @GetMapping("/merged")
    @Transactional(readOnly = true)
    public Page<MergedSkillDto> merged(@PageableDefault(size = 50, sort = "name") Pageable pageable) {
        Long userId = getCurrentUserId();
        java.util.Map<String, Boolean> userMap = java.util.Collections.emptyMap();
        if (userId != null) {
            java.util.List<UserSkill> list = userSkillRepository.findByUserId(userId);
            userMap = new java.util.HashMap<>();
            for (UserSkill us : list) {
                userMap.put(us.getSkillSlug(), us.isEnabled());
            }
        }
        java.util.Map<String, Boolean> finalUserMap = userMap;
        java.util.Map<String, String> userSafetyLabelMap = java.util.Collections.emptyMap();
        if (userId != null) {
            java.util.List<UserSkillSafetyLabel> labels = userSkillSafetyLabelRepository.findByUserId(userId);
            userSafetyLabelMap = new java.util.HashMap<>();
            for (UserSkillSafetyLabel label : labels) {
                userSafetyLabelMap.put(label.getSkillSlug(), label.getLabel());
            }
        }
        java.util.Map<String, String> finalUserSafetyLabelMap = userSafetyLabelMap;
        return skillRepository.findAll(pageable)
                .map(s -> {
                    Boolean ue = finalUserMap.get(s.getSlug());
                    String label = finalUserSafetyLabelMap.get(s.getSlug());
                    return MergedSkillDto.from(s, ue, label);
                });
    }

    /**
     * 增量版本：按 updatedAt 拉取合并视图。
     * updatedAfter 为空时等价于全量。
     */
    @GetMapping("/merged/incremental")
    @Transactional(readOnly = true)
    public Page<MergedSkillDto> mergedIncremental(
            @RequestParam(name = "updatedAfter", required = false) String updatedAfter,
            @PageableDefault(size = 50, sort = "updatedAt") Pageable pageable
    ) {
        Long userId = getCurrentUserId();
        java.util.Map<String, Boolean> userMap = java.util.Collections.emptyMap();
        if (userId != null) {
            java.util.List<UserSkill> list = userSkillRepository.findByUserId(userId);
            userMap = new java.util.HashMap<>();
            for (UserSkill us : list) {
                userMap.put(us.getSkillSlug(), us.isEnabled());
            }
        }
        java.util.Map<String, Boolean> finalUserMap = userMap;
        java.util.Map<String, String> userSafetyLabelMap = java.util.Collections.emptyMap();
        if (userId != null) {
            java.util.List<UserSkillSafetyLabel> labels = userSkillSafetyLabelRepository.findByUserId(userId);
            userSafetyLabelMap = new java.util.HashMap<>();
            for (UserSkillSafetyLabel label : labels) {
                userSafetyLabelMap.put(label.getSkillSlug(), label.getLabel());
            }
        }
        java.util.Map<String, String> finalUserSafetyLabelMap = userSafetyLabelMap;

        Instant instant = null;
        if (updatedAfter != null && !updatedAfter.isBlank()) {
            try {
                instant = Instant.parse(updatedAfter);
            } catch (DateTimeParseException ignored) {
                instant = null;
            }
        }

        Page<Skill> page;
        if (instant == null) {
            page = skillRepository.findAll(pageable);
        } else {
            page = skillRepository.findByUpdatedAtAfterOrderByUpdatedAtAsc(instant, pageable);
        }

        return page.map(s -> {
            Boolean ue = finalUserMap.get(s.getSlug());
            String label = finalUserSafetyLabelMap.get(s.getSlug());
            return MergedSkillDto.from(s, ue, label);
        });
    }

    /**
     * 返回当前系统中所有被禁用的技能 slug 列表（status = DISABLED）。
     */
    @GetMapping("/disabled-slugs")
    @Transactional(readOnly = true)
    public java.util.List<String> disabledSlugs() {
        return skillRepository.findSlugsByStatus("DISABLED");
    }

    /**
     * 返回当前系统中所有不推荐使用的技能 slug 列表（status = DEPRECATED）。
     */
    @GetMapping("/deprecated-slugs")
    @Transactional(readOnly = true)
    public java.util.List<String> deprecatedSlugs() {
        return skillRepository.findSlugsByStatus("DEPRECATED");
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<SkillDto> getById(@PathVariable("id") Long id) {
        Long userId = getCurrentUserId();
        java.util.Map<String, Boolean> userMap = java.util.Collections.emptyMap();
        if (userId != null) {
            java.util.List<UserSkill> list = userSkillRepository.findByUserId(userId);
            userMap = new java.util.HashMap<>();
            for (UserSkill us : list) {
                userMap.put(us.getSkillSlug(), us.isEnabled());
            }
        }
        java.util.Map<String, Boolean> finalUserMap = userMap;
        java.util.Map<String, String> userSafetyLabelMap = java.util.Collections.emptyMap();
        if (userId != null) {
            java.util.List<UserSkillSafetyLabel> labels = userSkillSafetyLabelRepository.findByUserId(userId);
            userSafetyLabelMap = new java.util.HashMap<>();
            for (UserSkillSafetyLabel label : labels) {
                userSafetyLabelMap.put(label.getSkillSlug(), label.getLabel());
            }
        }
        java.util.Map<String, String> finalUserSafetyLabelMap = userSafetyLabelMap;

        return skillRepository.findById(id)
                .map(s -> SkillDto.fromEntity(s, finalUserMap.get(s.getSlug()), finalUserSafetyLabelMap.get(s.getSlug())))
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
}

