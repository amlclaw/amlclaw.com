"use client";

import { useState, useEffect, useCallback } from "react";
import { t as translate, getLocale, setLocale as setStoredLocale, type Locale, type TranslationKey } from "./i18n";

export function useI18n() {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    setLocaleState(getLocale());
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    setStoredLocale(l);
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translate(key, locale),
    [locale]
  );

  return { locale, setLocale, t };
}
