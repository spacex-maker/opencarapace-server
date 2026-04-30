package com.opencarapace.server.skill;

import com.opencarapace.server.config.SystemDataVersionService;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class SkillAdminControllerTest {

    @Test
    void syncFromClawhubFullUsesV1FullScanWithoutWatermarkStop() {
        SkillSyncService skillSyncService = mock(SkillSyncService.class);
        SkillRepository skillRepository = mock(SkillRepository.class);
        SystemDataVersionService systemDataVersionService = mock(SystemDataVersionService.class);
        when(skillSyncService.syncFromClawhubApi(false)).thenReturn(12);

        SkillAdminController controller = new SkillAdminController(
                skillSyncService,
                skillRepository,
                systemDataVersionService
        );

        Map<String, Object> body = controller.syncFromClawhubFull().getBody();

        verify(skillSyncService).syncFromClawhubApi(false);
        verify(skillSyncService, never()).syncFromConvexFull();
        assertThat(body).containsEntry("source", "CLAWHUB");
        assertThat(body).containsEntry("mode", "FULL_SCAN");
        assertThat(body).containsEntry("stopAtWatermark", false);
        assertThat(body).containsEntry("synced", 12);
    }
}
