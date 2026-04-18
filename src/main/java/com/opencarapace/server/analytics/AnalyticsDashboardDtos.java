package com.opencarapace.server.analytics;

import java.time.LocalDate;
import java.util.List;

public final class AnalyticsDashboardDtos {

    private AnalyticsDashboardDtos() {
    }

    public record AnalyticsDashboardResponse(
            String timezone,
            LocalDate fromDate,
            LocalDate toDate,
            List<DailyLongPoint> dauAll,
            List<DailyLongPoint> dauRegistered,
            List<DailyLongPoint> newRegistrations,
            List<DailyLongPoint> uniqueLoginUsers,
            List<DailyLongPoint> dailyPageViews,
            List<DailyDownloadsBreakdown> downloadsByDay,
            List<NameCount> downloadTargetsInRange,
            List<NameCount> downloadVariantsInRange,
            List<NameCount> topPageViews,
            List<NameCount> topEventNames,
            Summary summary
    ) {
    }

    public record DailyLongPoint(String date, long value) {
    }

    public record DailyDownloadsBreakdown(
            String date,
            long total,
            long platformWeb,
            long platformDesktop,
            long platformOther,
            long targetWindows,
            long targetMac,
            long targetOther
    ) {
    }

    public record NameCount(String name, long count) {
    }

    public record Summary(
            long totalTrackedEvents,
            long totalPageViews,
            long totalDownloadClicks,
            long distinctAnonymousInRange,
            long distinctUsersWithAnyEventInRange
    ) {
    }
}
