import { useState, useEffect, useRef } from "react";
import { api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

interface ApiKeyItem {
  id: number;
  label: string;
  scopes?: string;
  active?: boolean;
  createdAt?: string;
}

export const DashboardPage = () => {
  const { token } = useAuth();
  const { confirm } = useConfirm();
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newScopes, setNewScopes] = useState("");
  const [lastCreatedKey, setLastCreatedKey] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [actionKeyId, setActionKeyId] = useState<number | null>(null);
  const [editKey, setEditKey] = useState<ApiKeyItem | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editScopes, setEditScopes] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // 点击外部关闭下拉
  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActionKeyId(null);
      }
    };
    document.addEventListener("click", onOutside);
    return () => document.removeEventListener("click", onOutside);
  }, []);

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

  const revokeKey = (id: number, label: string) => {
    setActionKeyId(null);
    confirm({
      title: "确认删除",
      message: `确定要失效 API Key「${label || "未命名"}」吗？失效后该 Key 将无法再用于鉴权。`,
      confirmText: "删除",
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/api/api-keys/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          await loadKeys();
        } catch (e: unknown) {
          const msg =
            e && typeof e === "object" && "response" in e
              ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
              : null;
          setListError(msg || "删除失败，请重试");
          throw e;
        }
      },
    });
  };

  const openEdit = (k: ApiKeyItem) => {
    setActionKeyId(null);
    setEditKey(k);
    setEditLabel(k.label || "");
    setEditScopes(k.scopes || "");
  };

  const closeEdit = () => {
    setEditKey(null);
    setEditLabel("");
    setEditScopes("");
  };

  const saveEdit = async () => {
    if (!token || !editKey) return;
    setEditSubmitting(true);
    setListError(null);
    try {
      await api.patch(
        `/api/api-keys/${editKey.id}`,
        { label: editLabel.trim() || undefined, scopes: editScopes.trim() || undefined },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      closeEdit();
      await loadKeys();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setListError(msg || "修改失败，请重试");
    } finally {
      setEditSubmitting(false);
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
                  <div className="flex items-center gap-2 shrink-0">
                    {k.active !== false && (
                      <>
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                          有效
                        </span>
                        <div className="relative" ref={actionKeyId === k.id ? dropdownRef : undefined}>
                          <button
                            type="button"
                            onClick={() => setActionKeyId((id) => (id === k.id ? null : k.id))}
                            className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                            title="操作"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {actionKeyId === k.id && (
                            <div className="absolute right-0 top-full mt-1 py-1 min-w-[100px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg z-10">
                              <button
                                type="button"
                                onClick={() => openEdit(k)}
                                className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                修改
                              </button>
                              <button
                                type="button"
                                onClick={() => revokeKey(k.id, k.label)}
                                className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                删除
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 修改 API Key 弹窗 */}
      {editKey && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-key-title"
        >
          <div
            className="absolute inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-sm"
            onClick={closeEdit}
            aria-hidden
          />
          <div className="relative w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-5 space-y-4">
            <h2 id="edit-key-title" className="text-base font-semibold text-slate-900 dark:text-white">
              修改 API Key
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">描述</label>
                <input
                  className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="如：生产环境 Agent 网关"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Scopes（可选）</label>
                <input
                  className="w-full rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  value={editScopes}
                  onChange={(e) => setEditScopes(e.target.value)}
                  placeholder="tools:read, safety:check"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeEdit}
                disabled={editSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={editSubmitting || !editLabel.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-50"
              >
                {editSubmitting ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
