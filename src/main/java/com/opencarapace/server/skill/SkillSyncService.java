package com.opencarapace.server.skill;

import com.opencarapace.server.config.SystemDataVersionService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 从 ClawHub 同步技能到本地 oc_skills 表。
 * 使用 ClawHub 官方 HTTP API 自动分页拉取，无需在服务器安装 clawhub CLI 或手写导出脚本。
 */
@Service
@Slf4j
public class SkillSyncService {

    private static final String CLAWHUB_CODE = "CLAWHUB";
    private static final String CLAWHUB_UPDATED_SORT = "updated";
    private static final int MAX_PAGE_LIMIT = 180;
    private static final Duration DEFAULT_REQUEST_INTERVAL = Duration.ofSeconds(90);

    private final SkillSourceRepository sourceRepository;
    private final SkillRepository skillRepository;
    private final ClawhubApiClient clawhubApiClient;
    private final SystemDataVersionService systemDataVersionService;
    private final int pageLimit;
    private final Duration requestInterval;
    private final ClawhubSleeper sleeper;

    @Autowired
    public SkillSyncService(
            SkillSourceRepository sourceRepository,
            SkillRepository skillRepository,
            ClawhubApiClient clawhubApiClient,
            SystemDataVersionService systemDataVersionService,
            @Value("${claw.skills.clawhub-page-limit:${claw.skills.clawhub-search-limit-per-query:180}}") int searchLimitPerQuery
    ) {
        this(sourceRepository, skillRepository, clawhubApiClient, systemDataVersionService,
                searchLimitPerQuery, DEFAULT_REQUEST_INTERVAL, SkillSyncService::sleepCurrentThread);
    }

    SkillSyncService(
            SkillSourceRepository sourceRepository,
            SkillRepository skillRepository,
            ClawhubApiClient clawhubApiClient,
            SystemDataVersionService systemDataVersionService,
            int searchLimitPerQuery,
            Duration requestInterval,
            ClawhubSleeper sleeper
    ) {
        this.sourceRepository = sourceRepository;
        this.skillRepository = skillRepository;
        this.clawhubApiClient = clawhubApiClient;
        this.systemDataVersionService = systemDataVersionService;
        this.pageLimit = Math.max(1, Math.min(searchLimitPerQuery, MAX_PAGE_LIMIT));
        this.requestInterval = requestInterval;
        this.sleeper = sleeper;
    }

    /**
     * 通过 ClawHub 官方 v1 API 拉取并同步技能。
     * 按 updated 降序分页补充 / 更新技能，页内再做一次本地排序兜底；遇到已有记录的 ClawHub updatedAt 小于 last_sync_at 则停止。
     */
    public int syncFromClawhubApi() {
        SkillSource source = ensureSource();
        String cursor = null;
        int pageIndex = 0;
        int success = 0;
        int failed = 0;
        boolean stopAtUnchangedSkill = false;
        Set<String> processedSlugs = new HashSet<>();

        while (!stopAtUnchangedSkill) {
            pageIndex++;
            ClawhubSkillListResponse page = clawhubApiClient.listSkillsPage(cursor, pageLimit, CLAWHUB_UPDATED_SORT);
            List<ClawhubSkillListItem> items = page.getItems() == null ? List.of() : page.getItems();
            List<ClawhubSkillListItem> sortedItems = items.stream()
                    .filter(item -> item.getSlug() != null && !item.getSlug().isBlank())
                    .sorted(Comparator
                            .comparingLong(this::updatedAtEpochMillis)
                            .reversed()
                            .thenComparing(ClawhubSkillListItem::getSlug))
                    .toList();

            log.info("ClawHub v1 skills sync page {}: items={}, cursor={}, nextCursor={}",
                    pageIndex, sortedItems.size(), cursor, page.getNextCursor());

            for (ClawhubSkillListItem item : sortedItems) {
                String slug = item.getSlug().trim();
                if (!processedSlugs.add(slug)) {
                    continue;
                }
                var existing = skillRepository.findBySourceIdAndExternalId(source.getId(), slug);
                Instant clawhubUpdatedAt = toInstant(item.getUpdatedAt());
                if (existing.isPresent() && shouldStopAtExistingSkill(existing.get(), clawhubUpdatedAt)) {
                    stopAtUnchangedSkill = true;
                    log.info("ClawHub v1 skills sync stopped at synced slug={} clawhubUpdatedAt={} lastSyncAt={}",
                            slug, clawhubUpdatedAt, existing.get().getLastSyncAt());
                    break;
                }

                Skill skill = existing.orElseGet(() -> {
                    Skill s = new Skill();
                    s.setSource(source);
                    s.setExternalId(slug);
                    return s;
                });
                String preservedStatus = skill.getId() == null ? null : skill.getStatus();
                applyClawhubItem(skill, item, preservedStatus, Instant.now());
                try {
                    skillRepository.save(skill);
                    success++;
                    log.info("ClawHub v1 skill synced: slug={} name={}", slug, skill.getName());
                } catch (DataAccessException e) {
                    failed++;
                    log.error("ClawHub v1 skill sync FAILED: slug={} name={} - {}",
                            slug, skill.getName(), e.getMessage());
                }
            }

            String nextCursor = page.getNextCursor();
            if (stopAtUnchangedSkill || nextCursor == null || nextCursor.isBlank() || nextCursor.equals(cursor)) {
                break;
            }
            waitBeforeNextPage();
            cursor = nextCursor;
        }

        log.info("ClawHub v1 skills sync completed: success={}, failed={}, stoppedAtUnchanged={}",
                success, failed, stopAtUnchangedSkill);

        if (success > 0) {
            systemDataVersionService.incrementSkillsDataVersion();
            log.info("Skills data version incremented after ClawHub sync");
        }

        return success;
    }

