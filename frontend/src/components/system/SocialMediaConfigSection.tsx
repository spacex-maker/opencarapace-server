import { useEffect, useMemo, useState } from "react";
import {
  fetchAdminSocialMedia,
  createAdminSocialMedia,
  updateAdminSocialMedia,
  deleteAdminSocialMedia,
  type SocialMediaItem,
} from "../../api/client";
import {
  QrCode,
  Plus,
  Trash2,
  Pencil,
  Globe,
  MessageCircle,
  PlayCircle,
  Tv,
  Github,
  Linkedin,
  Twitter,
  ChevronDown,
  Check,
  X,
} from "lucide-react";
import { simpleIconCdnUrl } from "../../utils/socialIcon";

const SOCIAL_TEMPLATE_OPTIONS: Array<{
  label: string;
  iconKey: string;
  defaultName: string;
  defaultUrl: string;
}> = [
  { label: "微信", iconKey: "wechat", defaultName: "微信公众号", defaultUrl: "https://weixin.qq.com/" },
  { label: "企业微信", iconKey: "wecom", defaultName: "企业微信", defaultUrl: "https://work.weixin.qq.com/" },
  { label: "微博", iconKey: "weibo", defaultName: "微博", defaultUrl: "https://weibo.com/" },
  { label: "小红书", iconKey: "xiaohongshu", defaultName: "小红书", defaultUrl: "https://www.xiaohongshu.com/" },
  { label: "抖音", iconKey: "douyin", defaultName: "抖音", defaultUrl: "https://www.douyin.com/" },
  { label: "Bilibili", iconKey: "bilibili", defaultName: "Bilibili", defaultUrl: "https://space.bilibili.com/" },
  { label: "知乎", iconKey: "zhihu", defaultName: "知乎", defaultUrl: "https://www.zhihu.com/" },
  { label: "X / Twitter", iconKey: "x", defaultName: "X", defaultUrl: "https://x.com/" },
  { label: "GitHub", iconKey: "github", defaultName: "GitHub", defaultUrl: "https://github.com/" },
  { label: "Discord", iconKey: "discord", defaultName: "Discord", defaultUrl: "https://discord.com/" },
  { label: "YouTube", iconKey: "youtube", defaultName: "YouTube", defaultUrl: "https://www.youtube.com/" },
  { label: "LinkedIn", iconKey: "linkedin", defaultName: "LinkedIn", defaultUrl: "https://www.linkedin.com/" },
];

type SocialEditDraft = {
  id?: number;
  name: string;
  iconKey: string;
  url: string;
  enabled: boolean;
  showQrCode: boolean;
  sortOrder: number;
};

function makeEmptyDraft(): SocialEditDraft {
  return {
    name: "",
    iconKey: "wechat",
    url: "",
    enabled: true,
    showQrCode: true,
    sortOrder: 100,
  };
}

function socialIconForAdminPreview(iconKey: string) {
  const k = (iconKey || "").toLowerCase();
  if (k === "x" || k === "twitter") return Twitter;
  if (k === "github") return Github;
  if (k === "linkedin") return Linkedin;
  if (k === "wechat" || k === "weixin" || k === "wecom" || k === "weibo" || k === "xiaohongshu") return MessageCircle;
  if (k === "douyin" || k === "youtube") return PlayCircle;
  if (k === "bilibili") return Tv;
  if (k === "zhihu") return Globe;
  return Globe;
}

function SocialIconPreview({ iconKey }: { iconKey: string }) {
  const src = simpleIconCdnUrl(iconKey);
  const Icon = socialIconForAdminPreview(iconKey);
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <Icon className="w-4 h-4" />;
  return <img src={src} alt="" className="w-4 h-4" loading="lazy" onError={() => setFailed(true)} />;
}

const inputClass =
  "w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-slate-100 text-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50";

