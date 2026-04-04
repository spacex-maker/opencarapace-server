import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { zh, type Messages } from "./locales/zh";
import { en } from "./locales/en";
import { es } from "./locales/es";
import { hi } from "./locales/hi";
import { ar } from "./locales/ar";
import { fr } from "./locales/fr";
import { pt } from "./locales/pt";
import { ru } from "./locales/ru";
import { ja } from "./locales/ja";
import { de } from "./locales/de";
import {
  type Locale,
  isLocale,
  RTL_LOCALES,
  localeToHtmlLang,
} from "./localeMeta";

export type { Locale } from "./localeMeta";

const STORAGE_KEY = "oc_locale";

const bundles: Record<Locale, Messages> = {
  zh,
  en,
  es,
  hi,
  ar,
  fr,
  pt,
  ru,
  ja,
  de,
};

function getByPath(obj: unknown, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function matchNavigatorLocale(nav: string): Locale | null {
  const pairs: [string, Locale][] = [
    ["zh", "zh"],
    ["en", "en"],
    ["es", "es"],
    ["hi", "hi"],
    ["ar", "ar"],
    ["fr", "fr"],
    ["pt", "pt"],
    ["ru", "ru"],
    ["ja", "ja"],
    ["de", "de"],
  ];
  for (const [prefix, loc] of pairs) {
    if (nav.startsWith(prefix)) return loc;
  }
  return null;
}

function readInitialLocale(): Locale {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && isLocale(v)) return v;
  } catch {
    // ignore
  }
  if (typeof navigator !== "undefined") {
    const nav = navigator.language?.toLowerCase() ?? "";
    const matched = matchNavigatorLocale(nav);
    if (matched) return matched;
  }
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // ignore
    }
  }, [locale]);

  useEffect(() => {
    const dir = RTL_LOCALES.has(locale) ? "rtl" : "ltr";
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", localeToHtmlLang(locale));
  }, [locale]);

  const setLocale = useCallback((l: Locale) => setLocaleState(l), []);

  const t = useCallback(
    (key: string) => {
      const fromBundle = getByPath(bundles[locale], key);
      if (fromBundle !== undefined) return fromBundle;
      const enFb = getByPath(bundles.en, key);
      if (enFb !== undefined) return enFb;
      const zhFb = getByPath(bundles.zh, key);
      return zhFb ?? key;
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
