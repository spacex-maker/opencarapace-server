export function DocsPanel() {
  return (
    <div
      style={{
        maxWidth: 820,
        margin: "0 auto",
        background: "#020617",
        borderRadius: 16,
        padding: "24px 28px",
        border: "1px solid #1f2937",
        boxShadow: "0 20px 40px rgba(15,23,42,0.6)",
        fontSize: 13,
        lineHeight: 1.7,
        color: "#e5e7eb",
      }}
    >
      <h1 style={{ fontSize: 20, margin: "0 0 6px", color: "#f9fafb" }}>本地网关使用说明</h1>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: "#9ca3af" }}>
        本页介绍如何请求本地 LLM 网关，以及在开启「直接连接 LLM」模式时，如何配置上游模型地址。
      </p>

      <section style={{ marginTop: 12, paddingTop: 8, borderTop: "1px solid #1f2937" }}>
        <h2 style={{ fontSize: 14, margin: "0 0 6px", color: "#e5e7eb" }}>1. 本地网关基础地址</h2>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#9ca3af" }}>
          本地客户端在 <code style={codeStyle}>127.0.0.1:19111</code> 暴露了一个 OpenAI 兼容的
          <code style={codeStyle}>/v1/chat/completions</code> 接口，你可以将任何兼容 OpenAI 的 SDK / 工具指向这里。
        </p>
        <ul style={ulStyle}>
          <li>
            <span style={bulletTitle}>HTTP Base URL：</span>
            <code style={codeStyle}>http://127.0.0.1:19111/v1/chat/completions</code>
          </li>
          <li>
            <span style={bulletTitle}>协议：</span>HTTP（无需 HTTPS，所有转发由本地客户端处理）
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 16, paddingTop: 8, borderTop: "1px solid #1f2937" }}>
        <h2 style={{ fontSize: 14, margin: "0 0 6px", color: "#e5e7eb" }}>2. 如何在 SDK 中配置</h2>
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
        <h2 style={{ fontSize: 14, margin: "0 0 6px", color: "#e5e7eb" }}>3. LLM 路由模式说明</h2>
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
            本地客户端在本机完成危险指令校验后，直接连接你在「概览 / 连接配置」中设置的上游 LLM 地址。
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 16, paddingTop: 8, borderTop: "1px solid #1f2937" }}>
        <h2 style={{ fontSize: 14, margin: "0 0 6px", color: "#e5e7eb" }}>4. 直连模式下的上游域名配置</h2>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#9ca3af" }}>
          当你选择「直接连接 LLM」模式时，本地客户端会使用「概览 / 连接配置」中的
          <span style={{ color: "#e5e7eb" }}> 上游 LLM Key</span>
          所对应的上游服务作为转发目标：
        </p>
        <ul style={ulStyle}>
          <li>
            <span style={bulletTitle}>API Base：</span>
            使用「连接配置」中的 <code style={codeStyle}>API Base</code>{" "}
            <span style={{ color: "#6b7280" }}>(例如你的自建 OpenAI 兼容服务域名)</span>
          </li>
          <li>
            <span style={bulletTitle}>鉴权：</span>
            使用配置中的 <code style={codeStyle}>上游 LLM Key</code> 作为
            <code style={codeStyle}>Authorization</code> 头发送给上游。
          </li>
        </ul>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6b7280" }}>
          换句话说，当路由模式设为「直接连接 LLM」时，你只需要在连接配置中填写好
          <code style={codeStyle}>API Base</code> 与 <code style={codeStyle}>上游 LLM Key</code>，本地网关就会将
          所有 <code style={codeStyle}>/v1/chat/completions</code> 请求安全地转发到该域名。
        </p>
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

const bulletTitle: React.CSSProperties = {
  color: "#e5e7eb",
};

