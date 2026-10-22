import { useCallback, useState, useEffect, useRef } from "react";
import { useShallow } from "zustand/shallow";

import { CalibrationDialog } from "./components/CalibrationDialog";
import type { CalibrationDialogSource } from "./components/CalibrationDialog";
import { ControlPanel } from "./components/ControlPanel";
import { EditSheet } from "./components/EditSheet";
import { GuidedTour } from "./components/GuidedTour";
import { Header } from "./components/Header";
import { MobileActionBar } from "./components/MobileActionBar";
import { PreviewPanel } from "./components/PreviewPanel";
import { ReloadPrompt } from "./components/ReloadPrompt";
import { Toast, type ToastType } from "./components/Toast";
import { UsageGuide } from "./components/UsageGuide";
import { useFrameProgress } from "./hooks/useFrameProgress";
import { useGenerationReadiness } from "./hooks/useGenerationReadiness";
import { PERSIST_STORAGE_KEY, useStore } from "./store/useStore";
import { AppError } from "./utils/appError";
import type { GenerationStatus } from "./utils/generation";
import {
  findVisibleTourTarget,
  getTourSteps,
  markGuidedTourSeen,
  shouldShowGuidedTour,
  type TourStep,
} from "./utils/guidedTour";
import { useI18n } from "./utils/i18nContext";
import type { Translations } from "./utils/i18nContext";
import { generatePDF } from "./utils/pdfGenerator";
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
    appMode,
    textConfig,
    theme,
    screenCalibration,
    setScreenCalibration,
  } = useStore(
    useShallow((state) => ({
      config: state.config,
      imageItems: state.imageItems,
      appMode: state.appMode,
      textConfig: state.textConfig,
      theme: state.theme,
      screenCalibration: state.screenCalibration,
      setScreenCalibration: state.setScreenCalibration,
    })),
  );

  // Toast State
  const [toast, setToast] = useState<{
    eventId: number;
    message: string;
    type: ToastType;
    visible: boolean;
  }>({
    eventId: 0,
    message: "",
    type: "success",
    visible: false,
  });

  const [genStatus, setGenStatus] = useState<GenerationStatus>("idle");
  const {
    progress,
    start: startProgress,
    update: updateProgress,
    finish: finishProgress,
    cancel: cancelProgress,
  } = useFrameProgress();
  const { percent: genProgress, phase: genPhase } = progress;
  const resetTimerRef = useRef<number | null>(null);
  const generationControllerRef = useRef<AbortController | null>(null);

  // 移动端编辑面板状态（<lg 生效）
  const [editOpen, setEditOpen] = useState(false);
  const [editFull, setEditFull] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => !window.matchMedia("(min-width: 1024px)").matches,
  );
  const [tourActive, setTourActive] = useState(() =>
    shouldShowGuidedTour(PERSIST_STORAGE_KEY),
  );
  const [tourStep, setTourStep] = useState<TourStep>(() =>
    window.matchMedia("(min-width: 1024px)").matches ? "content" : "edit",
  );
  const [tourHost, setTourHost] = useState<HTMLDivElement | null>(null);
  const guideLauncherRef = useRef<HTMLElement | null>(null);
  const tourSnapshotRef = useRef<{
    open: boolean;
    full: boolean;
    focus: HTMLElement | null;
  } | null>(null);
  if (tourSnapshotRef.current === null) {
    tourSnapshotRef.current = {
      open: editOpen,
      full: editFull,
      focus:
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null,
    };
  }
  const tourSteps = getTourSteps(isMobile);
  const displayedTourStep =
    !isMobile && tourStep === "edit"
      ? "content"
      : isMobile && tourStep === "zoom"
        ? "preview"
        : tourStep;
  const displayedTourIndex = tourSteps.indexOf(displayedTourStep);
  const tourInSheet =
    tourActive &&
    isMobile &&
    (displayedTourStep === "content" || displayedTourStep === "layout");

  const endTour = useCallback(
    (reason: "complete" | "dismiss" | "guide" | "calibration" | "generate") => {
      if (reason === "complete" || reason === "dismiss") markGuidedTourSeen();
      const restoreFocus = reason !== "guide" && reason !== "calibration";
      const snapshot = tourSnapshotRef.current;
      if (!snapshot) return;
      // AnimatePresence keeps a closing sheet connected until its exit finishes.
      // Its controls need restoration just like the tour, even while still mounted.
      const closingSheet =
        isMobile && snapshot.open ? null : tourHost?.closest('[role="dialog"]');
      setTourActive(false);
      setEditOpen(isMobile && snapshot.open);
      setEditFull(snapshot.full);
      requestAnimationFrame(() => {
        if (!restoreFocus) return;
        const current = document.activeElement;
        if (
          current instanceof HTMLElement &&
          current.isConnected &&
          current !== document.body &&
          !current.closest("[data-tour-overlay]") &&
          !closingSheet?.contains(current)
        )
          return;
        const target = snapshot.focus;
        if (
          target?.isConnected &&
          target !== document.body &&
          target.getClientRects().length
        )
          target.focus();
        else {
          const fallback = findVisibleTourTarget(
            isMobile && snapshot.open ? "content" : "preview",
          );
          (
            fallback ?? document.querySelector<HTMLElement>("header button")
          )?.focus();
        }
      });
    },
    [isMobile, tourHost],
  );
  const openTour = () => {
    if (generationControllerRef.current) return;
    const focus = guideLauncherRef.current;
    setGuideOpen(false);
    // Let the guide restore its launcher before capturing a new tour session.
    requestAnimationFrame(() => {
      if (generationControllerRef.current) return;
      tourSnapshotRef.current = { open: editOpen, full: editFull, focus };
      setTourStep(isMobile ? "edit" : "content");
      setEditOpen(false);
      setTourActive(true);
    });
  };
  const goToTourStep = (step: TourStep) => {
    setTourStep(step);
    setEditOpen(isMobile && (step === "content" || step === "layout"));
    if (isMobile && (step === "content" || step === "layout"))
      setEditFull(false);
  };
  useEffect(() => {
    if (!tourActive || tourInSheet) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        endTour("dismiss");
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [tourActive, tourInSheet, endTour]);
  // 预览缩放三态与 1:1 校准（非持久化）
  const [zoomMode, setZoomMode] = useState<ZoomMode>("fit");
  const [manualScale, setManualScale] = useState(1);
  const [calibrationSource, setCalibrationSource] =
    useState<CalibrationDialogSource | null>(null);
  // 每次打开对话框递增，用于强制重挂载以按当前校准值预填草稿
  const [calibrationNonce, setCalibrationNonce] = useState(0);

  const showToast = useCallback((message: string, type: ToastType) => {
    setToast((previous) => ({
      eventId: previous.eventId + 1,
      message,
      type,
      visible: true,
    }));
  }, []);

  const openCalibration = useCallback(
    (source: CalibrationDialogSource) => {
      if (tourActive) endTour("calibration");
      setCalibrationNonce((nonce) => nonce + 1);
      setCalibrationSource(source);
    },
    [tourActive, endTour],
  );

  // 1:1 请求：未校准或环境失效时打开校准对话框，否则直接进入 actual
  const handleRequestActual = useCallback(() => {
    if (
      !screenCalibration ||
      isCalibrationStale(screenCalibration, getCurrentScreenEnvironment())
    ) {
      openCalibration("zoom");
      return;
    }
    setZoomMode("actual");
  }, [screenCalibration, openCalibration]);

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

  useEffect(() => {
    const desktopMedia = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      const mobile = !desktopMedia.matches;
      setIsMobile(mobile);
      if (!mobile) {
        setEditOpen(false);
        setEditFull(false);
        if (tourActive && tourStep === "edit") setTourStep("content");
      } else if (tourActive) {
        setEditOpen(tourStep === "content" || tourStep === "layout");
        setEditFull(false);
      }
    };
    update();
    desktopMedia.addEventListener("change", update);
    return () => desktopMedia.removeEventListener("change", update);
  }, [tourActive, tourStep]);

  // 生成就绪度：与桌面 ControlPanel 共用同一判定来源
  const readiness = useGenerationReadiness(
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

  const getLocalizedError = useCallback(
    (error: unknown) => {
      if (error instanceof AppError) {
        return t(error.code as keyof Translations, error.params);
      }
      return error instanceof Error ? error.message : String(error);
    },
    [t],
  );

  const handleFilesSelect = useCallback(
    async (files: File[]) => {
      if (generationControllerRef.current) return;
      try {
        await useStore.getState().addImageFiles(files);
      } catch (error) {
        showToast(getLocalizedError(error), "error");
      }
    },
    [showToast, getLocalizedError],
  );

  const handleStartNumbering = useCallback(() => {
    if (generationControllerRef.current) return;
    useStore.getState().setAppMode("text");
    if (isMobile) {
      setEditOpen(true);
      if (tourActive) setTourStep("content");
    }
  }, [isMobile, tourActive]);

  const handleGeneratePdf = async () => {
    if (genStatus === "generating") return;
    if (tourActive) endTour("generate");
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    const controller = new AbortController();
    generationControllerRef.current = controller;
    const run = startProgress({
      percent: 0,
      phase: appMode === "image" ? "reading" : "preparing",
    });
    try {
      setGenStatus("generating");
      await generatePDF(
        config,
        imageItems,
        appMode,
        textConfig,
        (update) => {
          updateProgress(run, update);
        },
        { signal: controller.signal },
      );
      if (generationControllerRef.current !== controller) return;
      finishProgress(run);
      setGenStatus("success");
      // Auto reset after 2.5s
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = window.setTimeout(() => {
        resetTimerRef.current = null;
        cancelProgress();
        setGenStatus("idle");
      }, 2500);
    } catch (e) {
      if (generationControllerRef.current !== controller) return;
      cancelProgress();
      if (e instanceof AppError && e.code === "generation_cancelled") {
        setGenStatus("idle");
        startProgress({ percent: 0, phase: "preparing" });
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
        cancelProgress();
        setGenStatus("idle");
      }, 3000);
    } finally {
      if (generationControllerRef.current === controller) {
        generationControllerRef.current = null;
      }
    }
  };

  const handleCancelPdf = () => {
    cancelProgress();
    generationControllerRef.current?.abort();
  };

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
      generationControllerRef.current?.abort();
      generationControllerRef.current = null;
    };
  }, []);

  return (
    <div className="safe-area-app flex h-dvh flex-col overflow-hidden bg-background text-text-main selection:bg-brand-primary/20">
      <Header
        onOpenGuide={() => {
          if (tourActive) endTour("guide");
          guideLauncherRef.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
          setGuideOpen(true);
        }}
        onOpenCalibration={() => openCalibration("settings")}
        isGenerating={genStatus === "generating"}
      />

      <main className="flex flex-1 min-h-0 flex-col gap-3 p-2 lg:flex-row lg:overflow-hidden lg:p-3">
        {/* 桌面控制面板（<lg 隐藏，由 EditSheet 承担） */}
        <div className="hidden shrink-0 flex-col gap-3 scrollbar-hide lg:flex lg:h-full lg:w-80">
          <ControlPanel
            readiness={readiness}
            onFilesSelect={handleFilesSelect}
            onGeneratePdf={handleGeneratePdf}
            onCancelPdf={handleCancelPdf}
            genStatus={genStatus}
            genProgress={genProgress}
            genPhase={genPhase}
            isGenerating={genStatus === "generating"}
          />
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <div className="min-h-0 flex-1">
            <PreviewPanel
              tourActive={tourActive}
              zoomMode={zoomMode}
              manualScale={manualScale}
              onZoomModeChange={setZoomMode}
              onManualScaleChange={setManualScale}
              onRequestActual={handleRequestActual}
              onFilesSelect={handleFilesSelect}
              onStartNumbering={handleStartNumbering}
            />
          </div>
          <MobileActionBar
            onOpenEdit={() => {
              setEditOpen(true);
              if (tourActive) goToTourStep("content");
            }}
            onGenerate={handleGeneratePdf}
            onCancel={handleCancelPdf}
            editDisabled={genStatus === "generating"}
            disabled={!readiness.canGenerate}
            genStatus={genStatus}
            genProgress={genProgress}
            genPhase={genPhase}
          />
        </div>
      </main>

      <EditSheet
        readiness={readiness}
        open={editOpen}
        full={editFull}
        onClose={() => {
          setEditOpen(false);
          if (tourActive) goToTourStep("preview");
        }}
        onEscape={tourInSheet ? () => endTour("dismiss") : undefined}
        onTourHostChange={setTourHost}
        onToggleFull={() => setEditFull((full) => !full)}
        onFilesSelect={handleFilesSelect}
        isGenerating={genStatus === "generating"}
      />

      <CalibrationDialog
        key={calibrationNonce}
        open={calibrationSource !== null}
        source={calibrationSource ?? "zoom"}
        environmentMismatch={calibrationMismatch}
        onClose={handleCalibrationClose}
        onSaved={handleCalibrationSaved}
      />

      <UsageGuide
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        onRestartTour={openTour}
        isGenerating={genStatus === "generating"}
      />
      <GuidedTour
        open={tourActive && (!tourInSheet || tourHost !== null)}
        steps={tourSteps}
        stepIndex={displayedTourIndex}
        appMode={appMode}
        portalHost={tourInSheet ? tourHost : null}
        onNext={() => {
          const next = tourSteps[displayedTourIndex + 1];
          if (next) goToTourStep(next);
          else endTour("complete");
        }}
        onBack={() => {
          const previous = tourSteps[displayedTourIndex - 1];
          if (previous) goToTourStep(previous);
        }}
        onClose={() => endTour("dismiss")}
      />

      <Toast
        eventId={toast.eventId}
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
