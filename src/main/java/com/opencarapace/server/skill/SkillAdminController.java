package com.opencarapace.server.skill;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/skills")
public class SkillAdminController {

    private final SkillSyncService skillSyncService;
    private final SkillRepository skillRepository;

    public SkillAdminController(SkillSyncService skillSyncService, SkillRepository skillRepository) {
        this.skillSyncService = skillSyncService;
        this.skillRepository = skillRepository;
    }

    /**
     * 手动触发从 ClawHub 公开 API 同步技能（无需安装 CLI，全自动）。
     */
    @PostMapping("/sync/clawhub")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> syncFromClawhub() {
        int count = skillSyncService.syncFromClawhubApi();
        return ResponseEntity.ok(Map.of(
                "source", "CLAWHUB",
                "synced", count
        ));
    }

    /**
     * 使用 Convex 分页接口做全量同步（仅管理员手动触发），不影响原有搜索方案。
     */
    @PostMapping("/sync/clawhub-full")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> syncFromClawhubFull() {
        int count = skillSyncService.syncFromConvexFull();
        return ResponseEntity.ok(Map.of(
                "source", "CLAWHUB_CONVEX",
                "synced", count
        ));
    }

    /**
     * 管理员可对已同步技能的基础字段做适度调整（不改动 externalId / slug / manifest 等关键字段）。
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Skill> update(@PathVariable Long id, @RequestBody UpdateSkillRequest req) {
        return skillRepository.findById(id)
                .map(skill -> {
                    if (req.name() != null) skill.setName(req.name());
                    if (req.status() != null) skill.setStatus(req.status());
                    if (req.shortDesc() != null) skill.setShortDesc(req.shortDesc());
                    if (req.tags() != null) skill.setTags(req.tags());
                    if (req.homepageUrl() != null) skill.setHomepageUrl(req.homepageUrl());
                    if (req.installHint() != null) skill.setInstallHint(req.installHint());
                    if (req.category() != null) skill.setCategory(req.category());
                    if (req.type() != null) skill.setType(req.type());
                    return ResponseEntity.ok(skillRepository.save(skill));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    public record UpdateSkillRequest(
            String name,
            String status,
            String shortDesc,
            String tags,
            String homepageUrl,
            String installHint,
            String category,
            String type
    ) {}
}

