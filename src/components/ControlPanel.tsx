import { UploadCloud, Grid, Layout, File as FileIcon, FileMinus } from "lucide-react";
import type { HelperLayoutConfig } from "../utils/layoutMath";
import { 
    A4_WIDTH_MM, A4_HEIGHT_MM, 
    A3_WIDTH_MM, A3_HEIGHT_MM, 
    A5_WIDTH_MM, A5_HEIGHT_MM, 
    LETTER_WIDTH_MM, LETTER_HEIGHT_MM 
} from "../utils/layoutMath";
import { motion, Reorder } from "framer-motion";
import { useI18n } from "../utils/i18n";
import { NumberInput } from "./NumberInput";
import { SmartButton } from "./SmartButton";
import { ThumbnailItem } from "./ThumbnailItem";
import { useMemo } from "react";

import type { ImageItem } from "../App";

interface ControlPanelProps {
    config: HelperLayoutConfig;
    onConfigChange: (updates: Partial<HelperLayoutConfig>) => void;
    onFilesSelect: (files: File[]) => void;
    imageItems: ImageItem[];
    onReorder: (newItems: ImageItem[]) => void;
    onItemCountChange: (id: string, count: number) => void;
    onGeneratePdf: () => void;
    genStatus?: 'idle' | 'generating' | 'success' | 'error';
    genProgress?: number;
    maxRows?: number;
    maxCols?: number;
    appMode: 'image' | 'text';
    textConfig: {
        prefix: string;
        startNumber: number;
        digits: number;
        count: number;
    };
    onTextConfigChange: (updates: Partial<ControlPanelProps['textConfig']>) => void;
}

