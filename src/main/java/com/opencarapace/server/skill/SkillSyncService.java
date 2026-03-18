package com.opencarapace.server.skill;

import com.opencarapace.server.config.SystemDataVersionService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * 从 ClawHub 同步技能到本地 oc_skills 表。
 * 使用 ClawHub 公开搜索 API 自动拉取，无需在服务器安装 clawhub CLI 或手写导出脚本。
 */
@Service
@Slf4j
public class SkillSyncService {

    private static final String CLAWHUB_CODE = "CLAWHUB";
    private static final String DEFAULT_SEED_QUERIES = "skill,tool,api,code,shell,security,web,data,agent,openclaw,claw,assistant,automation";

    private final SkillSourceRepository sourceRepository;
    private final SkillRepository skillRepository;
    private final ClawhubApiClient clawhubApiClient;
    private final SystemDataVersionService systemDataVersionService;
    private final int searchLimitPerQuery;
    private final List<String> seedQueries;

    public SkillSyncService(
            SkillSourceRepository sourceRepository,
            SkillRepository skillRepository,
            ClawhubApiClient clawhubApiClient,
            SystemDataVersionService systemDataVersionService,
            @Value("${claw.skills.clawhub-search-limit-per-query:200}") int searchLimitPerQuery,
            @Value("${claw.skills.clawhub-search-queries:" + DEFAULT_SEED_QUERIES + "}") String seedQueriesCsv
    ) {
        this.sourceRepository = sourceRepository;
        this.skillRepository = skillRepository;
        this.clawhubApiClient = clawhubApiClient;
        this.systemDataVersionService = systemDataVersionService;
        this.searchLimitPerQuery = searchLimitPerQuery;
        this.seedQueries = Stream.of(seedQueriesCsv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toList());
        if (this.seedQueries.isEmpty()) {
            this.seedQueries.addAll(Arrays.asList(DEFAULT_SEED_QUERIES.split(",")));
        }
    }

    /**
     * 通过 ClawHub 公开 API 拉取并同步技能（无需 CLI / 本地文件）。
     * 整体不包事务，每条记录独立插入，失败不会影响已成功的数据。
     */
    public int syncFromClawhubApi() {
        SkillSource source = ensureSource();

        Map<String, ClawhubSearchItem> bySlug = new LinkedHashMap<>();
        for (String query : seedQueries) {
            List<ClawhubSearchItem> page = clawhubApiClient.search(query, searchLimitPerQuery);
            for (ClawhubSearchItem item : page) {
                if (item.getSlug() != null && !item.getSlug().isBlank()) {
                    bySlug.putIfAbsent(item.getSlug(), item);
                }
            }
        }

        Instant now = Instant.now();
        int total = bySlug.size();
        int index = 0;
        int success = 0;
        int failed = 0;
        for (ClawhubSearchItem item : bySlug.values()) {
            index++;
            String externalId = item.getSlug();
            Skill skill = skillRepository
                    .findBySourceIdAndExternalId(source.getId(), externalId)
                    .orElseGet(() -> {
                        Skill s = new Skill();
                        s.setSource(source);
                        s.setExternalId(externalId);
                        return s;
                    });

            String displayName = nullToEmpty(item.getDisplayName(), item.getSlug());
            skill.setName(displayName);
            skill.setSlug(item.getSlug());
            skill.setType("SKILL");
            skill.setStatus("ACTIVE");
            skill.setShortDesc(item.getSummary());
            skill.setVersion(item.getVersion());
            skill.setHomepageUrl("https://clawhub.ai/skills/" + item.getSlug());
            skill.setInstallHint("clawhub install " + item.getSlug());
            skill.setLastSyncAt(now);
            try {
                skillRepository.save(skill);
                log.info("ClawHub skill sync {}/{}: slug={} name={}", index, total, externalId, displayName);
                success++;
            } catch (DataAccessException e) {
                failed++;
                log.error("ClawHub skill sync FAILED {}/{}: slug={} name={} - {}", index, total, externalId, displayName, e.getMessage());
            }
        }
        log.info("ClawHub skills sync completed: success={}, failed={}, seedQueries={}, uniqueSlugs={}",
                success, failed, seedQueries.size(), total);
        
        if (success > 0) {
            systemDataVersionService.incrementSkillsDataVersion();
            log.info("Skills data version incremented after sync");
        }
        
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
            ConvexSkillsPage page = clawhubApiClient.listPublicPageV4(cursor, searchLimitPerQuery);
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
                    String displayName = nullToEmpty(s.getDisplayName(), slug);
                    skill.setName(displayName);
                    skill.setSlug(slug);
                    skill.setType("SKILL");
                    skill.setStatus("ACTIVE");
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

    private String nullToEmpty(String value, String fallback) {
        return (value != null && !value.isBlank()) ? value : fallback;
    }
}

