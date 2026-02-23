import { createContext, useContext } from "react";
import { translations } from "./translations";
import type { Language } from "./translations";

export type Translations = typeof translations.zh;

export interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (
    key: keyof Translations,
    variables?: Record<string, string | number>,
  ) => string;
}

export const I18nContext = createContext<I18nContextType | null>(null);

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
