package com.opencarapace.server.dashboard;

import com.opencarapace.server.billing.TokenUsageRepository;
import com.opencarapace.server.danger.DangerCommandRepository;
import com.opencarapace.server.safety.SafetyEvaluationRepository;
import com.opencarapace.server.skill.SkillRepository;
import com.opencarapace.server.user.UserSkillSafetyLabelRepository;
import com.opencarapace.server.user.UserSkillRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class DashboardService {

    @Autowired
    private SkillRepository skillRepository;

    @Autowired
    private UserSkillRepository userSkillRepository;

    @Autowired
    private UserSkillSafetyLabelRepository userSkillSafetyLabelRepository;

    @Autowired
    private DangerCommandRepository dangerCommandRepository;

    @Autowired
    private SafetyEvaluationRepository safetyEvaluationRepository;

    @Autowired
    private TokenUsageRepository tokenUsageRepository;

    public Map<String, Object> getSkillsStats(Long userId) {
        Map<String, Object> result = new HashMap<>();
        
        long totalSkills = skillRepository.count();
        result.put("totalSkills", totalSkills);
        
        long activeSkills = skillRepository.countByStatus("ACTIVE");
        result.put("activeSkills", activeSkills);
        
        long deprecatedSkills = skillRepository.countByStatus("DEPRECATED");
        result.put("deprecatedSkills", deprecatedSkills);
        
        long disabledSkills = skillRepository.countByStatus("DISABLED");
        result.put("disabledSkills", disabledSkills);
        
        long userDisabledCount = userSkillRepository.countByUserIdAndEnabled(userId, false);
        result.put("userDisabledCount", userDisabledCount);

        long userSafeLabelCount = userSkillSafetyLabelRepository.countByUserIdAndLabel(userId, "SAFE");
        result.put("userSafeLabelCount", userSafeLabelCount);

        long userUnsafeLabelCount = userSkillSafetyLabelRepository.countByUserIdAndLabel(userId, "UNSAFE");
        result.put("userUnsafeLabelCount", userUnsafeLabelCount);

        long totalSafeMarks = skillRepository.findAll().stream()
                .mapToLong(s -> s.getSafeMarkCount() == null ? 0L : s.getSafeMarkCount())
                .sum();
        result.put("totalSafeMarks", totalSafeMarks);

        long totalUnsafeMarks = skillRepository.findAll().stream()
                .mapToLong(s -> s.getUnsafeMarkCount() == null ? 0L : s.getUnsafeMarkCount())
                .sum();
        result.put("totalUnsafeMarks", totalUnsafeMarks);
        
        List<Map<String, Object>> categoryDistribution = skillRepository.findAll().stream()
            .collect(Collectors.groupingBy(
                skill -> skill.getCategory() != null ? skill.getCategory() : "未分类",
                Collectors.counting()
            ))
            .entrySet().stream()
            .map(entry -> {
                Map<String, Object> item = new HashMap<>();
                item.put("category", entry.getKey());
                item.put("count", entry.getValue());
                return item;
            })
            .sorted((a, b) -> Long.compare((Long) b.get("count"), (Long) a.get("count")))
            .collect(Collectors.toList());
        result.put("categoryDistribution", categoryDistribution);
        
        List<Map<String, Object>> typeDistribution = skillRepository.findAll().stream()
            .collect(Collectors.groupingBy(
                skill -> skill.getType() != null ? skill.getType() : "未分类",
                Collectors.counting()
            ))
            .entrySet().stream()
            .map(entry -> {
                Map<String, Object> item = new HashMap<>();
                item.put("type", entry.getKey());
                item.put("count", entry.getValue());
                return item;
            })
            .sorted((a, b) -> Long.compare((Long) b.get("count"), (Long) a.get("count")))
            .collect(Collectors.toList());
        result.put("typeDistribution", typeDistribution);
        
        return result;
    }

    public Map<String, Object> getDangerCommandStats() {
        Map<String, Object> result = new HashMap<>();
        
        long totalCommands = dangerCommandRepository.count();
        result.put("totalCommands", totalCommands);
        
        long enabledCommands = dangerCommandRepository.countByEnabled(true);
        result.put("enabledCommands", enabledCommands);
        
        List<Map<String, Object>> systemTypeDistribution = dangerCommandRepository.findAll().stream()
            .collect(Collectors.groupingBy(
                cmd -> cmd.getSystemType() != null ? cmd.getSystemType().name() : "OTHER",
                Collectors.counting()
            ))
            .entrySet().stream()
            .map(entry -> {
                Map<String, Object> item = new HashMap<>();
                item.put("systemType", entry.getKey());
                item.put("count", entry.getValue());
                return item;
            })
            .sorted((a, b) -> Long.compare((Long) b.get("count"), (Long) a.get("count")))
            .collect(Collectors.toList());
        result.put("systemTypeDistribution", systemTypeDistribution);
        
        List<Map<String, Object>> categoryDistribution = dangerCommandRepository.findAll().stream()
            .collect(Collectors.groupingBy(
                cmd -> cmd.getCategory() != null ? cmd.getCategory().name() : "OTHER",
                Collectors.counting()
            ))
            .entrySet().stream()
            .map(entry -> {
                Map<String, Object> item = new HashMap<>();
                item.put("category", entry.getKey());
                item.put("count", entry.getValue());
                return item;
            })
            .sorted((a, b) -> Long.compare((Long) b.get("count"), (Long) a.get("count")))
            .collect(Collectors.toList());
        result.put("categoryDistribution", categoryDistribution);
        
        List<Map<String, Object>> riskLevelDistribution = dangerCommandRepository.findAll().stream()
            .collect(Collectors.groupingBy(
                cmd -> cmd.getRiskLevel() != null ? cmd.getRiskLevel().name() : "UNKNOWN",
                Collectors.counting()
            ))
            .entrySet().stream()
            .map(entry -> {
                Map<String, Object> item = new HashMap<>();
                item.put("riskLevel", entry.getKey());
                item.put("count", entry.getValue());
                return item;
            })
            .sorted((a, b) -> {
                String levelA = (String) a.get("riskLevel");
                String levelB = (String) b.get("riskLevel");
                return getRiskLevelOrder(levelB) - getRiskLevelOrder(levelA);
            })
            .collect(Collectors.toList());
        result.put("riskLevelDistribution", riskLevelDistribution);
        
        return result;
    }

    public Map<String, Object> getInterceptRiskStats(Long userId) {
        Map<String, Object> result = new HashMap<>();
        
        long totalIntercepts = safetyEvaluationRepository.countByUserId(userId);
        result.put("totalIntercepts", totalIntercepts);
        
        List<Map<String, Object>> riskDistribution = safetyEvaluationRepository.findByUserId(userId).stream()
            .collect(Collectors.groupingBy(
                eval -> eval.getRiskLevel() != null ? eval.getRiskLevel() : "UNKNOWN",
                Collectors.counting()
            ))
            .entrySet().stream()
            .map(entry -> {
                Map<String, Object> item = new HashMap<>();
                item.put("riskLevel", entry.getKey());
                item.put("count", entry.getValue());
                return item;
            })
            .sorted((a, b) -> {
                String levelA = (String) a.get("riskLevel");
                String levelB = (String) b.get("riskLevel");
                return getRiskLevelOrder(levelB) - getRiskLevelOrder(levelA);
            })
            .collect(Collectors.toList());
        result.put("riskDistribution", riskDistribution);
        
        List<Map<String, Object>> verdictDistribution = safetyEvaluationRepository.findByUserId(userId).stream()
            .collect(Collectors.groupingBy(
                eval -> eval.getVerdict() != null ? eval.getVerdict() : "UNKNOWN",
                Collectors.counting()
            ))
            .entrySet().stream()
            .map(entry -> {
                Map<String, Object> item = new HashMap<>();
                item.put("verdict", entry.getKey());
                item.put("count", entry.getValue());
                return item;
            })
            .sorted((a, b) -> Long.compare((Long) b.get("count"), (Long) a.get("count")))
            .collect(Collectors.toList());
        result.put("verdictDistribution", verdictDistribution);
        
        return result;
    }

    public Map<String, Object> getTokenUsageTimeline(Long userId, String range, String granularity) {
        Map<String, Object> result = new HashMap<>();
        
        Instant now = Instant.now();
        Instant startTime;
        String normalizedGranularity = normalizeGranularity(granularity);
        
        switch (range) {
            case "1h":
                startTime = now.minus(1, ChronoUnit.HOURS);
                break;
            case "7d":
                startTime = now.minus(7, ChronoUnit.DAYS);
                break;
            case "30d":
                startTime = now.minus(30, ChronoUnit.DAYS);
                break;
            case "24h":
            default:
                startTime = now.minus(24, ChronoUnit.HOURS);
                break;
        }
        
        List<Object[]> rawData = tokenUsageRepository.findTokenUsageTimeline(userId, startTime);
        
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern(formatByGranularity(normalizedGranularity))
                .withZone(ZoneId.systemDefault());
        
        Map<String, Long> timelineMap = new LinkedHashMap<>();
        for (Object[] row : rawData) {
            Instant timestamp = (Instant) row[0];
            Long tokens = ((Number) row[1]).longValue();
            String timeLabel = formatter.format(bucketStart(timestamp, normalizedGranularity));
            timelineMap.merge(timeLabel, tokens, (a, b) -> a + b);
        }
        
        List<Map<String, Object>> timeline = timelineMap.entrySet().stream()
            .map(entry -> {
                Map<String, Object> item = new HashMap<>();
                item.put("time", entry.getKey());
                item.put("tokens", entry.getValue());
                return item;
            })
            .collect(Collectors.toList());
        
        result.put("timeline", timeline);
        result.put("range", range);
        result.put("granularity", normalizedGranularity);
        
        long totalTokens = tokenUsageRepository.sumTokensByUserIdSince(userId, startTime);
        result.put("totalTokens", totalTokens);
        
        return result;
    }

    public Map<String, Object> getInterceptTimeline(Long userId, String range, String granularity) {
        Map<String, Object> result = new HashMap<>();
        
        Instant now = Instant.now();
        Instant startTime;
        String normalizedGranularity = normalizeGranularity(granularity);
        
        switch (range) {
            case "1h":
                startTime = now.minus(1, ChronoUnit.HOURS);
                break;
            case "7d":
                startTime = now.minus(7, ChronoUnit.DAYS);
                break;
            case "30d":
                startTime = now.minus(30, ChronoUnit.DAYS);
                break;
            case "24h":
            default:
                startTime = now.minus(24, ChronoUnit.HOURS);
                break;
        }
        
        List<Object[]> rawData = safetyEvaluationRepository.findInterceptTimeline(userId, startTime);
        
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern(formatByGranularity(normalizedGranularity))
                .withZone(ZoneId.systemDefault());
        
        Map<String, Long> timelineMap = new LinkedHashMap<>();
        for (Object[] row : rawData) {
            Instant timestamp = (Instant) row[0];
            Long count = ((Number) row[1]).longValue();
            String timeLabel = formatter.format(bucketStart(timestamp, normalizedGranularity));
            timelineMap.merge(timeLabel, count, (a, b) -> a + b);
        }
        
        List<Map<String, Object>> timeline = timelineMap.entrySet().stream()
            .map(entry -> {
                Map<String, Object> item = new HashMap<>();
                item.put("time", entry.getKey());
                item.put("count", entry.getValue());
                return item;
            })
            .collect(Collectors.toList());
        
        result.put("timeline", timeline);
        result.put("range", range);
        result.put("granularity", normalizedGranularity);
        
        long totalIntercepts = safetyEvaluationRepository.countByUserIdSince(userId, startTime);
        result.put("totalIntercepts", totalIntercepts);
        
        return result;
    }

    private int getRiskLevelOrder(String level) {
        switch (level) {
            case "CRITICAL": return 4;
            case "HIGH": return 3;
            case "MEDIUM": return 2;
            case "LOW": return 1;
            default: return 0;
        }
    }

    private String normalizeGranularity(String granularity) {
        if (granularity == null) {
            return "hour";
        }
        switch (granularity.toLowerCase()) {
            case "minute":
            case "hour":
            case "day":
            case "week":
            case "month":
                return granularity.toLowerCase();
            default:
                return "hour";
        }
    }

    private String formatByGranularity(String granularity) {
        switch (granularity) {
            case "minute":
                return "MM-dd HH:mm";
            case "hour":
                return "MM-dd HH:00";
            case "day":
                return "yyyy-MM-dd";
            case "week":
                return "yyyy-'W'ww";
            case "month":
                return "yyyy-MM";
            default:
                return "MM-dd HH:00";
        }
    }

    private Instant bucketStart(Instant ts, String granularity) {
        ZonedDateTime zdt = ts.atZone(ZoneId.systemDefault());
        switch (granularity) {
            case "minute":
                zdt = zdt.withSecond(0).withNano(0);
                break;
            case "hour":
                zdt = zdt.withMinute(0).withSecond(0).withNano(0);
                break;
            case "day":
                zdt = zdt.toLocalDate().atStartOfDay(zdt.getZone());
                break;
            case "week":
                int dayOfWeek = zdt.getDayOfWeek().getValue();
                zdt = zdt.minusDays(dayOfWeek - 1L).toLocalDate().atStartOfDay(zdt.getZone());
                break;
            case "month":
                zdt = zdt.withDayOfMonth(1).toLocalDate().atStartOfDay(zdt.getZone());
                break;
            default:
                zdt = zdt.withMinute(0).withSecond(0).withNano(0);
                break;
        }
        return zdt.toInstant();
    }
}
