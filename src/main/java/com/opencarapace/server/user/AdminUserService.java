package com.opencarapace.server.user;

import com.opencarapace.server.user.AdminUserDtos.AdminUserRowDto;
import com.opencarapace.server.user.AdminUserDtos.CreateAdminUserRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminUserService {

    private static final String ROLE_ADMIN = "ADMIN";
    private static final String ROLE_USER = "USER";
    private static final String PROVIDER_LOCAL = "local";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public Page<AdminUserRowDto> list(int page, int size, String email, String role, Boolean disabled) {
        int p = Math.max(page, 1);
        int s = Math.min(Math.max(size, 1), 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.DESC, "id"));
        Specification<User> spec = UserAdminSpecifications.filter(email, role, disabled);
        return userRepository.findAll(spec, pageable).map(this::toRow);
    }

    @Transactional
    public AdminUserRowDto create(CreateAdminUserRequest req) {
        String em = req.email().trim().toLowerCase();
        if (userRepository.findByEmail(em).isPresent()) {
            throw new IllegalArgumentException("该邮箱已存在");
        }
        String role = normalizeRole(req.role());
        User u = new User();
        u.setEmail(em);
        u.setPasswordHash(passwordEncoder.encode(req.password()));
        u.setDisplayName(req.displayName() != null && !req.displayName().isBlank() ? req.displayName().trim() : em);
        u.setProvider(PROVIDER_LOCAL);
        u.setProviderId(em);
        u.setRole(role);
        u.setDisabled(false);
        userRepository.save(u);
        return toRow(u);
    }

    @Transactional
    public AdminUserRowDto setDisabled(long adminUserId, long targetId, boolean disabled) {
        if (adminUserId == targetId && disabled) {
            throw new IllegalArgumentException("不能禁用当前登录的管理员账号");
        }
        User u = userRepository.findById(targetId).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        if (ROLE_ADMIN.equals(u.getRole()) && disabled) {
            if (userRepository.countByRoleAndDisabledIsFalse(ROLE_ADMIN) <= 1) {
                throw new IllegalArgumentException("不能禁用最后一个可用管理员");
            }
        }
        u.setDisabled(disabled);
        return toRow(userRepository.save(u));
    }

    @Transactional
    public AdminUserRowDto setRole(long adminUserId, long targetId, String role) {
        String nr = normalizeRole(role);
        User u = userRepository.findById(targetId).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        if (adminUserId == targetId && ROLE_ADMIN.equals(u.getRole()) && ROLE_USER.equals(nr)) {
            if (userRepository.countByRoleAndDisabledIsFalse(ROLE_ADMIN) <= 1) {
                throw new IllegalArgumentException("不能将最后一个可用管理员降为普通用户");
            }
        }
        u.setRole(nr);
        return toRow(userRepository.save(u));
    }

    @Transactional
    public void resetPassword(long targetId, String newPassword) {
        if (newPassword == null || newPassword.length() < 6) {
            throw new IllegalArgumentException("密码至少 6 位");
        }
        if (newPassword.length() > 100) {
            throw new IllegalArgumentException("密码过长");
        }
        User u = userRepository.findById(targetId).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        u.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(u);
    }

    private String normalizeRole(String r) {
        if (r == null || r.isBlank()) {
            return ROLE_USER;
        }
        String t = r.trim().toUpperCase();
        if (ROLE_ADMIN.equals(t) || ROLE_USER.equals(t)) {
            return t;
        }
        throw new IllegalArgumentException("角色只能是 USER 或 ADMIN");
    }

    private AdminUserRowDto toRow(User u) {
        return new AdminUserRowDto(
                u.getId(),
                u.getEmail(),
                u.getDisplayName(),
                u.getRole(),
                u.getProvider(),
                u.isDisabled(),
                u.getPasswordHash() != null,
                u.getCreatedAt()
        );
    }
}
