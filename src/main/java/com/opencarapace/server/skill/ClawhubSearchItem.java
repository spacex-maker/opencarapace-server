package com.opencarapace.server.skill;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class ClawhubSearchItem {

    private String slug;
    @JsonProperty("displayName")
    private String displayName;
    private String summary;
    private String version;
    @JsonProperty("updatedAt")
    private Long updatedAt;
}
