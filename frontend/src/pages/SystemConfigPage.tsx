import { useState, useEffect } from "react";
import {
  fetchSystemConfigList,
  setSystemConfig,
  fetchClawhubSyncSettings,
  updateClawhubSyncSettings,
  fetchGroupedSettings,
  putGroupedSettings,
  CLAWHUB_CRON_PRESETS,
  manualSyncClawhubSkills,
  type SystemConfigItem,
  type ClawhubSyncSettings,
  type GroupedSettingsDto,
} from "../api/client";
import {
  Settings,
  Save,
  Key,
  RefreshCw,
  Shield,
  Zap,
  Eye,
  Brain,
} from "lucide-react";
import { SocialMediaConfigSection } from "../components/system/SocialMediaConfigSection";

const KEY_LABELS: Record<string, string> = {
  "deepseek.api_key": "DeepSeek API Key",
  "tavily.api_key": "Tavily API Key",
  "danger_commands.sync.use_internet": "危险指令库 · 是否启用互联网更新",
  "llm_proxy.upstream_url": "代理中转 · 上游地址",
  "llm_proxy.upstream_api_key": "代理中转 · 上游 API Key",
  "llm_proxy.enabled": "代理中转开关",
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
  "llm_proxy.enabled": "true=开启代理中转；请求需 X-OC-API-KEY，可选 X-LLM-Backend 指定厂商",
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
  if (m) return `代理中转 · 后端 ${m[1]} · ${m[2] === "url" ? "URL" : "API Key"}`;
  return key;
}

function getConfigHint(key: string): string | undefined {
  if (KEY_HINTS[key]) return KEY_HINTS[key];
  if (key.match(/^llm_proxy\.backend\.[a-z0-9_-]+\.url$/)) return "该后端 API 根地址，如 https://api.openai.com";
  if (key.match(/^llm_proxy\.backend\.[a-z0-9_-]+\.api_key$/)) return "可选；不填则请求需带 Authorization（用户自己的 Key）";
  return undefined;
}

const CUSTOM_CRON_VALUE = "__custom__";

