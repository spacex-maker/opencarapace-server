package com.opencarapace.server.dashboard;

import com.opencarapace.server.billing.TokenUsageRepository;
import com.opencarapace.server.danger.DangerCommandRepository;
import com.opencarapace.server.safety.SafetyEvaluationRepository;
import com.opencarapace.server.skill.SkillRepository;
import com.opencarapace.server.user.UserSkillRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneId;
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

    public Map<String, Object> getTokenUsageTimeline(Long userId, String range) {
        Map<String, Object> result = new HashMap<>();
        
        Instant now = Instant.now();
        Instant startTime;
        String timeFormat;
        
        switch (range) {
            case "1h":
                startTime = now.minus(1, ChronoUnit.HOURS);
                timeFormat = "HH:mm";
                break;
            case "7d":
                startTime = now.minus(7, ChronoUnit.DAYS);
                timeFormat = "MM-dd";
                break;
            case "30d":
                startTime = now.minus(30, ChronoUnit.DAYS);
                timeFormat = "MM-dd";
                break;
            case "24h":
            default:
                startTime = now.minus(24, ChronoUnit.HOURS);
                timeFormat = "HH:00";
                break;
        }
        
        List<Object[]> rawData = tokenUsageRepository.findTokenUsageTimeline(userId, startTime);
        
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern(timeFormat).withZone(ZoneId.systemDefault());
        
        Map<String, Long> timelineMap = new LinkedHashMap<>();
        for (Object[] row : rawData) {
            Instant timestamp = (Instant) row[0];
            Long tokens = ((Number) row[1]).longValue();
            String timeLabel = formatter.format(timestamp);
            timelineMap.merge(timeLabel, tokens, Long::sum);
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
        
        long totalTokens = tokenUsageRepository.sumTokensByUserIdSince(userId, startTime);
        result.put("totalTokens", totalTokens);
        
        return result;
    }

    public Map<String, Object> getInterceptTimeline(Long userId, String range) {
        Map<String, Object> result = new HashMap<>();
        
        Instant now = Instant.now();
        Instant startTime;
        String timeFormat;
        
        switch (range) {
            case "1h":
                startTime = now.minus(1, ChronoUnit.HOURS);
                timeFormat = "HH:mm";
                break;
            case "7d":
                startTime = now.minus(7, ChronoUnit.DAYS);
                timeFormat = "MM-dd";
                break;
            case "30d":
                startTime = now.minus(30, ChronoUnit.DAYS);
                timeFormat = "MM-dd";
                break;
            case "24h":
            default:
                startTime = now.minus(24, ChronoUnit.HOURS);
                timeFormat = "HH:00";
                break;
        }
        
        List<Object[]> rawData = safetyEvaluationRepository.findInterceptTimeline(userId, startTime);
        
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern(timeFormat).withZone(ZoneId.systemDefault());
        
        Map<String, Long> timelineMap = new LinkedHashMap<>();
        for (Object[] row : rawData) {
            Instant timestamp = (Instant) row[0];
            Long count = ((Number) row[1]).longValue();
            String timeLabel = formatter.format(timestamp);
            timelineMap.merge(timeLabel, count, Long::sum);
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
}
