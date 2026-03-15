package com.opencarapace.server.config;

import com.opencarapace.server.config.entity.SystemConfig;
import com.opencarapace.server.config.entity.SystemConfigRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * 系统配置默认值：若未配置「是否互联网查询」则写入 false，由管理员在后台改为 true 后才会走 Tavily+DeepSeek。
 */
@Component
@Order(40)
@RequiredArgsConstructor
@Slf4j
public class SystemConfigInitializer implements ApplicationRunner {

    private final SystemConfigRepository repository;

    @Override
    public void run(ApplicationArguments args) {
        if (repository.findByConfigKey(SystemConfig.KEY_DANGER_COMMANDS_USE_INTERNET).isEmpty()) {
            save(SystemConfig.KEY_DANGER_COMMANDS_USE_INTERNET, "false", "是否通过互联网（Tavily+DeepSeek）更新危险指令库，true=启用，false=仅使用本地/种子数据");
        }
        if (repository.findByConfigKey(SystemConfig.KEY_LLM_PROXY_UPSTREAM_URL).isEmpty()) {
            save(SystemConfig.KEY_LLM_PROXY_UPSTREAM_URL, "", "大模型代理：上游 API 地址，如 https://api.openai.com 或 https://api.deepseek.com");
        }
        if (repository.findByConfigKey(SystemConfig.KEY_LLM_PROXY_UPSTREAM_API_KEY).isEmpty()) {
            save(SystemConfig.KEY_LLM_PROXY_UPSTREAM_API_KEY, "", "大模型代理：上游 API Key（Bearer）");
        }
        if (repository.findByConfigKey(SystemConfig.KEY_LLM_PROXY_ENABLED).isEmpty()) {
            save(SystemConfig.KEY_LLM_PROXY_ENABLED, "false", "大模型代理：是否启用中转，true=启用");
        }
        // 多后端示例：请求头 X-LLM-Backend=deepseek 或 openai 时使用对应配置
        if (repository.findByConfigKey("llm_proxy.backend.deepseek.url").isEmpty()) {
            save("llm_proxy.backend.deepseek.url", "https://api.deepseek.com", "大模型代理 · 后端 deepseek 的 API 地址");
        }
        if (repository.findByConfigKey("llm_proxy.backend.deepseek.api_key").isEmpty()) {
            save("llm_proxy.backend.deepseek.api_key", "", "大模型代理 · 后端 deepseek 的 API Key（可选，不填则请求需带 Authorization）");
        }
        if (repository.findByConfigKey("llm_proxy.backend.openai.url").isEmpty()) {
            save("llm_proxy.backend.openai.url", "https://api.openai.com", "大模型代理 · 后端 openai 的 API 地址");
        }
        if (repository.findByConfigKey("llm_proxy.backend.openai.api_key").isEmpty()) {
            save("llm_proxy.backend.openai.api_key", "", "大模型代理 · 后端 openai 的 API Key（可选）");
        }
        if (repository.findByConfigKey(SystemConfig.KEY_LLM_PROXY_SUPERVISION_ENABLED).isEmpty()) {
            save(SystemConfig.KEY_LLM_PROXY_SUPERVISION_ENABLED, "true", "监管层：是否对代理请求/响应做危险指令匹配，true=启用");
        }
        if (repository.findByConfigKey(SystemConfig.KEY_LLM_PROXY_SUPERVISION_BLOCK_LEVELS).isEmpty()) {
            save(SystemConfig.KEY_LLM_PROXY_SUPERVISION_BLOCK_LEVELS, "CRITICAL,HIGH", "监管层：触犯哪些风险等级时拦截，如 CRITICAL 或 CRITICAL,HIGH");
        }
        if (repository.findByConfigKey(SystemConfig.KEY_LLM_PROXY_INTENT_ENABLED).isEmpty()) {
            save(SystemConfig.KEY_LLM_PROXY_INTENT_ENABLED, "false", "意图层：是否用 AI 判断意图是否危险；使用用户自己的 API+Key，我们只注入系统提示词，true=启用");
        }
        if (repository.findByConfigKey(SystemConfig.KEY_LLM_PROXY_INTENT_MODEL).isEmpty()) {
            save(SystemConfig.KEY_LLM_PROXY_INTENT_MODEL, "gpt-3.5-turbo", "意图层：分类请求用的模型名（与用户上游一致），如 deepseek-chat");
        }
    }

    private void save(String key, String value, String description) {
        SystemConfig c = new SystemConfig();
        c.setConfigKey(key);
        c.setConfigValue(value);
        c.setDescription(description);
        repository.save(c);
        log.info("System config default set: {} = {}", key, key.contains("api_key") ? "***" : value);
    }
}
