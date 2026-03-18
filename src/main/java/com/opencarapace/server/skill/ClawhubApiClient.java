package com.opencarapace.server.skill;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * 调用 ClawHub 公开搜索 API，无需安装 CLI。
 * 文档/发现：Registry 来自 https://clawhub.ai/.well-known/clawhub.json，搜索接口 GET /api/search?q=...&limit=...
 */
@Component
public class ClawhubApiClient {

    private final WebClient webClient;
    private final WebClient convexClient;

    public ClawhubApiClient(
            WebClient.Builder webClientBuilder,
            @Value("${claw.skills.clawhub-base-url:https://clawhub.ai}") String baseUrl,
            @Value("${claw.skills.convex-base-url:https://wry-manatee-359.convex.cloud}") String convexBaseUrl
    ) {
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
}
