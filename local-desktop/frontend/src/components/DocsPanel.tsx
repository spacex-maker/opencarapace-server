type DocsPanelProps = {
  /** 嵌入设置页时使用：去掉外层卡片，避免与设置容器重复边框 */
  embedded?: boolean;
};

export function DocsPanel({ embedded = false }: DocsPanelProps) {
  const outerStyle = embedded
    ? {
        maxWidth: "100%" as const,
        margin: 0,
        background: "transparent",
        borderRadius: 0,
        padding: 0,
        border: "none",
        boxShadow: "none",
        fontSize: 13,
        lineHeight: 1.7,
        color: "#e5e7eb",
      }
    : {
        maxWidth: 920,
        margin: "0 auto",
        background: "#020617",
        borderRadius: 16,
        padding: "24px 28px",
        border: "1px solid #1f2937",
        boxShadow: "0 20px 40px rgba(15,23,42,0.6)",
        fontSize: 13,
        lineHeight: 1.7,
        color: "#e5e7eb",
      };

  return (
    <div style={outerStyle}>
      <h1 style={{ fontSize: embedded ? 18 : 20, margin: "0 0 6px", color: "#f9fafb" }}>ClawHeart 系统使用说明</h1>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: "#9ca3af" }}>
        本页汇总本地客户端与云端系统的核心能力，并给出主导航说明、典型操作流程、接口约定和排障建议。完整说明从顶部栏右侧「设置」进入，在「文档与使用说明」子页查看。
      </p>

      <section style={{ marginTop: 12, paddingTop: 8, borderTop: "1px solid #1f2937" }}>
        <h2 style={{ fontSize: 14, margin: "0 0 6px", color: "#e5e7eb" }}>1. 系统功能总览</h2>
        <ul style={ulStyle}>
          <li>
            <span style={bulletTitle}>本地代理与路由：</span>
            本地服务监听 <code style={codeStyle}>127.0.0.1:19111</code>，统一处理客户端 UI、本地规则、转发与同步。
          </li>
          <li>
            <span style={bulletTitle}>危险指令治理：</span>
            支持系统规则 + 用户偏好，命中后本地拦截并写入拦截监控记录。
          </li>
          <li>
            <span style={bulletTitle}>安全市场治理：</span>
            支持系统状态（正常/禁用/不推荐）、用户启用开关、用户安全打标（安全/不安全）、市场分类（精选/推荐/热门/最新）及统计展示。
          </li>
          <li>
            <span style={bulletTitle}>可视化看板：</span>
            提供技能、风险分布、拦截趋势、Token 消耗趋势等指标。
          </li>
          <li>
            <span style={bulletTitle}>LLM 接入：</span>
            支持云端网关转发与本地直连两种路由模式，并可通过前缀映射接入不同厂商。
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 16, paddingTop: 8, borderTop: "1px solid #1f2937" }}>
        <h2 style={{ fontSize: 14, margin: "0 0 6px", color: "#e5e7eb" }}>2. 主导航说明</h2>
        <ul style={ulStyle}>
          <li><span style={bulletTitle}>总览：</span>查看技能统计、风险分布、拦截与 Token 时间线。</li>
          <li>
            <span style={bulletTitle}>安全扫描：</span>
            从云端拉取通用扫描项（AI / 静态），结合本机状态与补充说明执行扫描；AI 项依赖云端已配置的{" "}
            <code style={codeStyle}>deepseek.api_key</code>。
          </li>
          <li>
            <span style={bulletTitle}>安全市场：</span>
            浏览技能（官方精选 / 安全推荐 / 热门 / 最新）、系统状态、启用、安全打标与详情；审计报告能力后续提供。
          </li>
          <li>
            <span style={bulletTitle}>拦截监控：</span>
            含「拦截记录」（云端记录的拦截事件）与「拦截项目」（原危险指令库：规则同步、筛选与用户启用开关）。
          </li>
          <li><span style={bulletTitle}>Token 账单：</span>查看 Token 使用统计与时间趋势。</li>
          <li><span style={bulletTitle}>OpenClaw：</span>管理与 OpenClaw 相关的接入与使用入口。</li>
          <li>
            <span style={bulletTitle}>设置：</span>
            在顶部栏右侧「账户」区域与登录/退出并排。打开后可在「常规设置」与「文档与使用说明」之间切换：前者配置云端基地址、OC API Key、LLM 路由模式、网络映射与云端同步等；后者即本说明全文。
          </li>
          <li>
            <span style={bulletTitle}>Agent 管理：</span>
            按 Agent 平台（Claude Code、Codex 等）在左侧树选择 Providers / Skills / Prompts / MCP / Sessions；条目存于本机库（<code style={codeStyle}>/api/agent-mgmt/*</code>），云端同名接口可在登录后用于多设备扩展。
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 16, paddingTop: 8, borderTop: "1px solid #1f2937" }}>
        <h2 style={{ fontSize: 14, margin: "0 0 6px", color: "#e5e7eb" }}>3. 快速上手（推荐流程）</h2>
        <ol style={olStyle}>
          <li>
            进入 <span style={bulletTitle}>设置</span>，填写云端基地址（例如 <code style={codeStyle}>https://api.clawheart.live</code>）和 OC API Key。
          </li>
          <li>点击保存后触发同步，确认右下角连接状态为“已连接服务器”。</li>
          <li>
            进入 <span style={bulletTitle}>安全市场</span>，切换分类并查询/同步，检查系统状态与用户启用。
          </li>
          <li>
            如需安全侧治理，在技能列表中查看 <code style={codeStyle}>安全/不安全</code> 标记统计，并进行用户打标。
          </li>
          <li>
            进入 <span style={bulletTitle}>总览</span> 与 <span style={bulletTitle}>拦截监控</span>，验证策略是否生效。
          </li>
        </ol>
      </section>

      <section style={{ marginTop: 16, paddingTop: 8, borderTop: "1px solid #1f2937" }}>
        <h2 style={{ fontSize: 14, margin: "0 0 6px", color: "#e5e7eb" }}>4. 本地网关基础地址</h2>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#9ca3af" }}>
          本地客户端在 <code style={codeStyle}>127.0.0.1:19111</code> 暴露了 OpenAI 兼容接口。推荐把 SDK 的 Base URL
          配置为 <code style={codeStyle}>http://127.0.0.1:19111/v1</code>，其余路径由 SDK 自行拼接（例如
          <code style={codeStyle}>/chat/completions</code>）。
        </p>
        <ul style={ulStyle}>
          <li>
            <span style={bulletTitle}>HTTP Base URL：</span>
            <code style={codeStyle}>http://127.0.0.1:19111/v1</code>
          </li>
          <li>
            <span style={bulletTitle}>协议：</span>HTTP（无需 HTTPS，所有转发由本地客户端处理）
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 16, paddingTop: 8, borderTop: "1px solid #1f2937" }}>
        <h2 style={{ fontSize: 14, margin: "0 0 6px", color: "#e5e7eb" }}>5. 如何在 SDK 中配置</h2>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#9ca3af" }}>
          以下是将常见 OpenAI SDK 指向本地网关的示例（仅示意，具体以你的 SDK 为准）：
        </p>
        <pre style={preStyle}>
          <code>
            {`// 以 OpenAI 官方 SDK 为例（Node.js）
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://127.0.0.1:19111/v1",
  apiKey: "sk-local-anything", // 本地网关不会校验此 Key
});`}
          </code>
        </pre>
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#6b7280" }}>
          只要将原来的
          <code style={codeStyle}>https://api.openai.com/v1</code> 改为
          <code style={codeStyle}>http://127.0.0.1:19111/v1</code>
          ，即可让请求先经过本地网关，再根据路由模式转发到云端或上游 LLM。
        </p>
      </section>

      <section style={{ marginTop: 16, paddingTop: 8, borderTop: "1px solid #1f2937" }}>
        <h2 style={{ fontSize: 14, margin: "0 0 6px", color: "#e5e7eb" }}>6. LLM 路由模式说明</h2>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#9ca3af" }}>
          在「设置」页面中，你可以为本地客户端选择两种不同的 LLM 路由模式：
        </p>
        <ul style={ulStyle}>
          <li>
            <span style={bulletTitle}>通过 ClawHeart 网关（推荐）：</span>
            请求从本地网关发出后，先进入云端 ClawHeart 网关，执行危险指令拦截、意图识别等统一策略，再转发到上游模型。
          </li>
          <li>
            <span style={bulletTitle}>直接连接 LLM（仅本地校验）：</span>
            本地客户端在本机完成危险指令校验后，直接连接你在「设置」中配置的上游 LLM 地址。
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 16, paddingTop: 8, borderTop: "1px solid #1f2937" }}>
        <h2 style={{ fontSize: 14, margin: "0 0 6px", color: "#e5e7eb" }}>7. 通过网络映射对接不同厂商</h2>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#9ca3af" }}>
          你可以在「设置 → 网络映射配置」里创建前缀，将本地请求转发到任意上游（包括 OpenClaw 的 provider baseUrl
          指向本地前缀的场景）。
        </p>
        <ul style={ulStyle}>
          <li>
            <span style={bulletTitle}>例子：</span>
            配置前缀 <code style={codeStyle}>minimax</code> → 目标基地址 <code style={codeStyle}>https://api.minimaxi.com/anthropic</code>
          </li>
          <li>
            <span style={bulletTitle}>使用方式：</span>
            Base URL 设为 <code style={codeStyle}>http://127.0.0.1:19111/minimax</code>（第三方 SDK 会自行拼 path）。
          </li>
        </ul>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6b7280" }}>
          注意：鉴权 header 会尽量按原样透传到上游；不同厂商需要的 header 可能不同（如 `Authorization`、`x-api-key` 等）。
        </p>
      </section>

      <section style={{ marginTop: 16, paddingTop: 8, borderTop: "1px solid #1f2937" }}>
        <h2 style={{ fontSize: 14, margin: "0 0 6px", color: "#e5e7eb" }}>8. Skills 打标与详情说明</h2>
        <ul style={ulStyle}>
          <li>
            <span style={bulletTitle}>打标语义：</span>
            用户可对技能标记为 <code style={codeStyle}>SAFE</code>（安全）或 <code style={codeStyle}>UNSAFE</code>（不安全）。
          </li>
          <li>
            <span style={bulletTitle}>统计维度：</span>
            每个技能展示全局安全/不安全计数；总览页面展示当前用户已打标数量。
          </li>
          <li>
            <span style={bulletTitle}>详情加载：</span>
            详情数据优先按配置的云端 <code style={codeStyle}>apiBase</code> 拉取，需有效登录 token。
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 16, paddingTop: 8, borderTop: "1px solid #1f2937" }}>
        <h2 style={{ fontSize: 14, margin: "0 0 6px", color: "#e5e7eb" }}>9. 常见问题排查</h2>
        <ul style={ulStyle}>
          <li>
            <span style={bulletTitle}>详情接口 400/401：</span>
            先检查是否已登录、本地 token 是否有效、以及设置中的 <code style={codeStyle}>apiBase</code> 是否正确。
          </li>
          <li>
            <span style={bulletTitle}>列表无数据：</span>
            检查同步状态；必要时在 Skills 页手动同步并重试查询。
          </li>
          <li>
            <span style={bulletTitle}>策略未生效：</span>
            查看拦截监控，确认请求是否命中规则、用户偏好是否覆盖系统默认行为。
          </li>
          <li>
            <span style={bulletTitle}>云端与本地不一致：</span>
            等待版本轮询自动同步，或手动触发同步刷新。
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 16, paddingTop: 8, borderTop: "1px solid #1f2937" }}>
        <h2 style={{ fontSize: 14, margin: "0 0 8px", color: "#e5e7eb" }}>10. 接口清单速查表</h2>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "#9ca3af" }}>
          按“本地代理（19111）”与“云端核心（apiBase）”分组。联调时建议先确认请求落在哪一层，再看状态码与返回体。
        </p>

        <h3 style={h3Style}>本地代理接口（http://127.0.0.1:19111）</h3>
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>方法</th>
                <th style={thStyle}>路径</th>
                <th style={thStyle}>用途</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdMonoStyle}>GET</td>
                <td style={tdMonoStyle}>/api/status</td>
                <td style={tdStyle}>读取本地状态、登录态、设置与连接信息</td>
              </tr>
              <tr>
                <td style={tdMonoStyle}>GET</td>
                <td style={tdMonoStyle}>/api/sync-status?type=skills|danger</td>
                <td style={tdStyle}>读取同步进度</td>
              </tr>
              <tr>
                <td style={tdMonoStyle}>GET</td>
                <td style={tdMonoStyle}>/api/skills</td>
                <td style={tdStyle}>Skills 列表（本地聚合视图）</td>
              </tr>
              <tr>
                <td style={tdMonoStyle}>POST</td>
                <td style={tdMonoStyle}>/api/skills/sync</td>
                <td style={tdStyle}>触发技能同步</td>
              </tr>
              <tr>
                <td style={tdMonoStyle}>PUT</td>
                <td style={tdMonoStyle}>/api/user-skills/:slug</td>
                <td style={tdStyle}>切换用户技能启用状态</td>
              </tr>
              <tr>
                <td style={tdMonoStyle}>PUT</td>
                <td style={tdMonoStyle}>/api/user-skills/:slug/safety-label</td>
                <td style={tdStyle}>用户技能安全打标（SAFE / UNSAFE）</td>
              </tr>
              <tr>
                <td style={tdMonoStyle}>GET</td>
                <td style={tdMonoStyle}>/api/agent-mgmt/summary</td>
                <td style={tdStyle}>Agent 平台与各功能条目计数（本机库）</td>
              </tr>
              <tr>
                <td style={tdMonoStyle}>GET</td>
                <td style={tdMonoStyle}>/api/agent-mgmt/items?platform=&amp;feature=</td>
                <td style={tdStyle}>按平台与功能类型列出 Agent 条目（本机库）</td>
              </tr>
              <tr>
                <td style={tdMonoStyle}>GET</td>
                <td style={tdMonoStyle}>/api/dashboard/*</td>
                <td style={tdStyle}>总览图表数据代理（需登录 token）</td>
              </tr>
              <tr>
                <td style={tdMonoStyle}>GET</td>
                <td style={tdMonoStyle}>/api/security-scan/items</td>
                <td style={tdStyle}>安全扫描项列表（转发云端，需本地已登录）</td>
              </tr>
              <tr>
                <td style={tdMonoStyle}>POST</td>
                <td style={tdMonoStyle}>/api/security-scan/ai-run</td>
                <td style={tdStyle}>执行安全扫描（转发云端，body: itemCodes, context）</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 style={h3Style}>云端核心接口（{`{apiBase}`}）</h3>
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>方法</th>
                <th style={thStyle}>路径</th>
                <th style={thStyle}>用途</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdMonoStyle}>POST</td>
                <td style={tdMonoStyle}>/api/auth/login</td>
                <td style={tdStyle}>登录并换取 JWT</td>
              </tr>
              <tr>
                <td style={tdMonoStyle}>GET</td>
                <td style={tdMonoStyle}>/api/skills</td>
                <td style={tdStyle}>技能分页查询（支持 status/type/category/keyword）</td>
              </tr>
              <tr>
                <td style={tdMonoStyle}>GET</td>
                <td style={tdMonoStyle}>/api/skills/{"{id}"}</td>
                <td style={tdStyle}>技能详情（按 id）</td>
              </tr>
              <tr>
                <td style={tdMonoStyle}>PUT</td>
                <td style={tdMonoStyle}>/api/user-skills/me/{"{slug}"}</td>
                <td style={tdStyle}>用户技能启用偏好</td>
              </tr>
              <tr>
                <td style={tdMonoStyle}>PUT</td>
                <td style={tdMonoStyle}>/api/user-skills/me/{"{slug}"}/safety-label</td>
                <td style={tdStyle}>用户技能安全打标</td>
              </tr>
              <tr>
                <td style={tdMonoStyle}>GET</td>
                <td style={tdMonoStyle}>/api/dashboard/token-usage-timeline</td>
                <td style={tdStyle}>Token 消耗趋势（range + granularity）</td>
              </tr>
              <tr>
                <td style={tdMonoStyle}>GET</td>
                <td style={tdMonoStyle}>/api/dashboard/intercept-timeline</td>
                <td style={tdStyle}>拦截趋势（range + granularity）</td>
              </tr>
              <tr>
                <td style={tdMonoStyle}>GET</td>
                <td style={tdMonoStyle}>/api/security-scan/items</td>
                <td style={tdStyle}>安全扫描项定义（JWT）</td>
              </tr>
              <tr>
                <td style={tdMonoStyle}>POST</td>
                <td style={tdMonoStyle}>/api/security-scan/ai-run</td>
                <td style={tdStyle}>执行扫描，返回 findings 列表（JWT；AI 项需 deepseek.api_key）</td>
              </tr>
              <tr>
                <td style={tdMonoStyle}>GET</td>
                <td style={tdMonoStyle}>/api/user-settings/version</td>
                <td style={tdStyle}>读取云端版本号用于增量同步判断</td>
              </tr>
              <tr>
                <td style={tdMonoStyle}>GET</td>
                <td style={tdMonoStyle}>/api/agent-mgmt/me/summary</td>
                <td style={tdStyle}>当前用户 Agent 目录统计（JWT；表 oc_user_agent_items）</td>
              </tr>
              <tr>
                <td style={tdMonoStyle}>GET</td>
                <td style={tdMonoStyle}>/api/agent-mgmt/me/items?platform=&amp;feature=</td>
                <td style={tdStyle}>当前用户 Agent 条目列表（JWT）</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const codeStyle: React.CSSProperties = {
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  fontSize: 12,
  background: "#020617",
  padding: "1px 4px",
  borderRadius: 4,
  border: "1px solid #111827",
  color: "#e5e7eb",
};

const preStyle: React.CSSProperties = {
  margin: "6px 0 0",
  padding: "8px 10px",
  borderRadius: 8,
  background: "#020617",
  border: "1px solid #111827",
  fontSize: 11,
  overflowX: "auto",
};

const ulStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 16,
  fontSize: 12,
  color: "#9ca3af",
  lineHeight: 1.7,
};

const olStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  fontSize: 12,
  color: "#9ca3af",
  lineHeight: 1.7,
};

const h3Style: React.CSSProperties = {
  fontSize: 12,
  margin: "12px 0 6px",
  color: "#cbd5e1",
};

const tableWrapStyle: React.CSSProperties = {
  border: "1px solid #1f2937",
  borderRadius: 10,
  overflowX: "auto",
  marginBottom: 8,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  color: "#cbd5e1",
  borderBottom: "1px solid #1f2937",
  background: "rgba(15,23,42,0.7)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  color: "#94a3b8",
  borderBottom: "1px solid #111827",
  whiteSpace: "nowrap",
};

const tdMonoStyle: React.CSSProperties = {
  ...tdStyle,
  color: "#e2e8f0",
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
};

const bulletTitle: React.CSSProperties = {
  color: "#e5e7eb",
};

