package com.opencarapace.server.agent;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.List;

/**
 * Tavily 搜索 API 客户端：用于 AI Agent 从互联网检索危险指令等相关内容。
 * 文档: https://docs.tavily.com/documentation/api-reference/endpoint/search
 */
@Component
@RequiredArgsConstructor
public class TavilyClient {

    private static final String TAVILY_SEARCH_URL = "https://api.tavily.com/search";

    private final WebClient.Builder webClientBuilder;

    public TavilySearchResponse search(String apiKey, String query, int maxResults) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalArgumentException("Tavily API key is required");
        }
        WebClient client = webClientBuilder
                .baseUrl(TAVILY_SEARCH_URL)
                .defaultHeader("Authorization", "Bearer " + apiKey.trim())
                .build();
        try {
            return client.post()
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(new TavilySearchRequest(query, "basic", maxResults))
                    .retrieve()
                    .bodyToMono(TavilySearchResponse.class)
                    .block();
        } catch (WebClientResponseException e) {
            throw new RuntimeException("Tavily search failed: " + e.getStatusCode() + " " + e.getResponseBodyAsString(), e);
        }
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TavilySearchRequest {
        private final String query;
        @JsonProperty("search_depth")
        private final String searchDepth;
        @JsonProperty("max_results")
        private final int maxResults;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TavilySearchResponse {
        private List<TavilyResult> results;
        private String answer;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TavilyResult {
        private String title;
        private String url;
        private String content;
        private Double score;
    }
}
