import axios from "axios";

/** 根据当前访问地址自动选择后端：localhost/127.0.0.1 → :8080，否则产线域名；可用 VITE_BACKEND_BASE 覆盖 */
export function getBackendBase(): string {
  if (import.meta.env.VITE_BACKEND_BASE) return import.meta.env.VITE_BACKEND_BASE;
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") return "http://localhost:8080";
    return "https://api.clawheart.live";
  }
  return "http://localhost:8080";
}

const backendBase = getBackendBase();

export const api = axios.create({
  baseURL: backendBase,
  headers: { "Content-Type": "application/json" },
});

/** 请求时附带 JWT */
export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
}

export interface AuthResponse {
  token: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface UserProfile {
  id: number;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
  createdAt: string;
}

export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/api/auth/login", {
    email,
    password,
  });
  return data;
}

export async function register(
  email: string,
  password: string,
  displayName?: string
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/api/auth/register", {
    email,
    password,
    displayName: displayName || undefined,
  });
  return data;
}

export async function fetchMe(token: string): Promise<UserProfile> {
  setAuthToken(token);
  const { data } = await api.get<UserProfile>("/api/users/me");
  return data;
}

/** 危险指令库条目（仅管理员可调用的接口） */
export interface DangerCommandItem {
  id: number;
  commandPattern: string;
  systemType: string;
  category: string;
  riskLevel: string;
  title: string;
  description: string | null;
  mitigation: string | null;
  tags: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 分页结果（Spring Page） */
export interface DangerCommandPage {
  content: DangerCommandItem[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

export function fetchDangerCommands(params: {
  page?: number;
  size?: number;
  systemType?: string;
  category?: string;
  riskLevel?: string;
  keyword?: string;
}): Promise<DangerCommandPage> {
  const search = new URLSearchParams();
  if (params.page != null) search.set("page", String(params.page));
  if (params.size != null) search.set("size", String(params.size));
  if (params.systemType) search.set("systemType", params.systemType);
  if (params.category) search.set("category", params.category);
  if (params.riskLevel) search.set("riskLevel", params.riskLevel);
  if (params.keyword) search.set("keyword", params.keyword);
  return api
    .get<DangerCommandPage>(`/api/danger-commands?${search.toString()}`)
    .then((r) => r.data);
}

export interface DangerCommandDto {
  commandPattern: string;
  systemType: string;
  category: string;
  riskLevel: string;
  title: string;
  description?: string | null;
  mitigation?: string | null;
  tags?: string | null;
  enabled?: boolean | null;
}

export async function updateDangerCommand(id: number, payload: DangerCommandDto): Promise<DangerCommandItem> {
  const { data } = await api.put<DangerCommandItem>(`/api/danger-commands/${id}`, payload);
  return data;
}

// Skills
export interface SkillItem {
  id: number;
  name: string;
  slug: string;
  type: string;
  category?: string;
  status: string;
  shortDesc?: string;
  tags?: string;
  homepageUrl?: string;
  installHint?: string;
  sourceName?: string;
  lastSyncAt?: string;
  createdAt?: string;
  updatedAt?: string;
  /** 用户级启用状态；null 表示未配置（默认启用） */
  userEnabled?: boolean | null;
}

export interface SkillPage {
  content: SkillItem[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

export function fetchSkills(params: { page?: number; size?: number }): Promise<SkillPage> {
  const search = new URLSearchParams();
  if (params.page != null) search.set("page", String(params.page));
  if (params.size != null) search.set("size", String(params.size));
  return api.get<SkillPage>(`/api/skills?${search.toString()}`).then((r) => r.data);
}

export interface UpdateSkillDto {
  name?: string;
  status?: string;
  shortDesc?: string;
  tags?: string;
  homepageUrl?: string;
  installHint?: string;
  category?: string;
  type?: string;
}

export function updateSkill(id: number, payload: UpdateSkillDto): Promise<SkillItem> {
  return api.put<SkillItem>(`/api/admin/skills/${id}`, payload).then((r) => r.data);
}

// User skills (per-user enable/disable)
export interface UserSkillPref {
  slug: string;
  enabled: boolean;
}

export async function fetchMyUserSkills(): Promise<UserSkillPref[]> {
  const { data } = await api.get<UserSkillPref[]>("/api/user-skills/me");
  return Array.isArray(data) ? data : [];
}

export async function setMyUserSkill(slug: string, enabled: boolean): Promise<UserSkillPref> {
  const { data } = await api.put<UserSkillPref>(`/api/user-skills/me/${encodeURIComponent(slug)}`, {
    enabled,
  });
  return data;
}

export async function manualSyncClawhubSkills(): Promise<{ source: string; synced: number }> {
  const { data } = await api.post<{ source: string; synced: number }>("/api/admin/skills/sync/clawhub");
  return data;
}

export async function manualFullSyncClawhubSkills(): Promise<{ source: string; synced: number }> {
  const { data } = await api.post<{ source: string; synced: number }>("/api/admin/skills/sync/clawhub-full");
  return data;
}

// 用户设置：LLM 路由模式
export type LlmRouteMode = "DIRECT" | "GATEWAY";

export interface UserSettings {
  llmRouteMode: LlmRouteMode;
}

export async function fetchUserSettings(): Promise<UserSettings> {
  const { data } = await api.get<UserSettings>("/api/user-settings/me");
  return data;
}

export async function updateLlmRouteMode(mode: LlmRouteMode): Promise<UserSettings> {
  const { data } = await api.put<UserSettings>("/api/user-settings/me/llm-route-mode", { llmRouteMode: mode });
  return data;
}

// 当前用户自己的拦截日志
export interface ClientInterceptLogItem {
  id: number;
  clientId?: string;
  requestType?: string;
  upstream?: string;
  verdict: string;
  riskLevel?: string;
  matchedRuleIds?: string;
  reason?: string;
  requestSnippet?: string;
  createdAt?: string;
}

export async function fetchMyInterceptLogs(limit = 50): Promise<ClientInterceptLogItem[]> {
  const { data } = await api.get<ClientInterceptLogItem[]>(`/api/client/intercept-logs/me?limit=${limit}`);
  return Array.isArray(data) ? data : [];
}

/** 系统配置项（仅管理员） */
export interface SystemConfigItem {
  configKey: string;
  configValue: string;
  description: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export function fetchSystemConfigList(): Promise<SystemConfigItem[]> {
  return api.get<SystemConfigItem[]>("/api/admin/system-config").then((r) => r.data);
}

export function setSystemConfig(
  key: string,
  value: string,
  description?: string
): Promise<SystemConfigItem> {
  return api
    .put<SystemConfigItem>(`/api/admin/system-config/${encodeURIComponent(key)}`, {
      value,
      description: description ?? null,
    })
    .then((r) => r.data);
}

/** ClawHub 技能同步设置（系统设置中的专用配置，非 KV） */
export interface ClawhubSyncSettings {
  enabled: boolean;
  cronExpression: string;
  lastRunAt: string | null;
}

const CLAWHUB_CRON_PRESETS: { value: string; label: string }[] = [
  { value: "0 0 2 * * ?", label: "每天凌晨 2:00" },
  { value: "0 0 3 * * ?", label: "每天凌晨 3:00" },
  { value: "0 0 */6 * * ?", label: "每 6 小时" },
  { value: "0 0 */12 * * ?", label: "每 12 小时" },
];

export { CLAWHUB_CRON_PRESETS };

export function fetchClawhubSyncSettings(): Promise<ClawhubSyncSettings> {
  return api.get<ClawhubSyncSettings>("/api/admin/settings/clawhub-sync").then((r) => r.data);
}

export function updateClawhubSyncSettings(
  enabled: boolean,
  cronExpression: string
): Promise<ClawhubSyncSettings> {
  return api
    .put<ClawhubSyncSettings>("/api/admin/settings/clawhub-sync", {
      enabled,
      cronExpression,
      lastRunAt: null,
    })
    .then((r) => r.data);
}

/** 分组配置（系统配置页专用卡片数据） */
export interface GroupedSettingsDto {
  dangerCommands: DangerCommandsDto;
  llmProxy: LlmProxyDto;
  supervision: SupervisionDto;
  intent: IntentDto;
}
export interface DangerCommandsDto {
  useInternet: boolean;
  deepseekApiKeySet: boolean;
  tavilyApiKeySet: boolean;
  deepseekApiKey?: string | null;
  tavilyApiKey?: string | null;
}
export interface LlmProxyDto {
  enabled: boolean;
  upstreamUrl: string;
  upstreamApiKeySet: boolean;
  upstreamApiKey?: string | null;
  backends: BackendDto[];
}
export interface BackendDto {
  name: string;
  url: string;
  apiKeySet: boolean;
  apiKey?: string | null;
}
export interface SupervisionDto {
  enabled: boolean;
  blockLevels: string;
}
export interface IntentDto {
  enabled: boolean;
  model: string;
}

export function fetchGroupedSettings(): Promise<GroupedSettingsDto> {
  return api.get<GroupedSettingsDto>("/api/admin/settings/grouped").then((r) => r.data);
}
export function putGroupedSettings(body: GroupedSettingsDto): Promise<GroupedSettingsDto> {
  return api.put<GroupedSettingsDto>("/api/admin/settings/grouped", body).then((r) => r.data);
}
