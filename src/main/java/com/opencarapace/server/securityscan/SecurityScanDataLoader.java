package com.opencarapace.server.securityscan;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * 首次启动时写入默认扫描项（表为空时）。
 */
@Component
@Order(100)
@RequiredArgsConstructor
@Slf4j
public class SecurityScanDataLoader implements CommandLineRunner {

    private final SecurityScanItemRepository repository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void run(String... args) {
        if (repository.count() > 0) {
            return;
        }
        log.info("Seeding default security scan items");
        int order = 0;
        repository.save(item("secrets_api_key", "API Key / 密钥暴露风险", "检查配置描述中是否可能出现明文密钥、重复定义等风险模式。",
                "SECRETS", "CRITICAL", "AI_PROMPT", aiSpec(
                        "重点：配置文件、Provider、.env、MCP 启动参数中是否明文写入 sk- / api key；密钥是否应改用环境变量。",
                        "用户会提供一段「本地/Agent 环境」文字描述。请根据描述分析密钥暴露与治理建议。"), order++));

        repository.save(item("mcp_privilege", "MCP / 工具链权限与命令风险", "分析 MCP Server、子进程命令中是否存在过高权限（如 sudo）、路径穿越等描述。",
                "MCP", "CRITICAL", "AI_PROMPT", aiSpec(
                        "重点：MCP 启动命令、工作目录、是否 sudo、是否任意文件读写。",
                        "用户会提供环境描述。请输出 JSON findings。"), order++));

        repository.save(item("routing_llm", "LLM 路由与网关配置", "检查直连 vs 网关、上游地址、映射前缀等配置是否合理、是否存在绕过安全网关的风险。",
                "NETWORK", "WARN", "AI_PROMPT", aiSpec(
                        "重点：是否应走统一网关、apiBase 是否可信、是否混用多个上游导致策略不一致。",
                        "用户会提供与 ClawHeart / OpenClaw / 本地网关相关的文字说明。"), order++));

        repository.save(item("skills_governance", "Skills 启用与安全打标", "从描述中推断 Skills 启用策略、打标是否一致、是否存在高风险技能被启用的情况。",
                "COMPLIANCE", "WARN", "AI_PROMPT", aiSpec(
                        "重点：禁用项是否仍被启用、用户打标与系统状态冲突、缺少审计轨迹。",
                        "用户会提供与 Skills 列表或统计相关的文字。"), order++));

        repository.save(item("baseline_tls_files", "基线：传输与文件权限（静态）", "不调用模型时的示例静态项：提醒检查 TLS、本地配置目录权限等。",
                "CONFIG", "PASS", "STATIC_INFO", staticSpec(), order));
    }

    private SecurityScanItem item(String code, String title, String desc, String category, String sev, String type, String spec, int sort) {
        SecurityScanItem it = new SecurityScanItem();
        it.setCode(code);
        it.setTitle(title);
        it.setDescription(desc);
        it.setCategory(category);
        it.setDefaultSeverity(sev);
        it.setScannerType(type);
        it.setSpecJson(spec);
        it.setEnabled(true);
        it.setSortOrder(sort);
        return it;
    }

    private String aiSpec(String focusHint, String extra) {
        try {
            ObjectNode root = objectMapper.createObjectNode();
            root.put("systemPrompt", """
                    你是 AI Agent / MCP / 本地开发环境安全审计助手。
                    只输出一个 JSON 对象，不要 markdown。格式：{"findings":[{"severity":"CRITICAL|WARN|PASS","title":"","detail":"","remediation":"","location":""}]}
                    severity 必须大写。信息不足时用 WARN 说明需要更多上下文。
                    """.trim());
            root.put("userPromptTemplate", """
                    【环境上下文】
                    {{context}}

                    【扫描项编码】{{code}}
                    【扫描项标题】{{focus}}
                    【扫描项说明】{{description}}

                    检查侧重点：%s
                    %s
                    """.formatted(focusHint, extra));
            return objectMapper.writeValueAsString(root);
        } catch (Exception e) {
            return "{}";
        }
    }

    private String staticSpec() {
        try {
            ObjectNode root = objectMapper.createObjectNode();
            ArrayNode arr = root.putArray("staticFindings");
            ObjectNode f1 = arr.addObject();
            f1.put("severity", "PASS");
            f1.put("title", "建议启用 HTTPS 与校验证书");
            f1.put("detail", "访问云端 API 时使用 HTTPS；避免在不可信网络下明文传输 Token。");
            f1.put("remediation", "在设置中确认 apiBase 为 https:// 开头；系统时间准确以便校验证书。");
            f1.put("location", "设置 › 云端基地址");
            ObjectNode f2 = arr.addObject();
            f2.put("severity", "WARN");
            f2.put("title", "本地配置目录权限");
            f2.put("detail", "确保仅当前用户可读写本地数据库与 token 存储目录。");
            f2.put("remediation", "检查 %APPDATA% 或应用数据目录的 ACL；勿以管理员身份日常运行客户端。");
            f2.put("location", "本机文件系统");
            return objectMapper.writeValueAsString(root);
        } catch (Exception e) {
            return "{\"staticFindings\":[]}";
        }
    }
}
