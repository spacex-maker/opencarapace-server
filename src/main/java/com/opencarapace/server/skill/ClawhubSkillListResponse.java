package com.opencarapace.server.skill;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

import java.util.Collections;
import java.util.List;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class ClawhubSkillListResponse {

    private List<ClawhubSkillListItem> items = Collections.emptyList();
    private String nextCursor;
}
