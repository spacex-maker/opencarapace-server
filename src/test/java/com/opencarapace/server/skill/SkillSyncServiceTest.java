package com.opencarapace.server.skill;

import com.opencarapace.server.config.SystemDataVersionService;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SkillSyncServiceTest {

    private static final int PAGE_LIMIT = 180;

    @Test
    void syncFromClawhubApiSortsPageByUpdatedAtDescAndStopsWhenClawhubUpdatedAtBeforeLastSyncAt() {
        SkillSourceRepository sourceRepository = mock(SkillSourceRepository.class);
        SkillRepository skillRepository = mock(SkillRepository.class);
        FakeClawhubApiClient clawhubApiClient = new FakeClawhubApiClient();
        CountingSystemDataVersionService versionService = new CountingSystemDataVersionService();

        SkillSource source = new SkillSource();
        source.setId(7L);
        source.setCode("CLAWHUB");
        when(sourceRepository.findByCode("CLAWHUB")).thenReturn(Optional.of(source));

        ClawhubSkillListResponse firstPage = new ClawhubSkillListResponse();
        firstPage.setItems(List.of(
                skillItem("already-synced", "Already Synced", 1000L, "0.1.0"),
                skillItem("brand-new", "Brand New", 3000L, "1.2.3")
        ));
        firstPage.setNextCursor("next-page");
        clawhubApiClient.addPage(firstPage);

        Skill existing = new Skill();
        existing.setId(42L);
        existing.setSource(source);
        existing.setExternalId("already-synced");
        existing.setSlug("already-synced");
        existing.setLastSyncAt(Instant.ofEpochMilli(2000L));
        when(skillRepository.findBySourceIdAndExternalId(7L, "brand-new")).thenReturn(Optional.empty());
        when(skillRepository.findBySourceIdAndExternalId(7L, "already-synced")).thenReturn(Optional.of(existing));
        when(skillRepository.save(any(Skill.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SkillSyncService service = new SkillSyncService(
                sourceRepository,
                skillRepository,
                clawhubApiClient,
                versionService,
                PAGE_LIMIT,
                Duration.ZERO,
                millis -> {
                }
        );

        int synced = service.syncFromClawhubApi();

        assertThat(synced).isEqualTo(1);
        verify(skillRepository).save(argThat(skill ->
                "brand-new".equals(skill.getExternalId())
                        && "Brand New".equals(skill.getName())
                        && "1.2.3".equals(skill.getVersion())
                        && skill.getCategory() == null
                        && skill.getSecurityGrade() == null
                        && Long.valueOf(42L).equals(skill.getDownloadCount())
                        && Long.valueOf(3L).equals(skill.getFavoriteCount())
                        && skill.getStarRating() == null
                        && skill.getLongDesc() == null
                        && skill.getManifestJson() == null
                        && "clawhub install brand-new".equals(skill.getInstallHint())
                        && Instant.ofEpochMilli(3000L).equals(skill.getPublishedAt())
                        && !skill.getLastSyncAt().isBefore(Instant.ofEpochMilli(3500L))
        ));
        assertThat(clawhubApiClient.requests).containsExactly(
                new PageRequest(null, PAGE_LIMIT, "updated")
        );
        assertThat(versionService.incrementCalls).isEqualTo(1);
    }

    @Test
    void syncFromClawhubApiUpdatesExistingChangedSkillBeforeStoppingAtSyncedSkill() {
        SkillSourceRepository sourceRepository = mock(SkillSourceRepository.class);
        SkillRepository skillRepository = mock(SkillRepository.class);
        FakeClawhubApiClient clawhubApiClient = new FakeClawhubApiClient();
        CountingSystemDataVersionService versionService = new CountingSystemDataVersionService();

        SkillSource source = new SkillSource();
        source.setId(7L);
        source.setCode("CLAWHUB");
        when(sourceRepository.findByCode("CLAWHUB")).thenReturn(Optional.of(source));

        ClawhubSkillListResponse firstPage = new ClawhubSkillListResponse();
        firstPage.setItems(List.of(
                skillItem("unchanged", "Unchanged", 3000L, "1.0.0"),
                skillItem("changed", "Changed", 5000L, "2.0.0")
        ));
        firstPage.setNextCursor("next-page");
        clawhubApiClient.addPage(firstPage);

        Skill changed = new Skill();
        changed.setId(11L);
        changed.setSource(source);
        changed.setExternalId("changed");
        changed.setSlug("changed");
        changed.setStatus("DISABLED");
        changed.setLastSyncAt(Instant.ofEpochMilli(1000L));

        Skill unchanged = new Skill();
        unchanged.setId(12L);
        unchanged.setSource(source);
        unchanged.setExternalId("unchanged");
        unchanged.setSlug("unchanged");
        unchanged.setLastSyncAt(Instant.ofEpochMilli(4000L));

        when(skillRepository.findBySourceIdAndExternalId(7L, "changed")).thenReturn(Optional.of(changed));
        when(skillRepository.findBySourceIdAndExternalId(7L, "unchanged")).thenReturn(Optional.of(unchanged));
        when(skillRepository.save(any(Skill.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SkillSyncService service = new SkillSyncService(
                sourceRepository,
                skillRepository,
                clawhubApiClient,
                versionService,
                PAGE_LIMIT,
                Duration.ZERO,
                millis -> {
                }
        );

        int synced = service.syncFromClawhubApi();

        assertThat(synced).isEqualTo(1);
        verify(skillRepository).save(argThat(skill ->
                Long.valueOf(11L).equals(skill.getId())
                        && "changed".equals(skill.getExternalId())
                        && "Changed".equals(skill.getName())
                        && "DISABLED".equals(skill.getStatus())
                        && !skill.getLastSyncAt().isBefore(Instant.ofEpochMilli(5500L))
        ));
        verify(skillRepository, never()).save(argThat(skill -> "unchanged".equals(skill.getExternalId())));
        assertThat(clawhubApiClient.requests).containsExactly(
                new PageRequest(null, PAGE_LIMIT, "updated")
        );
        assertThat(versionService.incrementCalls).isEqualTo(1);
    }

    @Test
    void syncFromClawhubApiDoesNotStopWhenClawhubUpdatedAtEqualsLastSyncAt() {
        SkillSourceRepository sourceRepository = mock(SkillSourceRepository.class);
        SkillRepository skillRepository = mock(SkillRepository.class);
        FakeClawhubApiClient clawhubApiClient = new FakeClawhubApiClient();
        CountingSystemDataVersionService versionService = new CountingSystemDataVersionService();

        SkillSource source = new SkillSource();
        source.setId(7L);
        source.setCode("CLAWHUB");
        when(sourceRepository.findByCode("CLAWHUB")).thenReturn(Optional.of(source));

        ClawhubSkillListResponse firstPage = new ClawhubSkillListResponse();
        firstPage.setItems(List.of(skillItem("equal-watermark", "Equal Watermark", 1000L, "1.0.0")));
        firstPage.setNextCursor(null);
        clawhubApiClient.addPage(firstPage);

        Skill existing = new Skill();
        existing.setId(21L);
        existing.setSource(source);
        existing.setExternalId("equal-watermark");
        existing.setSlug("equal-watermark");
        existing.setLastSyncAt(Instant.ofEpochMilli(1500L));

        when(skillRepository.findBySourceIdAndExternalId(7L, "equal-watermark")).thenReturn(Optional.of(existing));
        when(skillRepository.save(any(Skill.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SkillSyncService service = new SkillSyncService(
                sourceRepository,
                skillRepository,
                clawhubApiClient,
                versionService,
                PAGE_LIMIT,
                Duration.ZERO,
                millis -> {
                }
        );

        int synced = service.syncFromClawhubApi();

        assertThat(synced).isEqualTo(1);
        verify(skillRepository).save(argThat(skill ->
                Long.valueOf(21L).equals(skill.getId())
                        && "equal-watermark".equals(skill.getExternalId())
                        && !skill.getLastSyncAt().isBefore(Instant.ofEpochMilli(1500L))
        ));
        assertThat(versionService.incrementCalls).isEqualTo(1);
    }

    @Test
    void syncFromClawhubApiIgnoresLocalUpdatedAtWhenLastSyncAtIsBehindUpstream() {
        SkillSourceRepository sourceRepository = mock(SkillSourceRepository.class);
        SkillRepository skillRepository = mock(SkillRepository.class);
        FakeClawhubApiClient clawhubApiClient = new FakeClawhubApiClient();
        CountingSystemDataVersionService versionService = new CountingSystemDataVersionService();

        SkillSource source = new SkillSource();
        source.setId(7L);
        source.setCode("CLAWHUB");
        when(sourceRepository.findByCode("CLAWHUB")).thenReturn(Optional.of(source));

        ClawhubSkillListResponse firstPage = new ClawhubSkillListResponse();
        firstPage.setItems(List.of(skillItem("admin-touched", "Admin Touched", 1000L, "1.0.0")));
        firstPage.setNextCursor(null);
        clawhubApiClient.addPage(firstPage);

        Skill existing = new Skill();
        existing.setId(22L);
        existing.setSource(source);
        existing.setExternalId("admin-touched");
        existing.setSlug("admin-touched");
        existing.setUpdatedAt(Instant.ofEpochMilli(10_000L));
        existing.setLastSyncAt(Instant.ofEpochMilli(1_000L));

        when(skillRepository.findBySourceIdAndExternalId(7L, "admin-touched")).thenReturn(Optional.of(existing));
        when(skillRepository.save(any(Skill.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SkillSyncService service = new SkillSyncService(
                sourceRepository,
                skillRepository,
                clawhubApiClient,
                versionService,
                PAGE_LIMIT,
                Duration.ZERO,
                millis -> {
                }
        );

        int synced = service.syncFromClawhubApi();

        assertThat(synced).isEqualTo(1);
        verify(skillRepository).save(argThat(skill ->
                Long.valueOf(22L).equals(skill.getId())
                        && "Admin Touched".equals(skill.getName())
                        && !skill.getLastSyncAt().isBefore(Instant.ofEpochMilli(1500L))
        ));
        assertThat(versionService.incrementCalls).isEqualTo(1);
    }

    @Test
    void syncFromClawhubApiUsesClawhubUpdatedAtAsLastSyncAtWhenItIsAfterLocalWriteTime() {
        SkillSourceRepository sourceRepository = mock(SkillSourceRepository.class);
        SkillRepository skillRepository = mock(SkillRepository.class);
        FakeClawhubApiClient clawhubApiClient = new FakeClawhubApiClient();
        CountingSystemDataVersionService versionService = new CountingSystemDataVersionService();
        AtomicReference<Skill> savedSkill = new AtomicReference<>();

        SkillSource source = new SkillSource();
        source.setId(7L);
        source.setCode("CLAWHUB");
        when(sourceRepository.findByCode("CLAWHUB")).thenReturn(Optional.of(source));

        long futureCreatedAt = 4_102_444_800_000L;
        ClawhubSkillListResponse firstPage = new ClawhubSkillListResponse();
        firstPage.setItems(List.of(skillItem("future-updated", "Future Updated", futureCreatedAt, "9.9.9")));
        firstPage.setNextCursor(null);
        clawhubApiClient.addPage(firstPage);

        when(skillRepository.findBySourceIdAndExternalId(7L, "future-updated")).thenReturn(Optional.empty());
        when(skillRepository.save(any(Skill.class))).thenAnswer(invocation -> {
            Skill skill = invocation.getArgument(0);
            savedSkill.set(skill);
            return skill;
        });

        SkillSyncService service = new SkillSyncService(
                sourceRepository,
                skillRepository,
                clawhubApiClient,
                versionService,
                PAGE_LIMIT,
                Duration.ZERO,
                millis -> {
                }
        );

        int synced = service.syncFromClawhubApi();

        assertThat(synced).isEqualTo(1);
        assertThat(savedSkill.get().getLastSyncAt()).isEqualTo(Instant.ofEpochMilli(futureCreatedAt + 500));
    }

    @Test
    void syncFromClawhubApiFallsBackToLocalWriteTimeWhenClawhubUpdatedAtIsMissing() {
        SkillSourceRepository sourceRepository = mock(SkillSourceRepository.class);
        SkillRepository skillRepository = mock(SkillRepository.class);
        FakeClawhubApiClient clawhubApiClient = new FakeClawhubApiClient();
        CountingSystemDataVersionService versionService = new CountingSystemDataVersionService();
        AtomicReference<Skill> savedSkill = new AtomicReference<>();

        SkillSource source = new SkillSource();
        source.setId(7L);
        source.setCode("CLAWHUB");
        when(sourceRepository.findByCode("CLAWHUB")).thenReturn(Optional.of(source));

        ClawhubSkillListItem item = skillItem("missing-updated", "Missing Updated", 1000L, "1.0.0");
        item.setUpdatedAt(null);
        ClawhubSkillListResponse firstPage = new ClawhubSkillListResponse();
        firstPage.setItems(List.of(item));
        firstPage.setNextCursor(null);
        clawhubApiClient.addPage(firstPage);

        when(skillRepository.findBySourceIdAndExternalId(7L, "missing-updated")).thenReturn(Optional.empty());
        when(skillRepository.save(any(Skill.class))).thenAnswer(invocation -> {
            Skill skill = invocation.getArgument(0);
            savedSkill.set(skill);
            return skill;
        });

        SkillSyncService service = new SkillSyncService(
                sourceRepository,
                skillRepository,
                clawhubApiClient,
                versionService,
                PAGE_LIMIT,
                Duration.ZERO,
                millis -> {
                }
        );

        Instant beforeSync = Instant.now();
        int synced = service.syncFromClawhubApi();
        Instant afterSync = Instant.now();

        assertThat(synced).isEqualTo(1);
        assertThat(savedSkill.get().getLastSyncAt()).isBetween(beforeSync, afterSync);
    }

    @Test
    void syncFromClawhubApiSkipsDuplicateSlugsAcrossPages() {
        SkillSourceRepository sourceRepository = mock(SkillSourceRepository.class);
        SkillRepository skillRepository = mock(SkillRepository.class);
        FakeClawhubApiClient clawhubApiClient = new FakeClawhubApiClient();
        CountingSystemDataVersionService versionService = new CountingSystemDataVersionService();

        SkillSource source = new SkillSource();
        source.setId(7L);
        source.setCode("CLAWHUB");
        when(sourceRepository.findByCode("CLAWHUB")).thenReturn(Optional.of(source));

        ClawhubSkillListResponse firstPage = new ClawhubSkillListResponse();
        firstPage.setItems(List.of(skillItem("duplicate", "Duplicate", 2000L, "1.0.0")));
        firstPage.setNextCursor("cursor-2");
        ClawhubSkillListResponse secondPage = new ClawhubSkillListResponse();
        secondPage.setItems(List.of(skillItem("duplicate", "Duplicate Again", 1000L, "1.0.1")));
        secondPage.setNextCursor(null);
        clawhubApiClient.addPage(firstPage);
        clawhubApiClient.addPage(secondPage);

        when(skillRepository.findBySourceIdAndExternalId(7L, "duplicate")).thenReturn(Optional.empty());
        when(skillRepository.save(any(Skill.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SkillSyncService service = new SkillSyncService(
                sourceRepository,
                skillRepository,
                clawhubApiClient,
                versionService,
                PAGE_LIMIT,
                Duration.ZERO,
                millis -> {
                }
        );

        int synced = service.syncFromClawhubApi();

        assertThat(synced).isEqualTo(1);
        verify(skillRepository, times(1)).save(any(Skill.class));
        assertThat(clawhubApiClient.requests).containsExactly(
                new PageRequest(null, PAGE_LIMIT, "updated"),
                new PageRequest("cursor-2", PAGE_LIMIT, "updated")
        );
        assertThat(versionService.incrementCalls).isEqualTo(1);
    }

    @Test
    void syncFromClawhubApiContinuesWhileNextCursorExists() {
        SkillSourceRepository sourceRepository = mock(SkillSourceRepository.class);
        SkillRepository skillRepository = mock(SkillRepository.class);
        FakeClawhubApiClient clawhubApiClient = new FakeClawhubApiClient();
        CountingSystemDataVersionService versionService = new CountingSystemDataVersionService();

        SkillSource source = new SkillSource();
        source.setId(7L);
        source.setCode("CLAWHUB");
        when(sourceRepository.findByCode("CLAWHUB")).thenReturn(Optional.of(source));

        ClawhubSkillListResponse firstPage = new ClawhubSkillListResponse();
        firstPage.setItems(List.of(skillItem("first", "First", 2000L, "1.0.0")));
        firstPage.setNextCursor("cursor-2");
        ClawhubSkillListResponse secondPage = new ClawhubSkillListResponse();
        secondPage.setItems(List.of(skillItem("second", "Second", 1000L, "1.0.1")));
        secondPage.setNextCursor(null);

        clawhubApiClient.addPage(firstPage);
        clawhubApiClient.addPage(secondPage);
        when(skillRepository.findBySourceIdAndExternalId(eq(7L), any())).thenReturn(Optional.empty());
        when(skillRepository.save(any(Skill.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SkillSyncService service = new SkillSyncService(
                sourceRepository,
                skillRepository,
                clawhubApiClient,
                versionService,
                PAGE_LIMIT,
                Duration.ZERO,
                millis -> {
                }
        );

        int synced = service.syncFromClawhubApi();

        assertThat(synced).isEqualTo(2);
        assertThat(clawhubApiClient.requests).containsExactly(
                new PageRequest(null, PAGE_LIMIT, "updated"),
                new PageRequest("cursor-2", PAGE_LIMIT, "updated")
        );
        verify(skillRepository, times(2)).save(any(Skill.class));
        assertThat(versionService.incrementCalls).isEqualTo(1);
    }

    @Test
    void syncFromClawhubApiWaitsNinetySecondsBeforeRequestingNextPage() {
        SkillSourceRepository sourceRepository = mock(SkillSourceRepository.class);
        SkillRepository skillRepository = mock(SkillRepository.class);
        FakeClawhubApiClient clawhubApiClient = new FakeClawhubApiClient();
        CountingSystemDataVersionService versionService = new CountingSystemDataVersionService();
        List<Long> sleeps = new ArrayList<>();

        SkillSource source = new SkillSource();
        source.setId(7L);
        source.setCode("CLAWHUB");
        when(sourceRepository.findByCode("CLAWHUB")).thenReturn(Optional.of(source));

        ClawhubSkillListResponse firstPage = new ClawhubSkillListResponse();
        firstPage.setItems(List.of(skillItem("first", "First", 2000L, "1.0.0")));
        firstPage.setNextCursor("cursor-2");
        ClawhubSkillListResponse secondPage = new ClawhubSkillListResponse();
        secondPage.setItems(List.of(skillItem("second", "Second", 1000L, "1.0.1")));
        secondPage.setNextCursor(null);
        clawhubApiClient.addPage(firstPage);
        clawhubApiClient.addPage(secondPage);
        when(skillRepository.findBySourceIdAndExternalId(eq(7L), any())).thenReturn(Optional.empty());
        when(skillRepository.save(any(Skill.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SkillSyncService service = new SkillSyncService(
                sourceRepository,
                skillRepository,
                clawhubApiClient,
                versionService,
                PAGE_LIMIT,
                Duration.ofSeconds(90),
                sleeps::add
        );

        int synced = service.syncFromClawhubApi();

        assertThat(synced).isEqualTo(2);
        assertThat(sleeps).containsExactly(90_000L);
    }

    @Test
    void syncFromClawhubApiClampsConfiguredLimitToAnonymousReadLimit() {
        SkillSourceRepository sourceRepository = mock(SkillSourceRepository.class);
        SkillRepository skillRepository = mock(SkillRepository.class);
        FakeClawhubApiClient clawhubApiClient = new FakeClawhubApiClient();
        CountingSystemDataVersionService versionService = new CountingSystemDataVersionService();

        SkillSource source = new SkillSource();
        source.setId(7L);
        source.setCode("CLAWHUB");
        when(sourceRepository.findByCode("CLAWHUB")).thenReturn(Optional.of(source));

        ClawhubSkillListResponse firstPage = new ClawhubSkillListResponse();
        firstPage.setItems(List.of());
        firstPage.setNextCursor(null);
        clawhubApiClient.addPage(firstPage);

        SkillSyncService service = new SkillSyncService(
                sourceRepository,
                skillRepository,
                clawhubApiClient,
                versionService,
                200,
                Duration.ZERO,
                millis -> {
                }
        );

        int synced = service.syncFromClawhubApi();

        assertThat(synced).isZero();
        assertThat(clawhubApiClient.requests).containsExactly(
                new PageRequest(null, PAGE_LIMIT, "updated")
        );
        assertThat(versionService.incrementCalls).isZero();
    }

    private static ClawhubSkillListItem skillItem(String slug, String displayName, long createdAt, String version) {
        ClawhubSkillListItem item = new ClawhubSkillListItem();
        item.setSlug(slug);
        item.setDisplayName(displayName);
        item.setSummary("Summary for " + slug);
        item.setCreatedAt(createdAt);
        item.setUpdatedAt(createdAt + 500);
        ClawhubSkillListItem.Stats stats = new ClawhubSkillListItem.Stats();
        stats.setDownloads(42L);
        stats.setStars(3L);
        item.setStats(stats);
        ClawhubSkillListItem.LatestVersion latestVersion = new ClawhubSkillListItem.LatestVersion();
        latestVersion.setVersion(version);
        latestVersion.setCreatedAt(createdAt);
        latestVersion.setChangelog("Changes for " + slug);
        item.setLatestVersion(latestVersion);
        return item;
    }

    private record PageRequest(String cursor, int limit, String sort) {
    }

    private static class FakeClawhubApiClient extends ClawhubApiClient {

        private final List<ClawhubSkillListResponse> pages = new ArrayList<>();
        private final List<PageRequest> requests = new ArrayList<>();

        private FakeClawhubApiClient() {
            super(WebClient.builder(), "http://localhost", "http://localhost", "");
        }

        private void addPage(ClawhubSkillListResponse page) {
            pages.add(page);
        }

        @Override
        public ClawhubSkillListResponse listSkillsPage(String cursor, int limit, String sort) {
            requests.add(new PageRequest(cursor, limit, sort));
            return pages.remove(0);
        }
    }

    private static class CountingSystemDataVersionService extends SystemDataVersionService {

        private int incrementCalls;

        private CountingSystemDataVersionService() {
            super(null);
        }

        @Override
        public void incrementSkillsDataVersion() {
            incrementCalls++;
        }
    }
}
