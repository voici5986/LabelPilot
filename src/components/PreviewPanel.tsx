import { useEffect, useMemo, useState, useRef } from "react";
import { calculateLabelLayout, A4_WIDTH_MM, A4_HEIGHT_MM, resolveItemAtSlot } from "../utils/layoutMath";
import type { HelperLayoutConfig } from "../utils/layoutMath";
import { Maximize, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "../utils/i18n";
import { motion, AnimatePresence } from "framer-motion";
import { mapPctToScale, getThumbBottomPct } from "../utils/zoomMath";

import type { ImageItem } from "../App";

interface PreviewPanelProps {
    config: HelperLayoutConfig;
    imageItems: ImageItem[];
    appMode: 'image' | 'text';
    textConfig: {
        prefix: string;
        startNumber: number;
        digits: number;
        count: number;
    };
}

export function PreviewPanel({ config, imageItems, appMode, textConfig }: PreviewPanelProps) {
    const { t } = useI18n();
    const [scale, setScale] = useState(1);
    const [baseFitScale, setBaseFitScale] = useState(0.8);
    const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map());
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

            const isPortrait = config.orientation === 'portrait';
            const baseW = config.pageWidthMm || A4_WIDTH_MM;
            const baseH = config.pageHeightMm || A4_HEIGHT_MM;
            const paperWidthMm = isPortrait ? Math.min(baseW, baseH) : Math.max(baseW, baseH);
            const paperHeightMm = isPortrait ? Math.max(baseW, baseH) : Math.min(baseW, baseH);

            const mmToPx = 3.78;
            const paperW = paperWidthMm * mmToPx;
            const paperH = paperHeightMm * mmToPx;

            setBaseFitScale(Math.min(containerW / paperW, containerH / paperH));
        };

        updateFitScale();
        window.addEventListener('resize', updateFitScale);
        return () => window.removeEventListener('resize', updateFitScale);
    }, [config.orientation]);

    // 处理图片 URL 列表生命周期
    useEffect(() => {
        if (imageItems && imageItems.length > 0) {
            const newMap = new Map<string, string>();
            imageItems.forEach(item => {
                newMap.set(item.id, URL.createObjectURL(item.file));
            });
            setImageUrls(newMap);
            return () => {
                newMap.forEach(url => URL.revokeObjectURL(url));
            };
        }
        setImageUrls(new Map());
    }, [imageItems]);

    const layout = useMemo(() => calculateLabelLayout(config), [config]);

    const totalCount = useMemo(() => {
        if (appMode === 'image') {
            return imageItems.reduce((acc, item) => acc + item.count, 0);
        } else {
            return textConfig.count;
        }
    }, [imageItems, appMode, textConfig.count]);

    const slotsPerPage = layout.positions.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / slotsPerPage));
    const [currentPage, setCurrentPage] = useState(0);

    // Reset current page if total pages change
    useEffect(() => {
        if (currentPage >= totalPages) {
            setCurrentPage(Math.max(0, totalPages - 1));
        }
    }, [totalPages, currentPage]);

    const isPortrait = config.orientation === 'portrait';
    const baseW = config.pageWidthMm || A4_WIDTH_MM;
    const baseH = config.pageHeightMm || A4_HEIGHT_MM;
    const paperWidthMm = isPortrait ? Math.min(baseW, baseH) : Math.max(baseW, baseH);
    const paperHeightMm = isPortrait ? Math.max(baseW, baseH) : Math.min(baseW, baseH);

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
        <section className="flex-1 flex flex-col p-2 pl-0 h-full overflow-hidden">
            <div className="flex-1 glass-panel rounded-lg flex flex-col relative overflow-hidden shadow-inner font-sans">

                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10 pointer-events-none dark:opacity-5" style={{ backgroundImage: 'radial-gradient(var(--color-text-main) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                {/* Scrollable Area */}
                <div
                    ref={containerRef}
                    onMouseDown={handleMouseDown}
                    className={`flex-1 overflow-auto text-center p-2 scrollbar-thin scrollbar-thumb-text-main/20 select-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
                >
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
                                    const currentImageUrl = item ? imageUrls.get(item.id) : null;
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
                                    const currentNumber = textConfig.startNumber + globalIdx;
                                    const formattedNumber = String(currentNumber).padStart(textConfig.digits, '0');
                                    content = (
                                        <div className="flex flex-col items-center justify-center w-full h-full p-1 text-center">
                                            <span 
                                                className="text-black font-mono font-semibold leading-tight break-all"
                                                style={{ 
                                                    fontSize: `${Math.min(pos.width * 0.8 / (textConfig.prefix.length + textConfig.digits), pos.height * 0.5)}mm`
                                                }}
                                            >
                                                {textConfig.prefix}{formattedNumber}
                                            </span>
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
                </div>

                {/* Page Navigation Controls */}
                {totalPages > 1 && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 z-30 bg-surface/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-border-subtle shadow-lg">
                        <button
                            disabled={currentPage === 0}
                            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                            className="p-1 rounded-full hover:bg-black/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title={t('page_prev')}
                        >
                            <ChevronLeft className="w-5 h-5 text-text-main" />
                        </button>
                        
                        <span className="text-sm font-medium text-text-main min-w-[80px] text-center">
                            {t('page_of', { current: currentPage + 1, total: totalPages })}
                        </span>

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
