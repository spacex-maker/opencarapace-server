package com.opencarapace.server.user;

import com.opencarapace.server.user.AdminUserDtos.AdminUserPageResponse;
import com.opencarapace.server.user.AdminUserDtos.AdminUserRowDto;
import com.opencarapace.server.user.AdminUserDtos.CreateAdminUserRequest;
import com.opencarapace.server.user.AdminUserDtos.ResetPasswordRequest;
import com.opencarapace.server.user.AdminUserDtos.SetDisabledRequest;
import com.opencarapace.server.user.AdminUserDtos.SetRoleRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final AdminUserService adminUserService;
    private final UserService userService;

    @GetMapping
    public AdminUserPageResponse list(
            @RequestParam(name = "page", required = false, defaultValue = "1") int page,
            @RequestParam(name = "size", required = false, defaultValue = "20") int size,
            @RequestParam(name = "email", required = false) String email,
            @RequestParam(name = "role", required = false) String role,
            @RequestParam(name = "disabled", required = false) Boolean disabled
    ) {
        Page<AdminUserRowDto> pg = adminUserService.list(page, size, email, role, disabled);
        return new AdminUserPageResponse(pg.getNumber() + 1, pg.getSize(), pg.getTotalElements(), pg.getContent());
    }

    @PostMapping
    public ResponseEntity<AdminUserRowDto> create(@Valid @RequestBody CreateAdminUserRequest body) {
        AdminUserRowDto row = adminUserService.create(body);
        return ResponseEntity.status(HttpStatus.CREATED).body(row);
    }

    @PatchMapping("/{id}/disabled")
    public AdminUserRowDto setDisabled(@PathVariable("id") long id, @RequestBody SetDisabledRequest body) {
        long adminId = userService.getCurrentUserId().orElseThrow();
        return adminUserService.setDisabled(adminId, id, body.disabled());
    }

    @PatchMapping("/{id}/role")
    public AdminUserRowDto setRole(@PathVariable("id") long id, @Valid @RequestBody SetRoleRequest body) {
        long adminId = userService.getCurrentUserId().orElseThrow();
        return adminUserService.setRole(adminId, id, body.role());
    }

    @PostMapping("/{id}/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(@PathVariable("id") long id, @Valid @RequestBody ResetPasswordRequest body) {
        adminUserService.resetPassword(id, body.newPassword());
    }
}
