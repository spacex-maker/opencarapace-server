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

@Service
@Slf4j
public class SecurityScanRunService {

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

    public Map<String, Object> startAsync(User user, List<String> itemCodes, String context) {
        if (itemCodes == null || itemCodes.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "itemCodes 不能为空");
        }
        String ctx = context == null ? "" : context.trim();

        List<SecurityScanItem> items = itemRepository.findByCodeInAndEnabledTrue(itemCodes);
        if (items.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "未找到可用的扫描项");
        }

        SecurityScanRun run = new SecurityScanRun();
        run.setUserId(user.getId());
        run.setStatus("RUNNING");
        run.setPhase("初始化");
        run.setTotalItems(items.size());
        run.setDoneItems(0);
        run.setContextText(ctx);
        run.setRequestItemCodesJson(writeJsonSafe(itemCodes));
        run.setFindingsJson(writeJsonSafe(Map.of("findings", List.of())));
        run.setScannedItemCodesJson(writeJsonSafe(List.of()));
        run.setErrorMessage(null);
        run = runRepository.save(run);

        Long runId = run.getId();
        executor.submit(() -> executeRun(runId, user, itemCodes, ctx));

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

    private void executeRun(Long runId, User user, List<String> itemCodes, String context) {
        try {
            // 复用既有同步逻辑，但我们要能持续写入进度，因此这里自己分步跑
            List<SecurityScanItem> items = itemRepository.findByCodeInAndEnabledTrue(itemCodes);
            if (items.isEmpty()) {
                fail(runId, "未找到可用的扫描项");
                return;
            }

            List<Map<String, Object>> findings = new ArrayList<>();
            List<String> scannedCodes = new ArrayList<>();

            update(runId, "RUNNING", "准备执行扫描项", 0, items.size(), findings, scannedCodes, null);

            int done = 0;
            for (SecurityScanItem item : items) {
                String phase = "执行：" + (item.getTitle() == null ? item.getCode() : item.getTitle());
                update(runId, "RUNNING", phase, done, items.size(), findings, scannedCodes, null);

                scannedCodes.add(item.getCode());

                try {
                    // 复用 SecurityScanService 的实现，避免复制 prompt / static 解析逻辑
                    Map<String, Object> one = securityScanService.runScan(user, List.of(item.getCode()), context);
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
                            "title", "扫描项执行失败",
                            "detail", e.getMessage() == null ? "" : e.getMessage(),
                            "remediation", "检查云端扫描项配置或 DeepSeek 配置后重试",
                            "location", ""
                    ));
                }

                done++;
                update(runId, "RUNNING", phase, done, items.size(), findings, scannedCodes, null);
            }

            update(runId, "SUCCESS", "完成", items.size(), items.size(), findings, scannedCodes, null);
        } catch (Exception e) {
            log.warn("Async scan failed: runId={} {}", runId, e.getMessage(), e);
            fail(runId, e.getMessage() != null ? e.getMessage() : "扫描失败");
        }
    }

    private void fail(Long runId, String message) {
        update(runId, "FAILED", "失败", 0, 0, List.of(), List.of(), message);
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

