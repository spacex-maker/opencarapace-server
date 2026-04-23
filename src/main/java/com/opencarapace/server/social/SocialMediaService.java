package com.opencarapace.server.social;

import com.opencarapace.server.social.SocialMediaDtos.SocialMediaItemDto;
import com.opencarapace.server.social.SocialMediaDtos.UpsertSocialMediaRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SocialMediaService {

    private final SocialMediaLinkRepository repository;

    @Transactional(readOnly = true)
    public List<SocialMediaItemDto> listAllForAdmin() {
        return repository.findAll().stream()
                .sorted(Comparator.comparing(SocialMediaLink::getSortOrder).thenComparing(SocialMediaLink::getId))
                .map(this::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SocialMediaItemDto> listEnabledForPublic() {
        return repository.findAllByEnabledTrueOrderBySortOrderAscIdAsc().stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public SocialMediaItemDto create(UpsertSocialMediaRequest req) {
        SocialMediaLink row = new SocialMediaLink();
        apply(row, req);
        repository.save(row);
        return toDto(row);
    }

    @Transactional
    public SocialMediaItemDto update(long id, UpsertSocialMediaRequest req) {
        SocialMediaLink row = repository.findById(id).orElseThrow(() -> new IllegalArgumentException("社媒配置不存在"));
        apply(row, req);
        repository.save(row);
        return toDto(row);
    }

    @Transactional
    public void delete(long id) {
        if (!repository.existsById(id)) {
            throw new IllegalArgumentException("社媒配置不存在");
        }
        repository.deleteById(id);
    }

    private void apply(SocialMediaLink row, UpsertSocialMediaRequest req) {
        String url = req.url().trim();
        if (!(url.startsWith("http://") || url.startsWith("https://"))) {
            throw new IllegalArgumentException("URL 必须以 http:// 或 https:// 开头");
        }
        row.setName(req.name().trim());
        row.setIconKey(req.iconKey().trim().toLowerCase());
        row.setUrl(url);
        row.setEnabled(req.enabled());
        row.setShowQrCode(req.showQrCode());
        row.setSortOrder(Math.max(0, req.sortOrder()));
    }

    private SocialMediaItemDto toDto(SocialMediaLink row) {
        return new SocialMediaItemDto(
                row.getId(),
                row.getName(),
                row.getIconKey(),
                row.getUrl(),
                row.isEnabled(),
                row.isShowQrCode(),
                row.getSortOrder(),
                row.getCreatedAt(),
                row.getUpdatedAt()
        );
    }
}
