package com.opencarapace.server.skill;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class ClawhubApiClientTest {

    @Test
    void listSkillsPageRetriesTooManyRequestsAfterRetryAfterWithJitter() {
        List<Long> sleeps = new ArrayList<>();
        int[] calls = {0};
        WebClient.Builder builder = WebClient.builder()
                .exchangeFunction(request -> {
                    calls[0]++;
                    if (calls[0] == 1) {
                        return Mono.just(ClientResponse.create(HttpStatus.TOO_MANY_REQUESTS)
                                .header("Retry-After", "2")
                                .build());
                    }
                    return Mono.just(ClientResponse.create(HttpStatus.OK)
                            .header("Content-Type", "application/json")
                            .body("""
                                    {"items":[{"slug":"new-skill","displayName":"New Skill","createdAt":1000}],"nextCursor":null}
                                    """)
                            .build());
                });

        ClawhubApiClient client = new ClawhubApiClient(
                builder,
                "https://clawhub.ai",
                "http://localhost",
                "",
                sleeps::add,
                () -> 250L
        );

        ClawhubSkillListResponse response = client.listSkillsPage(null, 200, "createdAt");

        assertThat(response.getItems()).hasSize(1);
        assertThat(response.getItems().get(0).getSlug()).isEqualTo("new-skill");
        assertThat(calls[0]).isEqualTo(2);
        assertThat(sleeps).containsExactly(2_250L);
    }

    @Test
    void listSkillsPageEncodesCursorContainingJsonBracesAndDefaultsToUpdatedSort() {
        AtomicReference<String> rawQuery = new AtomicReference<>();
        WebClient.Builder builder = WebClient.builder()
                .exchangeFunction(request -> {
                    rawQuery.set(request.url().getRawQuery());
                    return Mono.just(ClientResponse.create(HttpStatus.OK)
                            .header("Content-Type", "application/json")
                            .body("""
                                    {"items":[],"nextCursor":null}
                                    """)
                            .build());
                });

        ClawhubApiClient client = new ClawhubApiClient(
                builder,
                "https://clawhub.ai",
                "http://localhost",
                "",
                millis -> {
                },
                () -> 0L
        );

        ClawhubSkillListResponse response = client.listSkillsPage("[{\"__undef\":1},1777537607485]", 180, null);

        assertThat(response.getItems()).isEmpty();
        assertThat(rawQuery.get()).contains("limit=180");
        assertThat(rawQuery.get()).contains("sort=updated");
        assertThat(rawQuery.get()).contains("cursor=%5B%7B%22__undef%22%3A1%7D");
    }
}
