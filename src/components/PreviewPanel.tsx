import { useMemo, useState } from "react";
import {
  calculateLabelLayout,
  resolvePageDimensions,
  resolveItemAtSlot,
  formatLabelText,
  getLabelTextFontSizeMm,
  getTextLayoutBoxes,
} from "../utils/layoutMath";
import { AlertCircle } from "lucide-react";
import { useI18n } from "../utils/i18nContext";
import { motion } from "framer-motion";
import { QrCodeSvg } from "./QrCodeSvg";
import { useStore } from "../store/useStore";
import { useShallow } from "zustand/shallow";
import { usePreviewViewport } from "../hooks/usePreviewViewport";
import { PageNavigator } from "./PageNavigator";
import { ZoomControl } from "./ZoomControl";

import type { Translations } from "../utils/i18nContext";

export function PreviewPanel() {
  const { config, imageItems, imageUrlMap, appMode, textConfig } = useStore(
    useShallow((state) => ({
      config: state.config,
      imageItems: state.imageItems,
      imageUrlMap: state.imageUrlMap,
      appMode: state.appMode,
      textConfig: state.textConfig,
    })),
  );
  const { t } = useI18n();
  const [scale, setScale] = useState(1);
  const { containerRef, baseFitScale, isPanning, handleMouseDown } =
    usePreviewViewport(config);

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
          onMouseDown={handleMouseDown}
          className={`flex-1 overflow-auto text-center p-2 scrollbar-thin scrollbar-thumb-text-main/20 select-none ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
        >
          {layout.error ? (
            <div className="flex h-full w-full items-center justify-center p-8">
              <div className="flex flex-col items-center gap-3 rounded-lg border border-red-200/50 bg-surface p-6 text-red-700 dark:border-red-800/50 dark:text-red-300">
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
            <div
              className="inline-block text-left align-top"
              style={{
                width: `${paperWidthMm * scale * baseFitScale}mm`,
                height: `${paperHeightMm * scale * baseFitScale}mm`,
                marginTop: "0px",
                position: "relative",
              }}
            >
              <motion.div
                initial={false}
                animate={{
                  scale: scale * baseFitScale,
                }}
                transition={{
                  duration: 0.18,
                  ease: [0.25, 1, 0.5, 1],
                }}
                className="absolute left-0 top-0 bg-white shadow-[0_12px_32px_-16px_rgba(0,0,0,0.35)]"
                style={{
                  width: `${paperWidthMm}mm`,
                  height: `${paperHeightMm}mm`,
                  transformOrigin: "top left",
                  filter: `brightness(var(--paper-brightness))`,
                }}
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
                          Label {globalIdx + 1}
                        </span>
                      );
                    }
                  } else if (globalIdx < totalCount) {
                    // 自动编号模式
                    const displayText = formatLabelText(globalIdx, textConfig);
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
              </motion.div>
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
        <div className="absolute bottom-4 left-14 flex flex-col items-start gap-1 pointer-events-none z-20 opacity-60">
          <div className="flex items-end h-3">
            <div className="w-[1.5px] h-full bg-text-muted"></div>
            <div
              className="h-[1.5px] bg-text-muted"
              style={{ width: `${50 * scale * baseFitScale}mm` }}
            />
            <div className="w-[1.5px] h-full bg-text-muted"></div>
          </div>
          <span className="text-[12px] text-text-muted font-semibold font-mono leading-none select-none">
            50mm
          </span>
        </div>

        <ZoomControl scale={scale} setScale={setScale} />
      </div>
    </section>
  );
}
