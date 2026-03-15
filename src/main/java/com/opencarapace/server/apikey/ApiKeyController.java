package com.opencarapace.server.apikey;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/api-keys")
public class ApiKeyController {

    private final ApiKeyService apiKeyService;

    public ApiKeyController(ApiKeyService apiKeyService) {
        this.apiKeyService = apiKeyService;
    }

    @PostMapping
    public ResponseEntity<CreateKeyResponse> createKey(@Valid @RequestBody CreateKeyRequest request) {
        ApiKeyService.ApiKeyWithPlainToken created = apiKeyService.createKey(request.label(), request.scopes());
        return ResponseEntity.ok(new CreateKeyResponse(created.apiKey().getId(), created.plainToken()));
    }

    @GetMapping
    public List<ApiKeyDto> listKeys() {
        return apiKeyService.listActiveKeys().stream()
                .map(ApiKeyDto::from)
                .toList();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> revoke(@PathVariable Long id) {
        apiKeyService.revokeKey(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ApiKeyDto> update(@PathVariable Long id, @RequestBody UpdateKeyRequest request) {
        ApiKey updated = apiKeyService.updateKey(id, request.label(), request.scopes());
        return ResponseEntity.ok(ApiKeyDto.from(updated));
    }

    public record CreateKeyRequest(@NotBlank String label, String scopes) {
    }

    public record UpdateKeyRequest(String label, String scopes) {
    }

    public record CreateKeyResponse(Long id, String apiKey) {
    }
}

