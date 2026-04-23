package com.opencarapace.server.social;

import com.opencarapace.server.social.SocialMediaDtos.SocialMediaItemDto;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/public/social-media")
@RequiredArgsConstructor
public class PublicSocialMediaController {

    private final SocialMediaService socialMediaService;

    @GetMapping
    public List<SocialMediaItemDto> list() {
        return socialMediaService.listEnabledForPublic();
    }
}
