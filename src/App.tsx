import { useState, useEffect, useMemo } from "react";
import { Layout } from "./components/Layout";
import { Header } from "./components/Header";
import { ControlPanel } from "./components/ControlPanel";
import { PreviewPanel } from "./components/PreviewPanel";
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
};

export interface ImageItem {
  id: string;
  file: File;
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

  // 响应式派生：根据语言和图片数量自动计算显示文本
  const selectedFileName = useMemo(() => {
    if (imageItems.length === 0) return "";
    if (imageItems.length === 1) return imageItems[0].file.name;
    return t('files_selected', { n: imageItems.length });
  }, [imageItems, t]);

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: ToastType; visible: boolean }>({
    message: "",
    type: "success",
    visible: false
  });

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
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const handleFilesSelect = (files: File[]) => {
    const totalSlots = config.rows * config.cols;
    const numFiles = files.length;

    const newItems: ImageItem[] = files.map((file, idx) => {
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
    if (imageItems.length === 0) return;
    try {
      await generatePDF(config, imageItems);
      showToast(t('gen_success'), 'success');
    } catch (e) {
      showToast(t('gen_failed') + ": " + (e as Error).message, 'error');
    }
  };

  return (
    <Layout>
      <Header />
      <main className="flex-1 flex overflow-hidden">
        <ControlPanel
          config={config}
          onConfigChange={handleConfigChange}
          onFilesSelect={handleFilesSelect}
          imageItems={imageItems}
          onReorder={setImageItems}
          onItemCountChange={handleItemCountChange}
          selectedFileName={selectedFileName}
          onGeneratePdf={handleGenerateValues}
        />
        <PreviewPanel
          config={config}
          imageItems={imageItems}
        />
      </main>

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