export const SystemConfigPage = () => {
  const [list, setList] = useState<SystemConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const [clawhubSync, setClawhubSync] = useState<ClawhubSyncSettings | null>(null);
  const [clawhubSyncLoading, setClawhubSyncLoading] = useState(true);
  const [clawhubEnabled, setClawhubEnabled] = useState(false);
  const [clawhubCronPreset, setClawhubCronPreset] = useState<string>("0 0 2 * * ?");
  const [clawhubCronCustom, setClawhubCronCustom] = useState("");
  const [clawhubSaving, setClawhubSaving] = useState(false);
  const [clawhubSyncingOnce, setClawhubSyncingOnce] = useState(false);

  const [grouped, setGrouped] = useState<GroupedSettingsDto | null>(null);
  const [groupedLoading, setGroupedLoading] = useState(true);
  const [groupedSaving, setGroupedSaving] = useState<string | null>(null);

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

  const loadClawhubSync = () => {
    setClawhubSyncLoading(true);
    fetchClawhubSyncSettings()
      .then((data) => {
        setClawhubSync(data);
        setClawhubEnabled(data.enabled);
        const preset = CLAWHUB_CRON_PRESETS.find((p) => p.value === data.cronExpression);
        setClawhubCronPreset(preset ? preset.value : CUSTOM_CRON_VALUE);
        if (!preset) setClawhubCronCustom(data.cronExpression);
      })
      .catch(() => setClawhubSync(null))
      .finally(() => setClawhubSyncLoading(false));
  };

  useEffect(() => {
    loadClawhubSync();
  }, []);

  const loadGrouped = () => {
    setGroupedLoading(true);
    fetchGroupedSettings()
      .then(setGrouped)
      .catch(() => setGrouped(null))
      .finally(() => setGroupedLoading(false));
  };
  useEffect(() => {
    loadGrouped();
  }, []);

  const saveGroupedSection = async (
    section: keyof GroupedSettingsDto,
    payload: Partial<GroupedSettingsDto>
  ) => {
    if (!grouped) return;
    setGroupedSaving(section);
    setError("");
    try {
      const next = { ...grouped, ...payload };
      const updated = await putGroupedSettings(next);
      setGrouped(updated);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setError(msg || "保存失败");
    } finally {
      setGroupedSaving(null);
    }
  };

  const saveClawhubSync = async () => {
    setClawhubSaving(true);
    setError("");
    const cron =
      clawhubCronPreset === CUSTOM_CRON_VALUE ? clawhubCronCustom.trim() : clawhubCronPreset;
    if (!cron) {
      setError("请选择或填写同步频次");
      setClawhubSaving(false);
      return;
    }
    try {
      const updated = await updateClawhubSyncSettings(clawhubEnabled, cron);
      setClawhubSync(updated);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setError(msg || "保存失败");
    } finally {
      setClawhubSaving(false);
    }
  };

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

      {/* ClawHub 技能同步 - 独立卡片 */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-5 shadow-sm">
        {clawhubSyncLoading ? (
          <div className="text-sm text-slate-500 dark:text-slate-400 py-4">加载中…</div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    ClawHub 技能同步
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    从 ClawHub 公开 API 定时拉取技能列表到本地，无需安装 CLI
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={saveClawhubSync}
                  disabled={clawhubSaving || clawhubSyncingOnce}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {clawhubSaving ? "保存中…" : "保存"}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setClawhubSyncingOnce(true);
                      const res = await manualSyncClawhubSkills();
                      // 简单提示，不引入额外 Toast 组件
                      alert(`已从 ${res.source} 手动同步 ${res.synced} 条技能。`);
                    } catch (e: any) {
                      alert(e?.response?.data?.message || e?.message || "手动同步失败");
                    } finally {
                      setClawhubSyncingOnce(false);
                    }
                  }}
                  disabled={clawhubSyncingOnce}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-xs font-medium disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {clawhubSyncingOnce ? "同步中…" : "手动同步一次"}
                </button>
              </div>
            </div>
            <div className="space-y-4 max-w-md">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                启用定时同步
              </label>
              <button
                type="button"
                role="switch"
                aria-checked={clawhubEnabled}
                onClick={() => setClawhubEnabled((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/50 ${
                  clawhubEnabled
                    ? "bg-brand-500 border-brand-500"
                    : "bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                    clawhubEnabled ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                同步频次
              </label>
              <div className="flex flex-wrap gap-2">
                {CLAWHUB_CRON_PRESETS.map((p) => {
                  const active = clawhubCronPreset === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setClawhubCronPreset(p.value)}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                        active
                          ? "bg-brand-500 text-white border-brand-500"
                          : "bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setClawhubCronPreset(CUSTOM_CRON_VALUE)}
                  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                    clawhubCronPreset === CUSTOM_CRON_VALUE
                      ? "bg-brand-500 text-white border-brand-500"
                      : "bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                >
                  自定义 Cron
                </button>
              </div>
              {clawhubCronPreset === CUSTOM_CRON_VALUE && (
                <input
                  type="text"
                  value={clawhubCronCustom}
                  onChange={(e) => setClawhubCronCustom(e.target.value)}
                  placeholder="如 0 0 2 * * ?"
                  className="mt-2 w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-brand-500/50"
                />
              )}
            </div>
              {clawhubSync?.lastRunAt && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  上次执行：{new Date(clawhubSync.lastRunAt).toLocaleString("zh-CN")}
                </p>
              )}
            </div>
          </>
        )}
      </section>

      {/* 危险指令库同步 - 独立卡片 */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">危险指令库同步</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Tavily + DeepSeek 定时从互联网更新危险指令数据</p>
            </div>
          </div>
          {grouped?.dangerCommands && (
            <button
              type="button"
              onClick={() => saveGroupedSection("dangerCommands", { dangerCommands: grouped.dangerCommands })}
              disabled={groupedSaving === "dangerCommands"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {groupedSaving === "dangerCommands" ? "保存中…" : "保存"}
            </button>
          )}
        </div>
        {groupedLoading ? (
          <div className="text-sm text-slate-500 dark:text-slate-400 py-4">加载中…</div>
        ) : grouped?.dangerCommands ? (
          <div className="space-y-4 max-w-md">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">启用互联网更新</label>
              <button
                type="button"
                role="switch"
                aria-checked={grouped.dangerCommands.useInternet}
                onClick={() =>
                  setGrouped((g) =>
                    g ? { ...g, dangerCommands: { ...g.dangerCommands, useInternet: !g.dangerCommands.useInternet } } : g,
                  )
                }
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
                  grouped.dangerCommands.useInternet ? "bg-brand-500 border-brand-500" : "bg-slate-200 dark:bg-slate-700 border-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    grouped.dangerCommands.useInternet ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">DeepSeek API Key</label>
              <input
                type="password"
                autoComplete="new-password"
                name="danger-deepseek-api-key"
                placeholder={grouped.dangerCommands.deepseekApiKeySet ? "留空保留原值" : "用于 AI 解析"}
                value={grouped.dangerCommands.deepseekApiKey ?? ""}
                onChange={(e) =>
                  setGrouped((g) =>
                    g ? { ...g, dangerCommands: { ...g.dangerCommands, deepseekApiKey: e.target.value } } : g,
                  )
                }
                className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Tavily API Key</label>
              <input
                type="password"
                autoComplete="new-password"
                name="danger-tavily-api-key"
                placeholder={grouped.dangerCommands.tavilyApiKeySet ? "留空保留原值" : "用于互联网搜索"}
                value={grouped.dangerCommands.tavilyApiKey ?? ""}
                onChange={(e) =>
                  setGrouped((g) =>
                    g ? { ...g, dangerCommands: { ...g.dangerCommands, tavilyApiKey: e.target.value } } : g,
                  )
                }
                className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm"
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-2">加载失败或暂无数据，请刷新或确认管理员权限</p>
        )}
      </section>

      {/* 代理中转开关 - 独立卡片 */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">代理中转开关</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                控制是否启用请求中转。上游地址与 API Key 均由调用方在请求头中传入（X-LLM-Upstream-Url + Authorization）。
              </p>
            </div>
          </div>
          {grouped?.llmProxy && (
            <button
              type="button"
              onClick={() => grouped && saveGroupedSection("llmProxy", { llmProxy: grouped.llmProxy })}
              disabled={groupedSaving === "llmProxy"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {groupedSaving === "llmProxy" ? "保存中…" : "保存"}
            </button>
          )}
        </div>
        {groupedLoading ? (
          <div className="text-sm text-slate-500 dark:text-slate-400 py-4">加载中…</div>
        ) : grouped?.llmProxy ? (
          <div className="space-y-4 max-w-lg">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">启用代理中转</label>
              <button
                type="button"
                role="switch"
                aria-checked={grouped.llmProxy.enabled}
                onClick={() =>
                  setGrouped((g) =>
                    g ? { ...g, llmProxy: { ...g.llmProxy, enabled: !g.llmProxy.enabled } } : g,
                  )
                }
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
                  grouped.llmProxy.enabled ? "bg-brand-500 border-brand-500" : "bg-slate-200 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    grouped.llmProxy.enabled ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-2">加载失败或暂无数据</p>
        )}
      </section>

      {/* 监管层 - 独立卡片 */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Eye className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">监管层</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">对代理请求/响应做危险指令库匹配，触犯则拦截</p>
            </div>
          </div>
          {grouped?.supervision && (
            <button
              type="button"
              onClick={() => grouped && saveGroupedSection("supervision", { supervision: grouped.supervision })}
              disabled={groupedSaving === "supervision"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {groupedSaving === "supervision" ? "保存中…" : "保存"}
            </button>
          )}
        </div>
        {groupedLoading ? (
          <div className="text-sm text-slate-500 dark:text-slate-400 py-4">加载中…</div>
        ) : grouped?.supervision ? (
          <div className="space-y-4 max-w-md">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">启用监管</label>
              <button
                type="button"
                role="switch"
                aria-checked={grouped.supervision.enabled}
                onClick={() =>
                  setGrouped((g) =>
                    g ? { ...g, supervision: { ...g.supervision, enabled: !g.supervision.enabled } } : g,
                  )
                }
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
                  grouped.supervision.enabled ? "bg-brand-500 border-brand-500" : "bg-slate-200 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    grouped.supervision.enabled ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                触犯时拦截的等级
              </label>
              <div className="flex flex-wrap gap-2 mb-1">
                {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((level) => {
                  const selected = (grouped.supervision.blockLevels || "")
                    .split(",")
                    .filter(Boolean)
                    .includes(level);
                  const toggle = () => {
                    setGrouped((g) => {
                      if (!g) return g;
                      const current = (g.supervision.blockLevels || "")
                        .split(",")
                        .filter(Boolean);
                      const next = selected
                        ? current.filter((x) => x !== level)
                        : [...current, level];
                      return {
                        ...g,
                        supervision: {
                          ...g.supervision,
                          blockLevels: next.join(","),
                        },
                      };
                    });
                  };
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={toggle}
                      className={`px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
                        selected
                          ? "bg-brand-500 text-white border-brand-500"
                          : "bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                当前：{grouped.supervision.blockLevels || "未选择（默认不拦截）"}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-2">加载失败或暂无数据</p>
        )}
      </section>

      {/* 意图层 - 独立卡片 */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">意图层</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                用 AI 判断是否意图执行危险指令（会多一次上游调用，使用调用方自己的 LLM）
              </p>
            </div>
          </div>
          {grouped?.intent && (
            <button
              type="button"
              onClick={() => grouped && saveGroupedSection("intent", { intent: grouped.intent })}
              disabled={groupedSaving === "intent"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {groupedSaving === "intent" ? "保存中…" : "保存"}
            </button>
          )}
        </div>
        {groupedLoading ? (
          <div className="text-sm text-slate-500 dark:text-slate-400 py-4">加载中…</div>
        ) : grouped?.intent ? (
          <div className="space-y-4 max-w-md">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">启用意图判断</label>
              <button
                type="button"
                role="switch"
                aria-checked={grouped.intent.enabled}
                onClick={() =>
                  setGrouped((g) =>
                    g ? { ...g, intent: { ...g.intent, enabled: !g.intent.enabled } } : g,
                  )
                }
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
                  grouped.intent.enabled ? "bg-brand-500 border-brand-500" : "bg-slate-200 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    grouped.intent.enabled ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-2">加载失败或暂无数据</p>
        )}
      </section>

      <SocialMediaConfigSection />

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {/* 其余键值配置：与上方卡片区分，列表形式 */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-3">其余键值配置</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">以下为未在专用卡片中管理的键值项，可在此编辑。</p>
      </div>

      {loading && (
        <div className="text-slate-500 dark:text-slate-400 text-sm py-8">加载中…</div>
      )}

      {!loading && list.length === 0 && (
        <p className="text-slate-500 dark:text-slate-400 text-sm py-4">当前无其余键值项，所有配置均通过上方卡片管理。</p>
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
