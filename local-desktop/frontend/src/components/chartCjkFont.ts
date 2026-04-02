import type { EChartsOption } from "echarts";

/**
 * Windows / Electron 下 ECharts 默认 canvas 字体常不含中文，图例与 tooltip 易出现乱码或方框。
 * 为 option 内所有 textStyle、axisLabel、series.label 等补上中文字体栈。
 */
const CJK_FONT_STACK =
  'system-ui, -apple-system, "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", sans-serif';

export function applyCjkChartFonts(option: EChartsOption): EChartsOption {
  const cloned = JSON.parse(JSON.stringify(option)) as EChartsOption & Record<string, unknown>;

  /** 强制使用含中文的回退字体栈（覆盖 option 里可能不含 CJK 的 fontFamily） */
  const mergeFf = (style: Record<string, unknown> | undefined) =>
    ({ ...(style || {}), fontFamily: CJK_FONT_STACK }) as Record<string, unknown>;

  const walk = (x: unknown): void => {
    if (x === null || typeof x !== "object") return;
    if (Array.isArray(x)) {
      x.forEach(walk);
      return;
    }
    const r = x as Record<string, unknown>;
    if (r.textStyle && typeof r.textStyle === "object") {
      r.textStyle = mergeFf(r.textStyle as Record<string, unknown>);
    }
    if (r.axisLabel && typeof r.axisLabel === "object" && !Array.isArray(r.axisLabel)) {
      r.axisLabel = mergeFf(r.axisLabel as Record<string, unknown>);
    }
    if (r.label && typeof r.label === "object" && !Array.isArray(r.label)) {
      const lb = r.label as Record<string, unknown>;
      if ("fontSize" in lb || "color" in lb || "formatter" in lb || "show" in lb) {
        r.label = mergeFf(lb);
      }
    }
    for (const v of Object.values(r)) walk(v);
  };

  cloned.textStyle = mergeFf(cloned.textStyle as Record<string, unknown> | undefined) as never;
  walk(cloned);
  return cloned;
}
