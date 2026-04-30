package com.opencarapace.server.skill;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class ClawhubSkillListItem {

    private String slug;
    private String displayName;
    private String summary;
    private Map<String, Object> tags;
    private Stats stats;
    private Object metadata;
    private Long createdAt;
    private Long updatedAt;
    private LatestVersion latestVersion;

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class LatestVersion {
        private String version;
        private Long createdAt;
        private String changelog;
        private String license;
    }

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Stats {
        private Long comments;
        private Long downloads;
        private Long installsAllTime;
        private Long installsCurrent;
        private Long stars;
        private Long versions;
    }
}
