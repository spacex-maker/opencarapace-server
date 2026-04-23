import { useState } from "react";
import { Github, Globe, Linkedin, MessageCircle, PlayCircle, Send, Tv, Twitter } from "lucide-react";
import type { SocialMediaItem } from "../api/client";
import { simpleIconCdnUrl } from "../utils/socialIcon";

function qrUrl(rawUrl: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=${encodeURIComponent(rawUrl)}`;
}

function iconFor(key: string) {
  const k = key.toLowerCase();
  if (k === "x" || k === "twitter") return Twitter;
  if (k === "github") return Github;
  if (k === "linkedin") return Linkedin;
  if (k === "wechat" || k === "weixin") return MessageCircle;
  if (k === "xiaohongshu") return MessageCircle;
  if (k === "douyin") return PlayCircle;
  if (k === "zhihu") return Globe;
  if (k === "telegram") return Send;
  if (k === "youtube") return PlayCircle;
  if (k === "bilibili") return Tv;
  if (k === "weibo") return MessageCircle;
  return Globe;
}

function SocialIcon({
  iconKey,
  className,
}: {
  iconKey: string;
  className?: string;
}) {
  const src = simpleIconCdnUrl(iconKey);
  const Fallback = iconFor(iconKey);
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <Fallback className={className} />;
  return (
    <img
      src={src}
      alt=""
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

type Props = {
  title?: string;
  subtitle?: string;
  items: SocialMediaItem[];
};

export function SocialMediaModule({
  title = "社媒与社区",
  subtitle = "关注官方渠道，获取发布、更新与活动信息。",
  items,
}: Props) {
  if (!items || items.length === 0) return null;
  return (
    <section className="relative overflow-hidden">
      <div className="relative py-2">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
          <div className="lg:col-span-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-400">Social Channels</p>
            <h3 className="mt-2 text-xl md:text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{subtitle}</p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/70 dark:bg-slate-900/60 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              已接入 {items.length} 个官方渠道
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map((it) => (
                <a
                  key={it.id}
                  href={it.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-2xl bg-white/70 dark:bg-slate-950/45 p-4 hover:-translate-y-0.5 hover:shadow-md transition-all"
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100/80 dark:bg-slate-900/80">
                      <SocialIcon iconKey={it.iconKey || ""} className="w-5 h-5" />
                    </span>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{it.name}</div>
                  </div>

                  {it.showQrCode ? (
                    <div className="mt-4 flex items-center justify-between rounded-xl px-2.5 py-2 bg-slate-50/70 dark:bg-slate-900/55">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">扫码直达</span>
                      <img
                        src={qrUrl(it.url)}
                        alt={`${it.name} 二维码`}
                        className="h-16 w-16 rounded-lg bg-white p-1"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="mt-4 text-[11px] text-slate-500 dark:text-slate-500">该渠道未开启二维码</div>
                  )}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
