export interface LocalStatus {
  danger: number;
  disabled: number;
  deprecated: number;
  auth?: {
    email: string;
  } | null;
  settings: {
    apiBase: string;
    ocApiKey: string;
    llmKey: string;
  } | null;
  llmRouteMode?: "DIRECT" | "GATEWAY";
}

