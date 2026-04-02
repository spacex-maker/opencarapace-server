package com.opencarapace.server.securityscan;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.opencarapace.server.agent.DeepSeekClient;
import com.opencarapace.server.config.SystemConfigService;
import com.opencarapace.server.config.entity.SystemConfig;
import com.opencarapace.server.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class SecurityScanService {

    private static final String TYPE_AI = "AI_PROMPT";
    private static final String TYPE_STATIC = "STATIC_INFO";

    private static final String DEFAULT_SYSTEM = """
            你是 AI Agent / 本地开发环境安全审计助手。根据用户提供的「环境上下文」，只做安全与配置风险分析。
            必须只输出一个 JSON 对象，不要 markdown，不要代码块。格式严格如下：
            {"findings":[{"severity":"CRITICAL|WARN|PASS","title":"","detail":"","remediation":"","location":""}]}
            severity 说明：CRITICAL=需立即处理，WARN=建议修复，PASS=未发现该维度问题。
            若信息不足，仍返回 findings，可包含一条 WARN 说明需要更多上下文。
            """;

    private final SecurityScanItemRepository itemRepository;
    private final SystemConfigService systemConfigService;
    private final DeepSeekClient deepSeekClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public List<Map<String, Object>> listItemsForClient() {
        return itemRepository.findByEnabledTrueOrderBySortOrderAscIdAsc().stream()
                .map(this::toPublicItem)
                .toList();
    }

    private Map<String, Object> toPublicItem(SecurityScanItem it) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", it.getId());
        m.put("code", it.getCode());
        m.put("title", it.getTitle());
        m.put("description", it.getDescription());
        m.put("category", it.getCategory());
        m.put("defaultSeverity", it.getDefaultSeverity());
        m.put("scannerType", it.getScannerType());
        return m;
    }

    /**
     * 执行扫描：AI 项使用系统配置的 deepseek.api_key；静态项直接展开 spec。
     */
    public Map<String, Object> runScan(User user, List<String> itemCodes, String context) {
        if (itemCodes == null || itemCodes.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "itemCodes 不能为空");
        }
        String ctx = context == null ? "" : context.trim();
        List<SecurityScanItem> items = itemRepository.findByCodeInAndEnabledTrue(itemCodes);
        if (items.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "未找到可用的扫描项");
        }

        List<Map<String, Object>> findings = new ArrayList<>();
        List<String> scannedCodes = new ArrayList<>();

        for (SecurityScanItem item : items) {
            scannedCodes.add(item.getCode());
            try {
                JsonNode spec = objectMapper.readTree(item.getSpecJson() == null ? "{}" : item.getSpecJson());
                if (TYPE_STATIC.equalsIgnoreCase(item.getScannerType())) {
                    appendStaticFindings(findings, item.getCode(), spec);
                } else if (TYPE_AI.equalsIgnoreCase(item.getScannerType())) {
                    appendAiFindings(findings, item, spec, ctx);
                } else {
                    findings.add(simpleFinding(item.getCode(), "WARN", "未知扫描类型",
                            "scannerType=" + item.getScannerType(), "请联系管理员更新扫描项配置", ""));
                }
            } catch (Exception e) {
                log.warn("Scan item failed: {} {}", item.getCode(), e.getMessage());
                findings.add(simpleFinding(item.getCode(), "WARN", "扫描项执行失败",
                        e.getMessage(), "检查云端扫描项 spec_json 或 DeepSeek 配置", ""));
            }
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("findings", findings);
        out.put("scannedItemCodes", scannedCodes);
        out.put("scannedAt", Instant.now().toString());
        out.put("userId", user.getId());
        return out;
    }

    private void appendStaticFindings(List<Map<String, Object>> findings, String code, JsonNode spec) {
        JsonNode arr = spec.path("staticFindings");
        if (!arr.isArray() || arr.isEmpty()) {
            findings.add(simpleFinding(code, "PASS", "静态检查项", "无附加静态规则", "", ""));
            return;
        }
        for (JsonNode f : arr) {
            findings.add(findingFromJson(code, f));
        }
    }

    private void appendAiFindings(List<Map<String, Object>> findings, SecurityScanItem item, JsonNode spec, String context) {
        String apiKey = systemConfigService.getValue(SystemConfig.KEY_DEEPSEEK_API_KEY).orElse("").trim();
        if (apiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "云端未配置 DeepSeek API Key（deepseek.api_key），无法执行 AI 安全扫描");
        }
        String systemPrompt = textOrDefault(spec, "systemPrompt", DEFAULT_SYSTEM);
        String userTpl = textOrDefault(spec, "userPromptTemplate",
                "【环境上下文】\n{{context}}\n\n【检查项】{{focus}}\n\n请按系统要求的 JSON 输出 findings。");
        String userMsg = userTpl
                .replace("{{context}}", context == null ? "" : context)
                .replace("{{focus}}", item.getTitle() == null ? "" : item.getTitle())
                .replace("{{code}}", item.getCode() == null ? "" : item.getCode())
                .replace("{{description}}", item.getDescription() == null ? "" : item.getDescription());

        String raw = deepSeekClient.chat(apiKey, systemPrompt, userMsg);
        if (raw == null || raw.isBlank()) {
            findings.add(simpleFinding(item.getCode(), "WARN", "模型无输出", "DeepSeek 返回空内容", "稍后重试或检查网络", ""));
            return;
        }
        JsonNode root = parseJsonLenient(raw);
        JsonNode arr = root.path("findings");
        if (!arr.isArray() || arr.isEmpty()) {
            findings.add(simpleFinding(item.getCode(), "WARN", "无法解析模型输出",
                    truncate(raw, 400), "请调整该扫描项的 systemPrompt / userPromptTemplate", ""));
            return;
        }
        for (JsonNode f : arr) {
            findings.add(findingFromJson(item.getCode(), f));
        }
    }

    private static String textOrDefault(JsonNode spec, String field, String def) {
        JsonNode n = spec.get(field);
        if (n == null || !n.isTextual()) return def;
        String t = n.asText("");
        return t.isBlank() ? def : t;
    }

    private JsonNode parseJsonLenient(String raw) {
        try {
            String trimmed = raw.trim();
            if (trimmed.startsWith("```")) {
                int start = trimmed.indexOf("{");
                int end = trimmed.lastIndexOf("}");
                if (start >= 0 && end > start) trimmed = trimmed.substring(start, end + 1);
            }
            return objectMapper.readTree(trimmed);
        } catch (Exception e) {
            return objectMapper.createObjectNode();
        }
    }

    private Map<String, Object> findingFromJson(String itemCode, JsonNode f) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("itemCode", itemCode);
        m.put("severity", text(f, "severity", "WARN").toUpperCase());
        m.put("title", text(f, "title", "未命名"));
        m.put("detail", text(f, "detail", ""));
        m.put("remediation", text(f, "remediation", ""));
        m.put("location", text(f, "location", ""));
        return m;
    }

    private static String text(JsonNode f, String key, String def) {
        JsonNode n = f.get(key);
        return n == null || !n.isTextual() ? def : n.asText(def);
    }

    private Map<String, Object> simpleFinding(String itemCode, String severity, String title, String detail, String remediation, String location) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("itemCode", itemCode);
        m.put("severity", severity);
        m.put("title", title);
        m.put("detail", detail);
        m.put("remediation", remediation);
        m.put("location", location);
        return m;
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }
}
