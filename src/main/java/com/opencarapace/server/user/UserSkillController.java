package com.opencarapace.server.user;

import com.opencarapace.server.skill.Skill;
import com.opencarapace.server.skill.SkillRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 用户技能偏好（启用/禁用）配置接口。
 * - 普通登录用户可读写自己的配置
 * - 列表 /api/user-skills/me 供本地客户端等使用
 */
@RestController
@RequestMapping("/api/user-skills")
public class UserSkillController {

    private final UserSkillRepository userSkillRepository;
    private final UserSkillSafetyLabelRepository userSkillSafetyLabelRepository;
    private final UserRepository userRepository;
    private final SkillRepository skillRepository;

    public UserSkillController(UserSkillRepository userSkillRepository,
                               UserSkillSafetyLabelRepository userSkillSafetyLabelRepository,
                               UserRepository userRepository,
                               SkillRepository skillRepository) {
        this.userSkillRepository = userSkillRepository;
        this.userSkillSafetyLabelRepository = userSkillSafetyLabelRepository;
        this.userRepository = userRepository;
        this.skillRepository = skillRepository;
    }

    public record UserSkillDto(
            String slug,
            boolean enabled
    ) {
        static UserSkillDto fromEntity(UserSkill us) {
            return new UserSkillDto(us.getSkillSlug(), us.isEnabled());
        }
    }

    public record UserSkillSafetyLabelDto(
            String slug,
            String label
    ) {
        static UserSkillSafetyLabelDto fromEntity(UserSkillSafetyLabel l) {
            return new UserSkillSafetyLabelDto(l.getSkillSlug(), l.getLabel());
        }
    }

    /**
     * 当前登录用户的全部技能偏好列表。
     */
    @GetMapping("/me")
    @Transactional(readOnly = true)
    public ResponseEntity<List<UserSkillDto>> listMySkills() {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        List<UserSkill> list = userSkillRepository.findByUserId(user.getId());
        List<UserSkillDto> body = list.stream()
                .map(UserSkillDto::fromEntity)
                .toList();
        return ResponseEntity.ok(body);
    }

    /**
     * 设置当前用户对某个 skill 的启用状态（有则更新，无则创建）。
     */
    @PutMapping("/me/{slug}")
    @Transactional
    public ResponseEntity<UserSkillDto> upsertMySkill(@PathVariable("slug") String slug,
                                                      @RequestBody java.util.Map<String, Object> body) {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        Object enabledObj = body.get("enabled");
        if (!(enabledObj instanceof Boolean)) {
            return ResponseEntity.badRequest().build();
        }
        boolean enabled = (Boolean) enabledObj;

        UserSkill userSkill = userSkillRepository
                .findByUserIdAndSkillSlug(user.getId(), slug)
                .orElseGet(() -> {
                    UserSkill us = new UserSkill();
                    us.setUser(user);
                    us.setSkillSlug(slug);
                    return us;
                });
        userSkill.setEnabled(enabled);

        UserSkill saved = userSkillRepository.save(userSkill);
        
        user.setSettingsVersion(user.getSettingsVersion() + 1);
        userRepository.save(user);
        
        return ResponseEntity.ok(UserSkillDto.fromEntity(saved));
    }

    @GetMapping("/me/safety-labels")
    @Transactional(readOnly = true)
    public ResponseEntity<List<UserSkillSafetyLabelDto>> listMySafetyLabels() {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        List<UserSkillSafetyLabel> list = userSkillSafetyLabelRepository.findByUserId(user.getId());
        List<UserSkillSafetyLabelDto> body = list.stream()
                .map(UserSkillSafetyLabelDto::fromEntity)
                .toList();
        return ResponseEntity.ok(body);
    }

    @PutMapping("/me/{slug}/safety-label")
    @Transactional
    public ResponseEntity<UserSkillSafetyLabelDto> upsertMySafetyLabel(@PathVariable("slug") String slug,
                                                                        @RequestBody java.util.Map<String, Object> body) {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        Object labelObj = body.get("label");
        if (!(labelObj instanceof String)) {
            return ResponseEntity.badRequest().build();
        }
        String label = ((String) labelObj).trim().toUpperCase();
        if (!"SAFE".equals(label) && !"UNSAFE".equals(label)) {
            return ResponseEntity.badRequest().build();
        }

        Skill skill = skillRepository.findBySlug(slug).orElse(null);
        if (skill == null) {
            return ResponseEntity.notFound().build();
        }

        UserSkillSafetyLabel current = userSkillSafetyLabelRepository
                .findByUserIdAndSkillSlug(user.getId(), slug)
                .orElse(null);
        if (current != null && label.equals(current.getLabel())) {
            return ResponseEntity.ok(UserSkillSafetyLabelDto.fromEntity(current));
        }

        if (current == null) {
            current = new UserSkillSafetyLabel();
            current.setUser(user);
            current.setSkillSlug(slug);
            if ("SAFE".equals(label)) {
                skill.setSafeMarkCount((skill.getSafeMarkCount() == null ? 0L : skill.getSafeMarkCount()) + 1);
            } else {
                skill.setUnsafeMarkCount((skill.getUnsafeMarkCount() == null ? 0L : skill.getUnsafeMarkCount()) + 1);
            }
        } else {
            if ("SAFE".equals(current.getLabel())) {
                skill.setSafeMarkCount(Math.max(0L, (skill.getSafeMarkCount() == null ? 0L : skill.getSafeMarkCount()) - 1));
            } else if ("UNSAFE".equals(current.getLabel())) {
                skill.setUnsafeMarkCount(Math.max(0L, (skill.getUnsafeMarkCount() == null ? 0L : skill.getUnsafeMarkCount()) - 1));
            }
            if ("SAFE".equals(label)) {
                skill.setSafeMarkCount((skill.getSafeMarkCount() == null ? 0L : skill.getSafeMarkCount()) + 1);
            } else {
                skill.setUnsafeMarkCount((skill.getUnsafeMarkCount() == null ? 0L : skill.getUnsafeMarkCount()) + 1);
            }
        }

        current.setLabel(label);
        UserSkillSafetyLabel saved = userSkillSafetyLabelRepository.save(current);
        skillRepository.save(skill);

        user.setSettingsVersion(user.getSettingsVersion() + 1);
        userRepository.save(user);

        return ResponseEntity.ok(UserSkillSafetyLabelDto.fromEntity(saved));
    }

    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            return null;
        }
        try {
            Long userId = Long.parseLong(auth.getName());
            return userRepository.findById(userId).orElse(null);
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}

