package com.opencarapace.server.llm;

import com.opencarapace.server.user.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/user-llm-mappings")
@RequiredArgsConstructor
public class UserLlmMappingController {

    private final UserLlmMappingRepository repository;
    private final UserRepository userRepository;

    @GetMapping("/me")
    public ResponseEntity<List<MappingDto>> myMappings() {
        Long userId = getCurrentUserId();
        List<UserLlmMapping> mappings = repository.findByUserId(userId);
        List<MappingDto> items = mappings.stream().map(m -> new MappingDto(
                m.getId(),
                m.getPrefix(),
                m.getTargetBase(),
                m.getCreatedAt() != null ? m.getCreatedAt().toString() : null
        )).toList();
        return ResponseEntity.ok(items);
    }

    @PostMapping("/me")
    public ResponseEntity<MappingDto> createOrUpdateMapping(@Valid @RequestBody UpsertRequest request) {
        Long userId = getCurrentUserId();
        var user = userRepository.findById(userId.longValue()).orElseThrow(() -> new IllegalStateException("User not found"));

        UserLlmMapping mapping = repository.findByUserIdAndPrefix(userId, request.prefix())
                .orElseGet(() -> {
                    UserLlmMapping m = new UserLlmMapping();
                    m.setUser(user);
                    m.setPrefix(request.prefix());
                    return m;
                });
        mapping.setTargetBase(request.targetBase());
        repository.save(mapping);

        return ResponseEntity.ok(new MappingDto(
                mapping.getId(),
                mapping.getPrefix(),
                mapping.getTargetBase(),
                mapping.getCreatedAt() != null ? mapping.getCreatedAt().toString() : null
        ));
    }

    @DeleteMapping("/me/{id}")
    public ResponseEntity<Void> deleteMapping(@PathVariable("id") Long id) {
        Long userId = getCurrentUserId();
        if (id == null) {
            return ResponseEntity.badRequest().build();
        }
        UserLlmMapping mapping = repository.findById(id).orElse(null);
        if (mapping == null || !mapping.getUser().getId().equals(userId)) {
            return ResponseEntity.notFound().build();
        }
        repository.delete(mapping);
        return ResponseEntity.ok().build();
    }

    private Long getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            throw new IllegalStateException("Missing authentication");
        }
        return Long.parseLong(auth.getName());
    }

    public record UpsertRequest(
            @NotBlank String prefix,
            @NotBlank String targetBase
    ) {}

    public record MappingDto(
            Long id,
            String prefix,
            String targetBase,
            String createdAt
    ) {}
}
