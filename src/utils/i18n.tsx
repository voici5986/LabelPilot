import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';

import { translations } from './translations';
import type { Language } from './translations';
import { I18nContext } from './i18nContext';
import type { Translations } from './i18nContext';

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
    document.title = translations[language]['window_title'] || translations.zh['window_title'];
  }, [language]);

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}
