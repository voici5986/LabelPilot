import { useEffect, useMemo, useState, useRef } from "react";
import {
    calculateLabelLayout,
    resolvePageDimensions,
    resolveItemAtSlot,
    formatLabelText,
    getLabelTextFontSizeMm,
    getTextLayoutBoxes,
    MM_TO_PX
} from "../utils/layoutMath";
import { Maximize, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { useI18n } from "../utils/i18nContext";
import { motion, AnimatePresence } from "framer-motion";
import { mapPctToScale, getThumbBottomPct } from "../utils/zoomMath";
import { QRCodeSVG } from "qrcode.react";
import { useStore } from "../store/useStore";


import { translations } from "../utils/translations";

export function PreviewPanel() {
    const { config, imageItems, imageUrlMap, appMode, textConfig } = useStore();
    const { t } = useI18n();
    const [scale, setScale] = useState(1);
    const [baseFitScale, setBaseFitScale] = useState(0.8);
    const containerRef = useRef<HTMLDivElement>(null);

    // Zoom control states
    const [isDragging, setIsDragging] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
    const sliderTrackRef = useRef<HTMLDivElement>(null);

    // 计算自动缩放比例 (保持在本地，因为依赖 DOM ref)
    useEffect(() => {
        const updateFitScale = () => {
            if (!containerRef.current) return;
            const TOP_GAP = 10;
            const BOTTOM_GAP = 10;
            const HORIZONTAL_GAP = 20;

            const containerW = containerRef.current.clientWidth - HORIZONTAL_GAP;
            const containerH = containerRef.current.clientHeight - (TOP_GAP + BOTTOM_GAP);

            const { pageWidth, pageHeight } = resolvePageDimensions(config);
            const paperW = pageWidth * MM_TO_PX;
            const paperH = pageHeight * MM_TO_PX;

            setBaseFitScale(Math.min(containerW / paperW, containerH / paperH));
        };

        updateFitScale();
        window.addEventListener('resize', updateFitScale);
        return () => window.removeEventListener('resize', updateFitScale);
    }, [config]);

    const layout = useMemo(() => calculateLabelLayout(config), [config]);

    const totalCount = useMemo(() => {
        if (appMode === 'image') {
            return imageItems.reduce((acc, item) => acc + item.count, 0);
        } else {
            return textConfig.count;
        }
    }, [imageItems, appMode, textConfig.count]);

    const slotsPerPage = Math.max(1, layout.positions.length);
    const totalPages = Math.max(1, Math.ceil(totalCount / slotsPerPage));
    const [currentPage, setCurrentPage] = useState(0);
    const [pageInput, setPageInput] = useState(String(currentPage + 1));

    // Reset current page if total pages change
    useEffect(() => {
        if (currentPage >= totalPages) {
            setCurrentPage(Math.max(0, totalPages - 1));
        }
    }, [totalPages, currentPage]);
    
    useEffect(() => {
        setPageInput(String(currentPage + 1));
    }, [currentPage]);

    const { pageWidth: paperWidthMm, pageHeight: paperHeightMm } = resolvePageDimensions(config);

    const handleSliderChange = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        if (!sliderTrackRef.current) return;
        const rect = sliderTrackRef.current.getBoundingClientRect();
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
        const pct = 1 - (clientY - rect.top) / rect.height;
        setScale(mapPctToScale(pct));
    };

    useEffect(() => {
        if (!isDragging) return;
        const onMove = (e: MouseEvent | TouchEvent) => handleSliderChange(e);
        const onUp = () => setIsDragging(false);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('touchmove', onMove);
        window.addEventListener('touchend', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onUp);
        };
    }, [isDragging]);

    // Panning (Drag-to-scroll) Handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!containerRef.current || e.button !== 0) return; // Only left click
        e.preventDefault(); // Stop native drag and drop behavior
        setIsPanning(true);
        setPanStart({
            x: e.clientX,
            y: e.clientY,
            scrollLeft: containerRef.current.scrollLeft,
            scrollTop: containerRef.current.scrollTop
        });
    };

    useEffect(() => {
        if (!isPanning || !containerRef.current) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current) return;
            const dx = e.clientX - panStart.x;
            const dy = e.clientY - panStart.y;
            containerRef.current.scrollLeft = panStart.scrollLeft - dx;
            containerRef.current.scrollTop = panStart.scrollTop - dy;
        };

        const handleMouseUp = () => {
            setIsPanning(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isPanning, panStart]);

    return (
        <section className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="flex-1 glass-panel rounded-xl flex flex-col relative overflow-hidden shadow-inner font-sans">

                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10 pointer-events-none dark:opacity-5" style={{ backgroundImage: 'radial-gradient(var(--color-text-main) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                {/* Scrollable Area */}
                <div
                    ref={containerRef}
                    onMouseDown={handleMouseDown}
                    className={`flex-1 overflow-auto text-center p-2 scrollbar-thin scrollbar-thumb-text-main/20 select-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
                >
                    {layout.error ? (
                        <div className="w-full h-full flex items-center justify-center p-8">
                            <div className="bg-surface/80 backdrop-blur-md p-6 rounded-xl border border-red-200/50 dark:border-red-800/50 shadow-xl flex flex-col items-center gap-3 text-red-600 dark:text-red-400">
                                <AlertCircle className="w-10 h-10" />
                                <div className="text-center">
                                    <p className="font-medium text-lg">{t('layout_error_title')}</p>
                                    <p className="text-sm opacity-80">
                                        {layout.error ? t(layout.error.toLowerCase() as keyof typeof translations.zh) || layout.error : ''}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                    <div className="inline-block text-left align-top" style={{
                        width: `${paperWidthMm * scale * baseFitScale}mm`,
                        height: `${paperHeightMm * scale * baseFitScale}mm`,
                        marginTop: '0px',
                        position: 'relative'
                    }}>
                        <motion.div
                            initial={false}
                            animate={{
                                width: `${paperWidthMm}mm`,
                                height: `${paperHeightMm}mm`,
                                scale: scale * baseFitScale,
                                boxShadow: isDragging
                                    ? `0 ${20 / scale}px ${50 / scale}px -12px rgba(0,0,0,${0.1 + (1 - scale / 3) * 0.1})`
                                    : "0 20px 50px -12px rgba(0,0,0,0.15)"
                            }}
                            transition={isDragging ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }}
                            className="bg-white absolute top-0 left-0"
                            style={{
                                transformOrigin: 'top left',
                                filter: `brightness(var(--paper-brightness))`
                            }}
                        >
                            {layout.positions.map((pos, idx) => {
                                // 考虑分页的索引偏移
                                const globalIdx = currentPage * slotsPerPage + idx;

                                // 根据模式决定渲染内容
                                let content = null;
                                if (appMode === 'image') {
                                    const item = resolveItemAtSlot(globalIdx, imageItems);
                                    const currentImageUrl = item ? imageUrlMap.get(item.id) : null;
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
                                        content = <span className="text-[12px] text-text-muted font-medium select-none">Label {globalIdx + 1}</span>;
                                    }
                                } else if (globalIdx < totalCount) {
                                    // 自动编号模式
                                    const displayText = formatLabelText(globalIdx, textConfig);
                                    const qrValue = `${textConfig.qrContentPrefix}${displayText}`;
                                    const fontSizeMm = getLabelTextFontSizeMm(displayText, pos, textConfig.showQrCode);
                                    const {
                                        qrDimMm,
                                        qrTopMm,
                                        qrLeftMm,
                                        textBoxTopMm,
                                        textBoxHeightMm
                                    } = getTextLayoutBoxes(pos, textConfig.showQrCode, textConfig.qrSizeRatio);

                                    content = (
                                        <div className="w-full h-full text-center">
                                            {textConfig.showQrCode && (
                                                <div
                                                    className="absolute flex items-center justify-center"
                                                    style={{
                                                        left: `${qrLeftMm}mm`,
                                                        top: `${qrTopMm}mm`,
                                                        width: `${qrDimMm}mm`,
                                                        height: `${qrDimMm}mm`
                                                    }}
                                                >
                                                    <QRCodeSVG
                                                        value={qrValue}
                                                        size={qrDimMm * MM_TO_PX}
                                                        level="M"
                                                    />
                                                </div>
                                            )}
                                            <div
                                                className="absolute flex items-center justify-center w-full"
                                                style={{
                                                    top: `${textBoxTopMm}mm`,
                                                    height: `${textBoxHeightMm}mm`
                                                }}
                                            >
                                                <span
                                                    className="text-black font-bold leading-tight break-all"
                                                    style={{
                                                        fontSize: `${fontSizeMm}mm`,
                                                        fontFamily: '"Courier New", Courier, monospace',
                                                        letterSpacing: '0px',
                                                        lineHeight: '1'
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

                {/* Page Navigation Controls */}
                {!layout.error && totalPages > 1 && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-30 bg-surface/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-border-subtle shadow-lg">
                        <button
                            disabled={currentPage === 0}
                            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                            className="p-1 rounded-full hover:bg-black/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title={t('page_prev')}
                        >
                            <ChevronLeft className="w-5 h-5 text-text-main" />
                        </button>

                        <div className="text-sm font-medium text-text-main flex items-center justify-center gap-1.5">
                            <input
                                type="text"
                                inputMode="numeric"
                                value={pageInput}
                                onChange={(e) => setPageInput(e.target.value.replace(/[^\d]/g, ''))}
                                onBlur={() => {
                                    const parsed = parseInt(pageInput || '1', 10);
                                    const next = Math.min(totalPages, Math.max(1, isNaN(parsed) ? 1 : parsed));
                                    setCurrentPage(next - 1);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        (e.target as HTMLInputElement).blur();
                                    }
                                }}
                                className="w-10 text-center input-base focus:input-base-focus px-1 py-0.5 text-sm"
                                aria-label={t('page_of', { current: currentPage + 1, total: totalPages })}
                            />
                            <span>/ {totalPages}</span>
                        </div>

                        <button
                            disabled={currentPage === totalPages - 1}
                            onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                            className="p-1 rounded-full hover:bg-black/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title={t('page_next')}
                        >
                            <ChevronRight className="w-5 h-5 text-text-main" />
                        </button>
                    </div>
                )}

                {/* Relative Ruler */}
                <div className="absolute bottom-4 left-14 flex flex-col items-start gap-1 pointer-events-none z-20 opacity-60">
                    <div className="flex items-end h-3">
                        <div className="w-[1.5px] h-full bg-text-muted"></div>
                        <motion.div
                            className="h-[1.5px] bg-text-muted"
                            animate={{ width: `${50 * scale * baseFitScale}mm` }}
                            transition={isDragging ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }}
                        />
                        <div className="w-[1.5px] h-full bg-text-muted"></div>
                    </div>
                    <span className="text-[12px] text-text-muted font-semibold font-mono leading-none select-none">50mm</span>
                </div>

                {/* Vertical Zoom Controls */}
                <div
                    className="absolute bottom-2 left-2 flex flex-col items-center gap-1 z-20"
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    {/* Reset Button */}
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setScale(1)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-surface rounded-lg text-text-muted hover:text-brand-primary transition-all shadow-sm border border-transparent hover:border-border-subtle bg-surface/50"
                        title={t('zoom_reset')}
                    >
                        <Maximize className="w-4 h-4" />
                    </motion.button>

                    <motion.div
                        animate={{
                            backgroundColor: isDragging ? "var(--color-surface)" : "var(--color-surface)",
                            opacity: isDragging ? 0.95 : 0.7,
                            boxShadow: isDragging ? "0 4px 12px rgba(0,0,0,0.2)" : "0 4px 6px rgba(0,0,0,0.1)"
                        }}
                        className="backdrop-blur-glass rounded-lg p-1.5 border border-glass-border flex flex-col items-center h-40 w-8 relative"
                    >
                        {/* Tooltip (Enhanced popup animation) */}
                        <AnimatePresence>
                            {(isHovered || isDragging) && (
                                <motion.div
                                    initial={{ opacity: 0, x: -5, scale: 0.8 }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    exit={{ opacity: 0, x: -5, scale: 0.8 }}
                                    className="absolute left-12 top-1/2 -translate-y-1/2 bg-zinc-800 text-white text-[14px] px-2 py-1 rounded shadow-xl whitespace-nowrap pointer-events-none font-semibold z-30"
                                >
                                    {Math.round(scale * 100)}%
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div
                            ref={sliderTrackRef}
                            className="w-1.5 h-full bg-text-main/10 rounded-lg relative cursor-ns-resize"
                            onMouseDown={(e) => { setIsDragging(true); handleSliderChange(e); }}
                            onTouchStart={(e) => { setIsDragging(true); handleSliderChange(e); }}
                        >
                            <motion.div
                                className="absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-brand-primary rounded-lg shadow-md pointer-events-none"
                                animate={{
                                    bottom: `${getThumbBottomPct(scale)}%`
                                }}
                                transition={isDragging ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }}
                                style={{ marginBottom: '-8px' }}
                            />
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
