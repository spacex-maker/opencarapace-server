/**
 * 下载页：识别访客 UA / Client Hints / WebGL，用于推荐 Windows / macOS 及 Mac 芯片架构。
 * 浏览器指纹非 100% 准确（尤其 Rosetta 下 UA 仍可能带 Intel），仅作引导。
 */

export type ClientOs = "windows" | "macos" | "linux" | "mobile" | "unknown";

export type DownloadClientDetect = {
  os: ClientOs;
  /** 仅 macOS 有意义：true 倾向 Apple Silicon，false 倾向 Intel，null 无法区分 */
  macPreferArm64: boolean | null;
};

export function detectClientOs(): ClientOs {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  const ual = ua.toLowerCase();
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string; mobile?: boolean } }).userAgentData;
  if (uaData?.mobile || /android|iphone|ipad|ipod|webos|blackberry/i.test(ua)) return "mobile";
  const plat = (uaData?.platform || navigator.platform || "").toLowerCase();
  if (/windows|win32|win64|wow64/.test(ual) || plat.includes("win")) return "windows";
  if (/macintosh|mac os x/.test(ual) || plat === "macos") return "macos";
  if ((/linux/.test(ual) || plat.includes("linux")) && !/android/.test(ual)) return "linux";
  return "unknown";
}

function webglLooksLikeAppleSilicon(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl =
      (c.getContext("webgl") || c.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    const dbg = gl?.getExtension("WEBGL_debug_renderer_info") as { UNMASKED_RENDERER_WEBGL: number } | null;
    if (!dbg || !gl) return false;
    const r = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || "");
    if (/Apple M\d|Apple M1|Apple M2|Apple M3|Apple GPU/i.test(r)) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** 异步：优先 Client Hints architecture，其次 UA / WebGL */
export async function detectDownloadClient(): Promise<DownloadClientDetect> {
  const os = detectClientOs();
  if (os !== "macos") {
    return { os, macPreferArm64: null };
  }

  const nav = navigator as Navigator & {
    userAgentData?: {
      architecture?: string;
      getHighEntropyValues?: (keys: string[]) => Promise<{ architecture?: string }>;
    };
  };

  const arch = nav.userAgentData?.architecture;
  if (arch === "arm") return { os, macPreferArm64: true };
  if (arch === "x86") return { os, macPreferArm64: false };

  try {
    if (nav.userAgentData?.getHighEntropyValues) {
      const hv = await nav.userAgentData.getHighEntropyValues(["architecture"]);
      if (hv.architecture === "arm") return { os, macPreferArm64: true };
      if (hv.architecture === "x86") return { os, macPreferArm64: false };
    }
  } catch {
    /* ignore */
  }

  if (/aarch64|arm64/i.test(navigator.userAgent)) return { os, macPreferArm64: true };
  if (/Intel Mac OS X|Intel Mac OS/i.test(navigator.userAgent)) return { os, macPreferArm64: false };
  if (webglLooksLikeAppleSilicon()) return { os, macPreferArm64: true };

  return { os, macPreferArm64: null };
}

export function recommendedDownloadTarget(d: DownloadClientDetect | null): "windows" | "mac" | null {
  if (!d) return null;
  if (d.os === "windows") return "windows";
  if (d.os === "macos") return "mac";
  return null;
}

/** 顶部提示条文案；无推荐时返回 null */
export function recommendationBannerText(d: DownloadClientDetect | null): string | null {
  if (!d) return null;
  if (d.os === "windows") return "检测到您正在使用 Windows，已为您标注本机推荐安装包。";
  if (d.os === "macos") {
    if (d.macPreferArm64 === true) {
      return "检测到您正在使用 macOS（倾向 Apple Silicon），请优先选择下方「Apple Silicon」安装包。";
    }
    if (d.macPreferArm64 === false) {
      return "检测到您正在使用 macOS（倾向 Intel 芯片），请优先选择下方「Intel 芯片」安装包。";
    }
    return "检测到您正在使用 macOS，请按本机芯片选择 Intel 或 Apple Silicon 安装包。";
  }
  if (d.os === "linux") {
    return "检测到 Linux 环境。以下提供 Windows / macOS 桌面安装包；其他平台敬请期待。";
  }
  if (d.os === "mobile") {
    return "检测到移动设备。桌面客户端请在 Windows 或 macOS 电脑上下载。";
  }
  return null;
}

/** Windows 变体：推荐完整版（与 DownloadPage 中 label 一致） */
export const WIN_RECOMMENDED_LABEL = "完整版（内置 OpenClaw）";

export function isMacVariantRecommended(d: DownloadClientDetect | null, variantLabel: string): boolean {
  if (!d || d.os !== "macos" || d.macPreferArm64 === null) return false;
  if (d.macPreferArm64) return variantLabel.includes("Apple Silicon") || variantLabel.includes("M 系列");
  return variantLabel.includes("Intel");
}

export function isWinVariantRecommended(d: DownloadClientDetect | null, variantLabel: string): boolean {
  if (!d || d.os !== "windows") return false;
  return variantLabel === WIN_RECOMMENDED_LABEL;
}
