import { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { ControlPanel } from "./components/ControlPanel";
import { PreviewPanel } from "./components/PreviewPanel";
import { ReloadPrompt } from "./components/ReloadPrompt";
import { OrientationGuard } from "./components/OrientationGuard";
import { useStore } from "./store/useStore";
import { generatePDF } from "./utils/pdfGenerator";
import { Toast, type ToastType } from "./components/Toast";
import { useI18n } from "./utils/i18n";


function App() {
  const { t } = useI18n();
  const {
    config,
    imageItems, setImageItems,
    appMode,
    textConfig,
    theme
  } = useStore();

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: ToastType; visible: boolean }>({
    message: "",
    type: "success",
    visible: false
  });

  const [genStatus, setGenStatus] = useState<'idle' | 'generating' | 'success' | 'error'>('idle');
  const [genProgress, setGenProgress] = useState(0);

  // Theme Side Effect
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type, visible: true });
  };

  const handleFilesSelect = (files: File[]) => {
    const defaultCount = config.rows * config.cols;
    const newItems = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      count: defaultCount
    }));
    setImageItems([...imageItems, ...newItems]);
  };

  const handleGeneratePdf = async () => {
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
    <div className="flex flex-col h-screen overflow-hidden bg-background text-text-main selection:bg-brand-primary/20">
      <Header />

      <main className="flex-1 flex overflow-hidden p-3 gap-3">
        <div className="w-80 flex flex-col gap-3 scrollbar-hide">
          <ControlPanel
            onFilesSelect={handleFilesSelect}
            onGeneratePdf={handleGeneratePdf}
            genStatus={genStatus}
            genProgress={genProgress}
          />
        </div>

        <div className="flex-1 min-w-0">
          <PreviewPanel />
        </div>
      </main>

      {toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={toast.visible}
          onClose={() => setToast(prev => ({ ...prev, visible: false }))}
        />
      )}

      <ReloadPrompt />
      <OrientationGuard />
    </div>
  );
}

export default App;
