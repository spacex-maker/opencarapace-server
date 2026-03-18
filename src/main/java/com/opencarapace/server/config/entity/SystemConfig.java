package com.opencarapace.server.config.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * 系统配置表：存储 API Key 等键值对（如 deepseek.api_key、tavily.api_key）。
 * 仅后端与管理员使用，不向前端暴露明文密钥。
 */
@Entity
@Table(name = "oc_system_config")
@Getter
@Setter
public class SystemConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "config_key", nullable = false, unique = true, length = 255)
    private String configKey;

    @Column(name = "config_value", columnDefinition = "TEXT")
    private String configValue;

    @Column(length = 512)
    private String description;

    @CreationTimestamp
    @Column(name = "created_at")
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    /** 配置键常量 */
    public static final String KEY_DEEPSEEK_API_KEY = "deepseek.api_key";
    public static final String KEY_TAVILY_API_KEY = "tavily.api_key";
    /** 是否启用互联网查询（Tavily+DeepSeek）更新危险指令库，值为 true/false，默认未配置时不查 */
    public static final String KEY_DANGER_COMMANDS_USE_INTERNET = "danger_commands.sync.use_internet";

    /** 大模型代理：上游 base URL，如 https://api.openai.com 或 https://api.deepseek.com */
    public static final String KEY_LLM_PROXY_UPSTREAM_URL = "llm_proxy.upstream_url";
    /** 大模型代理：上游 API Key（Bearer） */
    public static final String KEY_LLM_PROXY_UPSTREAM_API_KEY = "llm_proxy.upstream_api_key";
    /** 大模型代理：是否启用，true/false */
    public static final String KEY_LLM_PROXY_ENABLED = "llm_proxy.enabled";

    /** 监管层：是否启用（请求/响应与危险指令库匹配），true/false */
    public static final String KEY_LLM_PROXY_SUPERVISION_ENABLED = "llm_proxy.supervision.enabled";
    /** 监管层：触犯哪些风险等级时拦截，如 CRITICAL 或 CRITICAL,HIGH */
    public static final String KEY_LLM_PROXY_SUPERVISION_BLOCK_LEVELS = "llm_proxy.supervision.block_levels";
    /** 意图层：是否启用 AI 判断“是否意图执行危险指令”，true/false */
    public static final String KEY_LLM_PROXY_INTENT_ENABLED = "llm_proxy.intent.enabled";
    /** 意图层：用于意图分类的模型名，如 gpt-3.5-turbo 或 deepseek-chat */
    public static final String KEY_LLM_PROXY_INTENT_MODEL = "llm_proxy.intent.model";

    /** ClawHub 技能同步：是否启用定时同步，true/false */
    public static final String KEY_CLAWHUB_SYNC_ENABLED = "clawhub.sync.enabled";
    /** ClawHub 技能同步：cron 表达式，如 0 0 2 * * ? */
    public static final String KEY_CLAWHUB_SYNC_CRON = "clawhub.sync.cron";
    /** ClawHub 技能同步：上次执行时间（ISO-8601） */
    public static final String KEY_CLAWHUB_SYNC_LAST_RUN_AT = "clawhub.sync.last_run_at";

    /** 系统数据版本号：Skills 数据版本（用于客户端轮询检测系统级变更） */
    public static final String KEY_SKILLS_DATA_VERSION = "system.skills_data_version";
    /** 系统数据版本号：危险指令数据版本（用于客户端轮询检测系统级变更） */
    public static final String KEY_DANGER_COMMANDS_DATA_VERSION = "system.danger_commands_data_version";
}
