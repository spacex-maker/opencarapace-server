package com.opencarapace.server.skill;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/** ClawHub 公开搜索 API 响应：GET /api/search?q=...&limit=... */
@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class ClawhubSearchResponse {

    @JsonProperty("results")
    private List<ClawhubSearchItem> results;
}
