ALTER TABLE oc_skills
    ADD COLUMN IF NOT EXISTS safe_mark_count BIGINT NOT NULL DEFAULT 0 COMMENT '用户标记为安全的总数',
    ADD COLUMN IF NOT EXISTS unsafe_mark_count BIGINT NOT NULL DEFAULT 0 COMMENT '用户标记为不安全的总数';

CREATE TABLE IF NOT EXISTS oc_user_skill_safety_labels (
    id         BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id    BIGINT       NOT NULL COMMENT 'oc_users.id',
    skill_slug VARCHAR(255) NOT NULL COMMENT 'oc_skills.slug',
    label      VARCHAR(16)  NOT NULL COMMENT 'SAFE 或 UNSAFE',
    created_at DATETIME(6)  NULL,
    updated_at DATETIME(6)  NULL,
    UNIQUE KEY uk_user_skill_label (user_id, skill_slug),
    CONSTRAINT fk_oc_user_skill_labels_user FOREIGN KEY (user_id) REFERENCES oc_users (id),
    CONSTRAINT fk_oc_user_skill_labels_skill_slug FOREIGN KEY (skill_slug) REFERENCES oc_skills (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户技能安全打标记录';
