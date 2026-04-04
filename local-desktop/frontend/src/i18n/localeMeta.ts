/**
 * 全球常用十种界面语言（使用人口与互联网覆盖综合选取）。
 * 列表展示名使用各语言自称（native label），不随当前 UI 语言变化。
 */
export const LOCALE_OPTIONS = [
  { code: "en", nativeLabel: "English" },
  { code: "zh", nativeLabel: "简体中文" },
  { code: "es", nativeLabel: "Español" },
  { code: "hi", nativeLabel: "हिन्दी" },
  { code: "ar", nativeLabel: "العربية" },
  { code: "fr", nativeLabel: "Français" },
  { code: "pt", nativeLabel: "Português" },
  { code: "ru", nativeLabel: "Русский" },
  { code: "ja", nativeLabel: "日本語" },
  { code: "de", nativeLabel: "Deutsch" },
] as const;

export type Locale = (typeof LOCALE_OPTIONS)[number]["code"];

export function isLocale(v: string): v is Locale {
  return (LOCALE_OPTIONS as readonly { code: string }[]).some((o) => o.code === v);
}

export function localeNativeLabel(code: Locale): string {
  const row = LOCALE_OPTIONS.find((o) => o.code === code);
  return row?.nativeLabel ?? code;
}

export const RTL_LOCALES = new Set<Locale>(["ar"]);

/** BCP 47，用于 <html lang> */
export function localeToHtmlLang(locale: Locale): string {
  switch (locale) {
    case "zh":
      return "zh-CN";
    case "pt":
      return "pt-BR";
    default:
      return locale;
  }
}
