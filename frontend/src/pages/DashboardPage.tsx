import { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";

interface ApiKeyItem {
  id: number;
  label: string;
  scopes?: string;
  active?: boolean;
  createdAt?: string;
}

export const DashboardPage = () => {
  const { token } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newScopes, setNewScopes] = useState("");
  const [lastCreatedKey, setLastCreatedKey] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const loadKeys = async () => {
    if (!token) return;
    setListError(null);
    try {
      const res = await api.get<ApiKeyItem[]>("/api/api-keys", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setApiKeys(Array.isArray(res.data) ? res.data : []);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { status?: number; data?: { message?: string } } }).response?.data?.message
          : null;
      setListError(msg || "加载 API Key 列表失败，请刷新重试");
      setApiKeys([]);
    }
  };

  useEffect(() => {
    loadKeys();
  }, [token]);

  const createKey = async () => {
    if (!token || !newLabel.trim()) return;
    setListError(null);
    try {
      const res = await api.post<{ id: number; apiKey: string }>(
        "/api/api-keys",
        { label: newLabel, scopes: newScopes },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setLastCreatedKey(res.data.apiKey);
      setNewLabel("");
      setNewScopes("");
      await loadKeys();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setListError(msg || "创建失败，请重试");
    }
  };

  const formatDate = (s?: string) => {
    if (!s) return "—";
    try {
      const d = new Date(s);
      return d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch {
      return s;
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">用户后台</h2>

      {/* 创建 API Key */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-5 shadow-sm">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-3">创建 API Key</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-slate-500 dark:text-slate-400">描述</label>
            <input
              className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              placeholder="如：生产环境 Agent 网关"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs text-slate-500 dark:text-slate-400">Scopes（可选）</label>
            <input
              className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              placeholder="tools:read, safety:check"
              value={newScopes}
              onChange={(e) => setNewScopes(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={createKey}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
            >
              创建
            </button>
          </div>
        </div>
        {lastCreatedKey && (
          <div className="mt-4 p-3 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">新建 Key 仅显示一次，请复制保存</p>
            <code className="text-xs text-amber-900 dark:text-amber-100 break-all block font-mono">{lastCreatedKey}</code>
          </div>
        )}
      </section>

      {/* 我的 API Keys 列表 */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 shadow-sm overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">我的 API Keys</h3>
          <button
            type="button"
            onClick={() => loadKeys()}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
          >
            刷新
          </button>
        </div>
        <div className="p-5">
          {listError && (
            <div className="mb-4 py-2 px-3 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 text-sm">
              {listError}
            </div>
          )}
          {apiKeys.length === 0 && !listError && (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              暂无 API Key，在上方创建一个
            </div>
          )}
          {apiKeys.length > 0 && (
            <ul className="space-y-3">
              {apiKeys.map((k) => (
                <li
                  key={k.id}
                  className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 hover:border-slate-200 dark:hover:border-slate-600 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 dark:text-white truncate">
                      {k.label || "未命名"}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>ID {k.id}</span>
                      <span>·</span>
                      <span>创建于 {formatDate(k.createdAt)}</span>
                      {k.scopes && (
                        <>
                          <span>·</span>
                          <span className="text-slate-600 dark:text-slate-300">{k.scopes}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {k.active !== false && (
                    <span className="shrink-0 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                      有效
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
};

