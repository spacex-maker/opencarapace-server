/** 从 openclaw --version / npm view 等输出里抽出 x.y.z 或 2026.x.y */
export function extractOpenClawSemverLike(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = s.match(/(\d{4}\.\d+\.\d+|\d+\.\d+\.\d+)/);
  return m ? m[1]! : null;
}

export type OpenClawVersionCompare = "same" | "upgradeAvailable" | "localNewer" | "unknown";

export function compareOpenClawLocalToNpmLatest(
  localRaw: string | null | undefined,
  npmLatestRaw: string | null | undefined
): OpenClawVersionCompare {
  const a = extractOpenClawSemverLike(localRaw);
  const b = extractOpenClawSemverLike(npmLatestRaw);
  if (!a || !b) return "unknown";
  const pa = a.split(".").map((x) => parseInt(x, 10) || 0);
  const pb = b.split(".").map((x) => parseInt(x, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da < db ? "upgradeAvailable" : "localNewer";
  }
  return "same";
}
