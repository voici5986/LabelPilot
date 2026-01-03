import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

export type Language = 'en' | 'zh';

export const translations = {
  en: {
    window_title: 'LabelPilot',
    main_title: 'LabelPilot',
    file_group: 'LABEL IMAGE',
    layout_group: 'LAYOUT SETTINGS',
    browse_btn: 'Click to upload image',
    browse_hint: 'PNG, JPG supported',
    rows: 'Rows',
    cols: 'Columns',
    margin: 'Margin',
    spacing: 'Spacing',
    orientation: 'Page Orientation',
    portrait: 'Portrait',
    landscape: 'Landscape',
    generate_btn: 'Generate PDF',
    zoom_reset: 'Reset Zoom',
    gen_success: 'PDF Generated! Downloading...',
    gen_failed: 'Failed to generate PDF',
    files_selected: '{n} images selected',
  },
  zh: {
    window_title: 'LabelPilot',
    main_title: 'LabelPilot',
    file_group: '标签图片',
    layout_group: '排版设置',
    browse_btn: '点击上传标签图片',
    browse_hint: '支持 PNG, JPG 格式',
    rows: '行数',
    cols: '列数',
    margin: '边距',
    spacing: '间距',
    orientation: '纸张方向',
    portrait: '纵向',
    landscape: '横向',
    generate_btn: '生成 PDF 文档',
    zoom_reset: '重置缩放',
    gen_success: 'PDF 已生成！正在开始下载...',
    gen_failed: '生成 PDF 失败',
    files_selected: '已选择 {n} 张图片',
  }
};

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
