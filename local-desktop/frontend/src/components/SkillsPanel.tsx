import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";

type MarketTab = "featured" | "safe" | "hot" | "new";

type SkillRow = {
  id: number | null;
  slug: string;
  name: string | null;
  type: string | null;
  category: string | null;
  systemStatus: string;
  shortDesc: string | null;
  updatedAt: string | null;
  userEnabled: number | null;
  sourceName: string | null;
  safeMarkCount: number;
  unsafeMarkCount: number;
  userSafetyLabel: "SAFE" | "UNSAFE" | null;
  marketFeatured: boolean;
  marketSafeRecommended: boolean;
  hotScore: number;
  downloadCount: number;
  favoriteCount: number;
  starRating: number | null;
  publisherVerified: boolean;
  securityGrade: string | null;
  publishedAt: string | null;
};

function applyMarketTab(items: SkillRow[], tab: MarketTab): SkillRow[] {
  const copy = [...items];
  switch (tab) {
    case "featured": {
      const f = copy.filter((s) => s.marketFeatured);
      return f.length ? f : copy.filter((s) => s.systemStatus === "NORMAL");
    }
    case "safe":
      return copy.filter(
        (s) =>
          s.marketSafeRecommended ||
          s.securityGrade === "A" ||
          s.securityGrade === "B" ||
          ((!s.securityGrade || s.securityGrade === "") &&
            s.safeMarkCount >= s.unsafeMarkCount &&
            s.systemStatus === "NORMAL"),
      );
    case "hot":
      return copy.sort((a, b) => {
        const ha =
          a.hotScore + a.downloadCount * 0.01 + a.favoriteCount * 0.015 + (a.starRating ?? 0);
        const hb =
          b.hotScore + b.downloadCount * 0.01 + b.favoriteCount * 0.015 + (b.starRating ?? 0);
        if (hb !== ha) return hb - ha;
        return (b.downloadCount || 0) - (a.downloadCount || 0);
      });
    case "new":
      return copy.sort((a, b) => {
        const ta = Date.parse(a.publishedAt || a.updatedAt || "") || 0;
        const tb = Date.parse(b.publishedAt || b.updatedAt || "") || 0;
        return tb - ta;
      });
    default:
      return copy;
  }
}

