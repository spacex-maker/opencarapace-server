export interface LocalStatus {
  danger: number;
  disabled: number;
  deprecated: number;
  auth?: {
    email: string;
    token: string;
    /** 与云端用户资料一致，可能为空 */
    displayName?: string | null;
  } | null;
  settings: {
    apiBase: string;
    ocApiKey: string;
    llmKey?: string;
  } | null;
  llmRouteMode?: "DIRECT" | "GATEWAY";
}