export function ControlPanel({
    config,
    onConfigChange,
    onFilesSelect,
    imageItems,
    onReorder,
    onItemCountChange,
    onGeneratePdf,
    genStatus = 'idle',
    genProgress = 0,
    maxRows = 20,
    maxCols = 20,
    appMode,
    textConfig,
    onTextConfigChange
}: ControlPanelProps) {
    const { t } = useI18n();

    // 局部化逻辑：计算显示的文件名或数量
    const selectedFileName = useMemo(() => {
        if (imageItems.length === 0) return "";
        if (imageItems.length === 1) return imageItems[0].file.name;
        return t('files_selected', { n: imageItems.length });
    }, [imageItems, t]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onFilesSelect(Array.from(e.target.files));
        }
    };

    // Calculate current paper size info
    const paperSizeInfo = useMemo(() => {
        const w = Math.round((config.pageWidthMm || A4_WIDTH_MM) * 10) / 10;
        const h = Math.round((config.pageHeightMm || A4_HEIGHT_MM) * 10) / 10;

        let label = 'Custom';
        if (w === Math.round(A4_WIDTH_MM * 10) / 10 && h === Math.round(A4_HEIGHT_MM * 10) / 10) label = 'A4';
        else if (w === Math.round(A3_WIDTH_MM * 10) / 10 && h === Math.round(A3_HEIGHT_MM * 10) / 10) label = 'A3';
        else if (w === Math.round(A5_WIDTH_MM * 10) / 10 && h === Math.round(A5_HEIGHT_MM * 10) / 10) label = 'A5';
        else if (w === Math.round(LETTER_WIDTH_MM * 10) / 10 && h === Math.round(LETTER_HEIGHT_MM * 10) / 10) label = 'Letter';

        return `${label}, ${w}×${h}mm`;
    }, [config.pageWidthMm, config.pageHeightMm]);

    return (
        <aside className="w-80 glass-panel border-r-0 flex flex-col z-10 m-2 rounded-xl shadow-lg">
            <div className="p-6 overflow-y-auto flex-1 space-y-6 scrollbar-hide">

                {appMode === 'image' ? (
                    <>
                        {/* File Selection */}
                        <div className="space-y-3">
                            <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider flex items-center gap-2">
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
                                <div className={`absolute inset-0 bg-brand-primary/5 rounded-lg border-2 border-dashed transition-colors ${selectedFileName ? 'border-brand-primary bg-brand-primary/10' : 'border-brand-primary/20 group-hover:border-brand-primary/40'}`}></div>
                                <div className="relative flex flex-row items-center gap-3 py-3 px-4 pointer-events-none">
                                    <div className="bg-surface p-2 rounded-full shadow-sm flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                                        <UploadCloud className={`w-6 h-6 ${selectedFileName ? 'text-brand-primary' : 'text-brand-primary/40'}`} />
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col items-center">
                                        <p className="text-sm font-bold text-text-main truncate w-full text-center">
                                            {selectedFileName || t('browse_btn')}
                                        </p>
                                        {!selectedFileName && <p className="text-[12px] text-text-muted text-center">{t('browse_hint')}</p>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Image List */}
                        <div className="flex-1 min-h-0">
                            <Reorder.Group
                                axis="y"
                                values={imageItems}
                                onReorder={onReorder}
                                className="space-y-2"
                            >
                                {imageItems.map((item) => (
                                    <Reorder.Item
                                        key={item.id}
                                        value={item}
                                        dragListener={true}
                                    >
                                        <ThumbnailItem
                                            item={item}
                                            onCountChange={(count) => onItemCountChange(item.id, count)}
                                            onRemove={() => {
                                                const newItems = imageItems.filter(i => i.id !== item.id);
                                                onReorder(newItems);
                                            }}
                                        />
                                    </Reorder.Item>
                                ))}
                            </Reorder.Group>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Text Numbering Config */}
                        <div className="space-y-4">
                            <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider flex items-center gap-2">
                                <Grid className="w-4 h-4" /> {t('text_config_group')}
                            </h2>

                            <div className="space-y-4 bg-text-main/5 p-4 rounded-xl border border-border-subtle">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-text-muted">{t('text_prefix')}</label>
                                    <input 
                                        type="text"
                                        value={textConfig.prefix}
                                        onChange={(e) => onTextConfigChange({ prefix: e.target.value })}
                                        className="w-full bg-surface border border-border-subtle rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all font-mono"
                                        placeholder="SN-"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <NumberInput 
                                        label={t('text_start_number')}
                                        value={textConfig.startNumber}
                                        onChange={(val) => onTextConfigChange({ startNumber: val })}
                                        min={0}
                                        max={999999}
                                    />
                                    <NumberInput 
                                        label={t('text_digits')}
                                        value={textConfig.digits}
                                        onChange={(val) => onTextConfigChange({ digits: val })}
                                        min={1}
                                        max={10}
                                    />
                                </div>

                                <NumberInput 
                                    label={t('text_count')}
                                    value={textConfig.count}
                                    onChange={(val) => onTextConfigChange({ count: val })}
                                    min={1}
                                    max={500}
                                />
                            </div>
                        </div>
                    </>
                )}

                {/* Grid Settings */}
                <div className="space-y-4">
                    <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider flex items-center gap-2">
                        <Grid className="w-4 h-4" /> {t('layout_group')}
                    </h2>

                    <div className="grid grid-cols-2 gap-4">
                        <NumberInput
                            label={t('rows')}
                            value={config.rows}
                            onChange={(v) => onConfigChange({ rows: v })}
                            min={1} max={maxRows}
                            isInteger
                        />
                        <NumberInput
                            label={t('cols')}
                            value={config.cols}
                            onChange={(v) => onConfigChange({ cols: v })}
                            min={1} max={maxCols}
                            isInteger
                        />
                    </div>

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
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider flex items-center gap-2">
                            <Layout className="w-4 h-4" /> {t('orientation')}
                        </h2>
                        <span className="text-[14px] font-medium text-text-muted opacity-80">
                            {paperSizeInfo}
                        </span>
                    </div>
                    <div className="bg-text-main/5 p-1 rounded-lg flex border border-border-subtle relative isolate">
                        <button
                            type="button"
                            onClick={() => onConfigChange({ orientation: 'portrait' })}
                            className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors relative z-0 ${config.orientation === 'portrait' ? 'text-brand-primary' : 'text-text-muted hover:text-text-main'}`}
                        >
                            {config.orientation === 'portrait' && (
                                <motion.div
                                    layoutId="orientation-active"
                                    className="absolute inset-0 bg-surface shadow-sm rounded-lg -z-10"
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}
                            <FileIcon className="w-4 h-4" /> {t('portrait')}
                        </button>
                        <button
                            type="button"
                            onClick={() => onConfigChange({ orientation: 'landscape' })}
                            className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors relative z-0 ${config.orientation === 'landscape' ? 'text-brand-primary' : 'text-text-muted hover:text-text-main'}`}
                        >
                            {config.orientation === 'landscape' && (
                                <motion.div
                                    layoutId="orientation-active"
                                    className="absolute inset-0 bg-surface shadow-sm rounded-lg -z-10"
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}
                            <FileMinus className="w-4 h-4 transform rotate-90" /> {t('landscape')}
                        </button>
                    </div>
                </div>

            </div>

            {/* Action Button */}
            <div className="p-6 border-t border-glass-border bg-text-main/5 backdrop-blur-sm rounded-b-xl overflow-hidden relative">
                <SmartButton
                    onClick={onGeneratePdf}
                    disabled={appMode === 'image' ? !selectedFileName : false}
                    genStatus={genStatus}
                    genProgress={genProgress}
                />
            </div>
        </aside>
    );
}
