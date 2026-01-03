import { useState, useEffect } from "react";
import { UploadCloud, Grid, Layout, File as FileIcon, FileMinus, Download } from "lucide-react";
import type { HelperLayoutConfig } from "../utils/layoutMath";
import { motion } from "framer-motion";
import { useI18n } from "../utils/i18n";
import { NumberInput } from "./NumberInput";

import type { ImageItem } from "../App";

interface ControlPanelProps {
    config: HelperLayoutConfig;
    onConfigChange: (updates: Partial<HelperLayoutConfig>) => void;
    onFilesSelect: (files: File[]) => void;
    imageItems: ImageItem[];
    onItemCountChange: (id: string, count: number) => void;
    selectedFileName?: string;
    onGeneratePdf: () => void;
}

export function ControlPanel({
    config,
    onConfigChange,
    onFilesSelect,
    imageItems,
    onItemCountChange,
    selectedFileName,
    onGeneratePdf
}: ControlPanelProps) {
    const { t } = useI18n();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onFilesSelect(Array.from(e.target.files));
        }
    };

    return (
        <aside className="w-80 bg-glass-surface backdrop-blur-glass border border-glass-border border-r-0 flex flex-col z-10 m-2 rounded-lg shadow-sm">
            <div className="p-6 overflow-y-auto flex-1 space-y-8 scrollbar-hide">

                {/* File Selection */}
                <div className="space-y-3">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <UploadCloud className="w-4 h-4" /> {t('file_group')}
                    </h2>

                    <div className="relative group cursor-pointer transition-transform active:scale-[0.98]">
                        <input
                            type="file"
                            multiple
                            accept="image/png, image/jpeg, image/jpg"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                        />
                        <div className={`absolute inset-0 bg-indigo-50/50 rounded-lg border-2 border-dashed transition-colors ${selectedFileName ? 'border-brand-primary bg-indigo-50' : 'border-indigo-200 group-hover:border-indigo-400'}`}></div>
                        <div className="relative flex flex-row items-center gap-0 py-3 px-5 text-left pointer-events-none">
                            <div className="bg-white p-2 rounded-full shadow-sm flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                                <UploadCloud className={`w-7 h-7 ${selectedFileName ? 'text-brand-primary' : 'text-indigo-400'}`} />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col items-center">
                                <p className="text-sm font-bold text-slate-700 truncate w-full text-center">
                                    {selectedFileName || t('browse_btn')}
                                </p>
                                {!selectedFileName && <p className="text-[12px] text-slate-400 text-center">{t('browse_hint')}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Thumbnail Preview Area */}
                    {imageItems.length > 0 && (
                        <div className="flex gap-1 overflow-x-auto py-3 px-1 scrollbar-hide">
                            {imageItems.map((item) => (
                                <ThumbnailItem
                                    key={item.id}
                                    item={item}
                                    onCountChange={(count) => onItemCountChange(item.id, count)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Grid Settings */}
                <div className="space-y-4">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Grid className="w-4 h-4" /> {t('layout_group')}
                    </h2>

                    <div className="grid grid-cols-2 gap-4">
                        <NumberInput
                            label={t('rows')}
                            value={config.rows}
                            onChange={(v) => onConfigChange({ rows: v })}
                            min={1} max={20}
                            isInteger
                        />
                        <NumberInput
                            label={t('cols')}
                            value={config.cols}
                            onChange={(v) => onConfigChange({ cols: v })}
                            min={1} max={10}
                            isInteger
                        />
                    </div>

                    {/* Range Sliders -> Now Number Inputs */}
                    <div className="grid grid-cols-2 gap-4">
                        <NumberInput
                            label={`${t('margin')} (mm)`}
                            value={config.marginMm}
                            onChange={(v) => onConfigChange({ marginMm: v })}
                            min={0} max={50}
                            decimalPlaces={1}
                            step={1}
                        />
                        <NumberInput
                            label={`${t('spacing')} (mm)`}
                            value={config.spacingMm}
                            onChange={(v) => onConfigChange({ spacingMm: v })}
                            min={0} max={30}
                            decimalPlaces={1}
                            step={1}
                        />
                    </div>
                </div>

                {/* Orientation */}
                <div className="space-y-3">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Layout className="w-4 h-4" /> {t('orientation')}
                    </h2>
                    <div className="bg-slate-100/50 p-1 rounded-lg flex border border-slate-200 relative isolate">
                        <button
                            onClick={() => onConfigChange({ orientation: 'portrait' })}
                            className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors relative z-0 ${config.orientation === 'portrait' ? 'text-brand-primary' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {config.orientation === 'portrait' && (
                                <motion.div
                                    layoutId="orientation-active"
                                    className="absolute inset-0 bg-white shadow-sm rounded-lg -z-10"
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}
                            <FileIcon className="w-4 h-4" /> {t('portrait')}
                        </button>
                        <button
                            onClick={() => onConfigChange({ orientation: 'landscape' })}
                            className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors relative z-0 ${config.orientation === 'landscape' ? 'text-brand-primary' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {config.orientation === 'landscape' && (
                                <motion.div
                                    layoutId="orientation-active"
                                    className="absolute inset-0 bg-white shadow-sm rounded-lg -z-10"
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}
                            <FileMinus className="w-4 h-4 transform rotate-90" /> {t('landscape')}
                        </button>
                    </div>
                </div>

            </div>

            {/* Action Button */}
            <div className="p-6 border-t border-white/50 bg-white/40 backdrop-blur-sm rounded-lg overflow-hidden relative">
                {/* Shine effect container */}
                <motion.div
                    className="absolute top-0 left-0 w-full h-full pointer-events-none"
                    initial={false}
                    animate={selectedFileName ? { x: "100%" } : { x: "-100%" }}
                    transition={{ duration: 0.5 }}
                />

                <motion.button
                    layout
                    whileHover={selectedFileName ? { scale: 1.02, boxShadow: "0 10px 25px -5px rgba(79, 70, 229, 0.4)" } : {}}
                    whileTap={selectedFileName ? { scale: 0.98 } : {}}
                    initial={false}
                    animate={selectedFileName ? {
                        opacity: 1,
                        scale: 1,
                        filter: "grayscale(0%)",
                        boxShadow: "0 4px 6px -1px rgba(79, 70, 229, 0.1), 0 2px 4px -1px rgba(79, 70, 229, 0.06)"
                    } : {
                        opacity: 0.7,
                        scale: 1,
                        filter: "grayscale(100%)",
                        boxShadow: "none"
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    onClick={onGeneratePdf}
                    disabled={!selectedFileName}
                    className={`w-full py-3.5 px-4 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 relative overflow-hidden group ${selectedFileName ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                >
                    {/* Shimmer overlay on hover */}
                    <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

                    <Download className="w-5 h-5" />
                    <span>{t('generate_btn')}</span>
                </motion.button>
            </div>
        </aside>
    );
}

/**
 * Local helper for rendering individual image thumbnails with lifecycle management
 */
function ThumbnailItem({ item, onCountChange }: { item: ImageItem; onCountChange: (count: number) => void }) {
    const [url, setUrl] = useState<string>("");

    useEffect(() => {
        const u = URL.createObjectURL(item.file);
        setUrl(u);
        return () => URL.revokeObjectURL(u);
    }, [item.file]);

    const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value) || 1;
        onCountChange(Math.max(1, Math.min(999, val)));
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-shrink-0 w-20 h-20 rounded-lg border border-slate-200 bg-white shadow-sm relative group transition-all hover:border-brand-primary"
            title={item.file.name}
        >
            {url && <img src={url} alt="" className="w-full h-full object-contain p-1" />}

            {/* Count Input Overlay */}
            <div className="absolute -bottom-1 -right-1 flex items-center bg-brand-primary rounded-md shadow-sm border border-white shadow-brand-primary/20">
                <input
                    type="number"
                    min="1"
                    max="99"
                    value={item.count}
                    onChange={handleCountChange}
                    className="w-6 h-4 bg-transparent text-white text-[14px] font-bold text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
            </div>
        </motion.div>
    );
}

