const PREFIX = "opencarapace:dashboard:v1:";

function readJson<T>(key: string): T | null {
  try {
    const s = localStorage.getItem(key);
    if (!s) return null;
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 配额满或隐私模式等
  }
}

export function readDashboardSkills<T>(): T | null {
  return readJson<T>(`${PREFIX}skills`);
}

export function writeDashboardSkills<T>(data: T): void {
  writeJson(`${PREFIX}skills`, data);
}

export function readDashboardDanger<T>(): T | null {
  return readJson<T>(`${PREFIX}danger`);
}

export function writeDashboardDanger<T>(data: T): void {
  writeJson(`${PREFIX}danger`, data);
}

export function readDashboardIntercept<T>(): T | null {
  return readJson<T>(`${PREFIX}intercept`);
}

export function writeDashboardIntercept<T>(data: T): void {
  writeJson(`${PREFIX}intercept`, data);
}

export function readDashboardTokenTimeline<T>(range: string, granularity: string): T | null {
  return readJson<T>(`${PREFIX}tokenTimeline:${range}:${granularity}`);
}

export function writeDashboardTokenTimeline<T>(range: string, granularity: string, data: T): void {
  writeJson(`${PREFIX}tokenTimeline:${range}:${granularity}`, data);
}

export function readDashboardInterceptTimeline<T>(range: string, granularity: string): T | null {
  return readJson<T>(`${PREFIX}interceptTimeline:${range}:${granularity}`);
}

export function writeDashboardInterceptTimeline<T>(range: string, granularity: string, data: T): void {
  writeJson(`${PREFIX}interceptTimeline:${range}:${granularity}`, data);
}
