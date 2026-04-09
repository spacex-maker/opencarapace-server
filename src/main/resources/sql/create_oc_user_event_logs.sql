-- 全端埋点事件表（Web + 客户端）
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS oc_user_event_logs (
    id                 BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    event_id           VARCHAR(64)  NOT NULL                COMMENT '事件唯一 ID（幂等去重）',
    event_name         VARCHAR(64)  NOT NULL                COMMENT '事件名，例如 page_view',
    event_time         DATETIME(6)  NOT NULL                COMMENT '事件发生时间（客户端时间）',
    anonymous_id       VARCHAR(64)  NOT NULL                COMMENT '匿名标识（设备/浏览器）',
    session_id         VARCHAR(64)  NOT NULL                COMMENT '会话 ID',
    platform           VARCHAR(16)  NOT NULL                COMMENT 'web/desktop/android/ios',
    app_version        VARCHAR(32)  DEFAULT NULL            COMMENT '应用版本',
    page_id            VARCHAR(128) DEFAULT NULL            COMMENT '页面或窗口标识',
    module             VARCHAR(64)  DEFAULT NULL            COMMENT '业务模块',
    event_props_json   TEXT         DEFAULT NULL            COMMENT '事件属性 JSON',
    context_props_json TEXT         DEFAULT NULL            COMMENT '上下文属性 JSON',
    ip                 VARCHAR(64)  DEFAULT NULL            COMMENT '客户端 IP',
    user_agent         VARCHAR(512) DEFAULT NULL            COMMENT 'UA',
    valid              TINYINT(1)   NOT NULL DEFAULT 1      COMMENT '事件是否有效',
    user_id            BIGINT       DEFAULT NULL            COMMENT '登录用户 ID（匿名为 null）',
    created_at         DATETIME(6)  DEFAULT NULL            COMMENT '服务端入库时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_oc_user_event_logs_event_id (event_id),
    KEY idx_oc_user_event_logs_event_name_time (event_name, event_time),
    KEY idx_oc_user_event_logs_user_time (user_id, event_time),
    KEY idx_oc_user_event_logs_anonymous_time (anonymous_id, event_time),
    KEY idx_oc_user_event_logs_session_time (session_id, event_time),
    KEY idx_oc_user_event_logs_platform_time (platform, event_time),
    CONSTRAINT fk_oc_user_event_logs_user FOREIGN KEY (user_id) REFERENCES oc_users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='全端埋点事件表';

