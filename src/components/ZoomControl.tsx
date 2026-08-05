import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Dispatch,
  MouseEvent as ReactMouseEvent,
  SetStateAction,
  TouchEvent as ReactTouchEvent,
} from "react";
import { Maximize } from "lucide-react";
import { useI18n } from "../utils/i18nContext";
import {
  getThumbBottomPct,
  mapPctToScale,
  MAX_SCALE,
  MIN_SCALE,
} from "../utils/zoomMath";
import type { ZoomMode } from "../utils/zoomMath";

interface ZoomControlProps {
  zoomMode: ZoomMode;
  manualScale: number;
  onZoomModeChange: (mode: ZoomMode) => void;
  onManualScaleChange: Dispatch<SetStateAction<number>>;
  onRequestActual: () => void;
}

type SliderEvent = ReactMouseEvent | ReactTouchEvent | MouseEvent | TouchEvent;

export function ZoomControl({
  zoomMode,
  manualScale,
  onZoomModeChange,
  onManualScaleChange,
  onRequestActual,
}: ZoomControlProps) {
  const { t } = useI18n();
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

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
    (event: SliderEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const clientY =
        "touches" in event ? event.touches[0].clientY : event.clientY;
      const percentage = 1 - (clientY - rect.top) / rect.height;
      enterManual(mapPctToScale(percentage));
    },
    [enterManual],
  );

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (event: MouseEvent | TouchEvent) =>
      handleSliderChange(event);
    const handleEnd = () => setIsDragging(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("touchend", handleEnd);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [handleSliderChange, isDragging]);

  const handleReset = () => {
    onManualScaleChange(1);
    onZoomModeChange("fit");
  };

  const displayLabel = isActual
    ? t("zoom_actual_short")
    : `${Math.round(manualScale * 100)}%`;

  return (
    <div
      className="absolute bottom-2 left-2 z-20 flex flex-col items-center gap-1.5"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type="button"
        aria-label={t("zoom_reset")}
        onClick={handleReset}
        className="hit-target flex h-8 w-8 items-center justify-center rounded-md border border-border-subtle bg-elevated text-text-muted transition-colors hover:text-brand-primary"
        title={t("zoom_reset")}
      >
        <Maximize className="h-4 w-4" />
      </button>

      {/* 1:1 实际尺寸（仅桌面断点显示，文字按钮更易识别） */}
      <button
        type="button"
        aria-label={t("zoom_actual")}
        aria-pressed={isActual}
        onClick={onRequestActual}
        className={`hit-target hidden h-8 min-w-8 items-center justify-center rounded-md border px-1.5 text-xs font-bold transition-colors lg:flex ${
          isActual
            ? "border-brand-primary bg-brand-primary text-on-brand"
            : "border-border-subtle bg-elevated text-text-muted hover:text-brand-primary"
        }`}
        title={t("zoom_actual")}
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
        aria-valuenow={Math.round(manualScale * 100)}
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
        className="relative flex h-40 w-10 flex-col items-center rounded-md border border-border-subtle bg-elevated p-1.5"
      >
        {(isHovered || isDragging) && (
          <div className="pointer-events-none absolute left-10 top-1/2 z-30 -translate-y-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-sm font-semibold text-white">
            {displayLabel}
          </div>
        )}

        <div
          ref={trackRef}
          className="relative h-full w-1.5 cursor-ns-resize rounded bg-text-main/10"
          onMouseDown={(event) => {
            setIsDragging(true);
            handleSliderChange(event);
          }}
          onTouchStart={(event) => {
            setIsDragging(true);
            handleSliderChange(event);
          }}
        >
          <div
            className="pointer-events-none absolute left-1/2 h-4 w-4 -translate-x-1/2 rounded border-2 border-brand-primary bg-white transition-[bottom] duration-150"
            style={{
              bottom: `${getThumbBottomPct(manualScale)}%`,
              marginBottom: "-8px",
            }}
          />
        </div>
      </div>
    </div>
  );
}
