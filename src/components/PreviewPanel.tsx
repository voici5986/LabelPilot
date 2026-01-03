import { useEffect, useMemo, useState, useRef } from "react";
import { calculateLabelLayout, A4_WIDTH_MM, A4_HEIGHT_MM } from "../utils/layoutMath";
import type { HelperLayoutConfig } from "../utils/layoutMath";
import { Maximize } from "lucide-react";
import { useI18n } from "../utils/i18n";
import { motion } from "framer-motion";

interface PreviewPanelProps {
    config: HelperLayoutConfig;
    imageFile: File | null;
}

export function PreviewPanel({ config, imageFile }: PreviewPanelProps) {
    const { t } = useI18n();
    const [scale, setScale] = useState(1);
    const [baseFitScale, setBaseFitScale] = useState(0.8);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Zoom control states
    const [isDragging, setIsDragging] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const sliderTrackRef = useRef<HTMLDivElement>(null);

    // 计算自动缩放比例
    useEffect(() => {
        const updateFitScale = () => {
            if (!containerRef.current) return;
            const TOP_GAP = 10;
            const BOTTOM_GAP = 10;
            const HORIZONTAL_GAP = 20;

            const containerW = containerRef.current.clientWidth - HORIZONTAL_GAP;
            const containerH = containerRef.current.clientHeight - (TOP_GAP + BOTTOM_GAP);

            const isPortrait = config.orientation === 'portrait';
            const paperWidthMm = isPortrait ? A4_WIDTH_MM : A4_HEIGHT_MM;
            const paperHeightMm = isPortrait ? A4_HEIGHT_MM : A4_WIDTH_MM;

            const mmToPx = 3.78;
            const paperW = paperWidthMm * mmToPx;
            const paperH = paperHeightMm * mmToPx;

            const scaleW = containerW / paperW;
            const scaleH = containerH / paperH;

            setBaseFitScale(Math.min(scaleW, scaleH));
        };

        updateFitScale();
        window.addEventListener('resize', updateFitScale);
        return () => window.removeEventListener('resize', updateFitScale);
    }, [config.orientation]);

    useEffect(() => {
        if (imageFile) {
            const url = URL.createObjectURL(imageFile);
            setImageUrl(url);
            return () => URL.revokeObjectURL(url);
        } else {
            setImageUrl(null);
        }
    }, [imageFile]);

    const layout = useMemo(() => calculateLabelLayout(config), [config]);

    const isPortrait = config.orientation === 'portrait';
    const paperWidthMm = isPortrait ? A4_WIDTH_MM : A4_HEIGHT_MM;
    const paperHeightMm = isPortrait ? A4_HEIGHT_MM : A4_WIDTH_MM;

    const handleSliderChange = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        if (!sliderTrackRef.current) return;
        const rect = sliderTrackRef.current.getBoundingClientRect();
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

        let pct = 1 - (clientY - rect.top) / rect.height;
        pct = Math.max(0, Math.min(1, pct));

        // 分段非线性映射: 100% (1.0) 位于中心 (0.5)
        // 下平段: 0% -> 50% 进度 对应 50% -> 100% 缩放 (0.5 -> 1.0)
        // 上平段: 50% -> 100% 进度 对应 100% -> 300% 缩放 (1.0 -> 3.0)
        let newScale;
        if (pct <= 0.5) {
            newScale = 0.5 + (pct / 0.5) * 0.5;
        } else {
            newScale = 1.0 + ((pct - 0.5) / 0.5) * 2.0;
        }
        setScale(newScale);
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

    // 计算滑块位置的反向映射
    const getThumbBottom = () => {
        if (scale <= 1.0) {
            // Scale 0.5 to 1.0 maps to bottom 0% to 50%
            return ((scale - 0.5) / 0.5) * 50;
        } else {
            // Scale 1.0 to 3.0 maps to bottom 50% to 100%
            return 50 + ((scale - 1.0) / 2.0) * 50;
        }
    };

    return (
        <section className="flex-1 flex flex-col p-2 pl-0 h-full overflow-hidden">
            <div className="flex-1 bg-white/40 backdrop-blur-md rounded-lg border border-white/60 flex flex-col relative overflow-hidden shadow-inner font-sans">

                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                {/* Scrollable Area */}
                <div ref={containerRef} className="flex-1 overflow-auto flex flex-col items-center pb-6 px-4 scrollbar-thin scrollbar-thumb-slate-300">
                    <motion.div
                        initial={false}
                        animate={{
                            width: `${paperWidthMm}mm`,
                            height: `${paperHeightMm}mm`,
                            scale: scale * baseFitScale
                        }}
                        transition={isDragging ? { duration: 0 } : { duration: 0.4, ease: "easeInOut" }}
                        className="bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] relative shrink-0"
                        style={{ transformOrigin: 'top center', marginTop: '10px', originY: 0, originX: 0.5 }}
                    >
                        {layout.positions.map((pos, idx) => (
                            <div
                                key={idx}
                                className="absolute overflow-hidden flex items-center justify-center bg-white border border-slate-200 border-dashed"
                                style={{
                                    left: `${pos.x}mm`,
                                    top: `${pos.y}mm`,
                                    width: `${pos.width}mm`,
                                    height: `${pos.height}mm`,
                                }}
                            >
                                {imageUrl ? (
                                    <img src={imageUrl} className="w-full h-full object-contain" alt="" />
                                ) : (
                                    <span className="text-[12px] text-slate-400 font-medium select-none">Label {idx + 1}</span>
                                )}
                            </div>
                        ))}
                    </motion.div>
                </div>

                {/* Vertical Zoom Controls */}
                <div
                    className="absolute bottom-2 left-2 flex flex-col items-center gap-1 z-20"
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    {/* Reset Button */}
                    <button
                        onClick={() => setScale(1)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-lg text-slate-500 hover:text-indigo-600 transition-all shadow-sm border border-transparent hover:border-slate-200 bg-white/50"
                        title={t('zoom_reset')}
                    >
                        <Maximize className="w-4 h-4" />
                    </button>

                    <div className="bg-white/60 backdrop-blur-md rounded-lg p-1.5 shadow-md border border-white/50 flex flex-col items-center h-40 w-8 relative">
                        {/* Tooltip (Centered to THIS container height) */}
                        {(isHovered || isDragging) && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="absolute left-12 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-[14px] px-2 py-1 rounded shadow-xl whitespace-nowrap pointer-events-none font-bold z-30"
                            >
                                {Math.round(scale * 100)}%
                            </motion.div>
                        )}

                        <div
                            ref={sliderTrackRef}
                            className="w-1.5 h-full bg-slate-200/50 rounded-lg relative cursor-ns-resize"
                            onMouseDown={(e) => { setIsDragging(true); handleSliderChange(e); }}
                            onTouchStart={(e) => { setIsDragging(true); handleSliderChange(e); }}
                        >
                            <motion.div
                                className="absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-lg shadow-md pointer-events-none"
                                animate={{ bottom: `${getThumbBottom()}%` }}
                                transition={isDragging ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }}
                                style={{ marginBottom: '-8px' }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
