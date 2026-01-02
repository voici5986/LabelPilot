import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

export type Language = 'zh' | 'th';

export const translations = {
  zh: {
    window_title: '标签打印排版工具',
    main_title: '标签批量打印工具',
    subtitle: '基于 React 重构',
    file_group: '选择标签图片',
    layout_group: '排版设置',
    page_group: '页面设置',
    preview_group: 'PDF预览',
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
    preview_hint: '预览模式',
    zoom_reset: '重置缩放',
    success_title: '生成成功',
    error_title: '错误',
    no_file: '请先选择文件',
    generating: '生成中...',
  },
  th: {
    window_title: 'เครื่องมือจัดเรียงฉลาก',
    main_title: 'เครื่องมือพิมพ์ฉลาก',
    subtitle: 'สร้างด้วย React',
    file_group: 'เลือกรูปภาพฉลาก',
    layout_group: 'ตั้งค่าการจัดวาง',
    page_group: 'ตั้งค่าหน้ากระดาษ',
    preview_group: 'ตัวอย่าง PDF',
    browse_btn: 'คลิกเพื่ออัปโหลดรูปภาพ',
    browse_hint: 'รองรับไฟล์ PNG, JPG',
    rows: 'แถว',
    cols: 'คอลัมน์',
    margin: 'ขอบ',
    spacing: 'ระยะห่าง',
    orientation: 'การวางแนว',
    portrait: 'แนวตั้ง',
    landscape: 'แนวนอน',
    generate_btn: 'สร้างไฟล์ PDF',
    preview_hint: 'โหมดตัวอย่าง',
    zoom_reset: 'รีเซ็ตการซูม',
    success_title: 'สำเร็จ',
    error_title: 'ข้อผิดพลาด',
    no_file: 'กรุณาเลือกไฟล์',
    generating: 'กำลังสร้าง...',
  }
};

type Translations = typeof translations.zh;

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof Translations) => string;
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

  const t = (key: keyof Translations) => {
    return translations[language][key] || translations.zh[key] || key;
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
