import { useState, useEffect } from "react";
import { UploadCloud, Grid, Layout, File as FileIcon, FileMinus, Download, ChevronUp, ChevronDown } from "lucide-react";
import type { HelperLayoutConfig } from "../utils/layoutMath";
import { motion } from "framer-motion";
import { useI18n } from "../utils/i18n";

interface ControlPanelProps {
    config: HelperLayoutConfig;
    onConfigChange: (updates: Partial<HelperLayoutConfig>) => void;
    onFileSelect: (file: File) => void;
    selectedFileName?: string;
    onGeneratePdf: () => void;
}

export function ControlPanel({
    config,
    onConfigChange,
    onFileSelect,
    selectedFileName,
    onGeneratePdf
}: ControlPanelProps) {
    const { t } = useI18n();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onFileSelect(e.target.files[0]);
        }
    };

    return (
        <aside className="w-80 bg-white/80 backdrop-blur-md border border-white/50 border-r-0 flex flex-col z-10 m-2 rounded-2xl shadow-sm">
            <div className="p-6 overflow-y-auto flex-1 space-y-8 scrollbar-hide">

                {/* File Selection */}
                <div className="space-y-3">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <UploadCloud className="w-4 h-4" /> {t('file_group')}
                    </h2>

                    <div className="relative group cursor-pointer">
                        <input
                            type="file"
                            accept="image/png, image/jpeg, image/jpg"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                        />
                        <div className={`absolute inset-0 bg-indigo-50/50 rounded-xl border-2 border-dashed transition-colors ${selectedFileName ? 'border-indigo-500 bg-indigo-50' : 'border-indigo-200 group-hover:border-indigo-400'}`}></div>
                        <div className="relative flex flex-col items-center justify-center py-6 px-4 text-center pointer-events-none">
                            <div className="bg-white p-3 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform duration-300">
                                <UploadCloud className={`w-6 h-6 ${selectedFileName ? 'text-indigo-600' : 'text-indigo-400'}`} />
                            </div>
                            <p className="text-sm font-medium text-slate-700 truncate max-w-full px-2">
                                {selectedFileName || t('browse_btn')}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">{t('browse_hint')}</p>
                        </div>
                    </div>
                </div>

                {/* Grid Settings */}
                <div className="space-y-4">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
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
                        />
                        <NumberInput
                            label={`${t('spacing')} (mm)`}
                            value={config.spacingMm}
                            onChange={(v) => onConfigChange({ spacingMm: v })}
                            min={0} max={30}
                            decimalPlaces={1}
                        />
                    </div>
                </div>

                {/* Orientation */}
                <div className="space-y-3">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Layout className="w-4 h-4" /> {t('orientation')}
                    </h2>
                    <div className="bg-slate-100/50 p-1 rounded-xl flex border border-slate-200">
                        <button
                            onClick={() => onConfigChange({ orientation: 'portrait' })}
                            className={`flex-1 py-2 px-3 rounded-lg font-medium text-xs flex items-center justify-center gap-2 transition-all ${config.orientation === 'portrait' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <FileIcon className="w-4 h-4" /> {t('portrait')}
                        </button>
                        <button
                            onClick={() => onConfigChange({ orientation: 'landscape' })}
                            className={`flex-1 py-2 px-3 rounded-lg font-medium text-xs flex items-center justify-center gap-2 transition-all ${config.orientation === 'landscape' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <FileMinus className="w-4 h-4 transform rotate-90" /> {t('landscape')}
                        </button>
                    </div>
                </div>

            </div>

            {/* Action Button */}
            <div className="p-6 border-t border-white/50 bg-white/40 backdrop-blur-sm rounded-b-2xl">
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onGeneratePdf}
                    disabled={!selectedFileName}
                    className={`w-full py-3.5 px-4 rounded-xl font-semibold text-sm shadow-lg flex items-center justify-center gap-2 transition-all ${selectedFileName ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-indigo-500/30' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                >
                    <Download className="w-5 h-5" />
                    {t('generate_btn')}
                </motion.button>
            </div>
        </aside>
    );
}

interface NumberInputProps {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    isInteger?: boolean;
    decimalPlaces?: number;
}

function NumberInput({ label, value, onChange, min, max, isInteger, decimalPlaces }: NumberInputProps) {
    // Local state to handle string input allowing intermediate states like "3."
    const [localVal, setLocalVal] = useState(String(value));

    // Sync from parent prop to local state
    useEffect(() => {
        // Only update if the numeric semantic value is different, to avoid overwriting "3." with "3"
        const parsed = parseFloat(localVal);
        if (parsed !== value && !isNaN(value)) {
            setLocalVal(String(value));
        }
    }, [value, localVal]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const nextVal = e.target.value;

        // Validation Logic
        if (nextVal === '') {
            setLocalVal('');
            return;
        }

        // 1. Integer check
        if (isInteger && !/^\d+$/.test(nextVal)) {
            return; // Reject non-digits
        }

        // 2. Decimal check
        if (decimalPlaces !== undefined) {
            // Regex: Start with digits, optionally a dot, optionally up to N digits
            // We construct regex dynamically or check string parts
            const parts = nextVal.split('.');
            if (parts.length > 2) return; // More than one dot
            if (parts.length === 2 && parts[1].length > decimalPlaces) return; // Too many decimals
        }

        setLocalVal(nextVal);

        const num = parseFloat(nextVal);
        if (!isNaN(num)) {
            // Optional: Clamp immediately or just let parent handle?
            // Let's pass the raw keypress value, but usually we clamp on Blur.
            // But if we pass > max, parent might accept it.
            // Let's just pass it.
            onChange(num);
        }
    };

    const handleBlur = () => {
        let num = parseFloat(localVal);
        if (isNaN(num)) num = min;

        // Clamp
        if (num < min) num = min;
        if (num > max) num = max;

        // Format
        if (isInteger) {
            num = Math.round(num);
            setLocalVal(String(num));
        } else if (decimalPlaces !== undefined) {
            // Round to decimal places
            const m = Math.pow(10, decimalPlaces);
            num = Math.round(num * m) / m;
            setLocalVal(String(num));
        } else {
            setLocalVal(String(num));
        }
        onChange(num);
    };

    const step = isInteger ? 1 : (decimalPlaces ? Math.pow(10, -decimalPlaces) : 1);

    const increment = () => {
        const newVal = Math.min(max, value + step);
        // Fix float precision issues
        const fixed = Number(newVal.toFixed(decimalPlaces || 0));
        onChange(fixed);
    };

    const decrement = () => {
        const newVal = Math.max(min, value - step);
        const fixed = Number(newVal.toFixed(decimalPlaces || 0));
        onChange(fixed);
    };

    return (
        <div className="space-y-1.5 hover:-translate-y-0.5 transition-transform duration-200">
            <label className="text-xs font-medium text-slate-500 ml-1">{label}</label>
            <div className="relative">
                <input
                    type="text" // Use text to allow full control over validation
                    inputMode={isInteger ? "numeric" : "decimal"}
                    value={localVal}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="w-full bg-white/50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-700 transition-all shadow-sm"
                />
                <div className="absolute right-0 top-0 h-full flex flex-col border-l border-slate-200">
                    <button onClick={increment} className="flex-1 px-2 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-tr-xl flex items-center justify-center group">
                        <ChevronUp className="w-3 h-3 group-hover:scale-110 transition-transform" />
                    </button>
                    <button onClick={decrement} className="flex-1 px-2 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-br-xl flex items-center justify-center group">
                        <ChevronDown className="w-3 h-3 group-hover:scale-110 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
}
