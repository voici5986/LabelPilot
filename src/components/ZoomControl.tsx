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

interface ZoomControlProps {
  scale: number;
  setScale: Dispatch<SetStateAction<number>>;
}

type SliderEvent = ReactMouseEvent | ReactTouchEvent | MouseEvent | TouchEvent;

export function ZoomControl({ scale, setScale }: ZoomControlProps) {
  const { t } = useI18n();
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleSliderChange = useCallback(
    (event: SliderEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const clientY =
        "touches" in event ? event.touches[0].clientY : event.clientY;
      const percentage = 1 - (clientY - rect.top) / rect.height;
      setScale(mapPctToScale(percentage));
    },
    [setScale],
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

  return (
    <div
      className="absolute bottom-2 left-2 z-20 flex flex-col items-center gap-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type="button"
        aria-label={t("zoom_reset")}
        onClick={() => setScale(1)}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-border-subtle bg-surface text-text-muted transition-colors hover:text-brand-primary"
        title={t("zoom_reset")}
      >
        <Maximize className="h-4 w-4" />
      </button>

      <div
        role="slider"
        tabIndex={0}
        aria-label={t("zoom_level")}
        aria-orientation="vertical"
        aria-valuemin={Math.round(MIN_SCALE * 100)}
        aria-valuemax={Math.round(MAX_SCALE * 100)}
        aria-valuenow={Math.round(scale * 100)}
        onKeyDown={(event) => {
          if (event.key === "Home") setScale(MIN_SCALE);
          else if (event.key === "End") setScale(MAX_SCALE);
          else if (event.key === "ArrowUp" || event.key === "ArrowRight") {
            setScale((current) => Math.min(MAX_SCALE, current + 0.1));
          } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
            setScale((current) => Math.max(MIN_SCALE, current - 0.1));
          } else {
            return;
          }
          event.preventDefault();
        }}
        className="relative flex h-40 w-8 flex-col items-center rounded-md border border-border-subtle bg-surface p-1.5"
      >
        {(isHovered || isDragging) && (
          <div className="pointer-events-none absolute left-10 top-1/2 z-30 -translate-y-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-sm font-semibold text-white">
            {Math.round(scale * 100)}%
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
              bottom: `${getThumbBottomPct(scale)}%`,
              marginBottom: "-8px",
            }}
          />
        </div>
      </div>
    </div>
  );
}
