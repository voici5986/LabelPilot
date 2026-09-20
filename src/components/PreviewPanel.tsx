import { AlertCircle } from "lucide-react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useShallow } from "zustand/shallow";

import { usePreviewViewport } from "../hooks/usePreviewViewport";
import { useStore } from "../store/useStore";
import { useI18n } from "../utils/i18nContext";
import type { Translations } from "../utils/i18nContext";
import {
  calculateLabelLayout,
  resolvePageDimensions,
  resolveItemAtSlot,
  formatLabelText,
  getLabelTextFontSizeMm,
  getTextLayoutBoxes,
} from "../utils/layoutMath";
import type { ZoomMode } from "../utils/zoomMath";
import { PageNavigator } from "./PageNavigator";
import { QrCodeSvg } from "./QrCodeSvg";
import { ZoomControl } from "./ZoomControl";

interface PreviewPanelProps {
  zoomMode: ZoomMode;
  manualScale: number;
  onZoomModeChange: (mode: ZoomMode) => void;
  onManualScaleChange: Dispatch<SetStateAction<number>>;
  onRequestActual: () => void;
}

interface ZoomFocus {
  paperPointX: number;
  paperPointY: number;
}

export function PreviewPanel({
  zoomMode,
  manualScale,
  onZoomModeChange,
  onManualScaleChange,
  onRequestActual,
}: PreviewPanelProps) {
  const {
    config,
    imageItems,
    imageUrlMap,
    appMode,
    textConfig,
    screenCalibration,
  } = useStore(
    useShallow((state) => ({
      config: state.config,
      imageItems: state.imageItems,
      imageUrlMap: state.imageUrlMap,
      appMode: state.appMode,
      textConfig: state.textConfig,
      screenCalibration: state.screenCalibration,
    })),
  );
  const { t } = useI18n();
  const { containerRef, baseFitScale, isPanning, handlePointerDown } =
    usePreviewViewport(config);
  const zoomDraggingRef = useRef(false);
  const paperRef = useRef<HTMLDivElement>(null);
  const zoomFocusRef = useRef<ZoomFocus>({
    paperPointX: 0.5,
    paperPointY: 0.5,
  });

  // 三态渲染倍率：actual 不读 baseFitScale，窗口/纸张变化不破坏 1:1
  const renderScale =
    zoomMode === "actual" && screenCalibration
      ? 1 / screenCalibration.k
      : baseFitScale * manualScale;

  const captureZoomFocus = useCallback(() => {
    const container = containerRef.current;
    const paper = paperRef.current;
    if (!container || !paper) return;

    const viewportRect = container.getBoundingClientRect();
    const paperRect = paper.getBoundingClientRect();
    const viewportX = viewportRect.left + container.clientWidth / 2;
    const viewportY = viewportRect.top + container.clientHeight / 2;

    zoomFocusRef.current = {
      paperPointX: Math.max(
        0,
        Math.min(1, (viewportX - paperRect.left) / paperRect.width),
      ),
      paperPointY: Math.max(
        0,
        Math.min(1, (viewportY - paperRect.top) / paperRect.height),
      ),
    };
  }, [containerRef]);

  const handleManualScaleChange = useCallback(
    (next: SetStateAction<number>) => {
      if (!zoomDraggingRef.current) captureZoomFocus();
      onManualScaleChange(next);
    },
    [captureZoomFocus, onManualScaleChange],
  );

  const handleZoomInteractionChange = useCallback(
    (isDragging: boolean) => {
      if (isDragging) captureZoomFocus();
      zoomDraggingRef.current = isDragging;
    },
    [captureZoomFocus],
  );

  const restoreZoomFocus = useCallback(() => {
    const focus = zoomFocusRef.current;
    const container = containerRef.current;
    const paper = paperRef.current;
    if (focus && container && paper) {
      const viewportRect = container.getBoundingClientRect();
      const paperRect = paper.getBoundingClientRect();
      const focusX = paperRect.left + paperRect.width * focus.paperPointX;
      const focusY = paperRect.top + paperRect.height * focus.paperPointY;
      container.scrollLeft +=
        focusX - (viewportRect.left + container.clientWidth / 2);
      container.scrollTop +=
        focusY - (viewportRect.top + container.clientHeight / 2);
    }
  }, [containerRef]);

  // CSS transform and scroll compensation are committed before the same paint.
  // This also covers entering actual size after the calibration dialog saves.
  useLayoutEffect(() => {
    if (zoomMode === "fit") {
      zoomFocusRef.current = { paperPointX: 0.5, paperPointY: 0.5 };
    }
    restoreZoomFocus();
  }, [renderScale, zoomMode, restoreZoomFocus]);

  const layout = useMemo(() => calculateLabelLayout(config), [config]);

  const totalCount = useMemo(() => {
    if (appMode === "image") {
      return imageItems.reduce((acc, item) => acc + item.count, 0);
    } else {
      return textConfig.count;
    }
  }, [imageItems, appMode, textConfig.count]);

  const slotsPerPage = Math.max(1, layout.positions.length);
  const totalPages = Math.max(1, Math.ceil(totalCount / slotsPerPage));
  const [pagination, setPagination] = useState({ pageIndex: 0, totalPages });
  if (pagination.totalPages !== totalPages) {
    setPagination({
      pageIndex: Math.min(pagination.pageIndex, totalPages - 1),
      totalPages,
    });
  }
  const currentPage = Math.min(pagination.pageIndex, totalPages - 1);
  const setPageIndex = (pageIndex: number) =>
    setPagination({ pageIndex, totalPages });

  const { pageWidth: paperWidthMm, pageHeight: paperHeightMm } =
    resolvePageDimensions(config);

  // Keep the scale bar compact using readable 1/2/5 mm steps at any zoom.
  const rulerMaxMm = 80 / (renderScale * (96 / 25.4));
  const rulerMagnitude = 10 ** Math.floor(Math.log10(rulerMaxMm));
  const rulerStep =
    [5, 2, 1].find((step) => step * rulerMagnitude <= rulerMaxMm) ?? 1;
  const rulerLengthMm = Number((rulerStep * rulerMagnitude).toPrecision(8));

  return (
    <section className="flex h-full flex-1 flex-col overflow-hidden">
      <div className="relative flex flex-1 flex-col overflow-hidden rounded-lg border border-border-subtle bg-surface font-sans">
        {/* Background Pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06] dark:opacity-[0.04]"
          style={{
            backgroundImage:
              "radial-gradient(var(--color-text-main) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        ></div>

        {/* Scrollable Area */}
        <div
          ref={containerRef}
          style={{ overflowAnchor: "none" }}
          onPointerDown={handlePointerDown}
          onScroll={() => {
            if (!zoomDraggingRef.current) captureZoomFocus();
          }}
          className={`flex-1 touch-none overflow-auto text-center p-2 scrollbar-thin scrollbar-thumb-text-main/20 select-none ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
        >
          {layout.error ? (
            <div className="flex h-full w-full items-center justify-center p-8">
              <div
                role="alert"
                className="flex flex-col items-center gap-3 rounded-lg border border-danger/20 bg-surface p-6 text-danger"
              >
                <AlertCircle className="w-10 h-10" />
                <div className="text-center">
                  <p className="font-medium text-lg">
                    {t("layout_error_title")}
                  </p>
                  <p className="text-sm">
                    {layout.error
                      ? t(layout.error.toLowerCase() as keyof Translations) ||
                        layout.error
                      : ""}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid min-h-full min-w-full w-max place-items-center">
              <div
                className="inline-block text-left align-top"
                style={{
                  width: `${paperWidthMm * renderScale}mm`,
                  height: `${paperHeightMm * renderScale}mm`,
                  marginTop: "0px",
                  position: "relative",
                }}
              >
                <div
                  className="absolute left-0 top-0 bg-white shadow-[0_12px_32px_-16px_rgba(0,0,0,0.35)]"
                  style={{
                    width: `${paperWidthMm}mm`,
                    height: `${paperHeightMm}mm`,
                    transformOrigin: "top left",
                    transform: `scale(${renderScale})`,
                    filter: `brightness(var(--paper-brightness))`,
                  }}
                  ref={paperRef}
                >
                  {layout.positions.map((pos, idx) => {
                    // 考虑分页的索引偏移
                    const globalIdx = currentPage * slotsPerPage + idx;

                    // 根据模式决定渲染内容
                    let content = null;
                    if (appMode === "image") {
                      const item = resolveItemAtSlot(globalIdx, imageItems);
                      const currentImageUrl = item
                        ? imageUrlMap.get(item.id)
                        : null;
                      if (currentImageUrl) {
                        content = (
                          <img
                            src={currentImageUrl}
                            className="w-full h-full object-contain pointer-events-none"
                            alt=""
                            draggable="false"
                          />
                        );
                      } else if (globalIdx < totalCount) {
                        content = (
                          <span className="text-[12px] text-text-muted font-medium select-none">
                            {t("preview_label", { index: globalIdx + 1 })}
                          </span>
                        );
                      }
                    } else if (globalIdx < totalCount) {
                      // 自动编号模式
                      const displayText = formatLabelText(
                        globalIdx,
                        textConfig,
                      );
                      const qrValue = `${textConfig.qrContentPrefix}${displayText}`;
                      const fontSizeMm = getLabelTextFontSizeMm(
                        displayText,
                        pos,
                        textConfig.showQrCode,
                      );
                      const {
                        qrDimMm,
                        qrTopMm,
                        qrLeftMm,
                        textBoxTopMm,
                        textBoxHeightMm,
                      } = getTextLayoutBoxes(
                        pos,
                        textConfig.showQrCode,
                        textConfig.qrSizeRatio,
                      );

                      content = (
                        <div className="w-full h-full text-center">
                          {textConfig.showQrCode && (
                            <div
                              className="absolute flex items-center justify-center"
                              style={{
                                left: `${qrLeftMm}mm`,
                                top: `${qrTopMm}mm`,
                                width: `${qrDimMm}mm`,
                                height: `${qrDimMm}mm`,
                              }}
                            >
                              <QrCodeSvg
                                value={qrValue}
                                className="h-full w-full"
                              />
                            </div>
                          )}
                          <div
                            className="absolute flex items-center justify-center w-full"
                            style={{
                              top: `${textBoxTopMm}mm`,
                              height: `${textBoxHeightMm}mm`,
                            }}
                          >
                            <span
                              className="text-black font-bold leading-tight break-all"
                              style={{
                                fontSize: `${fontSizeMm}mm`,
                                fontFamily: '"Courier New", Courier, monospace',
                                letterSpacing: "0px",
                                lineHeight: "1",
                              }}
                            >
                              {displayText}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={idx}
                        className="absolute overflow-hidden flex items-center justify-center bg-white border border-border-subtle border-dashed"
                        style={{
                          left: `${pos.x}mm`,
                          top: `${pos.y}mm`,
                          width: `${pos.width}mm`,
                          height: `${pos.height}mm`,
                        }}
                      >
                        {content}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {!layout.error && totalPages > 1 && (
          <PageNavigator
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPageIndex}
          />
        )}

        {/* Relative Ruler */}
        <div
          data-testid="preview-ruler"
          className="absolute top-3 right-3 flex flex-col items-end gap-1 pointer-events-none z-20 opacity-60"
        >
          <div className="flex items-end h-3">
            <div className="w-[1.5px] h-full bg-text-muted"></div>
            <div
              className="h-[1.5px] bg-text-muted"
              style={{ width: `${rulerLengthMm * renderScale}mm` }}
            />
            <div className="w-[1.5px] h-full bg-text-muted"></div>
          </div>
          <span className="text-[12px] text-text-muted font-semibold font-mono leading-none select-none">
            {t("ruler_length", { length: rulerLengthMm })}
          </span>
        </div>

        <ZoomControl
          zoomMode={zoomMode}
          manualScale={manualScale}
          onZoomModeChange={onZoomModeChange}
          onManualScaleChange={handleManualScaleChange}
          onRequestActual={onRequestActual}
          onInteractionChange={handleZoomInteractionChange}
        />
      </div>
    </section>
  );
}
