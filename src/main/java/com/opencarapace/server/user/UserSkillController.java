package com.opencarapace.server.user;

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
    private final UserRepository userRepository;

    public UserSkillController(UserSkillRepository userSkillRepository, UserRepository userRepository) {
        this.userSkillRepository = userSkillRepository;
        this.userRepository = userRepository;
    }

    public record UserSkillDto(
            String slug,
            boolean enabled
    ) {
        static UserSkillDto fromEntity(UserSkill us) {
            return new UserSkillDto(us.getSkillSlug(), us.isEnabled());
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
        return ResponseEntity.ok(UserSkillDto.fromEntity(saved));
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

