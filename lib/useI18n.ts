"use client";

import { useState, useEffect, useCallback } from "react";
import { t as translate, getLocale, setLocale as setStoredLocale, type Locale, type TranslationKey } from "./i18n";

const LOCALE_EVENT = "amlclaw:localechange";

export function useI18n() {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    setLocaleState(getLocale());
    // Sync locale across all hook instances (e.g. Sidebar switcher → page content)
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<Locale>).detail;
      if (detail === "en" || detail === "zh") setLocaleState(detail);
    };
    window.addEventListener(LOCALE_EVENT, onChange);
    return () => window.removeEventListener(LOCALE_EVENT, onChange);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    setStoredLocale(l);
    window.dispatchEvent(new CustomEvent<Locale>(LOCALE_EVENT, { detail: l }));
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translate(key, locale),
    [locale]
  );

  return { locale, setLocale, t };
}
