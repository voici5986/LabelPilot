import { useCallback, useState, useEffect, useRef } from "react";
import { useShallow } from "zustand/shallow";

import { CalibrationDialog } from "./components/CalibrationDialog";
import type { CalibrationDialogSource } from "./components/CalibrationDialog";
import { ControlPanel } from "./components/ControlPanel";
import { EditSheet } from "./components/EditSheet";
import { Header } from "./components/Header";
import { MobileActionBar } from "./components/MobileActionBar";
import { PreviewPanel } from "./components/PreviewPanel";
import { ReloadPrompt } from "./components/ReloadPrompt";
import { Toast, type ToastType } from "./components/Toast";
import { useGenerationReadiness } from "./hooks/useGenerationReadiness";
import { useStore } from "./store/useStore";
import { AppError } from "./utils/appError";
import type { GenerationStatus } from "./utils/generation";
import { useI18n } from "./utils/i18nContext";
import type { Translations } from "./utils/i18nContext";
import {
  validateImageFileContents,
  validateImageFiles,
} from "./utils/imageLimits";
import { generatePDF } from "./utils/pdfGenerator";
import type { PdfProgressPhase } from "./utils/pdfProgress";
import {
  getCurrentScreenEnvironment,
  isCalibrationStale,
} from "./utils/screenCalibration";
import type { ScreenCalibration } from "./utils/screenCalibration";
import type { ZoomMode } from "./utils/zoomMath";

function App() {
  const { t } = useI18n();
  const {
    config,
    imageItems,
    setImageItems,
    appMode,
    textConfig,
    theme,
    screenCalibration,
    setScreenCalibration,
  } = useStore(
    useShallow((state) => ({
      config: state.config,
      imageItems: state.imageItems,
      setImageItems: state.setImageItems,
      appMode: state.appMode,
      textConfig: state.textConfig,
      theme: state.theme,
      screenCalibration: state.screenCalibration,
      setScreenCalibration: state.setScreenCalibration,
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

  // 预览缩放三态与 1:1 校准（非持久化）
  const [zoomMode, setZoomMode] = useState<ZoomMode>("fit");
  const [manualScale, setManualScale] = useState(1);
  const [calibrationSource, setCalibrationSource] =
    useState<CalibrationDialogSource | null>(null);
  // 每次打开对话框递增，用于强制重挂载以按当前校准值预填草稿
  const [calibrationNonce, setCalibrationNonce] = useState(0);

  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type, visible: true });
  }, []);

  const openCalibration = (source: CalibrationDialogSource) => {
    setCalibrationNonce((nonce) => nonce + 1);
    setCalibrationSource(source);
  };

  // 1:1 请求：未校准或环境失效时打开校准对话框，否则直接进入 actual
  const handleRequestActual = () => {
    if (
      !screenCalibration ||
      isCalibrationStale(screenCalibration, getCurrentScreenEnvironment())
    ) {
      openCalibration("zoom");
      return;
    }
    setZoomMode("actual");
  };

  // 对话框打开时，若已存校准与环境不符 → 显示重校提示、不预填旧测量值
  const calibrationMismatch =
    calibrationSource !== null &&
    !!screenCalibration &&
    isCalibrationStale(screenCalibration, getCurrentScreenEnvironment());

  const handleCalibrationSaved = (calibration: ScreenCalibration) => {
    setScreenCalibration(calibration);
    if (calibrationSource === "zoom") setZoomMode("actual");
    setCalibrationSource(null);
  };

  const handleCalibrationClose = () => setCalibrationSource(null);

  // 供环境监听读取最新的缩放模式（effect 闭包内取不到实时值）
  const zoomModeRef = useRef(zoomMode);
  useEffect(() => {
    zoomModeRef.current = zoomMode;
  }, [zoomMode]);

  // 环境变化监听：actual 中检测到 DPR/分辨率变化则退出到 fit、重置手动倍率并提示重校
  useEffect(() => {
    if (!screenCalibration) return;
    const check = () => {
      if (
        !isCalibrationStale(screenCalibration, getCurrentScreenEnvironment())
      ) {
        return;
      }
      if (zoomModeRef.current === "actual") {
        setManualScale(1);
        setZoomMode("fit");
        showToast(t("calib_stale_toast"), "warning");
      }
    };
    const handleVisibility = () => {
      if (!document.hidden) check();
    };
    let mql: MediaQueryList | null = null;
    const registerMql = () => {
      mql?.removeEventListener("change", handleMqlChange);
      mql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      mql.addEventListener("change", handleMqlChange);
    };
    const handleMqlChange = () => {
      check();
      registerMql();
    };
    registerMql();
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      mql?.removeEventListener("change", handleMqlChange);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [screenCalibration, t, showToast]);

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
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
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
      resetTimerRef.current = window.setTimeout(() => {
        resetTimerRef.current = null;
        setGenStatus("idle");
      }, 2500);
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
      resetTimerRef.current = window.setTimeout(() => {
        resetTimerRef.current = null;
        setGenStatus("idle");
      }, 3000);
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
      <Header onOpenCalibration={() => openCalibration("settings")} />

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
            <PreviewPanel
              zoomMode={zoomMode}
              manualScale={manualScale}
              onZoomModeChange={setZoomMode}
              onManualScaleChange={setManualScale}
              onRequestActual={handleRequestActual}
            />
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

      <CalibrationDialog
        key={calibrationNonce}
        open={calibrationSource !== null}
        source={calibrationSource ?? "zoom"}
        environmentMismatch={calibrationMismatch}
        onClose={handleCalibrationClose}
        onSaved={handleCalibrationSaved}
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
