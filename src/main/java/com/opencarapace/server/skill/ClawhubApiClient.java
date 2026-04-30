package com.opencarapace.server.skill;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.LongSupplier;

/**
 * 调用 ClawHub 公开搜索 API，无需安装 CLI。
 * 文档/发现：Registry 来自 https://clawhub.ai/.well-known/clawhub.json，搜索接口 GET /api/search?q=...&limit=...
 */
@Component
public class ClawhubApiClient {

    private static final int MAX_429_RETRIES = 3;
    private static final long MAX_ANONYMOUS_READ_BACKOFF_MILLIS = Duration.ofSeconds(180).toMillis();

    private final WebClient webClient;
    private final WebClient convexClient;
    private final String apiToken;
    private final ClawhubSleeper sleeper;
    private final LongSupplier jitterMillisSupplier;

    @Autowired
    public ClawhubApiClient(
            WebClient.Builder webClientBuilder,
            @Value("${claw.skills.clawhub-base-url:https://clawhub.ai}") String baseUrl,
            @Value("${claw.skills.convex-base-url:https://wry-manatee-359.convex.cloud}") String convexBaseUrl,
            @Value("${claw.skills.clawhub-api-token:}") String apiToken
    ) {
        this(webClientBuilder, baseUrl, convexBaseUrl, apiToken, ClawhubApiClient::sleepCurrentThread,
                () -> ThreadLocalRandom.current().nextLong(0, 1_000));
    }

    ClawhubApiClient(
            WebClient.Builder webClientBuilder,
            String baseUrl,
            String convexBaseUrl,
            String apiToken,
            ClawhubSleeper sleeper,
            LongSupplier jitterMillisSupplier
    ) {
        this.apiToken = apiToken;
        this.sleeper = sleeper;
        this.jitterMillisSupplier = jitterMillisSupplier;
        this.webClient = webClientBuilder
                .baseUrl(baseUrl)
                .build();

        // Convex /api/query 返回的 JSON 可能较大，调高 WebClient 内存缓冲上限，避免 DataBufferLimitException
        ExchangeStrategies convexStrategies = ExchangeStrategies.builder()
                .codecs(cfg -> cfg.defaultCodecs().maxInMemorySize(2 * 1024 * 1024)) // 2MB
                .build();

        this.convexClient = webClientBuilder
                .clone()
                .baseUrl(convexBaseUrl)
                .exchangeStrategies(convexStrategies)
                .build();
    }

    /**
     * 分页列出公开技能。列表接口可匿名访问；配置 claw.skills.clawhub-api-token 后会附带 Bearer token。
     */
    public ClawhubSkillListResponse listSkillsPage(String cursor, int limit, String sort) {
        int attempt = 0;
        while (true) {
            try {
                ClawhubSkillListResponse response = webClient.get()
                        .uri(uriBuilder -> {
                            uriBuilder
                                    .path("/api/v1/skills")
                                    .queryParam("limit", limit)
                                    .queryParam("sort", StringUtils.hasText(sort) ? sort : "updated");
                            if (StringUtils.hasText(cursor)) {
                                uriBuilder.queryParam("cursor", "{cursor}");
                                return uriBuilder.build(Map.of("cursor", cursor));
                            }
                            return uriBuilder.build();
                        })
                        .headers(headers -> {
                            if (StringUtils.hasText(apiToken)) {
                                headers.setBearerAuth(apiToken.trim());
                            }
                        })
                        .retrieve()
                        .bodyToMono(ClawhubSkillListResponse.class)
                        .block();
                return response != null ? response : new ClawhubSkillListResponse();
            } catch (WebClientResponseException.TooManyRequests e) {
                if (attempt >= MAX_429_RETRIES) {
                    return new ClawhubSkillListResponse();
                }
                sleepBefore429Retry(e, attempt);
                attempt++;
            } catch (WebClientResponseException e) {
                return new ClawhubSkillListResponse();
            }
        }
    }

