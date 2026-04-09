import { api } from "../api/client";

type TrackPayload = {
  eventId: string;
  eventName: string;
  eventTime: number;
  anonymousId: string;
  sessionId: string;
  platform: "web";
  appVersion?: string;
  pageId?: string;
  module?: string;
  eventProps?: Record<string, unknown>;
  contextProps?: Record<string, unknown>;
};

const ANON_KEY = "oc_track_anon_id";
const SESSION_KEY = "oc_track_session_id";
const SESSION_TS_KEY = "oc_track_session_ts";
const SESSION_IDLE_MS = 30 * 60 * 1000;

function randomId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getAnonymousId(): string {
  const existing = localStorage.getItem(ANON_KEY);
  if (existing) return existing;
  const next = randomId("anon");
  localStorage.setItem(ANON_KEY, next);
  return next;
}

function getSessionId(nowMs: number): string {
  const lastTs = Number(localStorage.getItem(SESSION_TS_KEY) || "0");
  const existing = localStorage.getItem(SESSION_KEY);
  const expired = !lastTs || nowMs - lastTs > SESSION_IDLE_MS;
  const sessionId = !existing || expired ? randomId("sess") : existing;
  localStorage.setItem(SESSION_KEY, sessionId);
  localStorage.setItem(SESSION_TS_KEY, String(nowMs));
  return sessionId;
}

export async function trackEvent(
  eventName: string,
  options?: {
    pageId?: string;
    module?: string;
    eventProps?: Record<string, unknown>;
    contextProps?: Record<string, unknown>;
  }
) {
  try {
    const now = Date.now();
    const payload: TrackPayload = {
      eventId: randomId("evt"),
      eventName,
      eventTime: now,
      anonymousId: getAnonymousId(),
      sessionId: getSessionId(now),
      platform: "web",
      appVersion: import.meta.env.VITE_APP_VERSION || "web",
      pageId: options?.pageId,
      module: options?.module,
      eventProps: options?.eventProps,
      contextProps: {
        language: navigator.language,
        userAgent: navigator.userAgent,
        ...(options?.contextProps || {}),
      },
    };
    await api.post("/api/track/events", { events: [payload] });
  } catch {
    // Ignore tracking failures and never affect user flows.
  }
}

