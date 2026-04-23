package com.opencarapace.server.social;

import com.opencarapace.server.social.SocialMediaDtos.SocialMediaItemDto;
import com.opencarapace.server.social.SocialMediaDtos.UpsertSocialMediaRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/social-media")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminSocialMediaController {

    private final SocialMediaService socialMediaService;

    @GetMapping
    public List<SocialMediaItemDto> list() {
        return socialMediaService.listAllForAdmin();
    }

    @PostMapping
    public ResponseEntity<SocialMediaItemDto> create(@Valid @RequestBody UpsertSocialMediaRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(socialMediaService.create(body));
    }

    @PutMapping("/{id}")
    public SocialMediaItemDto update(@PathVariable("id") long id, @Valid @RequestBody UpsertSocialMediaRequest body) {
        return socialMediaService.update(id, body);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable("id") long id) {
        socialMediaService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
