package com.opencarapace.server.danger;

import com.opencarapace.server.user.User;
import com.opencarapace.server.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 用户级危险指令配置（启用/禁用）。
 * - 普通登录用户可以管理自己账号下的危险指令可用性。
 */
@RestController
@RequestMapping("/api/user-danger-commands")
public class UserDangerCommandController {

    private final UserDangerCommandRepository userDangerCommandRepository;
    private final UserRepository userRepository;
    private final DangerCommandRepository dangerCommandRepository;

    public UserDangerCommandController(UserDangerCommandRepository userDangerCommandRepository,
                                       UserRepository userRepository,
                                       DangerCommandRepository dangerCommandRepository) {
        this.userDangerCommandRepository = userDangerCommandRepository;
        this.userRepository = userRepository;
        this.dangerCommandRepository = dangerCommandRepository;
    }

    public record UserDangerCommandDto(Long dangerCommandId, boolean enabled) {
        static UserDangerCommandDto fromEntity(UserDangerCommand e) {
            return new UserDangerCommandDto(
                    e.getDangerCommand() != null ? e.getDangerCommand().getId() : null,
                    e.isEnabled()
            );
        }
    }

    @GetMapping("/me")
    @Transactional(readOnly = true)
    public ResponseEntity<List<UserDangerCommandDto>> listMy(@RequestParam(name = "onlyDisabled", required = false) Boolean onlyDisabled) {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        List<UserDangerCommand> list = userDangerCommandRepository.findByUserId(user.getId());
        boolean filterDisabled = Boolean.TRUE.equals(onlyDisabled);
        List<UserDangerCommandDto> body = list.stream()
                .filter(e -> !filterDisabled || !e.isEnabled())
                .map(UserDangerCommandDto::fromEntity)
                .toList();
        return ResponseEntity.ok(body);
    }

    @PutMapping("/me/{id}")
    @Transactional
    public ResponseEntity<UserDangerCommandDto> upsertMy(@PathVariable("id") Long dangerCommandId,
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

        DangerCommand danger = dangerCommandRepository.findById(dangerCommandId).orElse(null);
        if (danger == null) {
            return ResponseEntity.notFound().build();
        }

        UserDangerCommand entity = userDangerCommandRepository
                .findByUserIdAndDangerCommandId(user.getId(), dangerCommandId)
                .orElseGet(() -> {
                    UserDangerCommand e = new UserDangerCommand();
                    e.setUser(user);
                    e.setDangerCommand(danger);
                    return e;
                });
        entity.setEnabled(enabled);

        UserDangerCommand saved = userDangerCommandRepository.save(entity);
        
        user.setSettingsVersion(user.getSettingsVersion() + 1);
        userRepository.save(user);
        
        return ResponseEntity.ok(UserDangerCommandDto.fromEntity(saved));
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

