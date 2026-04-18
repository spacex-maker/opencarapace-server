package com.opencarapace.server.analytics;

import com.opencarapace.server.analytics.AnalyticsDashboardDtos.AnalyticsDashboardResponse;
import com.opencarapace.server.analytics.AnalyticsDashboardDtos.DailyDownloadsBreakdown;
import com.opencarapace.server.analytics.AnalyticsDashboardDtos.DailyLongPoint;
import com.opencarapace.server.analytics.AnalyticsDashboardDtos.NameCount;
import com.opencarapace.server.analytics.AnalyticsDashboardDtos.Summary;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class AdminAnalyticsService {

    /**
     * 报表按「上海日历日」对齐前端时间轴。
     * <p>
     * 当前数据源使用 {@code serverTimezone=Asia/Shanghai}，JPA 将 {@link java.time.Instant} 写入 MySQL {@code DATETIME}
     * 时一般为<strong>上海墙钟</strong>（而非 UTC）。若对这类列再执行 {@code CONVERT_TZ(..., '+00:00', 'Asia/Shanghai')}，
     * 会把墙钟误当 UTC，导致按日分组错位，出现「当天已注册但新增注册为 0」等现象。
     * <p>
     * 因此日粒度聚合使用 {@code DATE(column)}；区间过滤使用<strong>上海日界</strong>的 {@link LocalDateTime}
     * 绑定到 {@code DATETIME}（与 JDBC {@code serverTimezone=Asia/Shanghai} 下写入的墙钟一致）。切勿使用 {@link java.time.Instant}
     * 绑定：部分驱动会转成 UTC 再写入比较值，导致与库内墙钟比较错位、整段区间查无数据。
     */
    private static final ZoneId REPORT_ZONE = ZoneId.of("Asia/Shanghai");
    private static final int MAX_RANGE_DAYS = 90;
    private static final int DEFAULT_RANGE_DAYS = 14;

    @PersistenceContext
    private EntityManager entityManager;

    public AnalyticsDashboardResponse loadDashboard(Integer days, LocalDate fromParam, LocalDate toParam) {
        LocalDate today = LocalDate.now(REPORT_ZONE);
        LocalDate from;
        LocalDate to;
        if (fromParam != null && toParam != null) {
            from = fromParam.isAfter(toParam) ? toParam : fromParam;
            to = fromParam.isAfter(toParam) ? fromParam : toParam;
            if (from.until(to, java.time.temporal.ChronoUnit.DAYS) + 1 > MAX_RANGE_DAYS) {
                from = to.minusDays(MAX_RANGE_DAYS - 1);
            }
        } else {
            int d = days == null ? DEFAULT_RANGE_DAYS : Math.min(Math.max(days, 1), MAX_RANGE_DAYS);
            to = today;
            from = today.minusDays(d - 1L);
        }

        LocalDateTime rangeStartLdt = from.atStartOfDay(REPORT_ZONE).toLocalDateTime();
        LocalDateTime rangeEndExLdt = to.plusDays(1).atStartOfDay(REPORT_ZONE).toLocalDateTime();

        List<LocalDate> spine = enumerateDates(from, to);

        List<DailyLongPoint> dauAll = fillDaily(
                spine,
                queryKeyedLong(
                        """
                                SELECT DATE(l.event_time) AS d,
                                       COUNT(DISTINCT COALESCE(CAST(l.user_id AS CHAR), l.anonymous_id)) AS c
                                FROM oc_user_event_logs l
                                WHERE l.valid = TRUE
                                  AND l.event_time >= ?1 AND l.event_time < ?2
                                GROUP BY d
                                ORDER BY d
                                """,
                        rangeStartLdt,
                        rangeEndExLdt
                )
        );

        List<DailyLongPoint> dauRegistered = fillDaily(
                spine,
                queryKeyedLong(
                        """
                                SELECT DATE(l.event_time) AS d,
                                       COUNT(DISTINCT l.user_id) AS c
                                FROM oc_user_event_logs l
                                WHERE l.valid = TRUE
                                  AND l.user_id IS NOT NULL
                                  AND l.event_time >= ?1 AND l.event_time < ?2
                                GROUP BY d
                                ORDER BY d
                                """,
                        rangeStartLdt,
                        rangeEndExLdt
                )
        );

        List<DailyLongPoint> newRegs = fillDaily(
                spine,
                queryKeyedLong(
                        """
                                SELECT DATE(u.created_at) AS d,
                                       COUNT(*) AS c
                                FROM oc_users u
                                WHERE u.created_at >= ?1 AND u.created_at < ?2
                                GROUP BY d
                                ORDER BY d
                                """,
                        rangeStartLdt,
                        rangeEndExLdt
                )
        );

        List<DailyLongPoint> logins = fillDaily(
                spine,
                queryKeyedLong(
                        """
                                SELECT DATE(l.event_time) AS d,
                                       COUNT(DISTINCT l.user_id) AS c
                                FROM oc_user_event_logs l
                                WHERE l.valid = TRUE
                                  AND l.event_name = 'auth_login_success'
                                  AND l.user_id IS NOT NULL
                                  AND l.event_time >= ?1 AND l.event_time < ?2
                                GROUP BY d
                                ORDER BY d
                                """,
                        rangeStartLdt,
                        rangeEndExLdt
                )
        );

        List<DailyLongPoint> pageViews = fillDaily(
                spine,
                queryKeyedLong(
                        """
                                SELECT DATE(l.event_time) AS d,
                                       COUNT(*) AS c
                                FROM oc_user_event_logs l
                                WHERE l.valid = TRUE
                                  AND l.event_name = 'page_view'
                                  AND l.event_time >= ?1 AND l.event_time < ?2
                                GROUP BY d
                                ORDER BY d
                                """,
                        rangeStartLdt,
                        rangeEndExLdt
                )
        );

        List<DailyDownloadsBreakdown> downloadsByDay = queryDownloadsByDay(rangeStartLdt, rangeEndExLdt, spine);

        List<NameCount> downloadTargets = queryNameCounts(
                """
                        SELECT COALESCE(LOWER(JSON_UNQUOTE(JSON_EXTRACT(l.event_props_json, '$.target'))), '(未知)') AS k,
                               COUNT(*) AS c
                        FROM oc_user_event_logs l
                        WHERE l.valid = TRUE
                          AND l.event_name = 'download_click'
                          AND l.event_time >= ?1 AND l.event_time < ?2
                        GROUP BY k
                        ORDER BY c DESC
                        LIMIT 24
                        """,
                rangeStartLdt,
                rangeEndExLdt
        );

        List<NameCount> downloadVariants = queryNameCounts(
                """
                        SELECT COALESCE(JSON_UNQUOTE(JSON_EXTRACT(l.event_props_json, '$.variant')), '(未知)') AS k,
                               COUNT(*) AS c
                        FROM oc_user_event_logs l
                        WHERE l.valid = TRUE
                          AND l.event_name = 'download_click'
                          AND l.event_time >= ?1 AND l.event_time < ?2
                        GROUP BY k
                        ORDER BY c DESC
                        LIMIT 32
                        """,
                rangeStartLdt,
                rangeEndExLdt
        );

        List<NameCount> topPages = queryNameCounts(
                """
                        SELECT COALESCE(NULLIF(l.page_id, ''), '(无 page_id)') AS k,
                               COUNT(*) AS c
                        FROM oc_user_event_logs l
                        WHERE l.valid = TRUE
                          AND l.event_name = 'page_view'
                          AND l.event_time >= ?1 AND l.event_time < ?2
                        GROUP BY k
                        ORDER BY c DESC
                        LIMIT 20
                        """,
                rangeStartLdt,
                rangeEndExLdt
        );

        List<NameCount> topEvents = queryNameCounts(
                """
                        SELECT l.event_name AS k,
                               COUNT(*) AS c
                        FROM oc_user_event_logs l
                        WHERE l.valid = TRUE
                          AND l.event_time >= ?1 AND l.event_time < ?2
                        GROUP BY k
                        ORDER BY c DESC
                        LIMIT 18
                        """,
                rangeStartLdt,
                rangeEndExLdt
        );

        Summary summary = loadSummary(rangeStartLdt, rangeEndExLdt);

        return new AnalyticsDashboardResponse(
                REPORT_ZONE.getId(),
                from,
                to,
                dauAll,
                dauRegistered,
                newRegs,
                logins,
                pageViews,
                downloadsByDay,
                downloadTargets,
                downloadVariants,
                topPages,
                topEvents,
                summary
        );
    }

    private Summary loadSummary(LocalDateTime from, LocalDateTime toExclusive) {
        long totalTracked = scalarLong(
                "SELECT COUNT(*) FROM oc_user_event_logs l WHERE l.valid = TRUE AND l.event_time >= ?1 AND l.event_time < ?2",
                from,
                toExclusive
        );
        long totalPv = scalarLong(
                "SELECT COUNT(*) FROM oc_user_event_logs l WHERE l.valid = TRUE AND l.event_name = 'page_view' AND l.event_time >= ?1 AND l.event_time < ?2",
                from,
                toExclusive
        );
        long totalDl = scalarLong(
                "SELECT COUNT(*) FROM oc_user_event_logs l WHERE l.valid = TRUE AND l.event_name = 'download_click' AND l.event_time >= ?1 AND l.event_time < ?2",
                from,
                toExclusive
        );
        long distinctAnon = scalarLong(
                """
                        SELECT COUNT(DISTINCT l.anonymous_id) FROM oc_user_event_logs l
                        WHERE l.valid = TRUE AND l.event_time >= ?1 AND l.event_time < ?2
                        """,
                from,
                toExclusive
        );
        long distinctUsers = scalarLong(
                """
                        SELECT COUNT(DISTINCT l.user_id) FROM oc_user_event_logs l
                        WHERE l.valid = TRUE AND l.user_id IS NOT NULL AND l.event_time >= ?1 AND l.event_time < ?2
                        """,
                from,
                toExclusive
        );
        return new Summary(totalTracked, totalPv, totalDl, distinctAnon, distinctUsers);
    }

    private long scalarLong(String sql, LocalDateTime from, LocalDateTime toExclusive) {
        Query q = entityManager.createNativeQuery(sql);
        q.setParameter(1, from);
        q.setParameter(2, toExclusive);
        Object single = q.getSingleResult();
        if (single instanceof Number n) {
            return n.longValue();
        }
        return 0L;
    }

    private List<DailyDownloadsBreakdown> queryDownloadsByDay(LocalDateTime from, LocalDateTime toExclusive, List<LocalDate> spine) {
        Query q = entityManager.createNativeQuery(
                """
                        SELECT DATE(l.event_time) AS d,
                               COUNT(*) AS total,
                               SUM(CASE WHEN LOWER(l.platform) = 'web' THEN 1 ELSE 0 END) AS pw,
                               SUM(CASE WHEN LOWER(l.platform) = 'desktop' THEN 1 ELSE 0 END) AS pd,
                               SUM(CASE WHEN LOWER(l.platform) NOT IN ('web', 'desktop') OR l.platform IS NULL THEN 1 ELSE 0 END) AS po,
                               SUM(CASE WHEN LOWER(JSON_UNQUOTE(JSON_EXTRACT(l.event_props_json, '$.target'))) = 'windows' THEN 1 ELSE 0 END) AS tw,
                               SUM(CASE WHEN LOWER(JSON_UNQUOTE(JSON_EXTRACT(l.event_props_json, '$.target'))) = 'mac' THEN 1 ELSE 0 END) AS tm,
                               SUM(CASE WHEN COALESCE(LOWER(JSON_UNQUOTE(JSON_EXTRACT(l.event_props_json, '$.target'))), '') NOT IN ('windows', 'mac') THEN 1 ELSE 0 END) AS toth
                        FROM oc_user_event_logs l
                        WHERE l.valid = TRUE
                          AND l.event_name = 'download_click'
                          AND l.event_time >= ?1 AND l.event_time < ?2
                        GROUP BY d
                        ORDER BY d
                        """
        );
        q.setParameter(1, from);
        q.setParameter(2, toExclusive);
        @SuppressWarnings("unchecked")
        List<Object[]> rows = q.getResultList();
        Map<LocalDate, DailyDownloadsBreakdown> byDay = new LinkedHashMap<>();
        for (Object[] row : rows) {
            LocalDate d = toLocalDate(row[0]);
            if (d == null) {
                continue;
            }
            long total = toLong(row[1]);
            long pw = toLong(row[2]);
            long pd = toLong(row[3]);
            long po = toLong(row[4]);
            long tw = toLong(row[5]);
            long tm = toLong(row[6]);
            long toth = toLong(row[7]);
            byDay.put(d, new DailyDownloadsBreakdown(
                    d.toString(),
                    total,
                    pw,
                    pd,
                    po,
                    tw,
                    tm,
                    toth
            ));
        }
        List<DailyDownloadsBreakdown> out = new ArrayList<>();
        for (LocalDate d : spine) {
            out.add(byDay.getOrDefault(d, new DailyDownloadsBreakdown(d.toString(), 0, 0, 0, 0, 0, 0, 0)));
        }
        return out;
    }

    private List<NameCount> queryNameCounts(String sql, LocalDateTime from, LocalDateTime toExclusive) {
        Query q = entityManager.createNativeQuery(sql);
        q.setParameter(1, from);
        q.setParameter(2, toExclusive);
        @SuppressWarnings("unchecked")
        List<Object[]> rows = q.getResultList();
        List<NameCount> out = new ArrayList<>();
        for (Object[] row : rows) {
            String name = row[0] != null ? row[0].toString() : "";
            out.add(new NameCount(name, toLong(row[1])));
        }
        return out;
    }

    private Map<LocalDate, Long> queryKeyedLong(String sql, LocalDateTime from, LocalDateTime toExclusive) {
        Query q = entityManager.createNativeQuery(sql);
        q.setParameter(1, from);
        q.setParameter(2, toExclusive);
        @SuppressWarnings("unchecked")
        List<Object[]> rows = q.getResultList();
        Map<LocalDate, Long> map = new LinkedHashMap<>();
        for (Object[] row : rows) {
            LocalDate d = toLocalDate(row[0]);
            if (d != null) {
                map.put(d, toLong(row[1]));
            }
        }
        return map;
    }

    private static List<DailyLongPoint> fillDaily(List<LocalDate> spine, Map<LocalDate, Long> values) {
        return spine.stream()
                .map(d -> new DailyLongPoint(d.toString(), values.getOrDefault(d, 0L)))
                .collect(Collectors.toList());
    }

    private static List<LocalDate> enumerateDates(LocalDate from, LocalDate to) {
        List<LocalDate> list = new ArrayList<>();
        LocalDate c = from;
        while (!c.isAfter(to)) {
            list.add(c);
            c = c.plusDays(1);
        }
        return list;
    }

    private static LocalDate toLocalDate(Object o) {
        if (o == null) {
            return null;
        }
        if (o instanceof java.sql.Date sd) {
            return sd.toLocalDate();
        }
        if (o instanceof java.util.Date ud) {
            return ud.toInstant().atZone(REPORT_ZONE).toLocalDate();
        }
        if (o instanceof LocalDate ld) {
            return ld;
        }
        if (o instanceof String s) {
            return LocalDate.parse(s);
        }
        return null;
    }

    private static long toLong(Object o) {
        if (o == null) {
            return 0L;
        }
        if (o instanceof Number n) {
            return n.longValue();
        }
        return 0L;
    }
}
