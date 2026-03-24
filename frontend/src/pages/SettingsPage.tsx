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
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">设置</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          在这里选择本地客户端调用 LLM 时的路由模式，并配置自定义转发映射。
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-5">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">LLM 路由模式</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          你可以选择直接连接上游 LLM，或通过 ClawHeart 云端网关转发（带危险指令监管与意图识别能力）。
        </p>
        <div className="grid grid-cols-1 gap-3">
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
            className={`text-left px-4 py-4 rounded-2xl border ${
              routeMode === "GATEWAY"
                ? "bg-brand-500/10 border-brand-500"
                : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-brand-400/60"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100">
                通过 ClawHeart 网关（推荐）
              </div>
              {routeMode === "GATEWAY" && (
                <span className="inline-flex items-center rounded-full border border-brand-500/40 bg-brand-500/15 px-2 py-0.5 text-[11px] text-brand-700 dark:text-brand-300">
                  当前
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              请求先发到云端网关，由网关执行危险指令拦截与意图识别，再转发到上游 LLM。便于统一审计与策略配置。
            </p>
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
            className={`text-left px-4 py-4 rounded-2xl border ${
              routeMode === "DIRECT"
                ? "bg-brand-500/10 border-brand-500"
                : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-brand-400/60"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="text-sm sm:text-base font-medium text-slate-900 dark:text-slate-100">
                直接连接 LLM（仅本地校验）
              </div>
              {routeMode === "DIRECT" && (
                <span className="inline-flex items-center rounded-full border border-brand-500/40 bg-brand-500/15 px-2 py-0.5 text-[11px] text-brand-700 dark:text-brand-300">
                  当前
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              本地客户端直接调用上游 LLM，仅使用本地危险指令库做拦截。适合内网环境或对延迟更敏感的场景。
            </p>
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-5 space-y-2">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Skills 用户设置同步</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          当你在本地客户端修改 Skill 的启用状态时，是否同步到云端。开启后，你的偏好设置将在多设备间保持一致。
        </p>
        <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          已开启
        </span>
        <p className="text-sm text-slate-600 dark:text-slate-300">修改 Skill 启用状态时会同步到云端</p>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-5 space-y-2">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">危险指令用户设置同步</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          当你在本地客户端修改危险指令的启用状态时，是否同步到云端。开启后，你的偏好设置将在多设备间保持一致。
        </p>
        <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          已开启
        </span>
        <p className="text-sm text-slate-600 dark:text-slate-300">修改危险指令启用状态时会同步到云端</p>
      </section>
    </div>
  );
};

