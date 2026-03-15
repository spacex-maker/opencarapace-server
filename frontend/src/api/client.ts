import axios from "axios";

const backendBase =
  import.meta.env.VITE_BACKEND_BASE ?? "http://localhost:8080";

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
