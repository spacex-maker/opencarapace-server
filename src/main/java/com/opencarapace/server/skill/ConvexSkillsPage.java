package com.opencarapace.server.skill;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class ConvexSkillsPage {

    private ConvexValue value;

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ConvexValue {
        private boolean hasMore;
        private String nextCursor;
        private List<ConvexSkillItem> page;
    }

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ConvexSkillItem {
        private ConvexSkill skill;
    }

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ConvexSkill {
        private String slug;
        private String displayName;
        private String summary;
        private Double updatedAt;
    }
}

