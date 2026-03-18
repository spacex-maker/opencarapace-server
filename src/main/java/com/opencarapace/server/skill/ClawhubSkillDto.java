package com.opencarapace.server.skill;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class ClawhubSkillDto {

    private String id;
    private String name;
    private String slug;
    private String type;
    private String category;
    private String version;
    private String status;

    @JsonProperty("shortDesc")
    private String shortDesc;

    @JsonProperty("longDesc")
    private String longDesc;

    private String tags;

    @JsonProperty("homepageUrl")
    private String homepageUrl;

    @JsonProperty("installHint")
    private String installHint;

    @JsonProperty("manifest")
    private Map<String, Object> manifest;
}