function formatMarketCount(n: number): string {
  const x = Math.max(0, Math.floor(Number(n) || 0));
  if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(1)}M`;
  if (x >= 1_000) return `${(x / 1_000).toFixed(1)}K`;
  return String(x);
}

function FilterSelect(props: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  placeholder: string;
}) {
  const controlHeight = 36;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as any)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const current = props.options.find((o) => o.value === props.value)?.label || props.placeholder;

  return (
    <div ref={ref} style={{ position: "relative", minWidth: 160 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          height: controlHeight,
          padding: "0 12px",
          borderRadius: 999,
          border: "1px solid var(--panel-border)",
          background: "var(--panel-bg)",
          color: props.value ? "var(--fg)" : "var(--muted2)",
          fontSize: 12,
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          boxSizing: "border-box",
        }}
      >
        <span style={{ lineHeight: 1 }}>{current}</span>
        <span style={{ color: "var(--muted2)", lineHeight: 1 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 10,
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            maxHeight: 220,
            overflowY: "auto",
            borderRadius: 10,
            border: "1px solid var(--panel-border)",
            background: "var(--panel-bg)",
            boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
          }}
        >
          {props.options.map((o) => (
            <button
              key={o.value || "__all"}
              type="button"
              onClick={() => {
                props.onChange(o.value);
                setOpen(false);
              }}
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "none",
                background: o.value === props.value ? "rgba(34,197,94,0.12)" : "transparent",
                color: o.value === props.value ? "#bbf7d0" : "var(--fg)",
                fontSize: 11,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SkillsPanel({ showAccountSwitchPlaceholder = false }: { showAccountSwitchPlaceholder?: boolean }) {
  const { t } = useI18n();
  const smp = (key: string) => t(`skillsMarketPage.${key}`);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [marketTab, setMarketTab] = useState<MarketTab>("featured");
  const [marketPage, setMarketPage] = useState(1);
  const marketPageSize = 50;
  const [sync, setSync] = useState<{ running: boolean; total: number; synced: number }>({
    running: false,
    total: 0,
    synced: 0,
  });
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [installModal, setInstallModal] = useState<{ open: boolean; skill: SkillRow | null }>({ open: false, skill: null });

  const [keyword, setKeyword] = useState("");
  const [systemStatus, setSystemStatus] = useState("");
  /** UI 语义：是否启用拦截（1=拦截，0=不拦截）；后端仍沿用 userEnabled 参数 */
  const [interceptEnabled, setInterceptEnabled] = useState("");
  const [updatingSlug, setUpdatingSlug] = useState<string | null>(null);
  const [batchUpdating, setBatchUpdating] = useState(false);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef<"table" | "bottom" | null>(null);
  const [tableScrollSize, setTableScrollSize] = useState({ scrollWidth: 0, clientWidth: 0 });

  const displaySkills = useMemo(() => applyMarketTab(skills, marketTab), [skills, marketTab]);
  const showFeaturedFallbackHint =
    marketTab === "featured" && skills.length > 0 && !skills.some((s) => s.marketFeatured);

  useEffect(() => {
    setMarketPage(1);
  }, [marketTab, keyword, systemStatus, interceptEnabled]);

  const marketTotalPages = useMemo(
    () => Math.max(1, Math.ceil(displaySkills.length / marketPageSize)),
    [displaySkills.length]
  );

  const marketPageSafe = Math.min(Math.max(1, marketPage), marketTotalPages);
  const pagedSkills = useMemo(() => {
    const start = (marketPageSafe - 1) * marketPageSize;
    return displaySkills.slice(start, start + marketPageSize);
  }, [displaySkills, marketPageSafe]);
  const isRowBatchActionable = (s: SkillRow) => s.systemStatus === "NORMAL" && s.userEnabled !== null;
  const pageActionableSlugs = useMemo(
    () => pagedSkills.filter(isRowBatchActionable).map((s) => s.slug),
    [pagedSkills]
  );
  const selectedActionableSlugs = selectedSlugs.filter((slug) => pageActionableSlugs.includes(slug));
  const allPageSelected = pageActionableSlugs.length > 0 && selectedActionableSlugs.length === pageActionableSlugs.length;

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const syncMetrics = () => {
      setTableScrollSize({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
    };
    syncMetrics();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(syncMetrics);
      ro.observe(el);
      if (el.firstElementChild) ro.observe(el.firstElementChild as Element);
    }
    window.addEventListener("resize", syncMetrics);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", syncMetrics);
    };
  }, [pagedSkills.length, loading]);

  const onTableScroll = () => {
    const table = tableScrollRef.current;
    const bottom = bottomScrollRef.current;
    if (!table || !bottom) return;
    if (syncingScrollRef.current === "bottom") return;
    syncingScrollRef.current = "table";
    bottom.scrollLeft = table.scrollLeft;
    syncingScrollRef.current = null;
  };

  const onBottomScroll = () => {
    const table = tableScrollRef.current;
    const bottom = bottomScrollRef.current;
    if (!table || !bottom) return;
    if (syncingScrollRef.current === "table") return;
    syncingScrollRef.current = "bottom";
    table.scrollLeft = bottom.scrollLeft;
    syncingScrollRef.current = null;
  };

  const toggleSelectAllPageActionable = () => {
    setSelectedSlugs((prev) => {
      if (allPageSelected) return prev.filter((slug) => !pageActionableSlugs.includes(slug));
      return Array.from(new Set([...prev, ...pageActionableSlugs]));
    });
  };

  const toggleSelectRow = (slug: string) => {
    setSelectedSlugs((prev) => (prev.includes(slug) ? prev.filter((x) => x !== slug) : [...prev, slug]));
  };

  const loadData = async (withFilters = false) => {
    try {
      setLoading(true);
      setError(null);
      const qs = new URLSearchParams();
      if (withFilters) {
        if (keyword.trim()) qs.set("keyword", keyword.trim());
        if (systemStatus) qs.set("systemStatus", systemStatus);
        if (interceptEnabled) {
          // 兼容后端旧语义：userEnabled=1 表示不拦截；interceptEnabled=1 表示拦截
          qs.set("userEnabled", interceptEnabled === "1" ? "0" : "1");
        }
      }
      const url = `http://127.0.0.1:19111/api/skills${qs.toString() ? `?${qs.toString()}` : ""}`;
      const [skillsRes, syncRes] = await Promise.all([
        fetch(url),
        fetch("http://127.0.0.1:19111/api/sync-status?type=skills"),
      ]);
      const skillsData = await skillsRes.json();
      const syncJson = await syncRes.json();
      const raw = skillsData.items || [];
      setSkills(
        raw.map((it: any) => ({
          id: it.id ?? null,
          slug: String(it.slug || ""),
          name: it.name ?? null,
          type: it.type ?? null,
          category: it.category ?? null,
          systemStatus: it.systemStatus || "NORMAL",
          shortDesc: it.shortDesc ?? null,
          updatedAt: it.updatedAt ?? null,
          userEnabled: it.userEnabled ?? null,
          sourceName: it.sourceName ?? null,
          safeMarkCount: Number(it.safeMarkCount || 0),
          unsafeMarkCount: Number(it.unsafeMarkCount || 0),
          userSafetyLabel: it.userSafetyLabel ?? null,
          marketFeatured: !!it.marketFeatured,
          marketSafeRecommended: !!it.marketSafeRecommended,
          hotScore: Number(it.hotScore || 0),
          downloadCount: Number(it.downloadCount || 0),
          favoriteCount: Number(it.favoriteCount || 0),
          starRating: it.starRating != null ? Number(it.starRating) : null,
          publisherVerified: !!it.publisherVerified,
          securityGrade: it.securityGrade ?? null,
          publishedAt: it.publishedAt ?? null,
        })),
      );
      setSync(syncJson || { running: false, total: 0, synced: 0 });
    } catch (e: any) {
      setError(e?.message ?? smp("errLoadLocal"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  useEffect(() => {
    setSelectedSlugs((prev) => prev.filter((slug) => skills.some((s) => s.slug === slug)));
  }, [skills]);

  useEffect(() => {
    if (!sync.running) return;
    
    let pollCount = 0;
    const maxPolls = 60; // 最多轮询 60 次（2 分钟）
    
    const timer = setInterval(async () => {
      pollCount++;
      
      // 超时保护：避免无限轮询
      if (pollCount > maxPolls) {
        clearInterval(timer);
        setSync((s) => ({ ...s, running: false }));
        console.warn("[SkillsPanel] 同步轮询超时，已停止");
        return;
      }
      
      try {
        const res = await fetch("http://127.0.0.1:19111/api/sync-status?type=skills");
        const json = await res.json();
        setSync(json);
        if (!json.running) {
          clearInterval(timer);
          loadData();
        }
      } catch {
        // ignore
      }
    }, 2000); // 改为 2 秒轮询一次
    
    return () => clearInterval(timer);
  }, [sync.running]);

  const triggerSync = async () => {
    try {
      setError(null);
      await fetch("http://127.0.0.1:19111/api/skills/sync", { method: "POST" });
      setSync((s) => ({ ...s, running: true }));
    } catch (e: any) {
      setError(e?.message ?? smp("errTriggerSync"));
    }
  };

  const percent =
    sync.total > 0 ? Math.min(100, Math.round((sync.synced / sync.total) * 100)) : sync.running ? 0 : 100;

  const runQuery = () => loadData(true);

  const toggleUserEnabled = async (slug: string, currentEnabled: number | null) => {
    if (updatingSlug !== null || batchUpdating) return;

    const currentlyIntercepting = currentEnabled === 0;
    const nextIntercepting = !currentlyIntercepting;
    // 后端字段 enabled=true 表示技能启用（不拦截）
    const nextEnabled = !nextIntercepting;
    setUpdatingSlug(slug);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`http://127.0.0.1:19111/api/user-skills/${encodeURIComponent(slug)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data?.error?.message || smp("errUpdateUser"));
        setTimeout(() => setError(null), 3000);
        return;
      }
      setSkills((prev) =>
        prev.map((s) => (s.slug === slug ? { ...s, userEnabled: nextEnabled ? 1 : 0 } : s))
      );
      setMessage(nextIntercepting ? smp("toastSkillOff") : smp("toastSkillOn"));
      setTimeout(() => setMessage(null), 2000);
    } catch (e: any) {
      setError(e?.message ?? smp("errUpdateUser"));
      setTimeout(() => setError(null), 3000);
    } finally {
      setUpdatingSlug(null);
    }
  };

  const batchSetIntercept = async (intercept: boolean) => {
    const targetSlugs = selectedActionableSlugs;
    if (targetSlugs.length === 0 || updatingSlug !== null || batchUpdating) return;
    setBatchUpdating(true);
    setError(null);
    setMessage(null);
    const enabled = !intercept; // 旧协议：enabled=true 表示不拦截
    try {
      const res = await fetch("http://127.0.0.1:19111/api/user-skills-batch", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: targetSlugs, enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error?.message || "批量更新失败");
        return;
      }
      setSkills((prev) =>
        prev.map((s) => (targetSlugs.includes(s.slug) ? { ...s, userEnabled: enabled ? 1 : 0 } : s))
      );
      setSelectedSlugs((prev) => prev.filter((slug) => !targetSlugs.includes(slug)));
      const n = Number(data?.updatedCount) > 0 ? Number(data.updatedCount) : targetSlugs.length;
      setMessage(intercept ? `已批量启用拦截（${n} 条）` : `已批量取消拦截（${n} 条）`);
      setTimeout(() => setMessage(null), 2200);
    } catch (e: any) {
      setError(e?.message ?? smp("errUpdateUser"));
    } finally {
      setBatchUpdating(false);
    }
  };

  const setSafetyLabel = async (slug: string, label: "SAFE" | "UNSAFE") => {
    setError(null);
    setMessage(null);
    try {
      const target = skills.find((s) => s.slug === slug);
      if (!target) return;
      if (target.userSafetyLabel === label) return;
      const prev = target.userSafetyLabel;
      setSkills((prevSkills) =>
        prevSkills.map((s) =>
          s.slug === slug
            ? {
                ...s,
                userSafetyLabel: label,
                safeMarkCount: Math.max(0, s.safeMarkCount + (label === "SAFE" ? 1 : 0) - (prev === "SAFE" ? 1 : 0)),
                unsafeMarkCount: Math.max(0, s.unsafeMarkCount + (label === "UNSAFE" ? 1 : 0) - (prev === "UNSAFE" ? 1 : 0)),
              }
            : s,
        ),
      );
      const res = await fetch(`http://127.0.0.1:19111/api/user-skills/${encodeURIComponent(slug)}/safety-label`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) {
        setSkills((prevSkills) =>
          prevSkills.map((s) =>
            s.slug === slug
              ? {
                  ...s,
                  userSafetyLabel: prev,
                  safeMarkCount: Math.max(0, s.safeMarkCount + (prev === "SAFE" ? 1 : 0) - (label === "SAFE" ? 1 : 0)),
                  unsafeMarkCount: Math.max(0, s.unsafeMarkCount + (prev === "UNSAFE" ? 1 : 0) - (label === "UNSAFE" ? 1 : 0)),
                }
              : s,
          ),
        );
        const data = await res.json().catch(() => ({}));
        setError(data?.error?.message || smp("errSafetyLabel"));
        return;
      }
      setMessage(label === "SAFE" ? smp("toastMarkedSafe") : smp("toastMarkedUnsafe"));
      setTimeout(() => setMessage(null), 2000);
    } catch (e: any) {
      setError(e?.message ?? smp("errSafetyLabel"));
    }
  };

  const openDetail = async (slug: string) => {
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      // 详情直连云端：使用用户配置的 apiBase + 本地保存的 token
      const statusRes = await fetch("http://127.0.0.1:19111/api/status");
      const statusJson = await statusRes.json().catch(() => ({}));
      const apiBaseRaw = statusJson?.settings?.apiBase || "https://api.clawheart.live";
      const apiBase = String(apiBaseRaw).replace(/\/+$/, "");
      const token = statusJson?.auth?.token ? String(statusJson.auth.token) : null;

      if (!token) {
        setDetailError(smp("detailNeedLogin"));
        return;
      }

      // 先用 slug 在云端搜索到 skill id（云端详情接口按 id 查询）
      const search = new URLSearchParams();
      search.set("page", "0");
      search.set("size", "1");
      search.set("keyword", slug);
      const searchRes = await fetch(`${apiBase}/api/skills?${search.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const searchData = await searchRes.json().catch(() => ({}));
      if (!searchRes.ok) {
        setDetailError(searchData?.error?.message || searchData?.message || smp("detailCloudSearchFailed"));
        return;
      }
      const hit = Array.isArray(searchData?.content) ? searchData.content[0] : null;
      const id = hit?.id;
      if (!id) {
        setDetailError(smp("detailNotFound"));
        return;
      }

      const res = await fetch(`${apiBase}/api/skills/${encodeURIComponent(String(id))}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDetailError(data?.error?.message || data?.message || smp("detailLoadFailed"));
        return;
      }
      setDetail(data);
    } catch (e: any) {
      setDetailError(e?.message ?? smp("detailLoadFailed"));
    } finally {
      setDetailLoading(false);
    }
  };

  const clearLocal = async () => {
    try {
      setError(null);
      setDetail(null);
      setDetailError(null);
      await fetch("http://127.0.0.1:19111/api/skills/clear", { method: "POST" });
      await loadData();
    } catch (e: any) {
      setError(e?.message ?? smp("errClearLocal"));
    }
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 1280,
        margin: "0 auto",
        padding: "clamp(12px, 2vw, 24px)",
        fontSize: 12,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: 20, margin: "0 0 4px", color: "var(--fg)" }}>{smp("title")}</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>{smp("intro")}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={triggerSync}
            disabled={sync.running}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "none",
              background: "#22c55e",
              color: "#022c22",
              fontSize: 12,
              fontWeight: 600,
              cursor: sync.running ? "not-allowed" : "pointer",
              opacity: sync.running ? 0.7 : 1,
            }}
          >
            {sync.running ? smp("syncRunning") : smp("syncManual")}
          </button>
          <button
            type="button"
            onClick={clearLocal}
            disabled={sync.running}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid var(--btn-border)",
              background: "var(--panel-bg)",
              color: "var(--fg)",
              fontSize: 12,
              fontWeight: 500,
              cursor: sync.running ? "not-allowed" : "pointer",
              opacity: sync.running ? 0.7 : 1,
            }}
          >
            {smp("clearLocal")}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {(
          [
            { id: "featured" as const, label: smp("tabs.featured") },
            { id: "safe" as const, label: smp("tabs.safe") },
            { id: "hot" as const, label: smp("tabs.hot") },
            { id: "new" as const, label: smp("tabs.new") },
          ] as const
        ).map((tab) => {
          const active = marketTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMarketTab(tab.id)}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                border: active ? "1px solid rgba(59,130,246,0.5)" : "1px solid var(--panel-border)",
                background: active ? "rgba(59,130,246,0.12)" : "var(--panel-bg2)",
                color: active ? "#93c5fd" : "var(--muted)",
                fontSize: 13,
                fontWeight: active ? 700 : 600,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {showFeaturedFallbackHint && (
        <div
          style={{
            marginBottom: 10,
            padding: "8px 12px",
            borderRadius: 10,
            background: "rgba(59,130,246,0.08)",
            border: "1px solid rgba(59,130,246,0.25)",
            color: "#93c5fd",
            fontSize: 11,
            lineHeight: 1.5,
          }}
        >
          {smp("featuredFallbackHint")}
        </div>
      )}

      <div style={{ margin: "6px 0 14px" }}>
        <div
          style={{
            height: 6,
            borderRadius: 999,
            background: "var(--panel-bg)",
            border: "1px solid var(--panel-border)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${percent}%`,
              background: "#22c55e",
              transition: "width 0.3s ease-out",
            }}
          />
        </div>
        <div style={{ marginTop: 4, fontSize: 11, color: "var(--muted2)" }}>
          {sync.running
            ? smp("syncProgressRunning")
                .replace("{synced}", String(sync.synced))
                .replace("{total}", String(sync.total || "?"))
            : smp("syncProgressDone")
                .replace("{synced}", String(sync.synced))
                .replace("{total}", String(sync.total || skills.length))}
        </div>
      </div>

      {loading && (
        <div style={{ color: "var(--muted)", marginBottom: 8 }}>{smp("loading")}</div>
      )}
      {error && (
        <div
          style={{
            marginBottom: 8,
            padding: "8px 12px",
            borderRadius: 10,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#fca5a5",
            fontSize: 11,
          }}
        >
          {error}
        </div>
      )}
      {message && (
        <div
          style={{
            marginBottom: 8,
            padding: "8px 12px",
            borderRadius: 10,
            background: "rgba(34,197,94,0.1)",
            border: "1px solid rgba(34,197,94,0.3)",
            color: "#bbf7d0",
            fontSize: 11,
          }}
        >
          {message}
        </div>
      )}

      {showAccountSwitchPlaceholder && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(59,130,246,0.12)",
            border: "1px solid rgba(59,130,246,0.3)",
            color: "#bfdbfe",
            fontSize: 12,
          }}
        >
          {smp("accountSwitching")}
        </div>
      )}

      {/* 高级查询 */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          marginBottom: 14,
          padding: "12px",
          borderRadius: 12,
          background: "var(--panel-bg2)",
          border: "1px solid var(--panel-border)",
          boxShadow: "inset 0 1px 0 rgba(148,163,184,0.08), 0 8px 24px rgba(0,0,0,0.12)",
        }}
      >
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runQuery();
            }
          }}
          placeholder={smp("keywordPh")}
          style={{
            flex: "1 1 260px",
            minWidth: 280,
            height: 36,
            background: "var(--panel-bg)",
            borderRadius: 999,
            border: "1px solid var(--panel-border)",
            padding: "0 14px",
            fontSize: 12,
            fontWeight: 500,
            color: "var(--fg)",
            outline: "none",
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.14)",
          }}
        />

        <FilterSelect
          value={systemStatus}
          onChange={setSystemStatus}
          placeholder={smp("filterSystemAll")}
          options={[
            { label: smp("filterSystemAll"), value: "" },
            { label: smp("sysNormal"), value: "NORMAL" },
            { label: smp("sysDisabled"), value: "DISABLED" },
            { label: smp("sysDeprecated"), value: "DEPRECATED" },
          ]}
        />
        <FilterSelect
          value={interceptEnabled}
          onChange={setInterceptEnabled}
          placeholder="全部拦截状态"
          options={[
            { label: "全部拦截状态", value: "" },
            { label: "已启用拦截", value: "1" },
            { label: "未启用拦截", value: "0" },
          ]}
        />

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void batchSetIntercept(true)}
            disabled={batchUpdating || updatingSlug !== null || selectedActionableSlugs.length === 0}
            style={{
              height: 36,
              padding: "0 14px",
              borderRadius: 999,
              border: "1px solid rgba(239,68,68,0.45)",
              background: "rgba(239,68,68,0.10)",
              color: "var(--claw-danger-fg)",
              fontSize: 12,
              fontWeight: 700,
              cursor: batchUpdating || updatingSlug !== null || selectedActionableSlugs.length === 0 ? "not-allowed" : "pointer",
              opacity: batchUpdating || updatingSlug !== null || selectedActionableSlugs.length === 0 ? 0.55 : 1,
            }}
          >
            {batchUpdating ? "批量处理中…" : `批量启用拦截 (${selectedActionableSlugs.length})`}
          </button>
          <button
            type="button"
            onClick={() => void batchSetIntercept(false)}
            disabled={batchUpdating || updatingSlug !== null || selectedActionableSlugs.length === 0}
            style={{
              height: 36,
              padding: "0 14px",
              borderRadius: 999,
              border: "1px solid rgba(34,197,94,0.50)",
              background: "rgba(34,197,94,0.12)",
              color: "var(--claw-green-fg)",
              fontSize: 12,
              fontWeight: 700,
              cursor: batchUpdating || updatingSlug !== null || selectedActionableSlugs.length === 0 ? "not-allowed" : "pointer",
              opacity: batchUpdating || updatingSlug !== null || selectedActionableSlugs.length === 0 ? 0.55 : 1,
            }}
          >
            {batchUpdating ? "批量处理中…" : `批量取消拦截 (${selectedActionableSlugs.length})`}
          </button>
          <button
            type="button"
            onClick={runQuery}
            disabled={loading}
            style={{
              height: 36,
              padding: "0 16px",
              borderRadius: 999,
              border: "1px solid var(--btn-border)",
              background: loading ? "var(--panel-bg2)" : "linear-gradient(135deg, #2563eb, #1d4ed8)",
              color: "#f8fafc",
              fontSize: 12,
              fontWeight: 700,
              boxSizing: "border-box",
              cursor: loading ? "not-allowed" : "pointer",
              letterSpacing: "0.01em",
              boxShadow: loading ? "none" : "0 8px 18px rgba(37,99,235,0.35)",
              transition: "all 0.2s ease",
            }}
          >
            {loading ? smp("queryRunning") : smp("query")}
          </button>
        </div>
      </div>

      <div
        style={{
          borderRadius: 10,
          border: "1px solid var(--panel-border)",
          overflow: "hidden",
        }}
      >
        {/* clip 包装器：截断原生横向滚动条，仅保留底部自定义滚动条 */}
        <div style={{ overflow: "hidden", height: "calc(100vh - 290px)", minHeight: 320 }}>
        <div
          className="skills-table-scroll"
          ref={tableScrollRef}
          onScroll={onTableScroll}
          style={{
            height: "calc(100vh - 270px)", /* 比 clip 容器高 20px，原生横向滚动条落在被裁区域 */
            minHeight: 340,
            overflowY: "auto",
            overflowX: "auto",
            scrollbarWidth: "thin",
            scrollbarColor: "var(--muted2) var(--panel-bg)",
          }}
        >
        <table style={{ width: "100%", minWidth: 1320, borderCollapse: "separate", borderSpacing: 0 }}>
          <thead style={{ background: "var(--panel-solid)", position: "sticky", top: 0, zIndex: 10 }}>
            <tr>
              <th
                style={{
                  padding: "6px 8px",
                  borderBottom: "1px solid var(--panel-border)",
                  textAlign: "center",
                  width: 34,
                  position: "sticky",
                  top: 0,
                  left: 0,
                  zIndex: 7,
                  background: "var(--panel-solid)",
                  boxShadow: "1px 0 0 var(--panel-border), 10px 0 18px rgba(0,0,0,0.16)",
                }}
              >
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={toggleSelectAllPageActionable}
                  title="全选当前页可批量项"
                  style={{ cursor: "pointer" }}
                />
              </th>
              <th
                style={{
                  padding: "6px 8px",
                  borderBottom: "1px solid var(--panel-border)",
                  textAlign: "left",
                  color: "var(--muted)",
                  position: "sticky",
                  top: 0,
                  zIndex: 4,
                  background: "var(--panel-solid)",
                }}
              >
                {smp("colName")}
              </th>
              <th
                style={{
                  padding: "6px 8px",
                  borderBottom: "1px solid var(--panel-border)",
                  textAlign: "left",
                  color: "var(--muted)",
                  position: "sticky",
                  top: 0,
                  zIndex: 4,
                  background: "var(--panel-solid)",
                }}
              >
                {smp("colProvider")}
              </th>
              <th
                style={{
                  padding: "6px 8px",
                  borderBottom: "1px solid var(--panel-border)",
                  textAlign: "center",
                  width: 72,
                  color: "var(--muted)",
                  position: "sticky",
                  top: 0,
                  zIndex: 4,
                  background: "var(--panel-solid)",
                }}
              >
                {smp("colGrade")}
              </th>
              <th
                style={{
                  padding: "6px 8px",
                  borderBottom: "1px solid var(--panel-border)",
                  textAlign: "left",
                  color: "var(--muted)",
                  position: "sticky",
                  top: 0,
                  zIndex: 4,
                  background: "var(--panel-solid)",
                }}
              >
                {smp("colStatus")}
              </th>
              <th
                style={{
                  padding: "6px 8px",
                  borderBottom: "1px solid var(--panel-border)",
                  textAlign: "left",
                  color: "var(--muted)",
                  position: "sticky",
                  top: 0,
                  zIndex: 3,
                  background: "var(--panel-solid)",
                }}
              >
                {smp("colDesc")}
              </th>
              <th
                style={{
                  padding: "6px 8px",
                  borderBottom: "1px solid var(--panel-border)",
                  textAlign: "center",
                  width: 200,
                  minWidth: 200,
                  boxSizing: "border-box",
                  position: "sticky",
                  top: 0,
                  right: 0,
                  zIndex: 6,
                  background: "var(--panel-solid)",
                  boxShadow: "-1px 0 0 var(--panel-border), -10px 0 18px rgba(0,0,0,0.16)",
                  color: "var(--muted)",
                }}
              >
                拦截
              </th>
            </tr>
          </thead>
          <tbody>
            {pagedSkills.map((s) => (
              <tr key={s.slug} style={{ background: "var(--panel-bg)" }}>
                <td style={{
                  padding: "6px 8px",
                  borderBottom: "1px solid var(--panel-border)",
                  textAlign: "center",
                  position: "sticky",
                  left: 0,
                  zIndex: 2,
                  background: "var(--panel-solid)",
                  boxShadow: "1px 0 0 var(--panel-border), 10px 0 18px rgba(0,0,0,0.16)",
                }}>
                  <input
                    type="checkbox"
                    checked={selectedSlugs.includes(s.slug)}
                    onChange={() => toggleSelectRow(s.slug)}
                    disabled={!isRowBatchActionable(s) || batchUpdating}
                    title={!isRowBatchActionable(s) ? "仅 NORMAL 且已配置项可批量修改" : "选择此项"}
                    style={{ cursor: !isRowBatchActionable(s) || batchUpdating ? "not-allowed" : "pointer" }}
                  />
                </td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--panel-border)", maxWidth: 280 }}>
                  <div
                    style={{
                      color: "var(--fg)",
                      fontWeight: 500,
                      fontSize: 12,
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                    }}
                    title={s.name || s.slug}
                  >
                    {s.name || s.slug}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--muted2)",
                      marginTop: 3,
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                    }}
                    title={s.slug}
                  >
                    {s.slug}
                  </div>
                  <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {s.type && (
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 500,
                          background: "rgba(59,130,246,0.12)",
                          color: "#93c5fd",
                          border: "1px solid rgba(59,130,246,0.3)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {s.type}
                      </span>
                    )}
                    {s.category && (
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 500,
                          background: "rgba(168,85,247,0.12)",
                          color: "#c4b5fd",
                          border: "1px solid rgba(168,85,247,0.3)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {s.category}
                      </span>
                    )}
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 600,
                        background: "rgba(16,185,129,0.1)",
                        color: "#a7f3d0",
                        border: "1px solid rgba(16,185,129,0.28)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {smp("safePrefix")} {s.safeMarkCount || 0}
                    </span>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 600,
                        background: "rgba(239,68,68,0.1)",
                        color: "#fecaca",
                        border: "1px solid rgba(239,68,68,0.28)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {smp("unsafePrefix")} {s.unsafeMarkCount || 0}
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: "4px 10px",
                      fontSize: 10,
                      color: "var(--muted)",
                    }}
                  >
                    <span title={smp("downloadsTitle")}>
                      <span style={{ color: "var(--muted2)" }}>{smp("downloadsPrefix")} </span>
                      <span
                        style={{
                          fontWeight: 600,
                          color: "var(--fg)",
                          fontFamily:
                            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                        }}
                      >
                        {formatMarketCount(s.downloadCount)}
                      </span>
                    </span>
                    <span style={{ color: "var(--panel-border)", userSelect: "none" }} aria-hidden>
                      |
                    </span>
                    <span title={smp("favoritesTitle")}>
                      <span style={{ color: "var(--muted2)" }}>{smp("favoritesPrefix")} </span>
                      <span
                        style={{
                          fontWeight: 600,
                          color: "var(--fg)",
                          fontFamily:
                            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                        }}
                      >
                        {formatMarketCount(s.favoriteCount)}
                      </span>
                    </span>
                    {s.starRating != null && Number.isFinite(s.starRating) && (
                      <>
                        <span style={{ color: "var(--panel-border)", userSelect: "none" }} aria-hidden>
                          |
                        </span>
                        <span title={smp("starRatingTitle")}>
                          <span style={{ color: "#fbbf24" }}>★</span>{" "}
                          <span
                            style={{
                              fontWeight: 600,
                              color: "var(--fg)",
                              fontFamily:
                                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                            }}
                          >
                            {s.starRating.toFixed(1)}
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                </td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--panel-border)", color: "var(--muted)", fontSize: 11 }}>
                  <div style={{ whiteSpace: "nowrap" }}>{s.sourceName || "-"}</div>
                  {s.publisherVerified && (
                    <div style={{ marginTop: 4, fontSize: 9, fontWeight: 600, color: "#86efac" }}>{smp("verifiedPublisher")}</div>
                  )}
                </td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--panel-border)", textAlign: "center", verticalAlign: "middle" }}>
                  {s.securityGrade ? (
                    <div
                      style={{
                        display: "inline-flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 40,
                        padding: "4px 6px",
                        borderRadius: 6,
                        fontFamily:
                          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                        fontWeight: 700,
                        fontSize: 12,
                        border: "1px solid",
                        ...(s.securityGrade === "A"
                          ? { background: "rgba(34,197,94,0.12)", color: "#86efac", borderColor: "rgba(34,197,94,0.35)" }
                          : s.securityGrade === "B"
                            ? { background: "rgba(59,130,246,0.12)", color: "#93c5fd", borderColor: "rgba(59,130,246,0.35)" }
                            : { background: "rgba(245,158,11,0.12)", color: "#fcd34d", borderColor: "rgba(245,158,11,0.35)" }),
                      }}
                    >
                      <span>{s.securityGrade}</span>
                      <span style={{ fontSize: 8, fontWeight: 600, opacity: 0.85 }}>
                        {s.securityGrade === "A" ? "SAFE" : s.securityGrade === "B" ? "GOOD" : "NOTE"}
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: "var(--muted2)", fontSize: 11 }}>—</span>
                  )}
                </td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--panel-border)", whiteSpace: "nowrap" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "3px 10px",
                      borderRadius: 6,
                      border: "1px solid var(--btn-border)",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--fg)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.systemStatus === "DISABLED"
                      ? smp("systemStatusDisabled")
                      : s.systemStatus === "DEPRECATED"
                        ? smp("systemStatusDeprecated")
                        : smp("systemStatusNormal")}
                  </span>
                </td>
                <td
                  style={{
                    padding: "6px 8px",
                    borderBottom: "1px solid var(--panel-border)",
                    maxWidth: 260,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      lineHeight: 1.4,
                    }}
                    title={s.shortDesc || ""}
                  >
                    {s.shortDesc || "-"}
                  </div>
                </td>
                <td
                  style={{
                    padding: "6px 8px",
                    borderBottom: "1px solid var(--panel-border)",
                    textAlign: "center",
                    position: "sticky",
                    right: 0,
                    zIndex: 2,
                    background: "var(--panel-solid)",
                    boxShadow: "-1px 0 0 var(--panel-border), -10px 0 18px rgba(0,0,0,0.16)",
                    width: 200,
                    minWidth: 200,
                    boxSizing: "border-box",
                    verticalAlign: "middle",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                    {/* 启用：置于最右列顶部 */}
                    {s.userEnabled === null ? (
                      <div style={{ fontSize: 10, color: "var(--muted2)" }}>{smp("notConfigured")}</div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleUserEnabled(s.slug, s.userEnabled)}
                        disabled={updatingSlug === s.slug || batchUpdating}
                        style={{
                          position: "relative",
                          width: 42,
                          height: 22,
                          borderRadius: 999,
                          border: "none",
                          background: s.userEnabled === 0 ? "#22c55e" : "#374151",
                          cursor: updatingSlug === s.slug || batchUpdating ? "not-allowed" : "pointer",
                          opacity: updatingSlug === s.slug || batchUpdating ? 0.6 : 1,
                          transition: "background 0.2s, opacity 0.2s",
                        }}
                        title={s.userEnabled === 0 ? "已启用拦截" : "未启用拦截"}
                      >
                        <span
                          style={{
                            position: "absolute",
                            top: 2,
                            left: s.userEnabled === 0 ? 24 : 2,
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            background: "#fff",
                            transition: "left 0.2s",
                          }}
                        />
                      </button>
                    )}

                    {/* 操作：放在启用下方，横向平铺 */}
                    <div style={{ display: "flex", gap: 6, width: "100%", justifyContent: "center" }}>
                      <button
                        type="button"
                        disabled
                        title={smp("comingSoonTitle")}
                        style={{
                          height: 26,
                          padding: "0 8px",
                          borderRadius: 8,
                          border: "1px solid var(--btn-border)",
                          background: "var(--panel-bg2)",
                          color: "var(--muted2)",
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: "not-allowed",
                          flex: "0 0 auto",
                        }}
                      >
                        {smp("auditReport")}
                      </button>
                      {/* 仅当拦截关闭（userEnabled===1）时才显示安全安装按钮 */}
                      {s.userEnabled === 1 && s.systemStatus === "NORMAL" && (
                        <button
                          type="button"
                          onClick={() => setInstallModal({ open: true, skill: s })}
                          disabled={updatingSlug === s.slug}
                          title={smp("installTitleEnable")}
                          style={{
                            height: 26,
                            padding: "0 8px",
                            borderRadius: 8,
                            border: "none",
                            background: "#2563eb",
                            color: "#fff",
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: updatingSlug === s.slug ? "not-allowed" : "pointer",
                            opacity: updatingSlug === s.slug ? 0.6 : 1,
                            flex: "0 0 auto",
                          }}
                        >
                          {smp("safeInstall")}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openDetail(s.slug)}
                        style={{
                          height: 26,
                          padding: "0 8px",
                          borderRadius: 8,
                          border: "1px solid var(--btn-border)",
                          background: "var(--panel-bg)",
                          color: "var(--fg)",
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: "pointer",
                          flex: "0 0 auto",
                        }}
                      >
                        {smp("detailBtn")}
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {displaySkills.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={7}
                  style={{ padding: "8px 10px", textAlign: "center", color: "var(--muted2)", background: "var(--panel-bg)" }}
                >
                  {skills.length === 0 ? smp("emptyNoSkills") : smp("emptyNoMatch")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
        </div>{/* /clip 包装器 */}

        {/* 固定底部横向滚动条：拖动时同步主表横向位置 */}
        {!loading && tableScrollSize.scrollWidth > tableScrollSize.clientWidth + 1 && (
          <div
            style={{
              position: "sticky",
              bottom: 54,
              zIndex: 7,
              borderTop: "1px solid var(--panel-border)",
              background: "var(--panel-solid)",
              padding: "6px 10px",
            }}
          >
            <div
              ref={bottomScrollRef}
              onScroll={onBottomScroll}
              style={{
                overflowX: "auto",
                overflowY: "hidden",
                height: 12,
                scrollbarWidth: "thin",
              }}
            >
              <div style={{ width: tableScrollSize.scrollWidth, height: 1 }} />
            </div>
          </div>
        )}

        {/* 分页条：固定在视口底部 */}
        {!loading && displaySkills.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "10px 12px",
              borderTop: "1px solid var(--panel-border)",
              background: "var(--panel-solid)",
              position: "sticky",
              bottom: 0,
              zIndex: 8,
            }}
          >
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {smp("pageSummary")
                .replace("{total}", String(displaySkills.length))
                .replace("{page}", String(marketPageSafe))
                .replace("{pages}", String(marketTotalPages))
                .replace("{size}", String(marketPageSize))}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setMarketPage(1)}
                disabled={marketPageSafe <= 1}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid var(--panel-border)",
                  background: "var(--panel-bg2)",
                  color: "var(--fg)",
                  fontSize: 12,
                  cursor: marketPageSafe <= 1 ? "not-allowed" : "pointer",
                  opacity: marketPageSafe <= 1 ? 0.55 : 1,
                }}
              >
                {smp("pageFirst")}
              </button>
              <button
                type="button"
                onClick={() => setMarketPage((p) => Math.max(1, p - 1))}
                disabled={marketPageSafe <= 1}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid var(--panel-border)",
                  background: "var(--panel-bg2)",
                  color: "var(--fg)",
                  fontSize: 12,
                  cursor: marketPageSafe <= 1 ? "not-allowed" : "pointer",
                  opacity: marketPageSafe <= 1 ? 0.55 : 1,
                }}
              >
                {smp("pagePrev")}
              </button>
              <button
                type="button"
                onClick={() => setMarketPage((p) => Math.min(marketTotalPages, p + 1))}
                disabled={marketPageSafe >= marketTotalPages}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid var(--panel-border)",
                  background: "var(--panel-bg2)",
                  color: "var(--fg)",
                  fontSize: 12,
                  cursor: marketPageSafe >= marketTotalPages ? "not-allowed" : "pointer",
                  opacity: marketPageSafe >= marketTotalPages ? 0.55 : 1,
                }}
              >
                {smp("pageNext")}
              </button>
              <button
                type="button"
                onClick={() => setMarketPage(marketTotalPages)}
                disabled={marketPageSafe >= marketTotalPages}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid var(--panel-border)",
                  background: "var(--panel-bg2)",
                  color: "var(--fg)",
                  fontSize: 12,
                  cursor: marketPageSafe >= marketTotalPages ? "not-allowed" : "pointer",
                  opacity: marketPageSafe >= marketTotalPages ? 0.55 : 1,
                }}
              >
                {smp("pageLast")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 安全安装弹窗 */}
      {installModal.open && installModal.skill && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2,6,23,0.62)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 60,
            backdropFilter: "blur(3px)",
            WebkitBackdropFilter: "blur(3px)",
          }}
          onClick={() => setInstallModal({ open: false, skill: null })}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 520,
              borderRadius: 18,
              border: "1px solid var(--panel-border)",
              background: "var(--panel-bg)",
              boxShadow: "0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04) inset",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* 弹窗头部 */}
            <div
              style={{
                padding: "18px 22px 16px",
                borderBottom: "1px solid var(--panel-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(29,78,216,0.2))",
                    border: "1px solid rgba(37,99,235,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  📦
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--fg)", marginBottom: 3 }}>
                    {smp("safeInstall")}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--muted2)",
                      fontFamily: "ui-monospace, monospace",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {installModal.skill.slug}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInstallModal({ open: false, skill: null })}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: "1px solid var(--panel-border)",
                  background: "transparent",
                  color: "var(--muted)",
                  fontSize: 16,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>

            {/* 弹窗内容区（模糊降级） */}
            <div
              style={{
                padding: "22px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                filter: "blur(2px)",
                pointerEvents: "none",
                userSelect: "none",
              }}
            >
              {/* skill 基础信息 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg)" }}>
                  {installModal.skill.name || installModal.skill.slug}
                </div>
                {installModal.skill.shortDesc && (
                  <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>
                    {installModal.skill.shortDesc}
                  </div>
                )}
              </div>

              {/* 安装命令占位 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  安装命令
                </div>
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--panel-border)",
                    background: "rgba(0,0,0,0.15)",
                    fontSize: 12,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    color: "var(--muted)",
                    lineHeight: 1.6,
                    wordBreak: "break-all",
                  }}
                >
                  npm install {installModal.skill.slug}
                </div>
              </div>

              {/* 执行环境选项占位 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {["当前工作区", "全局环境"].map((label) => (
                  <div
                    key={label}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid var(--panel-border)",
                      background: "var(--panel-bg2)",
                      fontSize: 12,
                      color: "var(--muted)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--muted2)", flexShrink: 0 }} />
                    {label}
                  </div>
                ))}
              </div>

              {/* 操作按钮占位 */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
                <div style={{ height: 34, width: 64, borderRadius: 8, background: "var(--panel-border)" }} />
                <div style={{ height: 34, width: 100, borderRadius: 8, background: "rgba(37,99,235,0.3)" }} />
              </div>
            </div>

            {/* 建设中蒙版 */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                top: 64,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
                background: "rgba(2,6,23,0.72)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                borderRadius: "0 0 18px 18px",
              }}
            >
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 16,
                  background: "linear-gradient(135deg, rgba(251,191,36,0.18), rgba(245,158,11,0.28))",
                  border: "1px solid rgba(251,191,36,0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                }}
              >
                🚧
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#fbbf24", marginBottom: 6 }}>
                  功能建设中
                </div>
                <div style={{ fontSize: 12, color: "rgba(148,163,184,0.85)", lineHeight: 1.6, maxWidth: 260 }}>
                  自动安装功能正在开发中，敬请期待。
                </div>
              </div>
              <div
                style={{
                  padding: "5px 14px",
                  borderRadius: 999,
                  background: "rgba(251,191,36,0.10)",
                  border: "1px solid rgba(251,191,36,0.22)",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "rgba(251,191,36,0.7)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Coming Soon
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 详情弹窗 */}
      {(detailLoading || detail || detailError) && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2,6,23,0.58)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={() => {
            setDetail(null);
            setDetailError(null);
            setDetailLoading(false);
          }}
        >
          <div
            style={{
              width: 640,
              maxHeight: "85vh",
              background: "var(--panel-bg)",
              borderRadius: 16,
              border: "1px solid var(--panel-border)",
              boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--panel-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--fg)" }}>{smp("modalTitle")}</div>
                {detail && (
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--muted2)",
                      marginTop: 4,
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    }}
                  >
                    {detail.slug || "—"}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetail(null);
                  setDetailError(null);
                  setDetailLoading(false);
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid var(--panel-border)",
                  background: "transparent",
                  color: "var(--fg)",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                {smp("modalClose")}
              </button>
            </div>

            {/* 内容区 */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 20px",
                fontSize: 12,
              }}
            >
              {detailLoading && <div style={{ color: "var(--muted)" }}>{smp("modalLoading")}</div>}
              {detailError && <div style={{ color: "#f97373" }}>{detailError}</div>}

              {detail && !detailLoading && !detailError && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--muted2)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {smp("modalLabelName")}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--fg)" }}>{detail.name || detail.slug}</div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 11 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--muted2)", marginBottom: 3 }}>{smp("modalLabelSlug")}</div>
                      <code
                        style={{
                          fontFamily:
                            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                          fontSize: 10,
                          background: "var(--panel-bg2)",
                          padding: "4px 6px",
                          borderRadius: 6,
                          border: "1px solid var(--panel-border)",
                          color: "var(--fg)",
                          display: "block",
                          wordBreak: "break-all",
                        }}
                      >
                        {detail.slug}
                      </code>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--muted2)", marginBottom: 3 }}>{smp("modalLabelType")}</div>
                      <div style={{ color: "var(--fg)" }}>{detail.type || "-"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--muted2)", marginBottom: 3 }}>{smp("modalLabelCategory")}</div>
                      <div style={{ color: "var(--fg)" }}>{detail.category || "-"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--muted2)", marginBottom: 3 }}>{smp("modalLabelStatus")}</div>
                      <div style={{ color: "var(--fg)" }}>{detail.status || "-"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--muted2)", marginBottom: 3 }}>{smp("modalLabelSource")}</div>
                      <div style={{ color: "var(--fg)" }}>{detail.sourceName || "ClawHub"}</div>
                    </div>
                    {detail.version && (
                      <div>
                        <div style={{ fontSize: 10, color: "var(--muted2)", marginBottom: 3 }}>{smp("modalLabelVersion")}</div>
                        <div style={{ color: "var(--fg)" }}>v{detail.version}</div>
                      </div>
                    )}
                  </div>

                  {detail.shortDesc && (
                    <div>
                      <div style={{ fontSize: 10, color: "var(--muted2)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {smp("modalLabelShortDesc")}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>{detail.shortDesc}</div>
                    </div>
                  )}

                  {detail.longDesc && (
                    <div>
                      <div style={{ fontSize: 10, color: "var(--muted2)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {smp("modalLabelLongDesc")}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--muted)",
                          lineHeight: 1.6,
                          whiteSpace: "pre-wrap",
                          background: "var(--panel-bg2)",
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: "1px solid var(--panel-border)",
                        }}
                      >
                        {detail.longDesc}
                      </div>
                    </div>
                  )}

                  {detail.tags && (
                    <div>
                      <div style={{ fontSize: 10, color: "var(--muted2)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {smp("modalLabelTags")}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {detail.tags.split(/[,，\s]+/).filter(Boolean).map((tagStr: string) => (
                          <span
                            key={tagStr}
                            style={{
                              padding: "3px 8px",
                              borderRadius: 999,
                              fontSize: 10,
                              fontWeight: 500,
                              background: "rgba(34,197,94,0.12)",
                              color: "#86efac",
                              border: "1px solid rgba(34,197,94,0.3)",
                            }}
                          >
                            {tagStr}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {detail.installHint && (
                    <div>
                      <div style={{ fontSize: 10, color: "var(--muted2)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {smp("modalLabelInstallHint")}
                      </div>
                      <code
                        style={{
                          display: "block",
                          fontFamily:
                            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                          fontSize: 10,
                          background: "var(--panel-bg2)",
                          padding: "8px 10px",
                          borderRadius: 6,
                          border: "1px solid var(--panel-border)",
                          color: "var(--fg)",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-all",
                        }}
                      >
                        {detail.installHint}
                      </code>
                    </div>
                  )}

                  {detail.homepageUrl && (
                    <div>
                      <div style={{ fontSize: 10, color: "var(--muted2)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {smp("modalLabelHomepage")}
                      </div>
                      <a
                        href={detail.homepageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 11,
                          color: "#60a5fa",
                          textDecoration: "underline",
                          wordBreak: "break-all",
                        }}
                      >
                        {detail.homepageUrl}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <style>{`
        .skills-table-scroll::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .skills-table-scroll::-webkit-scrollbar-track {
          background: #0b1220;
          border-radius: 999px;
        }
        .skills-table-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #64748b, #475569);
          border-radius: 999px;
          border: 2px solid #0b1220;
        }
        .skills-table-scroll::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #94a3b8, #64748b);
        }
        .skills-table-scroll::-webkit-scrollbar-corner {
          background: #0b1220;
        }
      `}</style>
    </div>
  );
}

