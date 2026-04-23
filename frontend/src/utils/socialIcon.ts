export function normalizeSocialIconKey(iconKey: string | null | undefined): string {
  return String(iconKey || "").trim().toLowerCase();
}

/** 将业务 iconKey 映射到 simple-icons slug；未命中时尝试直接使用 iconKey 作为 slug。 */
export function toSimpleIconSlug(iconKey: string | null | undefined): string | null {
  const k = normalizeSocialIconKey(iconKey);
  if (!k) return null;
  const alias: Record<string, string> = {
    // 国内
    wechat: "wechat",
    weixin: "wechat",
    wecom: "wechat",
    wechatwork: "wechat",
    weibo: "sinaweibo",
    xiaohongshu: "xiaohongshu",
    rednote: "xiaohongshu",
    douyin: "tiktok", // simple-icons 无 douyin，使用 tiktok
    zhihu: "zhihu",
    bilibili: "bilibili",
    kuaishou: "kuaishou",
    // 国际
    x: "x",
    twitter: "x",
    github: "github",
    linkedin: "linkedin",
    youtube: "youtube",
    telegram: "telegram",
    discord: "discord",
    facebook: "facebook",
    instagram: "instagram",
    tiktok: "tiktok",
    reddit: "reddit",
  };
  return alias[k] || k;
}

export function simpleIconCdnUrl(iconKey: string | null | undefined): string | null {
  const slug = toSimpleIconSlug(iconKey);
  if (!slug) return null;
  return `https://cdn.simpleicons.org/${encodeURIComponent(slug)}`;
}
