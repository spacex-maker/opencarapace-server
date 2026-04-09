type TrackEventOptions = {
  pageId?: string;
  module?: string;
  eventProps?: Record<string, unknown>;
  contextProps?: Record<string, unknown>;
};

const ANON_KEY = "oc_desktop_track_anon_id";
const SESSION_KEY = "oc_desktop_track_session_id";
const SESSION_TS_KEY = "oc_desktop_track_session_ts";
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

function getSessionId(now: number): string {
  const existing = localStorage.getItem(SESSION_KEY);
  const ts = Number(localStorage.getItem(SESSION_TS_KEY) || "0");
  const expired = !ts || now - ts > SESSION_IDLE_MS;
  const sessionId = !existing || expired ? randomId("sess") : existing;
  localStorage.setItem(SESSION_KEY, sessionId);
  localStorage.setItem(SESSION_TS_KEY, String(now));
  return sessionId;
}

export async function trackEvent(eventName: string, options?: TrackEventOptions) {
  try {
    const now = Date.now();
    await fetch("http://127.0.0.1:19111/api/track/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        events: [
          {
            eventId: randomId("evt"),
            eventName,
            eventTime: now,
            anonymousId: getAnonymousId(),
            sessionId: getSessionId(now),
            platform: "desktop",
            appVersion: "desktop",
            pageId: options?.pageId,
            module: options?.module,
            eventProps: options?.eventProps,
            contextProps: {
              language: navigator.language,
              userAgent: navigator.userAgent,
              ...(options?.contextProps || {}),
            },
          },
        ],
      }),
    });
  } catch {
    // Ignore tracking failures.
  }
}