    /**
     * 匿名 read 限流按 180/min per IP 处理；同步任务保守地每 90 秒请求一页。
     */
    private void waitBeforeNextPage() {
        long millis = requestInterval.toMillis();
        if (millis <= 0) {
            return;
        }
        log.info("ClawHub v1 skills sync waiting {} ms before next page request", millis);
        sleeper.sleep(millis);
    }

    /**
     * 将 ClawHub 列表项映射为本地技能基础字段。
     */
    private void applyClawhubItem(Skill skill, ClawhubSkillListItem item, String previousStatus, Instant syncWriteTime) {
        String slug = item.getSlug().trim();
        String displayName = nullToEmpty(item.getDisplayName(), slug);
        skill.setName(displayName);
        skill.setSlug(slug);
        skill.setType("SKILL");
        applySyncedSkillStatus(skill, previousStatus);
        skill.setShortDesc(item.getSummary());
        skill.setVersion(item.getLatestVersion() != null ? item.getLatestVersion().getVersion() : null);
        skill.setTags(tagsToText(item.getTags()));
        skill.setHomepageUrl("https://clawhub.ai/skills/" + slug);
        skill.setInstallHint("clawhub install " + slug);
        applyStats(skill, item.getStats());
        skill.setPublishedAt(toInstant(item.getCreatedAt()));
        skill.setLastSyncAt(lastSyncInstant(item, syncWriteTime));
    }

    /**
     * 使用 Convex skills:listPublicPageV4 做全量同步（分页 + 游标），不影响原有搜索方案。
     */
    public int syncFromConvexFull() {
        SkillSource source = ensureSource();
        String cursor = null;
        int pageIndex = 0;
        int success = 0;
        int failed = 0;

        do {
            pageIndex++;
            ConvexSkillsPage page = clawhubApiClient.listPublicPageV4(cursor, pageLimit);
            if (page == null || page.getValue() == null || page.getValue().getPage() == null) {
                log.warn("Convex full sync: empty page at index {}", pageIndex);
                break;
            }
            ConvexSkillsPage.ConvexValue value = page.getValue();
            log.info("Convex full sync: page {} - items={}, hasMore={}", pageIndex,
                    value.getPage().size(), value.isHasMore());

            Instant now = Instant.now();
            for (ConvexSkillsPage.ConvexSkillItem item : value.getPage()) {
                ConvexSkillsPage.ConvexSkill s = item.getSkill();
                if (s == null || s.getSlug() == null || s.getSlug().isBlank()) continue;
                String slug = s.getSlug();
                Skill skill = skillRepository
                        .findBySourceIdAndExternalId(source.getId(), slug)
                        .orElseGet(() -> {
                            Skill ns = new Skill();
                            ns.setSource(source);
                            ns.setExternalId(slug);
                            return ns;
                        });
                try {
                    String preservedStatus = skill.getId() == null ? null : skill.getStatus();
                    String displayName = nullToEmpty(s.getDisplayName(), slug);
                    skill.setName(displayName);
                    skill.setSlug(slug);
                    skill.setType("SKILL");
                    applySyncedSkillStatus(skill, preservedStatus);
                    skill.setShortDesc(s.getSummary());
                    skill.setLastSyncAt(now);
                    skillRepository.save(skill);
                    success++;
                    log.info("Convex full sync skill: slug={} name={}", slug, displayName);
                } catch (DataAccessException e) {
                    failed++;
                    log.error("Convex full sync FAILED: slug={} - {}", slug, e.getMessage());
                }
            }

            cursor = value.getNextCursor();
            if (!value.isHasMore()) {
                break;
            }
        } while (cursor != null);

        log.info("Convex skills full sync completed: success={}, failed={}", success, failed);
        return success;
    }

