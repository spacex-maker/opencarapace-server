import { useState, useEffect } from "react";
import { fetchUserSettings, updateLlmRouteMode, type LlmRouteMode } from "../api/client";
import { useAuth } from "../contexts/AuthContext";

export const SettingsPage = () => {
  const { token } = useAuth();
  const [routeMode, setRouteMode] = useState<LlmRouteMode>("GATEWAY");
  const [routeSaving, setRouteSaving] = useState(false);

  useEffect(() => {
    if (token) {
      fetchUserSettings()
        .then((s) => setRouteMode(s.llmRouteMode))
        .catch(() => {
          // 忽略用户设置加载错误，沿用默认 GATEWAY
        });
    }
  }, [token]);

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">设置</h2>

      {/* LLM 路由模式设置 */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-5 shadow-sm">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">LLM 路由模式</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          本地 npx 代理可根据此设置选择直接连接 LLM，或先经过 ClawHeart 云端网关（带监管层 + 意图层）。
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            disabled={routeSaving}
            onClick={async () => {
              if (routeMode === "GATEWAY") return;
              setRouteSaving(true);
              try {
                const s = await updateLlmRouteMode("GATEWAY");
                setRouteMode(s.llmRouteMode);
              } finally {
                setRouteSaving(false);
              }
            }}
            className={`flex-1 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium border ${
              routeMode === "GATEWAY"
                ? "bg-brand-500 text-white border-brand-500"
                : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            通过 ClawHeart 网关（推荐）
          </button>
          <button
            type="button"
            disabled={routeSaving}
            onClick={async () => {
              if (routeMode === "DIRECT") return;
              setRouteSaving(true);
              try {
                const s = await updateLlmRouteMode("DIRECT");
                setRouteMode(s.llmRouteMode);
              } finally {
                setRouteSaving(false);
              }
            }}
            className={`flex-1 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium border ${
              routeMode === "DIRECT"
                ? "bg-slate-800 text-slate-50 border-slate-700"
                : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            直接连接 LLM（仅本地校验）
          </button>
        </div>
      </section>
    </div>
  );
};

