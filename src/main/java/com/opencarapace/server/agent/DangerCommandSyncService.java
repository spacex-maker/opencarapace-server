package com.opencarapace.server.agent;

import com.opencarapace.server.config.SystemConfigService;
import com.opencarapace.server.config.entity.SystemConfig;
import com.opencarapace.server.danger.DangerCommand;
import com.opencarapace.server.danger.DangerCommandRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * 危险指令库同步：通过 Tavily 搜索 + DeepSeek 解析，按系统类型从互联网更新 oc_danger_commands。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DangerCommandSyncService {

    private static final String SYSTEM_PROMPT = """
你是一个安全运维助手。根据用户提供的互联网搜索结果，提取其中的「危险命令/危险操作」信息。
请输出一个 JSON 对象，包含一个数组，数组的 key 为 "items"。
每个元素必须包含字段（均为字符串）：
- command_pattern: 危险指令或命令模式（如 rm -rf、DROP TABLE）
- system_type: 系统类型，只能从 [LINUX, WINDOWS, DATABASE, SHELL, DOCKER, KUBERNETES, GIT, OTHER] 中选一个
- category: 分类，从 [FILE_SYSTEM, DATABASE, NETWORK, PROCESS, PERMISSION, CONTAINER, VERSION_CONTROL, OTHER] 中选
- risk_level: 风险等级，从 [CRITICAL, HIGH, MEDIUM, LOW] 中选
- title: 简短中文标题
- description: 为何危险、典型场景（中文）
- mitigation: 缓解建议、替代方案（中文）
- tags: 逗号分隔的英文标签，可选

只输出 JSON，不要其他解释。若无法从内容中提取出任何危险指令，则输出 {"items":[]}。
""";

    private final SystemConfigService systemConfigService;
    private final TavilyClient tavilyClient;
    private final DeepSeekClient deepSeekClient;
    private final DangerCommandRepository dangerCommandRepository;

    /** 执行一次全量同步：仅当系统配置允许互联网查询时，才通过 Tavily+DeepSeek 更新库。 */
    @Transactional
    public SyncResult sync() {
        String useInternet = systemConfigService.getValue(SystemConfig.KEY_DANGER_COMMANDS_USE_INTERNET)
                .map(String::trim)
                .orElse("");
        if (!"true".equalsIgnoreCase(useInternet)) {
            log.info("DangerCommand sync skipped: danger_commands.sync.use_internet is not true");
            return new SyncResult(0, 0, "internet sync disabled");
        }

        String tavilyKey = systemConfigService.getValue(SystemConfig.KEY_TAVILY_API_KEY).orElse(null);
        String deepseekKey = systemConfigService.getValue(SystemConfig.KEY_DEEPSEEK_API_KEY).orElse(null);
        if (tavilyKey == null || tavilyKey.isBlank() || deepseekKey == null || deepseekKey.isBlank()) {
            log.warn("DangerCommand sync skipped: missing tavily.api_key or deepseek.api_key in system config");
            return new SyncResult(0, 0, "missing API keys");
        }

        int added = 0, updated = 0;
        for (DangerCommand.SystemType systemType : DangerCommand.SystemType.values()) {
            try {
                String query = "dangerous commands " + systemType.name().toLowerCase(Locale.ROOT) + " system security";
                TavilyClient.TavilySearchResponse searchResp = tavilyClient.search(tavilyKey, query, 10);
                String searchContext = buildSearchContext(searchResp);
                String userMsg = "请从以下互联网搜索结果中提取危险指令条目，按要求的 JSON 格式输出。\n\n" + searchContext;
                String json = deepSeekClient.chat(deepseekKey, SYSTEM_PROMPT, userMsg);
                List<DeepSeekClient.DangerCommandDto> dtos = deepSeekClient.parseDangerCommandsJson(json);
                for (DeepSeekClient.DangerCommandDto dto : dtos) {
                    if (dto.getCommandPattern() == null || dto.getCommandPattern().isBlank()) continue;
                    DangerCommand.SystemType st = parseSystemType(dto.getSystemType(), systemType);
                    Optional<DangerCommand> existing = dangerCommandRepository.findByCommandPatternAndSystemType(dto.getCommandPattern().trim(), st);
                    DangerCommand entity = existing.orElseGet(DangerCommand::new);
                    entity.setCommandPattern(dto.getCommandPattern().trim());
                    entity.setSystemType(st);
                    entity.setCategory(parseCategory(dto.getCategory()));
                    entity.setRiskLevel(parseRiskLevel(dto.getRiskLevel()));
                    entity.setTitle(dto.getTitle() != null && !dto.getTitle().isBlank() ? dto.getTitle().trim() : dto.getCommandPattern());
                    entity.setDescription(dto.getDescription());
                    entity.setMitigation(dto.getMitigation());
                    entity.setTags(dto.getTags());
                    entity.setEnabled(true);
                    dangerCommandRepository.save(entity);
                    if (existing.isPresent()) updated++; else added++;
                }
            } catch (Exception e) {
                log.warn("DangerCommand sync failed for systemType={}: {}", systemType, e.getMessage());
            }
        }
        log.info("DangerCommand sync finished: added={}, updated={}", added, updated);
        return new SyncResult(added, updated, null);
    }

    private String buildSearchContext(TavilyClient.TavilySearchResponse resp) {
        if (resp == null || resp.getResults() == null) return "";
        StringBuilder sb = new StringBuilder();
        for (TavilyClient.TavilyResult r : resp.getResults()) {
            if (r.getTitle() != null) sb.append("Title: ").append(r.getTitle()).append("\n");
            if (r.getContent() != null) sb.append("Content: ").append(r.getContent()).append("\n");
            sb.append("---\n");
        }
        return sb.toString();
    }

    private DangerCommand.SystemType parseSystemType(String s, DangerCommand.SystemType fallback) {
        if (s == null || s.isBlank()) return fallback;
        try {
            return DangerCommand.SystemType.valueOf(s.trim().toUpperCase(Locale.ROOT));
        } catch (Exception e) {
            return fallback;
        }
    }

    private DangerCommand.DangerCategory parseCategory(String s) {
        if (s == null || s.isBlank()) return DangerCommand.DangerCategory.OTHER;
        try {
            return DangerCommand.DangerCategory.valueOf(s.trim().toUpperCase(Locale.ROOT).replace(" ", "_"));
        } catch (Exception e) {
            return DangerCommand.DangerCategory.OTHER;
        }
    }

    private DangerCommand.RiskLevel parseRiskLevel(String s) {
        if (s == null || s.isBlank()) return DangerCommand.RiskLevel.MEDIUM;
        try {
            return DangerCommand.RiskLevel.valueOf(s.trim().toUpperCase(Locale.ROOT));
        } catch (Exception e) {
            return DangerCommand.RiskLevel.MEDIUM;
        }
    }

    public record SyncResult(int added, int updated, String error) {}
}
