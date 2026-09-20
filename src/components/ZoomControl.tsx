import { Maximize } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import type {
  Dispatch,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
} from "react";

import { useI18n } from "../utils/i18nContext";
import {
  getThumbBottomPct,
  mapPctToScale,
  MAX_SCALE,
  MIN_SCALE,
} from "../utils/zoomMath";
import type { ZoomMode } from "../utils/zoomMath";
import { IconButton } from "./ui/IconButton";

interface ZoomControlProps {
  zoomMode: ZoomMode;
  manualScale: number;
  onZoomModeChange: (mode: ZoomMode) => void;
  onManualScaleChange: Dispatch<SetStateAction<number>>;
  onRequestActual: () => void;
  onInteractionChange?: (isDragging: boolean) => void;
}

export function ZoomControl({
  zoomMode,
  manualScale,
  onZoomModeChange,
  onManualScaleChange,
  onRequestActual,
  onInteractionChange,
}: ZoomControlProps) {
  const { t } = useI18n();
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const zoomHintId = useId();

  const isActual = zoomMode === "actual";

  // 手动缩放（滑杆/键盘）统一进入 manual
  const enterManual = useCallback(
    (next: number) => {
      onManualScaleChange(Math.min(MAX_SCALE, Math.max(MIN_SCALE, next)));
      onZoomModeChange("manual");
    },
    [onManualScaleChange, onZoomModeChange],
  );

  const handleSliderChange = useCallback(
    (clientY: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const percentage = 1 - (clientY - rect.top) / rect.height;
      enterManual(mapPctToScale(percentage));
    },
    [enterManual],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDragging(true);
      onInteractionChange?.(true);
      handleSliderChange(event.clientY);
    },
    [handleSliderChange, onInteractionChange],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      event.preventDefault();
      handleSliderChange(event.clientY);
    },
    [handleSliderChange, isDragging],
  );

  const handlePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);
      onInteractionChange?.(false);
    },
    [isDragging, onInteractionChange],
  );

  const handleReset = () => {
    onManualScaleChange(1);
    onZoomModeChange("fit");
  };

  const displayLabel = isActual
    ? t("zoom_actual_short")
    : `${Math.round(manualScale * 100)}%`;
  const ariaValueText = displayLabel;
  const thumbScale = isActual ? 1 : manualScale;

  return (
    <div
      className="preview-controls absolute bottom-2 left-2 z-20 flex flex-col items-center gap-3"
      data-interacting={isDragging}
    >
      <IconButton
        aria-label={t("zoom_reset")}
        onClick={handleReset}
        size="md"
        tone="elevated"
        expandedHitArea
        title={t("zoom_reset")}
      >
        <Maximize />
      </IconButton>

      {/* 1:1 实际尺寸（仅桌面断点显示，文字按钮更易识别） */}
      <button
        type="button"
        aria-label={t("zoom_actual")}
        aria-pressed={isActual}
        onClick={onRequestActual}
        className={`hit-target hidden h-9 min-w-9 items-center justify-center rounded-md border px-1.5 font-mono text-xs font-bold tabular-nums transition-colors [--hit-target-inset:-5px] lg:flex ${
          isActual
            ? "border-brand-primary bg-brand-primary text-on-brand"
            : "border-border-subtle bg-elevated text-text-muted enabled:hover:text-brand-primary"
        }`}
        title={t("zoom_actual_hint")}
      >
        {t("zoom_actual_short")}
      </button>

      <div
        role="slider"
        tabIndex={0}
        aria-label={t("zoom_level")}
        aria-orientation="vertical"
        aria-valuemin={Math.round(MIN_SCALE * 100)}
        aria-valuemax={Math.round(MAX_SCALE * 100)}
        aria-valuenow={isActual ? 100 : Math.round(manualScale * 100)}
        aria-valuetext={ariaValueText}
        aria-describedby={zoomHintId}
        onKeyDown={(event) => {
          if (event.key === "Home") enterManual(MIN_SCALE);
          else if (event.key === "End") enterManual(MAX_SCALE);
          else if (event.key === "ArrowUp" || event.key === "ArrowRight") {
            enterManual(manualScale + 0.1);
          } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
            enterManual(manualScale - 0.1);
          } else {
            return;
          }
          event.preventDefault();
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        className="relative flex h-40 w-10 cursor-ns-resize touch-none flex-col items-center rounded-md border border-border-subtle bg-elevated p-1.5"
      >
        <div
          ref={trackRef}
          className="pointer-events-none relative h-full w-1.5 rounded bg-text-main/10"
        >
          <div
            className={`pointer-events-none absolute left-1/2 h-4 w-4 -translate-x-1/2 rounded border-2 border-brand-primary bg-white ${isDragging ? "transition-none" : "transition-[bottom] duration-150"}`}
            style={{
              bottom: `${getThumbBottomPct(thumbScale)}%`,
              marginBottom: "-8px",
            }}
          />
        </div>
      </div>
      <span
        aria-hidden="true"
        title={t(isActual ? "zoom_actual_hint" : "zoom_relative_hint")}
        className="pointer-events-auto -mt-1 rounded bg-elevated px-1 py-0.5 font-mono text-xs font-semibold tabular-nums text-text-main"
      >
        {displayLabel}
      </span>
      <span id={zoomHintId} className="sr-only">
        {t(isActual ? "zoom_actual_hint" : "zoom_relative_hint")}
      </span>
    </div>
  );
}