    /**
     * 确保存在 ClawHub 来源记录，避免并发插入导致锁等待。
     */
    private SkillSource ensureSource() {
        return sourceRepository.findByCode(CLAWHUB_CODE)
                .orElseGet(() -> {
                    try {
                        SkillSource s = new SkillSource();
                        s.setCode(CLAWHUB_CODE);
                        s.setName("ClawHub (OpenClaw Skills Registry)");
                        s.setBaseUrl("https://clawhub.ai");
                        s.setEnabled(true);
                        return sourceRepository.save(s);
                    } catch (DataIntegrityViolationException e) {
                        log.warn("SkillSource with code {} was created concurrently, reloading existing record", CLAWHUB_CODE);
                        return sourceRepository.findByCode(CLAWHUB_CODE)
                                .orElseThrow(() -> e);
                    }
                });
    }

    /**
     * 列表排序优先使用 skill.updatedAt；缺失时回退到 createdAt / latestVersion.createdAt。
     */
    private long updatedAtEpochMillis(ClawhubSkillListItem item) {
        Long itemUpdatedAt = item.getUpdatedAt();
        if (itemUpdatedAt != null) {
            return itemUpdatedAt;
        }
        Long itemCreatedAt = item.getCreatedAt();
        if (itemCreatedAt != null) {
            return itemCreatedAt;
        }
        ClawhubSkillListItem.LatestVersion latestVersion = item.getLatestVersion();
        if (latestVersion != null && latestVersion.getCreatedAt() != null) {
            return latestVersion.getCreatedAt();
        }
        return Long.MIN_VALUE;
    }

    private Instant toInstant(Long epochMillis) {
        return epochMillis != null ? Instant.ofEpochMilli(epochMillis) : null;
    }

    private Instant lastSyncInstant(ClawhubSkillListItem item, Instant syncWriteTime) {
        Instant clawhubUpdatedAt = toInstant(item.getUpdatedAt());
        if (clawhubUpdatedAt == null) {
            return syncWriteTime;
        }
        return clawhubUpdatedAt.isAfter(syncWriteTime) ? clawhubUpdatedAt : syncWriteTime;
    }

    private boolean shouldStopAtExistingSkill(Skill skill, Instant clawhubUpdatedAt) {
        Instant lastSyncAt = skill.getLastSyncAt();
        return clawhubUpdatedAt != null
                && lastSyncAt != null
                && clawhubUpdatedAt.isBefore(lastSyncAt);
    }

    private String tagsToText(Map<String, Object> tags) {
        if (tags == null || tags.isEmpty()) {
            return null;
        }
        return String.join(",", tags.keySet());
    }

    private void applyStats(Skill skill, ClawhubSkillListItem.Stats stats) {
        if (stats == null) {
            skill.setDownloadCount(0L);
            skill.setFavoriteCount(0L);
            return;
        }
        long downloads = stats.getDownloads() != null ? stats.getDownloads() : 0L;
        long stars = stats.getStars() != null ? stats.getStars() : 0L;
        skill.setDownloadCount(downloads);
        skill.setFavoriteCount(stars);
    }

    private String nullToEmpty(String value, String fallback) {
        return (value != null && !value.isBlank()) ? value : fallback;
    }

    /**
     * 新技能默认 ACTIVE；已存在记录若管理员设为 DISABLED / DEPRECATED，同步时保留，避免覆盖系统级启用状态。
     */
    private void applySyncedSkillStatus(Skill skill, String previousStatus) {
        if (previousStatus != null
                && ("DISABLED".equalsIgnoreCase(previousStatus) || "DEPRECATED".equalsIgnoreCase(previousStatus))) {
            skill.setStatus(previousStatus);
        } else {
            skill.setStatus("ACTIVE");
        }
    }

    private static void sleepCurrentThread(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while waiting before next ClawHub request", e);
        }
    }
}