export function SocialMediaConfigSection() {
  const [error, setError] = useState("");
  const [socialLoading, setSocialLoading] = useState(true);
  const [socialSaving, setSocialSaving] = useState<number | "new" | null>(null);
  const [socialItems, setSocialItems] = useState<SocialMediaItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [modalDraft, setModalDraft] = useState<SocialEditDraft>(makeEmptyDraft());

  const editingId = modalDraft.id;
  const modalSaving = socialSaving === "new" || (editingId != null && socialSaving === editingId);
  const modalTitle = editingId != null ? "编辑社媒" : "新增社媒";

  const selectedTemplateLabel = useMemo(
    () => SOCIAL_TEMPLATE_OPTIONS.find((tpl) => tpl.iconKey === modalDraft.iconKey)?.label ?? "选择社媒模板",
    [modalDraft.iconKey],
  );

  const loadSocialMedia = () => {
    setSocialLoading(true);
    fetchAdminSocialMedia()
      .then((rows) => {
        const sorted = [...rows].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.id ?? 0) - (b.id ?? 0));
        setSocialItems(sorted);
      })
      .catch(() => setSocialItems([]))
      .finally(() => setSocialLoading(false));
  };

  useEffect(() => {
    loadSocialMedia();
  }, []);

  const openCreateModal = () => {
    setError("");
    setTemplateOpen(false);
    setModalDraft(makeEmptyDraft());
    setModalOpen(true);
  };

  const openEditModal = (item: SocialMediaItem) => {
    setError("");
    setTemplateOpen(false);
    setModalDraft({
      id: item.id,
      name: item.name ?? "",
      iconKey: (item.iconKey || "wechat").toLowerCase(),
      url: item.url ?? "",
      enabled: !!item.enabled,
      showQrCode: !!item.showQrCode,
      sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : 100,
    });
    setModalOpen(true);
  };

  const applyTemplateToModal = (iconKey: string) => {
    const tpl = SOCIAL_TEMPLATE_OPTIONS.find((t) => t.iconKey === iconKey);
    if (!tpl) return;
    setModalDraft((prev) => ({
      ...prev,
      iconKey: tpl.iconKey,
      name: tpl.defaultName,
      url: tpl.defaultUrl,
    }));
    setTemplateOpen(false);
  };

  const closeModal = () => {
    if (modalSaving) return;
    setModalOpen(false);
    setTemplateOpen(false);
    setModalDraft(makeEmptyDraft());
  };

  const saveModal = async () => {
    setError("");
    const payload = {
      name: modalDraft.name.trim(),
      iconKey: modalDraft.iconKey.trim().toLowerCase() || "custom",
      url: modalDraft.url.trim(),
      enabled: !!modalDraft.enabled,
      showQrCode: !!modalDraft.showQrCode,
      sortOrder: Number.isFinite(modalDraft.sortOrder) ? modalDraft.sortOrder : 100,
    };

    if (!payload.name || !payload.url) {
      setError("请先填写名称和 URL");
      return;
    }

    try {
      if (modalDraft.id != null) {
        setSocialSaving(modalDraft.id);
        await updateAdminSocialMedia(modalDraft.id, payload);
      } else {
        setSocialSaving("new");
        await createAdminSocialMedia(payload);
      }
      closeModal();
      await loadSocialMedia();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setError(msg || "保存社媒配置失败");
    } finally {
      setSocialSaving(null);
    }
  };

  const removeSocial = async (item: SocialMediaItem) => {
    if (item.id == null) return;
    if (!window.confirm(`确认删除「${item.name || item.iconKey || "该社媒"}」吗？`)) return;
    setSocialSaving(item.id);
    setError("");
    try {
      await deleteAdminSocialMedia(item.id);
      await loadSocialMedia();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setError(msg || "删除社媒配置失败");
    } finally {
      setSocialSaving(null);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <QrCode className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">社媒配置</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              列表展示社媒项，右侧操作按钮支持编辑与删除，编辑通过弹窗完成。
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          新增社媒
        </button>
      </div>

      {socialLoading ? (
        <div className="text-sm text-slate-500 dark:text-slate-400 py-4">加载中…</div>
      ) : socialItems.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 py-4">暂无社媒配置，点击右上角「新增社媒」。</p>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-left">
                <th className="px-4 py-3 font-medium">平台</th>
                <th className="px-4 py-3 font-medium">URL</th>
                <th className="px-4 py-3 font-medium">排序</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">二维码</th>
                <th className="px-4 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {socialItems.map((item) => {
                const saving = socialSaving === item.id;
                return (
                  <tr key={item.id} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                          <SocialIconPreview iconKey={item.iconKey || ""} />
                        </span>
                        <span className="text-slate-800 dark:text-slate-200">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-[360px] truncate" title={item.url}>
                      {item.url}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{item.sortOrder ?? 100}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs border ${
                          item.enabled
                            ? "border-emerald-400/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
                            : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {item.enabled ? "已启用" : "已停用"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs border ${
                          item.showQrCode
                            ? "border-cyan-400/40 text-cyan-700 dark:text-cyan-300 bg-cyan-500/10"
                            : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {item.showQrCode ? "已开启" : "已关闭"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSocial(item)}
                          disabled={saving}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-300 text-red-600 dark:text-red-300 text-xs hover:bg-red-500/10 disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-sm px-4 py-3 mt-4">
          {error}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4" onClick={closeModal}>
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-semibold text-slate-900 dark:text-white">{modalTitle}</h4>
              <button
                type="button"
                onClick={closeModal}
                className="p-1.5 rounded-md border border-slate-300 dark:border-slate-600 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">平台模板</label>
                <div
                  className="relative"
                  tabIndex={-1}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                      setTemplateOpen(false);
                    }
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setTemplateOpen((v) => !v)}
                    className="w-full inline-flex items-center justify-between gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <span className="inline-flex items-center gap-2 truncate">
                      <SocialIconPreview iconKey={modalDraft.iconKey} />
                      {selectedTemplateLabel}
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${templateOpen ? "rotate-180" : ""}`} />
                  </button>
                  {templateOpen && (
                    <div className="absolute z-30 mt-2 w-full max-h-72 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-1.5 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.65)_transparent] dark:[scrollbar-color:rgba(71,85,105,0.8)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/80 dark:[&::-webkit-scrollbar-thumb]:bg-slate-600/75">
                      {SOCIAL_TEMPLATE_OPTIONS.map((tpl) => {
                        const selected = modalDraft.iconKey === tpl.iconKey;
                        return (
                          <button
                            key={tpl.iconKey}
                            type="button"
                            onClick={() => applyTemplateToModal(tpl.iconKey)}
                            className={`w-full text-left rounded-lg px-2.5 py-2 transition-colors ${
                              selected
                                ? "bg-brand-500/10 text-brand-700 dark:text-brand-300"
                                : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            }`}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="min-w-0 inline-flex items-center gap-2">
                                <SocialIconPreview iconKey={tpl.iconKey} />
                                <span className="truncate">{tpl.label}</span>
                              </span>
                              {selected && <Check className="h-4 w-4 shrink-0" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">名称</label>
                  <input
                    className={inputClass}
                    value={modalDraft.name}
                    onChange={(e) => setModalDraft((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="显示名称"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">排序</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={modalDraft.sortOrder}
                    onChange={(e) => setModalDraft((prev) => ({ ...prev, sortOrder: Number(e.target.value || "0") }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-1">URL（用于跳转与二维码）</label>
                <input
                  className={inputClass}
                  value={modalDraft.url}
                  onChange={(e) => setModalDraft((prev) => ({ ...prev, url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                  <span className="text-sm text-slate-700 dark:text-slate-300">已启用</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={modalDraft.enabled}
                    onClick={() => setModalDraft((prev) => ({ ...prev, enabled: !prev.enabled }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
                      modalDraft.enabled ? "bg-brand-500 border-brand-500" : "bg-slate-200 dark:bg-slate-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        modalDraft.enabled ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                  <span className="text-sm text-slate-700 dark:text-slate-300">生成二维码</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={modalDraft.showQrCode}
                    onClick={() => setModalDraft((prev) => ({ ...prev, showQrCode: !prev.showQrCode }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
                      modalDraft.showQrCode ? "bg-brand-500 border-brand-500" : "bg-slate-200 dark:bg-slate-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        modalDraft.showQrCode ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveModal}
                disabled={modalSaving}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {modalSaving ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
