package com.opencarapace.server.securityscan;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.opencarapace.server.user.User;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Slf4j
public class SecurityScanRunService {

    /** Phase 文案用 Unicode 转义写入 class，避免 Windows/构建机源码编码与 UTF-8 不一致导致前缀乱码 */
    private static final String PHASE_INIT = "\u521d\u59cb\u5316";
    private static final String PHASE_PREPARE = "\u51c6\u5907\u6267\u884c\u626b\u63cf\u9879";
    private static final String PHASE_RUN_PREFIX = "\u6267\u884c\uff1a";
    private static final String PHASE_DONE = "\u5b8c\u6210";
    private static final String PHASE_FAILED = "\u5931\u8d25";

    private final SecurityScanRunRepository runRepository;
    private final SecurityScanItemRepository itemRepository;
    private final SecurityScanService securityScanService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final ExecutorService executor = Executors.newFixedThreadPool(2, r -> {
        Thread t = new Thread(r, "security-scan-runner");
        t.setDaemon(true);
        return t;
    });

    public SecurityScanRunService(SecurityScanRunRepository runRepository,
                                  SecurityScanItemRepository itemRepository,
                                  SecurityScanService securityScanService) {
        this.runRepository = runRepository;
        this.itemRepository = itemRepository;
        this.securityScanService = securityScanService;
    }

    public Map<String, Object> startAsync(User user, List<String> itemCodes, String context, String clientOsRaw, String localeRaw) {
        if (itemCodes == null || itemCodes.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "itemCodes 不能为空");
        }
        String ctx = context == null ? "" : context.trim();