    /**
     * 搜索技能，返回当前页结果（无分页游标时用多组 seed 查询覆盖更多技能）。
     */
    public List<ClawhubSearchItem> search(String query, int limit) {
        try {
            ClawhubSearchResponse response = webClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/api/search")
                            .queryParam("q", query != null ? query : "")
                            .queryParam("limit", limit)
                            .build())
                    .retrieve()
                    .bodyToMono(ClawhubSearchResponse.class)
                    .block();
            return response != null && response.getResults() != null
                    ? response.getResults()
                    : Collections.emptyList();
        } catch (WebClientResponseException e) {
            return Collections.emptyList();
        }
    }

    /**
     * 调用 Convex 的 skills:listPublicPageV4 接口，按游标分页列出公开技能。
     */
    public ConvexSkillsPage listPublicPageV4(String cursor, int numItems) {
        try {
            // 按 Convex 官方客户端的请求体构造，首页不传 cursor 字段
            java.util.Map<String, Object> argsObject = new java.util.HashMap<>();
            argsObject.put("dir", "desc");
            argsObject.put("highlightedOnly", false);
            // 与浏览器抓包保持一致：nonSuspiciousOnly=false，避免被过滤到 0 条
            argsObject.put("nonSuspiciousOnly", false);
            argsObject.put("numItems", numItems);
            argsObject.put("sort", "downloads");
            if (cursor != null) {
                argsObject.put("cursor", cursor);
            }

            Map<String, Object> body = Map.of(
                    "path", "skills:listPublicPageV4",
                    "format", "convex_encoded_json",
                    "args", List.of(argsObject)
            );

            return convexClient.post()
                    .uri("/api/query")
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(ConvexSkillsPage.class)
                    .block();
        } catch (Exception e) {
            // 打印错误日志方便排查 Convex 接口/解析问题
            org.slf4j.LoggerFactory.getLogger(ClawhubApiClient.class)
                    .error("Convex listPublicPageV4 failed (cursor={}, numItems={})", cursor, numItems, e);
            return null;
        }
    }

    /**
     * 遇到 429 时优先遵守 Retry-After；缺失时使用 reset header 或指数退避，并加轻量 jitter。
     */
    private void sleepBefore429Retry(WebClientResponseException.TooManyRequests e, int attempt) {
        long baseDelay = retryDelayFromHeaders(e);
        if (baseDelay <= 0) {
            baseDelay = Math.min((long) Math.pow(2, attempt) * 1_000L, MAX_ANONYMOUS_READ_BACKOFF_MILLIS);
        }
        long jitter = Math.max(0L, jitterMillisSupplier.getAsLong());
        sleeper.sleep(Math.min(baseDelay + jitter, MAX_ANONYMOUS_READ_BACKOFF_MILLIS));
    }

    private long retryDelayFromHeaders(WebClientResponseException e) {
        String retryAfter = e.getHeaders().getFirst("Retry-After");
        Long retryAfterDelay = parseRetryAfterMillis(retryAfter);
        if (retryAfterDelay != null) {
            return retryAfterDelay;
        }
        String reset = e.getHeaders().getFirst("RateLimit-Reset");
        if (!StringUtils.hasText(reset)) {
            reset = e.getHeaders().getFirst("X-RateLimit-Reset");
        }
        return parseResetMillis(reset);
    }

    private Long parseRetryAfterMillis(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String trimmed = value.trim();
        try {
            return Math.max(0L, Long.parseLong(trimmed) * 1_000L);
        } catch (NumberFormatException ignored) {
            try {
                Instant retryAt = ZonedDateTime.parse(trimmed, DateTimeFormatter.RFC_1123_DATE_TIME).toInstant();
                return Math.max(0L, Duration.between(Instant.now(), retryAt).toMillis());
            } catch (RuntimeException ignoredDate) {
                return null;
            }
        }
    }

    private long parseResetMillis(String value) {
        if (!StringUtils.hasText(value)) {
            return 0L;
        }
        try {
            long parsed = Long.parseLong(value.trim());
            long nowEpochSecond = Instant.now().getEpochSecond();
            long seconds = parsed > nowEpochSecond ? parsed - nowEpochSecond : parsed;
            return Math.max(0L, seconds * 1_000L);
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    private static void sleepCurrentThread(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while waiting before retrying ClawHub request", e);
        }
    }
}
