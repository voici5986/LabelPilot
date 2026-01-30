import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

import { translations } from './translations';
import type { Language } from './translations';

type Translations = typeof translations.zh;

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof Translations, variables?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('label_printer_lang') as Language) || 'zh';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('label_printer_lang', lang);
  };

  const t = (key: keyof Translations, variables?: Record<string, string | number>) => {
    let str = translations[language][key] || translations.zh[key] || key;
    if (variables) {
      Object.entries(variables).forEach(([k, v]) => {
        str = str.replace(`{${k}}`, String(v));
      });
    }
    return str;
  };

  useEffect(() => {
    document.title = t('window_title');
  }, [language]);

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
