/**
 * Lightweight i18n — no external dependencies.
 * Supports en (English) and zh (Chinese).
 * Translations loaded from locales/*.json files.
 * Client components use the useI18n() hook.
 */

import en from "@/locales/en.json";
import zh from "@/locales/zh.json";

export type Locale = "en" | "zh";

/** Union of all known translation keys */
export type TranslationKey = keyof typeof en;

const translations: Record<Locale, Record<string, string>> = { en, zh };

export function t(key: TranslationKey, locale: Locale = "en"): string {
  const k = key as string;
  return translations[locale]?.[k] || translations.en[k] || k;
}

export function getLocale(): Locale {
  // The platform primarily serves Chinese users — default to zh.
  if (typeof window === "undefined") return "zh";
  const stored = localStorage.getItem("locale");
  if (stored === "zh" || stored === "en") return stored;
  // English browsers get en; everyone else defaults to zh
  const lang = navigator.language?.toLowerCase();
  if (lang?.startsWith("en")) return "en";
  return "zh";
}

export function setLocale(locale: Locale) {
  localStorage.setItem("locale", locale);
}
