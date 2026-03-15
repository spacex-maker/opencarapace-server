import { useState, useEffect } from "react";
import {
  fetchSystemConfigList,
  setSystemConfig,
  type SystemConfigItem,
} from "../api/client";
import { Settings, Save, Key } from "lucide-react";

const KEY_LABELS: Record<string, string> = {
  "deepseek.api_key": "DeepSeek API Key",
  "tavily.api_key": "Tavily API Key",
  "danger_commands.sync.use_internet": "危险指令库 · 是否启用互联网更新",
  "llm_proxy.upstream_url": "大模型代理 · 上游地址",
  "llm_proxy.upstream_api_key": "大模型代理 · 上游 API Key",
  "llm_proxy.enabled": "大模型代理 · 是否启用",
  "llm_proxy.supervision.enabled": "监管层 · 是否启用",
  "llm_proxy.supervision.block_levels": "监管层 · 拦截风险等级",
  "llm_proxy.intent.enabled": "意图层 · 是否启用 AI 意图判断",
  "llm_proxy.intent.model": "意图层 · 意图分类使用的模型名",
};

const KEY_HINTS: Record<string, string> = {
  "deepseek.api_key": "留空保留原值，输入新 Key 则覆盖",
  "tavily.api_key": "留空保留原值，输入新 Key 则覆盖",
  "danger_commands.sync.use_internet": "true=启用 Tavily+DeepSeek 定时更新，false=仅用本地数据",
  "llm_proxy.upstream_url": "默认上游；如 https://api.deepseek.com，不传 X-LLM-Backend 时使用",
  "llm_proxy.upstream_api_key": "可选：默认上游 Key；不填则请求时需带 Authorization",
  "llm_proxy.enabled": "true=启用中转；请求需 X-OC-API-KEY，可选 X-LLM-Backend 指定厂商",
  "llm_proxy.backend": "多后端：配置 llm_proxy.backend.{name}.url 与 .api_key，请求头 X-LLM-Backend=name 选择厂商",
  "llm_proxy.supervision.enabled": "true=对代理请求/响应做危险指令库匹配，触犯 block_levels 则拦截",
  "llm_proxy.supervision.block_levels": "触犯时拦截的等级，如 CRITICAL 或 CRITICAL,HIGH",
  "llm_proxy.intent.enabled": "true=用 AI 判断意图是否危险；使用用户自己的 API+Key，我们只注入系统提示词",
  "llm_proxy.intent.model": "意图分类请求使用的模型（与用户上游一致），如 gpt-3.5-turbo 或 deepseek-chat",
};

function isSecretKey(key: string): boolean {
  return key.endsWith(".api_key") || key.endsWith(".secret") || key.includes("password");
}

function getConfigLabel(key: string): string {
  if (KEY_LABELS[key]) return KEY_LABELS[key];
  const m = key.match(/^llm_proxy\.backend\.([a-z0-9_-]+)\.(url|api_key)$/);
  if (m) return `大模型代理 · 后端 ${m[1]} · ${m[2] === "url" ? "URL" : "API Key"}`;
  return key;
}

function getConfigHint(key: string): string | undefined {
  if (KEY_HINTS[key]) return KEY_HINTS[key];
  if (key.match(/^llm_proxy\.backend\.[a-z0-9_-]+\.url$/)) return "该后端 API 根地址，如 https://api.openai.com";
  if (key.match(/^llm_proxy\.backend\.[a-z0-9_-]+\.api_key$/)) return "可选；不填则请求需带 Authorization（用户自己的 Key）";
  return undefined;
}

export const SystemConfigPage = () => {
  const [list, setList] = useState<SystemConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError("");
    fetchSystemConfigList()
      .then(setList)
      .catch((err) => {
        setError(err?.response?.data?.message || "加载失败");
        setList([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (item: SystemConfigItem) => {
    setEditingKey(item.configKey);
    setEditValue(isSecretKey(item.configKey) && item.configValue === "***" ? "" : item.configValue);
    setEditDesc(item.description ?? "");
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue("");
    setEditDesc("");
  };

  const saveEdit = async () => {
    if (!editingKey) return;
    setSaving(true);
    setError("");
    try {
      await setSystemConfig(editingKey, editValue, editDesc || undefined);
      cancelEdit();
      load();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setError(msg || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full max-w-md rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-slate-100 text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
          <Settings className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">系统配置</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            管理 API Key 与开关（仅管理员可见）
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-slate-500 dark:text-slate-400 text-sm py-8">加载中…</div>
      )}

      {!loading && list.length === 0 && (
        <div className="text-slate-500 dark:text-slate-400 text-sm py-8">暂无配置项</div>
      )}

      {!loading && list.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-left">
                <th className="px-4 py-3 font-medium whitespace-nowrap">配置项</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">值</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">说明</th>
                <th className="px-4 py-3 font-medium w-24 whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map((item) => (
                <tr key={item.configKey} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-mono text-slate-800 dark:text-slate-200">
                      {getConfigLabel(item.configKey)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {editingKey === item.configKey ? (
                      <input
                        type={isSecretKey(item.configKey) ? "password" : "text"}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder={item.configValue === "***" ? "留空保留原值" : ""}
                        className={inputClass}
                      />
                    ) : (
                      <span className="text-slate-600 dark:text-slate-400 font-mono">
                        {item.configValue === "***" ? "已配置（不展示）" : item.configValue}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-500 min-w-0">
                    {editingKey === item.configKey ? (
                      <input
                        type="text"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="可选说明"
                        className={inputClass}
                      />
                    ) : (
                      <span>{item.description ?? getConfigHint(item.configKey) ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {editingKey === item.configKey ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={saveEdit}
                          disabled={saving}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium disabled:opacity-50"
                        >
                          <Save className="w-3 h-3" />
                          {saving ? "保存中" : "保存"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="px-2 py-1 rounded-md border border-slate-400 dark:border-slate-600 text-slate-600 dark:text-slate-400 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-400 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Key className="w-3 h-3" />
                        编辑
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 text-xs text-slate-600 dark:text-slate-500 space-y-1">
        <div className="font-medium text-slate-600 dark:text-slate-400">说明</div>
        <ul className="list-disc list-inside space-y-0.5">
          {Object.entries(KEY_HINTS).filter(([k]) => !k.startsWith("llm_proxy.backend.") || k === "llm_proxy.backend").map(([key, hint]) => (
            <li key={key}>
              <span className="font-mono text-slate-600 dark:text-slate-500">{key}</span>: {hint}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
