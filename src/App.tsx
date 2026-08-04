import { useState, useEffect, useRef } from "react";
import { Header } from "./components/Header";
import { ControlPanel } from "./components/ControlPanel";
import { PreviewPanel } from "./components/PreviewPanel";
import { ReloadPrompt } from "./components/ReloadPrompt";
import { MobileActionBar } from "./components/MobileActionBar";
import { EditSheet } from "./components/EditSheet";
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
import type { GenerationStatus } from "./utils/generation";
import { useGenerationReadiness } from "./hooks/useGenerationReadiness";

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

  const [genStatus, setGenStatus] = useState<GenerationStatus>("idle");
  const [genProgress, setGenProgress] = useState(0);
  const [genPhase, setGenPhase] = useState<PdfProgressPhase>("preparing");
  const resetTimerRef = useRef<number | null>(null);
  const generationControllerRef = useRef<AbortController | null>(null);

  // 移动端编辑面板状态（<lg 生效）
  const [editOpen, setEditOpen] = useState(false);
  const [editFull, setEditFull] = useState(false);

  // 桌面布局不保留移动端 Sheet 状态，避免缩回移动端时重新出现旧面板。
  useEffect(() => {
    const desktopMedia = window.matchMedia("(min-width: 1024px)");
    const resetMobileSheetForDesktop = () => {
      if (!desktopMedia.matches) return;
      setEditOpen(false);
      setEditFull(false);
    };

    resetMobileSheetForDesktop();
    desktopMedia.addEventListener("change", resetMobileSheetForDesktop);
    return () =>
      desktopMedia.removeEventListener("change", resetMobileSheetForDesktop);
  }, []);

  // 生成就绪度：与桌面 ControlPanel 共用同一判定来源
  const { canGenerate: mobileCanGenerate } = useGenerationReadiness(
    config,
    appMode,
    imageItems,
    textConfig,
  );

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
    <div className="safe-area-app flex h-dvh flex-col overflow-hidden bg-background text-text-main selection:bg-brand-primary/20">
      <Header />

      <main className="flex flex-1 min-h-0 flex-col gap-3 p-2 lg:flex-row lg:overflow-hidden lg:p-3">
        {/* 桌面控制面板（<lg 隐藏，由 EditSheet 承担） */}
        <div className="hidden shrink-0 flex-col gap-3 scrollbar-hide lg:flex lg:h-full lg:w-80">
          <ControlPanel
            onFilesSelect={handleFilesSelect}
            onGeneratePdf={handleGeneratePdf}
            onCancelPdf={handleCancelPdf}
            genStatus={genStatus}
            genProgress={genProgress}
            genPhase={genPhase}
          />
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <div className="min-h-0 flex-1">
            <PreviewPanel />
          </div>
          <MobileActionBar
            onOpenEdit={() => setEditOpen(true)}
            onGenerate={handleGeneratePdf}
            onCancel={handleCancelPdf}
            disabled={!mobileCanGenerate}
            genStatus={genStatus}
            genProgress={genProgress}
            genPhase={genPhase}
          />
        </div>
      </main>

      <EditSheet
        open={editOpen}
        full={editFull}
        onClose={() => setEditOpen(false)}
        onToggleFull={() => setEditFull((full) => !full)}
        onFilesSelect={handleFilesSelect}
      />

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
