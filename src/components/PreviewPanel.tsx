import { useEffect, useMemo, useState, useRef } from "react";
import { calculateLabelLayout, A4_WIDTH_MM, A4_HEIGHT_MM } from "../utils/layoutMath";
import type { HelperLayoutConfig } from "../utils/layoutMath";
import { Minus, Plus, Maximize } from "lucide-react";
import { useI18n } from "../utils/i18n";
import { motion } from "framer-motion";

interface PreviewPanelProps {
    config: HelperLayoutConfig;
    imageFile: File | null;
}

export function PreviewPanel({ config, imageFile }: PreviewPanelProps) {
    const { t } = useI18n();
    const [scale, setScale] = useState(1);
    const [baseFitScale, setBaseFitScale] = useState(0.8); // 默认保底比例
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // 计算自动缩放比例，使 A4 纸适配屏幕
    useEffect(() => {
        const updateFitScale = () => {
            if (!containerRef.current) return;

            // 定义边距常量
            const TOP_GAP = 10;    // 用户已改为 10px
            const BOTTOM_GAP = 10; // 底部空间缩小，因为控制条移走了
            const HORIZONTAL_GAP = 20; // 左右 32px (px-4)

            const containerW = containerRef.current.clientWidth - HORIZONTAL_GAP;
            const containerH = containerRef.current.clientHeight - (TOP_GAP + BOTTOM_GAP);

            const isPortrait = config.orientation === 'portrait';
            const paperWidthMm = isPortrait ? A4_WIDTH_MM : A4_HEIGHT_MM;
            const paperHeightMm = isPortrait ? A4_HEIGHT_MM : A4_WIDTH_MM;

            // 浏览器中 1mm 约等于 3.78px (96 DPI)
            const mmToPx = 3.78;
            const paperW = paperWidthMm * mmToPx;
            const paperH = paperHeightMm * mmToPx;

            // 计算宽和高的缩放比
            const scaleW = containerW / paperW;
            const scaleH = containerH / paperH;

            // 使用 0.92 作为安全系数，确保在各种浏览器下不溢出
            const fitScale = Math.min(scaleW, scaleH) * 1;
            setBaseFitScale(fitScale);
        };

        updateFitScale();
        window.addEventListener('resize', updateFitScale);
        return () => window.removeEventListener('resize', updateFitScale);
    }, [config.orientation]);

    // Generate object URL for image
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

    // Determine container size to fit A4
    const isPortrait = config.orientation === 'portrait';
    const paperWidthMm = isPortrait ? A4_WIDTH_MM : A4_HEIGHT_MM;
    const paperHeightMm = isPortrait ? A4_HEIGHT_MM : A4_WIDTH_MM;

    const paperStyle = {
        transformOrigin: 'top center',
    } as any;

    return (
        <section className="flex-1 flex flex-col p-2 pl-0 h-full overflow-hidden">
            <div className="flex-1 bg-white/40 backdrop-blur-md rounded-xl border border-white/60 flex flex-col relative overflow-hidden shadow-inner">

                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                {/* Scrollable Area */}
                <div ref={containerRef} className="flex-1 overflow-auto flex flex-col items-center pb-6 px-4 scrollbar-thin scrollbar-thumb-slate-300">
                    <motion.div
                        initial={false}
                        animate={{
                            width: `${paperWidthMm}mm`,
                            height: `${paperHeightMm}mm`,
                            scale: scale * baseFitScale // 使用动态计算的适配比例
                        }}
                        transition={{ duration: 0.4, ease: "easeInOut" }}
                        className="bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] relative shrink-0"
                        style={{ ...paperStyle, marginTop: '10px', originY: 0, originX: 0.5 }}
                    >
                        {/* Render Labels */}
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

                {/* Zoom Controls (Vertical, Bottom-Left) */}
                <div className="absolute bottom-2 left-2 flex flex-col items-center gap-1 bg-white/80 backdrop-blur rounded-xl p-1 shadow-lg border border-white/50 z-20">
                    <button
                        onClick={() => setScale(1)}
                        className="p-1 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
                        title={t('zoom_reset')}
                    >
                        <Maximize className="w-5 h-5" />
                    </button>
                    <div className="h-px w-4 bg-slate-200"></div>
                    <button
                        onClick={() => setScale(s => Math.min(3, s + 0.1))}
                        className="p-1 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                    <span className="text-[12px] font-bold text-slate-500 py-1 min-w-[2.5rem] text-center">
                        {Math.round(scale * 100)}%
                    </span>
                    <button
                        onClick={() => setScale(s => Math.max(0.2, s - 0.1))}
                        className="p-1 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
                    >
                        <Minus className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </section>
    );
}
