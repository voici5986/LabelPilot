import { useState, useEffect } from "react";
import { Layout } from "./components/Layout";
import { Header } from "./components/Header";
import { ControlPanel } from "./components/ControlPanel";
import { PreviewPanel } from "./components/PreviewPanel";
import { ReloadPrompt } from "./components/ReloadPrompt";
import { A4_WIDTH_MM, A4_HEIGHT_MM } from "./utils/layoutMath";
import type { HelperLayoutConfig } from "./utils/layoutMath";
import { generatePDF } from "./utils/pdfGenerator";
import { Toast, type ToastType } from "./components/Toast";
import { useI18n } from "./utils/i18n";

// Default Config
const DEFAULT_CONFIG: HelperLayoutConfig = {
  rows: 3,
  cols: 3,
  marginMm: 10,
  spacingMm: 10,
  orientation: 'landscape',
  pageWidthMm: A4_WIDTH_MM,
  pageHeightMm: A4_HEIGHT_MM,
};

export interface ImageItem {
  id: string;
  file: File;
  count: number;
}

interface TextConfig {
  prefix: string;
  startNumber: number;
  digits: number;
  count: number;
}

function App() {
  const { t } = useI18n();

  // State
  const [config, setConfig] = useState<HelperLayoutConfig>(() => {
    const saved = localStorage.getItem("label_printer_config");
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });

  const [imageItems, setImageItems] = useState<ImageItem[]>([]);


  // Toast State
  const [toast, setToast] = useState<{ message: string; type: ToastType; visible: boolean }>({
    message: "",
    type: "success",
    visible: false
  });

  const [genStatus, setGenStatus] = useState<'idle' | 'generating' | 'success' | 'error'>('idle');
  const [genProgress, setGenProgress] = useState(0);

  // App Mode State
  const [appMode, setAppMode] = useState<'image' | 'text'>(() => {
    return (localStorage.getItem("app_mode") as 'image' | 'text') || 'image';
  });

  // Sync App Mode to LocalStorage
  useEffect(() => {
    localStorage.setItem("app_mode", appMode);
  }, [appMode]);

  // Text Mode Config State
  const [textConfig, setTextConfig] = useState<TextConfig>(() => {
    const saved = localStorage.getItem("label_text_config");
    return saved ? JSON.parse(saved) : {
      prefix: "SN-",
      startNumber: 1,
      digits: 3,
      count: 10
    };
  });

  // Sync Text Config to LocalStorage
  useEffect(() => {
    localStorage.setItem("label_text_config", JSON.stringify(textConfig));
  }, [textConfig]);

  // Theme State
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>(() => {
    return (localStorage.getItem("theme_mode") as 'system' | 'light' | 'dark') || 'system';
  });

  // Sync Theme to DOM
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
    localStorage.setItem("theme_mode", theme);
  }, [theme]);

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type, visible: true });
  };

  const closeToast = () => {
    setToast(prev => ({ ...prev, visible: false }));
  };

  // Persist Config
  useEffect(() => {
    localStorage.setItem("label_printer_config", JSON.stringify(config));
  }, [config]);

  // Handlers
  const handleConfigChange = (updates: Partial<HelperLayoutConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...updates };
      // 动态行列限制与自动修正
      if (updates.orientation) {
        const isPortrait = next.orientation === 'portrait';
        const maxR = isPortrait ? 20 : 10;
        const maxC = isPortrait ? 10 : 20;
        next.rows = Math.min(next.rows, maxR);
        next.cols = Math.min(next.cols, maxC);
      }
      return next;
    });
  };

  const handleFilesSelect = (files: File[]) => {
    let FilesToProcess = files;
    if (files.length > 10) {
      showToast(t('limit_reached'), 'warning');
      FilesToProcess = files.slice(0, 10);
    }

    const totalSlots = config.rows * config.cols;
    const numFiles = FilesToProcess.length;

    const newItems: ImageItem[] = FilesToProcess.map((file, idx) => {
      let initialCount = 1;

      if (numFiles === 1) {
        // 单图模式：初始填满全页
        initialCount = totalSlots;
      } else if (numFiles > 1) {
        // 多图模式：平分格子，最后一份拿余数
        const baseCount = Math.floor(totalSlots / numFiles);
        initialCount = (idx === numFiles - 1)
          ? totalSlots - (baseCount * (numFiles - 1))
          : baseCount;
      }

      // 兜底
      if (initialCount <= 0) initialCount = 1;

      return {
        id: Math.random().toString(36).substring(2, 9),
        file,
        count: initialCount
      };
    });

    setImageItems(newItems);
  };

  const handleItemCountChange = (id: string, count: number) => {
    setImageItems(prev => prev.map(item => item.id === id ? { ...item, count } : item));
  };


  const handleGenerateValues = async () => {
    if (appMode === 'image' && imageItems.length === 0) return;
    setGenStatus('generating');
    setGenProgress(0);
    try {
      await generatePDF(config, imageItems, appMode, textConfig, (p: number) => setGenProgress(p));
      setGenStatus('success');
      // Auto reset after 2.5s
      setTimeout(() => setGenStatus('idle'), 2500);
    } catch (e) {
      setGenStatus('error');
      showToast(t('gen_failed') + ": " + (e as Error).message, 'error');
      setTimeout(() => setGenStatus('idle'), 3000);
    }
  };

  return (
    <Layout>
      <Header 
        theme={theme} 
        onThemeChange={setTheme} 
        config={config} 
        onConfigChange={handleConfigChange}
        appMode={appMode}
        onAppModeChange={setAppMode}
      />
      <main className="flex-1 flex overflow-hidden">
        <ControlPanel
          config={config}
          onConfigChange={handleConfigChange}
          onFilesSelect={handleFilesSelect}
          imageItems={imageItems}
          onReorder={setImageItems}
          onItemCountChange={handleItemCountChange}
          onGeneratePdf={handleGenerateValues}
          genStatus={genStatus}
          genProgress={genProgress}
          maxRows={config.orientation === 'portrait' ? 20 : 10}
          maxCols={config.orientation === 'portrait' ? 10 : 20}
          appMode={appMode}
          textConfig={textConfig}
          onTextConfigChange={(updates) => setTextConfig(prev => ({ ...prev, ...updates }))}
        />
        <PreviewPanel
          config={config}
          imageItems={imageItems}
          appMode={appMode}
          textConfig={textConfig}
        />
      </main>

      {/* PWA Update Prompt */}
      <ReloadPrompt />

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.visible}
        onClose={closeToast}
      />
    </Layout>
  );
}

export default App;
