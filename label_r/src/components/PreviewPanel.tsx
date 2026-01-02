import { useEffect, useMemo, useRef, useState } from "react";
import { HelperLayoutConfig, calculateLabelLayout, A4_WIDTH_MM, A4_HEIGHT_MM } from "../utils/layoutMath";
import { Minus, Plus, Maximize, Printer } from "lucide-react";

interface PreviewPanelProps {
    config: HelperLayoutConfig;
    imageFile: File | null;
}

export function PreviewPanel({ config, imageFile }: PreviewPanelProps) {
    const [scale, setScale] = useState(1);
    const [imageUrl, setImageUrl] = useState<string | null>(null);

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
    // A4 ratio: 210/297 = 0.707 (Portrait) or 1.414 (Landscape)
    const isPortrait = config.orientation === 'portrait';
    const paperWidthMm = isPortrait ? A4_WIDTH_MM : A4_HEIGHT_MM;
    const paperHeightMm = isPortrait ? A4_HEIGHT_MM : A4_WIDTH_MM;

    // Base pixel scale (mm to px for preview) - approximate 3.78 px/mm (96 dpi) or more for high res
    // We'll use CSS scale for zooming, but base size should be readable. 
    // Let's assume 1mm = 3px for base render to keep it sharp enough.
    const MM_TO_PX = 3;

    const paperStyle = {
        width: `${paperWidthMm}mm`,
        height: `${paperHeightMm}mm`,
        transform: `scale(${scale})`,
        transformOrigin: 'center top', // Zoom from top center
    };

    return (
        <section className="flex-1 flex flex-col p-4 pl-0 h-full overflow-hidden">
            <div className="flex-1 bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 flex flex-col relative overflow-hidden shadow-inner">

                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                {/* Scrollable Area */}
                <div className="flex-1 overflow-auto flex justify-center p-8 scrollbar-thin scrollbar-thumb-slate-300">
                    <div
                        className="bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] transition-all ease-out duration-300 relative"
                        style={paperStyle}
                    >
                        {/* Render Labels */}
                        {layout.positions.map((pos, idx) => (
                            <div
                                key={idx}
                                className="absolute overflow-hidden flex items-center justify-center bg-slate-100 border border-slate-200"
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
                                    <span className="text-[10px] text-slate-400 font-medium select-none">Label {idx + 1}</span>
                                )}
                            </div>
                        ))}

                        {/* Margins indicator (optional, maybe on hover) */}
                        {/* Watermark */}
                        <div className="absolute bottom-4 right-4 text-[10px] text-slate-300 pointer-events-none">Preview Mode</div>
                    </div>
                </div>

                {/* Zoom Controls */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/80 backdrop-blur rounded-full p-1.5 shadow-lg border border-white/50 z-20">
                    <button
                        onClick={() => setScale(s => Math.max(0.2, s - 0.1))}
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
                    >
                        <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-semibold text-slate-600 px-2 min-w-[3rem] text-center">
                        {Math.round(scale * 100)}%
                    </span>
                    <button
                        onClick={() => setScale(s => Math.min(3, s + 0.1))}
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                    <div className="w-px h-4 bg-slate-300 mx-1"></div>
                    <button
                        onClick={() => setScale(1)}
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors tooltip"
                        title="Reset Zoom"
                    >
                        <Maximize className="w-4 h-4" />
                    </button>
                </div>

            </div>
        </section>
    );
}
