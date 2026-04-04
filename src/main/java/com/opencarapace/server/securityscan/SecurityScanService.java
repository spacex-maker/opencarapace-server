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
import java.util.function.Function;
import java.util.stream.Collectors;

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

    /**
     * 将客户端上报的 OS 标识规范为 WINDOWS / MACOS / OTHER。
     * 若 {@code raw} 为空则返回 {@code null}，表示不按操作系统过滤（兼容未上报的旧客户端）。
     */
    public static String normalizeClientOsToken(String raw) {
        if (raw == null) return null;
        String s = raw.trim().toLowerCase();
        if (s.isEmpty()) return null;
        if ("win32".equals(s) || "windows".equals(s) || "win".equals(s)) return "WINDOWS";
        if ("darwin".equals(s) || "macos".equals(s) || "mac".equals(s)) return "MACOS";
        return "OTHER";
    }

    /**
     * 扫描项是否适用于当前客户端 OS。{@code normalizedToken == null} 时不做限制。
     */
    public static boolean itemAppliesToClientOs(SecurityScanItem item, String normalizedToken) {
        if (normalizedToken == null) return true;
        String scope = item.getClientOsScope();
        if (scope == null || scope.isBlank() || "ALL".equalsIgnoreCase(scope)) return true;
        if ("OTHER".equals(normalizedToken)) {
            return false;
        }
        if ("WINDOWS".equalsIgnoreCase(scope)) {
            return "WINDOWS".equals(normalizedToken);
        }
        if ("MACOS".equalsIgnoreCase(scope)) return "MACOS".equals(normalizedToken);
        return true;
    }

    public static String clientOsScopeLabel(String scope) {
        if (scope == null || scope.isBlank() || "ALL".equalsIgnoreCase(scope)) return "所有系统";
        if ("WINDOWS".equalsIgnoreCase(scope)) return "Windows";
        if ("MACOS".equalsIgnoreCase(scope)) return "macOS";
        return scope;
    }

    private static String clientOsScopeLabelEn(String scope) {
        if (scope == null || scope.isBlank() || "ALL".equalsIgnoreCase(scope)) return "all operating systems";
        if ("WINDOWS".equalsIgnoreCase(scope)) return "Windows";
        if ("MACOS".equalsIgnoreCase(scope)) return "macOS";
        return scope;
    }

    public List<Map<String, Object>> listItemsForClient() {
        return listItemsForClient(null);
    }

    public List<Map<String, Object>> listItemsForClient(String clientOsRaw) {
        String token = normalizeClientOsToken(clientOsRaw);
        return itemRepository.findByEnabledTrueOrderBySortOrderAscIdAsc().stream()
                .filter(it -> itemAppliesToClientOs(it, token))
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
        m.put("scanSection", it.getScanSection());
        m.put("scanGroup", it.getScanGroup());
        m.put("defaultSeverity", it.getDefaultSeverity());
        m.put("scannerType", it.getScannerType());
        m.put("clientOsScope", it.getClientOsScope() == null || it.getClientOsScope().isBlank()
                ? "ALL"
                : it.getClientOsScope());
        m.put("sortOrder", it.getSortOrder());
        return m;
    }

    /**
     * 执行扫描：AI 项使用系统配置的 deepseek.api_key；静态项直接展开 spec。
     *
     * @param clientOsRaw 客户端 {@code process.platform} 等；为空则不过滤操作系统。
     */
    /**
     * @param localeRaw 桌面端语言，如 zh / en；空则按中文处理。
     */
    public Map<String, Object> runScan(User user, List<String> itemCodes, String context, String clientOsRaw, String localeRaw) {
        if (itemCodes == null || itemCodes.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "itemCodes 不能为空");
        }
        String ctx = context == null ? "" : context.trim();
        String osToken = normalizeClientOsToken(clientOsRaw);
        String lang = SecurityScanLocale.normalize(localeRaw);

        Map<String, SecurityScanItem> byCode = itemRepository.findByCodeInAndEnabledTrue(itemCodes).stream()
                .collect(Collectors.toMap(SecurityScanItem::getCode, Function.identity(), (a, b) -> a));

        if (byCode.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "未找到可用的扫描项");
        }

        List<Map<String, Object>> findings = new ArrayList<>();
        List<String> scannedCodes = new ArrayList<>();
        List<SecurityScanItem> toRun = new ArrayList<>();

        for (String code : itemCodes) {
            SecurityScanItem item = byCode.get(code);
            if (item == null) {
                continue;
            }
            if (!itemAppliesToClientOs(item, osToken)) {
                findings.add(osSkippedFinding(code, item.getClientOsScope(), lang));
                continue;
            }
            toRun.add(item);
        }

        if (toRun.isEmpty()) {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("findings", findings);
            out.put("scannedItemCodes", scannedCodes);
            out.put("scannedAt", Instant.now().toString());
            out.put("userId", user.getId());
            return out;
        }

        for (SecurityScanItem item : toRun) {
            scannedCodes.add(item.getCode());
            try {
                JsonNode spec = objectMapper.readTree(item.getSpecJson() == null ? "{}" : item.getSpecJson());
                if (TYPE_STATIC.equalsIgnoreCase(item.getScannerType())) {
                    appendStaticFindings(findings, item.getCode(), spec, lang);
                } else if (TYPE_AI.equalsIgnoreCase(item.getScannerType())) {
                    appendAiFindings(findings, item, spec, ctx, lang);
                } else {
                    findings.add(unknownScannerFinding(item.getCode(), item.getScannerType(), lang));
                }
            } catch (Exception e) {
                log.warn("Scan item failed: {} {}", item.getCode(), e.getMessage(), e);
                findings.add(itemFailedFinding(item.getCode(), e.getMessage(), lang));
            }
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("findings", findings);
        out.put("scannedItemCodes", scannedCodes);
        out.put("scannedAt", Instant.now().toString());
        out.put("userId", user.getId());
        return out;
    }

    private void appendStaticFindings(List<Map<String, Object>> findings, String code, JsonNode spec, String lang) {
        JsonNode arr = pickStaticFindingsArray(spec, lang);
        if (!arr.isArray() || arr.isEmpty()) {
            findings.add(emptyStaticFinding(code, lang));
            return;
        }
        for (JsonNode f : arr) {
            findings.add(findingFromJson(code, f));
        }
    }

    private static JsonNode pickStaticFindingsArray(JsonNode spec, String lang) {
        if ("zh".equals(lang)) {
            return spec.path("staticFindings");
        }
        JsonNode en = spec.get("staticFindingsEn");
        if (en != null && en.isArray() && !en.isEmpty()) {
            return en;
        }
        return spec.path("staticFindings");
    }

    private void appendAiFindings(List<Map<String, Object>> findings, SecurityScanItem item, JsonNode spec, String context, String lang) {
        String apiKey = systemConfigService.getValue(SystemConfig.KEY_DEEPSEEK_API_KEY).orElse("").trim();
        if (apiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "云端未配置 DeepSeek API Key（deepseek.api_key），无法执行 AI 安全扫描");
        }
        String systemPrompt = textOrDefault(spec, "systemPrompt", DEFAULT_SYSTEM)
                + SecurityScanLocale.outputLanguageDirective(lang);
        String userTpl = textOrDefault(spec, "userPromptTemplate",
                "【环境上下文】\n{{context}}\n\n【检查项】{{focus}}\n\n请按系统要求的 JSON 输出 findings。");
        String userMsg = userTpl
                .replace("{{context}}", context == null ? "" : context)
                .replace("{{focus}}", item.getTitle() == null ? "" : item.getTitle())
                .replace("{{code}}", item.getCode() == null ? "" : item.getCode())
                .replace("{{description}}", item.getDescription() == null ? "" : item.getDescription());

        String raw = deepSeekClient.chat(apiKey, systemPrompt, userMsg);
        if (raw == null || raw.isBlank()) {
            findings.add(modelEmptyFinding(item.getCode(), lang));
            return;
        }
        JsonNode root = parseJsonLenient(raw);
        JsonNode arr = root.path("findings");
        if (!arr.isArray() || arr.isEmpty()) {
            findings.add(modelParseFinding(item.getCode(), raw, lang));
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

    private Map<String, Object> osSkippedFinding(String code, String scope, String lang) {
        if ("en".equals(lang)) {
            return simpleFinding(code, "WARN", "Skipped (wrong operating system)",
                    "This item applies only to " + clientOsScopeLabelEn(scope) + ".",
                    "Run the scan on a client for that OS, or deselect this item.", "");
        }
        return simpleFinding(code, "WARN", "已跳过（不适用当前操作系统）",
                "该扫描项仅适用于 " + clientOsScopeLabel(scope) + "。",
                "在对应系统的客户端上执行扫描，或取消勾选此项。", "");
    }

    private Map<String, Object> unknownScannerFinding(String code, String scannerType, String lang) {
        if ("en".equals(lang)) {
            return simpleFinding(code, "WARN", "Unknown scanner type",
                    "scannerType=" + scannerType, "Ask an admin to update this scan item configuration.", "");
        }
        return simpleFinding(code, "WARN", "未知扫描类型",
                "scannerType=" + scannerType, "请联系管理员更新扫描项配置", "");
    }

    private Map<String, Object> itemFailedFinding(String code, String detail, String lang) {
        if ("en".equals(lang)) {
            return simpleFinding(code, "WARN", "Scan item failed",
                    detail == null ? "" : detail, "Check the cloud scan item spec or DeepSeek configuration and retry.", "");
        }
        return simpleFinding(code, "WARN", "扫描项执行失败",
                detail == null ? "" : detail, "检查云端扫描项 spec_json 或 DeepSeek 配置", "");
    }

    private Map<String, Object> emptyStaticFinding(String code, String lang) {
        if ("en".equals(lang)) {
            return simpleFinding(code, "PASS", "Static check", "No static rules attached", "", "");
        }
        return simpleFinding(code, "PASS", "静态检查项", "无附加静态规则", "", "");
    }

    private Map<String, Object> modelEmptyFinding(String code, String lang) {
        if ("en".equals(lang)) {
            return simpleFinding(code, "WARN", "Model returned no output", "DeepSeek returned empty content", "Retry later or check network connectivity.", "");
        }
        return simpleFinding(code, "WARN", "模型无输出", "DeepSeek 返回空内容", "稍后重试或检查网络", "");
    }

    private Map<String, Object> modelParseFinding(String code, String raw, String lang) {
        if ("en".equals(lang)) {
            return simpleFinding(code, "WARN", "Could not parse model output",
                    truncate(raw, 400), "Adjust this item's systemPrompt / userPromptTemplate.", "");
        }
        return simpleFinding(code, "WARN", "无法解析模型输出",
                truncate(raw, 400), "请调整该扫描项的 systemPrompt / userPromptTemplate", "");
    }
}
