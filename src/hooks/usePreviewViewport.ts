import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { HelperLayoutConfig } from "../utils/layoutMath";
import { resolvePageDimensions } from "../utils/layoutMath";

const MM_TO_PX = 96 / 25.4;

interface PanStart {
  x: number;
  y: number;
  scrollLeft: number;
  scrollTop: number;
}

export function usePreviewViewport(config: HelperLayoutConfig) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<PanStart | null>(null);
  const [baseFitScale, setBaseFitScale] = useState(0.8);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    const updateFitScale = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth - 20;
      const containerHeight = containerRef.current.clientHeight - 20;
      const { pageWidth, pageHeight } = resolvePageDimensions(config);
      setBaseFitScale(
        Math.min(
          containerWidth / (pageWidth * MM_TO_PX),
          containerHeight / (pageHeight * MM_TO_PX),
        ),
      );
    };

    updateFitScale();
    const node = containerRef.current;
    if (node && "ResizeObserver" in window) {
      const observer = new ResizeObserver(updateFitScale);
      observer.observe(node);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateFitScale);
    return () => window.removeEventListener("resize", updateFitScale);
  }, [config]);

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!containerRef.current || event.button !== 0) return;
      event.preventDefault();
      panStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        scrollLeft: containerRef.current.scrollLeft,
        scrollTop: containerRef.current.scrollTop,
      };
      setIsPanning(true);
    },
    [],
  );

  useEffect(() => {
    if (!isPanning) return;

    const handleMouseMove = (event: MouseEvent) => {
      const start = panStartRef.current;
      const container = containerRef.current;
      if (!start || !container) return;
      container.scrollLeft = start.scrollLeft - (event.clientX - start.x);
      container.scrollTop = start.scrollTop - (event.clientY - start.y);
    };
    const handleMouseUp = () => {
      panStartRef.current = null;
      setIsPanning(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isPanning]);

  return { containerRef, baseFitScale, isPanning, handleMouseDown };
}
