import { useState, useEffect, useRef } from "react";
import { Header } from "./components/Header";
import { ControlPanel } from "./components/ControlPanel";
import { PreviewPanel } from "./components/PreviewPanel";
import { ReloadPrompt } from "./components/ReloadPrompt";
import { useStore } from "./store/useStore";
import { useShallow } from "zustand/shallow";
import { generatePDF } from "./utils/pdfGenerator";
import { Toast, type ToastType } from "./components/Toast";
import { useI18n } from "./utils/i18nContext";
import type { Translations } from "./utils/i18nContext";
import { AppError } from "./utils/appError";
import {
  validateImageFileContents,
  validateImageFiles,
} from "./utils/imageLimits";
import type { PdfProgressPhase } from "./utils/pdfProgress";

function App() {
  const { t } = useI18n();
  const { config, imageItems, setImageItems, appMode, textConfig, theme } =
    useStore(
      useShallow((state) => ({
        config: state.config,
        imageItems: state.imageItems,
        setImageItems: state.setImageItems,
        appMode: state.appMode,
        textConfig: state.textConfig,
        theme: state.theme,
      })),
    );

  // Toast State
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
    visible: boolean;
  }>({
    message: "",
    type: "success",
    visible: false,
  });

  const [genStatus, setGenStatus] = useState<
    "idle" | "generating" | "success" | "error"
  >("idle");
  const [genProgress, setGenProgress] = useState(0);
  const [genPhase, setGenPhase] = useState<PdfProgressPhase>("preparing");
  const resetTimerRef = useRef<number | null>(null);
  const generationControllerRef = useRef<AbortController | null>(null);

  // Theme Side Effect
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      root.setAttribute(
        "data-theme",
        theme === "system" ? (media.matches ? "dark" : "light") : theme,
      );
    };

    applyTheme();
    if (theme === "system") media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [theme]);

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type, visible: true });
  };

  const handleFilesSelect = async (files: File[]) => {
    try {
      validateImageFiles([...imageItems.map((item) => item.file), ...files]);
      await validateImageFileContents(files);
    } catch (error) {
      showToast(getLocalizedError(error), "error");
      return;
    }

    const defaultCount = config.rows * config.cols;
    const newItems = files.map((file) => ({
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2, 11),
      file,
      count: defaultCount,
    }));
    setImageItems([...imageItems, ...newItems]);
  };

  const handleGeneratePdf = async () => {
    if (genStatus === "generating") return;
    const controller = new AbortController();
    generationControllerRef.current = controller;
    try {
      setGenStatus("generating");
      setGenProgress(0);
      setGenPhase(appMode === "image" ? "reading" : "preparing");
      await generatePDF(
        config,
        imageItems,
        appMode,
        textConfig,
        (update) => {
          setGenProgress(update.percent);
          setGenPhase(update.phase);
        },
        { signal: controller.signal },
      );
      setGenStatus("success");
      // Auto reset after 2.5s
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = window.setTimeout(
        () => setGenStatus("idle"),
        2500,
      );
    } catch (e) {
      if (e instanceof AppError && e.code === "generation_cancelled") {
        setGenStatus("idle");
        setGenProgress(0);
        showToast(t("generation_cancelled"), "warning");
        return;
      }
      setGenStatus("error");
      showToast(`${t("gen_failed")}: ${getLocalizedError(e)}`, "error");
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = window.setTimeout(
        () => setGenStatus("idle"),
        3000,
      );
    } finally {
      if (generationControllerRef.current === controller) {
        generationControllerRef.current = null;
      }
    }
  };

  const getLocalizedError = (error: unknown) => {
    if (error instanceof AppError) {
      return t(error.code as keyof Translations, error.params);
    }
    return error instanceof Error ? error.message : String(error);
  };

  const handleCancelPdf = () => generationControllerRef.current?.abort();

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
      generationControllerRef.current?.abort();
    };
  }, []);

  return (
    <div className="safe-area-app min-h-app flex flex-col overflow-y-auto bg-background text-text-main selection:bg-brand-primary/20 lg:h-dvh lg:overflow-hidden">
      <Header />

      <main className="flex flex-1 flex-col gap-3 overflow-visible p-2 lg:min-h-0 lg:flex-row lg:overflow-hidden lg:p-3">
        <div className="flex w-full shrink-0 flex-col gap-3 scrollbar-hide lg:h-full lg:w-80">
          <ControlPanel
            onFilesSelect={handleFilesSelect}
            onGeneratePdf={handleGeneratePdf}
            onCancelPdf={handleCancelPdf}
            genStatus={genStatus}
            genProgress={genProgress}
            genPhase={genPhase}
          />
        </div>

        <div className="min-h-[65dvh] min-w-0 flex-1 lg:min-h-0">
          <PreviewPanel />
        </div>
      </main>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.visible}
        onClose={() => setToast((prev) => ({ ...prev, visible: false }))}
      />

      <ReloadPrompt />
    </div>
  );
}

export default App;
