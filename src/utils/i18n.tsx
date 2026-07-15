import { useState, useEffect } from "react";
import type { ReactNode } from "react";

import { translations } from "./translations";
import type { Language } from "./translations";
import { I18nContext } from "./i18nContext";
import type { Translations } from "./i18nContext";
import { interpolateTranslation } from "./i18nFormat";

const STORAGE_KEY = "label_printer_lang";

function isLanguage(value: string | null): value is Language {
  return value === "en" || value === "zh";
}

function readStoredLanguage(): Language {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isLanguage(value) ? value : "zh";
  } catch {
    return "zh";
  }
}

function writeStoredLanguage(lang: Language) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Storage can be unavailable in private mode or locked-down browsers.
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    writeStoredLanguage(lang);
  };

  const t = (
    key: keyof Translations,
    variables?: Record<string, string | number>,
  ) => {
    const template = translations[language][key] || translations.zh[key] || key;
    return interpolateTranslation(template, variables);
  };

  useEffect(() => {
    document.title =
      translations[language]["window_title"] || translations.zh["window_title"];
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}
