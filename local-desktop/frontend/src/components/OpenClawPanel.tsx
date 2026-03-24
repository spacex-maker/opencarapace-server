import { useEffect, useState } from "react";

export function OpenClawPanel() {
  const [loading, setLoading] = useState(true);
  const [hasEmbedded, setHasEmbedded] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [uiUrl, setUiUrl] = useState("http://localhost:18789");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [installing, setInstalling] = useState(false);
  
  // 标签页
  const [activeSubTab, setActiveSubTab] = useState<"ui" | "config">("ui");
  
  // JSON 配置编辑
  const [configJson, setConfigJson] = useState("");
  const [configPath, setConfigPath] = useState("");
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  /** Gateway 诊断日志（与后端 gatewayDiagnosticLog 同步，便于复制反馈） */
  const [gatewayLog, setGatewayLog] = useState("");

  const refresh = async () => {
    try {
      const res = await fetch("http://127.0.0.1:19111/api/openclaw/embedded-status");
      const data = await res.json();
      setHasEmbedded(!!data?.hasEmbedded);
      setIsRunning(!!data?.isRunning);
      setUiUrl(data?.uiUrl || "http://localhost:18789");
      if (typeof data?.gatewayDiagnosticLog === "string") {
        setGatewayLog(data.gatewayDiagnosticLog);
      }
    } catch (e: any) {
      setError(e?.message ?? "加载失败");
    }
  };

  const copyGatewayLog = async () => {
    const text = gatewayLog.trim() || "（无日志）";
    try {
      await navigator.clipboard.writeText(text);
      setMessage("诊断日志已复制到剪贴板");
      setTimeout(() => setMessage(null), 2500);
    } catch {
      setError("复制失败，请手动在日志框内全选复制");
    }
  };

  const loadConfig = async () => {
    setConfigLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:19111/api/openclaw/config");
      const data = await res.json();
      
      if (res.ok && data?.ok) {
        setConfigJson(JSON.stringify(data.config, null, 2));
        setConfigPath(data.configPath || "");
      } else {
        setConfigJson("{}");
      }
    } catch (e: any) {
      setError(e?.message ?? "加载配置失败");
      setConfigJson("{}");
    } finally {
      setConfigLoading(false);
    }
  };

  const saveConfig = async () => {
    setConfigSaving(true);
    setMessage(null);
    setError(null);
    
    try {
      const config = JSON.parse(configJson);
      
      const res = await fetch("http://127.0.0.1:19111/api/openclaw/config-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      
      const data = await res.json();
      
      if (!res.ok || !data?.ok) {
        setError(data?.error?.message || "保存失败");
        return;
      }
      
      setMessage("配置已保存！请重启 Gateway 使配置生效。");
    } catch (e: any) {
      if (e instanceof SyntaxError) {
        setError("JSON 格式错误: " + e.message);
      } else {
        setError(e?.message ?? "保存失败");
      }
    } finally {
      setConfigSaving(false);
    }
  };

  const restartGateway = async () => {
    setConfigSaving(true);
    setMessage(null);
    setError(null);
    
    try {
      const res = await fetch("http://127.0.0.1:19111/api/openclaw/restart-gateway", {
        method: "POST",
      });
      
      const data = await res.json();
      
      if (!res.ok || !data?.ok) {
        setError(data?.error?.message || "重启失败");
        return;
      }
      
      setMessage("Gateway 正在重启，请稍候...");
      
      setTimeout(() => {
        refresh();
      }, 3000);
    } catch (e: any) {
      setError(e?.message ?? "重启失败");
    } finally {
      setConfigSaving(false);
    }
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(configJson);
      setConfigJson(JSON.stringify(parsed, null, 2));
      setMessage("JSON 已格式化");
    } catch (e: any) {
      setError("JSON 格式错误: " + e.message);
    }
  };

  const reloadConfig = async () => {
    await loadConfig();
    setMessage("配置已重新加载");
  };

  const installOpenClaw = async () => {
    setInstalling(true);
    setMessage(null);
    setError(null);
    
    try {
      const res = await fetch("http://127.0.0.1:19111/api/openclaw/install", {
        method: "POST",
      });
      
      const data = await res.json();
      
      if (!res.ok || !data?.ok) {
        setError(data?.error?.message || "安装失败");
        return;
      }
      
      setMessage("OpenClaw 安装成功！正在刷新状态...");
      
      setTimeout(() => {
        refresh();
      }, 2000);
    } catch (e: any) {
      setError(e?.message ?? "安装失败");
    } finally {
      setInstalling(false);
    }
  };

  const startGateway = async () => {
    setStarting(true);
    setMessage(null);
    setError(null);
    
    try {
      const res = await fetch("http://127.0.0.1:19111/api/openclaw/start-gateway", {
        method: "POST",
      });
      
      const data = await res.json();

      if (typeof data?.gatewayDiagnosticLog === "string") {
        setGatewayLog(data.gatewayDiagnosticLog);
      }

      if (!res.ok || !data?.ok) {
        setError(data?.error?.message || "启动失败");
        return;
      }

      setMessage(data?.ok ? "Gateway 正在启动，请稍候..." : (data?.message ?? "启动未就绪"));

      // 等待几秒后刷新状态
      setTimeout(() => {
        refresh();
      }, 3000);
    } catch (e: any) {
      setError(e?.message ?? "启动失败");
    } finally {
      setStarting(false);
    }
  };

  const stopGateway = async () => {
    setStopping(true);
    setMessage(null);
    setError(null);
    
    try {
      const res = await fetch("http://127.0.0.1:19111/api/openclaw/stop-gateway", {
        method: "POST",
      });
      
      const data = await res.json();
      
      if (!res.ok || !data?.ok) {
        setError(data?.error?.message || data?.message || "停止失败");
        return;
      }

      setMessage(data?.message ?? "Gateway 已停止");
      
      // 立即刷新状态
      setTimeout(() => {
        refresh();
      }, 1000);
    } catch (e: any) {
      setError(e?.message ?? "停止失败");
    } finally {
      setStopping(false);
    }
  };



  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        await refresh();
        await loadConfig();
      } catch (e: any) {
        setError(e?.message ?? "加载失败");
      } finally {
        setLoading(false);
      }
    };
    load();

    // 每 3 秒轮询一次状态（用于检测 OpenClaw 是否启动）
    const interval = setInterval(() => {
      refresh().catch(() => {
        // 忽略错误，继续轮询
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        background: "#020617",
        borderRadius: 16,
        padding: "24px 28px",
        border: "1px solid #1f2937",
        boxShadow: "0 20px 40px rgba(15,23,42,0.6)",
        fontSize: 12,
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, margin: "0 0 4px", color: "#f9fafb" }}>OpenClaw</h1>
        <p style={{ margin: "4px 0 12px", fontSize: 13, color: "#9ca3af", lineHeight: 1.5 }}>
          OpenClaw 是一个强大的 AI Agent 框架。
          {hasEmbedded && <span style={{ color: "#4ade80" }}> 已检测到 OpenClaw。</span>}
          {isRunning && <span style={{ color: "#fbbf24", fontWeight: 600 }}> 首次使用需要配置 LLM 提供商。</span>}
        </p>
        
        {/* 标签页切换 */}
        <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #1f2937", paddingBottom: 8 }}>
          <button
            type="button"
            onClick={() => setActiveSubTab("ui")}
            style={{
              padding: "6px 16px",
              borderRadius: "8px 8px 0 0",
              border: "none",
              background: activeSubTab === "ui" ? "rgba(59,130,246,0.15)" : "transparent",
              color: activeSubTab === "ui" ? "#60a5fa" : "#9ca3af",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              borderBottom: activeSubTab === "ui" ? "2px solid #60a5fa" : "none",
            }}
          >
            UI 访问
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSubTab("config");
              loadConfig();
            }}
            style={{
              padding: "6px 16px",
              borderRadius: "8px 8px 0 0",
              border: "none",
              background: activeSubTab === "config" ? "rgba(59,130,246,0.15)" : "transparent",
              color: activeSubTab === "config" ? "#60a5fa" : "#9ca3af",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              borderBottom: activeSubTab === "config" ? "2px solid #60a5fa" : "none",
            }}
          >
            配置编辑
          </button>
        </div>
      </div>

      {!hasEmbedded && (
        <div
          style={{
            marginTop: 14,
            border: "1px solid rgba(251,191,36,0.35)",
            borderRadius: 12,
            padding: "14px 16px",
            background: "rgba(251,191,36,0.10)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", marginBottom: 8 }}>⚠️ OpenClaw 未安装</div>
          <div style={{ fontSize: 11, color: "#fde68a", lineHeight: 1.7, marginBottom: 12 }}>
            OpenClaw 是一个强大的 AI Agent 框架。点击下方按钮将全局安装 OpenClaw（约 100MB），安装后可被多个应用共享使用。
          </div>
          <button
            type="button"
            onClick={installOpenClaw}
            disabled={installing}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid rgba(34,197,94,0.35)",
              background: "rgba(34,197,94,0.15)",
              color: "#bbf7d0",
              fontSize: 12,
              fontWeight: 600,
              cursor: installing ? "not-allowed" : "pointer",
              opacity: installing ? 0.7 : 1,
            }}
          >
            {installing ? "安装中..." : "安装 OpenClaw"}
          </button>
        </div>
      )}

      {/* UI 访问标签页 */}
      {activeSubTab === "ui" && (
        <>
          {/* Gateway 状态控制 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>
              Gateway 状态
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: 10,
                  padding: "3px 10px",
                  borderRadius: 999,
                  border: hasEmbedded ? "1px solid rgba(34,197,94,0.35)" : "1px solid rgba(239,68,68,0.35)",
                  color: hasEmbedded ? "#bbf7d0" : "#fca5a5",
                  background: hasEmbedded ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
                }}
              >
                {hasEmbedded ? "已内置" : "未安装"}
              </span>
              <span
                style={{
                  fontSize: 10,
                  padding: "3px 10px",
                  borderRadius: 999,
                  border: isRunning ? "1px solid rgba(56,189,248,0.35)" : "1px solid rgba(107,114,128,0.35)",
                  color: isRunning ? "#bae6fd" : "#9ca3af",
                  background: isRunning ? "rgba(56,189,248,0.10)" : "rgba(107,114,128,0.10)",
                }}
              >
                {isRunning ? "运行中" : "未运行"}
              </span>
              
              {hasEmbedded && !isRunning && (
                <button
                  type="button"
                  onClick={startGateway}
                  disabled={starting}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(34,197,94,0.35)",
                    background: "rgba(34,197,94,0.10)",
                    color: "#bbf7d0",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: starting ? "not-allowed" : "pointer",
                    opacity: starting ? 0.7 : 1,
                  }}
                >
                  {starting ? "启动中..." : "启动 Gateway"}
                </button>
              )}
              
              {hasEmbedded && isRunning && (
                <button
                  type="button"
                  onClick={stopGateway}
                  disabled={stopping}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: "1px solid rgba(239,68,68,0.35)",
                    background: "rgba(239,68,68,0.10)",
                    color: "#fca5a5",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: stopping ? "not-allowed" : "pointer",
                    opacity: stopping ? 0.7 : 1,
                  }}
                >
                  {stopping ? "停止中..." : "停止 Gateway"}
                </button>
              )}
              
              <button
                type="button"
                onClick={() => refresh().catch((e) => setError(e?.message ?? "刷新失败"))}
                disabled={loading}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid #1f2937",
                  background: "rgba(15,23,42,0.85)",
                  color: "#e5e7eb",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                刷新状态
              </button>
            </div>
          </div>

          {hasEmbedded && isRunning && (
            <div
              style={{
                marginBottom: 14,
                border: "1px solid rgba(251,191,36,0.35)",
                borderRadius: 12,
                padding: "14px 16px",
                background: "rgba(251,191,36,0.10)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", marginBottom: 8 }}>⚠️ 需要配置 LLM</div>
              <div style={{ fontSize: 11, color: "#fde68a", lineHeight: 1.7 }}>
                <strong>首次使用必须配置 LLM 提供商</strong>，否则聊天功能无法使用（会报 401 错误）。
                <br />
                请切换到 <strong>「配置编辑」</strong> 标签页编辑 openclaw.json，在 models.providers.minimax.apiKey 中填入你的 API Key。
              </div>
            </div>
          )}

          <div
            style={{
              border: "1px solid #1f2937",
              borderRadius: 12,
              padding: "12px 12px",
              background: "rgba(15,23,42,0.85)",
            }}
          >
            <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.6, marginBottom: 8 }}>
              OpenClaw UI 地址: <code style={{ fontSize: 10, wordBreak: "break-all" }}>{uiUrl}</code>
              {uiUrl.includes("token=") && (
                <span style={{ marginLeft: 8, color: "#4ade80", fontSize: 10 }}>✓ 已包含认证 token</span>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <a
                href={uiUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "7px 12px",
                  borderRadius: 999,
                  border: "1px solid #374151",
                  background: "transparent",
                  color: isRunning ? "#60a5fa" : "#6b7280",
                  fontSize: 11,
                  fontWeight: 600,
                  pointerEvents: isRunning ? "auto" : "none",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                新窗口打开
              </a>
            </div>

            <div
              style={{
                minHeight: 520,
                borderRadius: 12,
                border: "1px solid #111827",
                overflow: "hidden",
                background: "#000",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {isRunning ? (
                <div style={{ textAlign: "center", padding: "20px" }}>
                  <div style={{ fontSize: 14, color: "#e5e7eb", marginBottom: 12, fontWeight: 600 }}>
                    OpenClaw UI 已就绪
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 20, lineHeight: 1.6 }}>
                    由于安全策略限制，OpenClaw UI 无法在 iframe 中嵌入。
                    <br />
                    请点击下方按钮在新窗口中打开（已自动登录）。
                  </div>
                  <a
                    href={uiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-block",
                      padding: "10px 20px",
                      borderRadius: 999,
                      border: "none",
                      background: "#3b82f6",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      textDecoration: "none",
                      cursor: "pointer",
                    }}
                  >
                    在新窗口打开 OpenClaw →
                  </a>
                  <div style={{ fontSize: 10, color: "#6b7280", marginTop: 16 }}>
                    URL: {uiUrl}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "16px 14px 14px",
                    color: "#9ca3af",
                    fontSize: 12,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "stretch",
                    gap: 10,
                    flex: 1,
                    minHeight: 0,
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 14, color: "#e5e7eb", marginBottom: 8, fontWeight: 600 }}>
                      OpenClaw Gateway 未运行
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.6 }}>
                      {hasEmbedded
                        ? "请点击上方的「启动 Gateway」按钮来启动 OpenClaw 服务。"
                        : "请先运行 npm install 安装 OpenClaw。"}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                    <button
                      type="button"
                      onClick={() => copyGatewayLog()}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        border: "1px solid #374151",
                        background: "rgba(59,130,246,0.15)",
                        color: "#93c5fd",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      复制全部诊断日志
                    </button>
                    <button
                      type="button"
                      onClick={() => refresh().catch(() => {})}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        border: "1px solid #374151",
                        background: "rgba(15,23,42,0.85)",
                        color: "#e5e7eb",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      刷新日志
                    </button>
                  </div>
                  <div style={{ fontSize: 10, color: "#6b7280", textAlign: "center" }}>
                    下方文本框可选中后 Ctrl+C 复制；失败时请整段发给开发者。
                  </div>
                  <textarea
                    readOnly
                    value={gatewayLog}
                    placeholder="（暂无日志：点击「启动 Gateway」后此处会显示完整命令、路径与子进程输出）"
                    spellCheck={false}
                    style={{
                      width: "100%",
                      flex: 1,
                      minHeight: 320,
                      boxSizing: "border-box",
                      resize: "vertical",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid #1f2937",
                      background: "#0b1220",
                      color: "#e2e8f0",
                      fontSize: 10,
                      fontFamily: "Consolas, Monaco, 'Courier New', monospace",
                      lineHeight: 1.45,
                      outline: "none",
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 配置编辑标签页 */}
      {activeSubTab === "config" && (
        <div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>
              配置文件路径: <code style={{ fontSize: 10, color: "#60a5fa" }}>{configPath}</code>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
              <button
                type="button"
                onClick={saveConfig}
                disabled={configSaving}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: "none",
                  background: configSaving ? "#065f46" : "#22c55e",
                  color: "#022c22",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: configSaving ? "not-allowed" : "pointer",
                }}
              >
                {configSaving ? "保存中..." : "保存配置"}
              </button>
              <button
                type="button"
                onClick={restartGateway}
                disabled={configSaving}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: "1px solid rgba(251,191,36,0.5)",
                  background: "transparent",
                  color: "#fbbf24",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: configSaving ? "not-allowed" : "pointer",
                }}
              >
                重启 Gateway
              </button>
              <button
                type="button"
                onClick={formatJson}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: "1px solid #374151",
                  background: "transparent",
                  color: "#9ca3af",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                格式化 JSON
              </button>
              <button
                type="button"
                onClick={reloadConfig}
                disabled={configLoading}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: "1px solid #374151",
                  background: "transparent",
                  color: "#9ca3af",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: configLoading ? "not-allowed" : "pointer",
                }}
              >
                {configLoading ? "加载中..." : "重新加载"}
              </button>
              {message && (
                <span style={{ fontSize: 11, color: "#4ade80", marginLeft: 8 }}>
                  {message}
                </span>
              )}
            </div>
          </div>
          
          <textarea
            value={configJson}
            onChange={(e) => setConfigJson(e.target.value)}
            spellCheck={false}
            style={{
              width: "100%",
              height: 600,
              padding: "12px",
              borderRadius: 8,
              border: "1px solid #374151",
              background: "#020617",
              color: "#e5e7eb",
              fontSize: 11,
              fontFamily: "Consolas, Monaco, 'Courier New', monospace",
              lineHeight: 1.6,
              resize: "vertical",
            }}
          />
          
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              border: "1px solid rgba(59,130,246,0.35)",
              borderRadius: 8,
              background: "rgba(59,130,246,0.10)",
              fontSize: 10,
              color: "#93c5fd",
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>💡 配置提示</div>
            <div>• 修改 models.providers 配置提供商和模型</div>
            <div>• 修改 agents.defaults.model 设置主模型和备用模型</div>
            <div>• 保存后需要重启 Gateway 才能生效</div>
            <div>• 参考文档: <a href="https://docs.openclaw.ai/gateway/configuration-reference" target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", textDecoration: "underline" }}>Configuration Reference</a></div>
          </div>
        </div>
      )}

      {loading && <div style={{ marginTop: 10, fontSize: 11, color: "#6b7280" }}>加载中…</div>}
      {error && <div style={{ marginTop: 6, fontSize: 11, color: "#f97373" }}>{error}</div>}
    </div>
  );
}