        Map<String, SecurityScanItem> byCode = itemRepository.findByCodeInAndEnabledTrue(itemCodes).stream()
                .collect(Collectors.toMap(SecurityScanItem::getCode, Function.identity(), (a, b) -> a));
        if (byCode.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "未找到可用的扫描项");
        }

        String lang = SecurityScanLocale.normalize(localeRaw);
        RunBatch batch = buildRunBatch(itemCodes, byCode, clientOsRaw, lang);

        SecurityScanRun run = new SecurityScanRun();
        run.setUserId(user.getId());
        run.setStatus("RUNNING");
        run.setPhase(PHASE_INIT);
        run.setTotalItems(batch.runnable.size());
        run.setDoneItems(0);
        run.setContextText(ctx);
        run.setRequestItemCodesJson(writeJsonSafe(itemCodes));
        run.setFindingsJson(writeJsonSafe(Map.of("findings", List.of())));
        run.setScannedItemCodesJson(writeJsonSafe(List.of()));
        run.setErrorMessage(null);
        run = runRepository.save(run);

        Long runId = run.getId();
        executor.submit(() -> executeRun(runId, user, ctx, batch, localeRaw == null ? "" : localeRaw.trim()));

        return Map.of(
                "runId", runId,
                "status", run.getStatus(),
                "phase", run.getPhase(),
                "totalItems", run.getTotalItems(),
                "doneItems", run.getDoneItems(),
                "createdAt", run.getCreatedAt() != null ? run.getCreatedAt().toString() : Instant.now().toString()
        );
    }

    public List<Map<String, Object>> listForUser(User user) {
        List<SecurityScanRun> runs = runRepository.findTop50ByUserIdOrderByCreatedAtDesc(user.getId());
        List<Map<String, Object>> out = new ArrayList<>();
        for (SecurityScanRun r : runs) {
            out.add(toSummary(r));
        }
        return out;
    }

    public Map<String, Object> getForUser(User user, Long runId) {
        SecurityScanRun r = runRepository.findByIdAndUserId(runId, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "未找到扫描记录"));
        Map<String, Object> out = new LinkedHashMap<>();
        out.putAll(toSummary(r));
        out.put("requestItemCodes", readListSafe(r.getRequestItemCodesJson()));
        out.put("scannedItemCodes", readListSafe(r.getScannedItemCodesJson()));
        out.put("findings", readFindingsSafe(r.getFindingsJson()));
        out.put("errorMessage", r.getErrorMessage());
        return out;
    }

    private static final class RunBatch {
        final List<Map<String, Object>> osSkipFindings;
        final List<SecurityScanItem> runnable;

        RunBatch(List<Map<String, Object>> osSkipFindings, List<SecurityScanItem> runnable) {
            this.osSkipFindings = osSkipFindings;
            this.runnable = runnable;
        }
    }

    private RunBatch buildRunBatch(List<String> itemCodes,
                                   Map<String, SecurityScanItem> byCode,
                                   String clientOsRaw,
                                   String lang) {
        List<SecurityScanItem> ordered = new ArrayList<>();
        for (String code : itemCodes) {
            SecurityScanItem it = byCode.get(code);
            if (it != null) {
                ordered.add(it);
            }
        }
        String token = SecurityScanService.normalizeClientOsToken(clientOsRaw);
        List<Map<String, Object>> skips = new ArrayList<>();
        List<SecurityScanItem> runnable = new ArrayList<>();
        for (SecurityScanItem item : ordered) {
            if (!SecurityScanService.itemAppliesToClientOs(item, token)) {
                skips.add(osSkipFindingMap(item.getCode(), item.getClientOsScope(), lang));
            } else {
                runnable.add(item);
            }
        }
        return new RunBatch(skips, runnable);
    }

    private static Map<String, Object> osSkipFindingMap(String code, String scope, String lang) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("itemCode", code);
        m.put("severity", "WARN");
        if (!"zh".equals(lang)) {
            m.put("title", "Skipped (wrong operating system)");
            m.put("detail", "This item applies only to " + clientOsScopeLabelEn(scope) + ".");
            m.put("remediation", "Run the scan on a client for that OS, or deselect this item.");
        } else {
            m.put("title", "\u5df2\u8df3\u8fc7\uff08\u4e0d\u9002\u7528\u5f53\u524d\u64cd\u4f5c\u7cfb\u7edf\uff09");
            m.put("detail", "\u8be5\u626b\u63cf\u9879\u4ec5\u9002\u7528\u4e8e " + SecurityScanService.clientOsScopeLabel(scope) + "\u3002");
            m.put("remediation", "\u5728\u5bf9\u5e94\u7cfb\u7edf\u7684\u5ba2\u6237\u7aef\u4e0a\u6267\u884c\u626b\u63cf\uff0c\u6216\u53d6\u6d88\u52fe\u9009\u6b64\u9879\u3002");
        }
        m.put("location", "");
        return m;
    }

    private static String clientOsScopeLabelEn(String scope) {
        if (scope == null || scope.isBlank() || "ALL".equalsIgnoreCase(scope)) {
            return "all operating systems";
        }
        if ("WINDOWS".equalsIgnoreCase(scope)) {
            return "Windows";
        }
        if ("MACOS".equalsIgnoreCase(scope)) {
            return "macOS";
        }
        return scope;
    }

    private void executeRun(Long runId, User user, String context, RunBatch batch, String locale) {
        try {
            List<Map<String, Object>> findings = new ArrayList<>(batch.osSkipFindings);
            List<String> scannedCodes = new ArrayList<>();
            List<SecurityScanItem> items = batch.runnable;
            int total = items.size();

            update(runId, "RUNNING", PHASE_PREPARE, 0, total, findings, scannedCodes, null);

            if (total == 0) {
                update(runId, "SUCCESS", PHASE_DONE, 0, 0, findings, scannedCodes, null);
                return;
            }

            int done = 0;
            for (SecurityScanItem item : items) {
                String phase = PHASE_RUN_PREFIX + (item.getTitle() == null ? item.getCode() : item.getTitle());
                update(runId, "RUNNING", phase, done, total, findings, scannedCodes, null);

                scannedCodes.add(item.getCode());

                try {
                    Map<String, Object> one = securityScanService.runScan(
                            user, List.of(item.getCode()), context, null, locale);
                    Object oneFindings = one.get("findings");
                    if (oneFindings instanceof List<?> lst) {
                        for (Object o : lst) {
                            Map<String, Object> normalized = normalizeMap(o);
                            if (!normalized.isEmpty()) findings.add(normalized);
                        }
                    }
                } catch (Exception e) {
                    log.warn("Async scan item failed: {} {}", item.getCode(), e.getMessage(), e);
                    findings.add(Map.of(
                            "itemCode", item.getCode(),
                            "severity", "WARN",
                            "title", "\u626b\u63cf\u9879\u6267\u884c\u5931\u8d25",
                            "detail", e.getMessage() == null ? "" : e.getMessage(),
                            "remediation", "\u68c0\u67e5\u4e91\u7aef\u626b\u63cf\u9879\u914d\u7f6e\u6216 DeepSeek \u914d\u7f6e\u540e\u91cd\u8bd5",
                            "location", ""
                    ));
                }

                done++;
                update(runId, "RUNNING", phase, done, total, findings, scannedCodes, null);
            }

            update(runId, "SUCCESS", PHASE_DONE, total, total, findings, scannedCodes, null);
        } catch (Exception e) {
            log.warn("Async scan failed: runId={} {}", runId, e.getMessage(), e);
            fail(runId, e.getMessage() != null ? e.getMessage() : "扫描失败");
        }
    }

    private void fail(Long runId, String message) {
        update(runId, "FAILED", PHASE_FAILED, 0, 0, List.of(), List.of(), message);
    }

    private void update(Long runId,
                        String status,
                        String phase,
                        int doneItems,
                        int totalItems,
                        List<Map<String, Object>> findings,
                        List<String> scannedCodes,
                        String errorMessage) {
        if (runId == null) return;
        runRepository.findById(runId).ifPresent(r -> {
            r.setStatus(status);
            r.setPhase(phase == null ? "" : phase);
            r.setDoneItems(Math.max(0, doneItems));
            r.setTotalItems(Math.max(0, totalItems));
            r.setFindingsJson(writeJsonSafe(Map.of("findings", findings)));
            r.setScannedItemCodesJson(writeJsonSafe(scannedCodes));
            r.setErrorMessage(errorMessage);
            runRepository.save(r);
        });
    }

    private Map<String, Object> normalizeMap(Object o) {
        if (!(o instanceof Map<?, ?> raw)) return Map.of();
        Map<String, Object> out = new LinkedHashMap<>();
        for (Map.Entry<?, ?> e : raw.entrySet()) {
            if (e.getKey() == null) continue;
            out.put(String.valueOf(e.getKey()), e.getValue());
        }
        return out;
    }

    private Map<String, Object> toSummary(SecurityScanRun r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("status", r.getStatus());
        m.put("phase", r.getPhase());
        m.put("totalItems", r.getTotalItems());
        m.put("doneItems", r.getDoneItems());
        m.put("createdAt", r.getCreatedAt() != null ? r.getCreatedAt().toString() : null);
        m.put("updatedAt", r.getUpdatedAt() != null ? r.getUpdatedAt().toString() : null);

        // 快速统计（已完成时才计算，避免频繁 JSON parse）
        if ("SUCCESS".equalsIgnoreCase(r.getStatus()) && r.getFindingsJson() != null && !r.getFindingsJson().isBlank()) {
            List<Map<String, Object>> fs = readFindingsSafe(r.getFindingsJson());
            int c = 0, w = 0, p = 0;
            for (Map<String, Object> f : fs) {
                String sev = String.valueOf(f.getOrDefault("severity", "")).toUpperCase(Locale.ROOT);
                if ("CRITICAL".equals(sev)) c++;
                else if ("WARN".equals(sev)) w++;
                else if ("PASS".equals(sev)) p++;
            }
            m.put("counts", Map.of("c", c, "w", w, "p", p, "total", fs.size()));
        }
        return m;
    }

    private String writeJsonSafe(Object o) {
        try {
            return objectMapper.writeValueAsString(o);
        } catch (Exception e) {
            return "{}";
        }
    }

    private List<String> readListSafe(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {
            });
        } catch (Exception e) {
            return List.of();
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> readFindingsSafe(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            Map<String, Object> root = objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {
            });
            Object fs = root.get("findings");
            if (fs instanceof List<?> lst) {
                List<Map<String, Object>> out = new ArrayList<>();
                for (Object o : lst) {
                    if (o instanceof Map<?, ?> m) out.add((Map<String, Object>) m);
                }
                return out;
            }
            return List.of();
        } catch (Exception e) {
            return List.of();
        }
    }
}

