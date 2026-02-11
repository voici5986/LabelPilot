import { Printer, Globe, Sun, Moon, Monitor, Settings, X, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "../utils/i18n";
import { useState, useRef, useEffect } from "react";
import { 
    A4_WIDTH_MM, A4_HEIGHT_MM, 
    A3_WIDTH_MM, A3_HEIGHT_MM,
    A5_WIDTH_MM, A5_HEIGHT_MM,
    LETTER_WIDTH_MM, LETTER_HEIGHT_MM 
} from "../utils/layoutMath";
import type { HelperLayoutConfig } from "../utils/layoutMath";
import { NumberInput } from "./NumberInput";

interface HeaderProps {
    theme: 'system' | 'light' | 'dark';
    onThemeChange: (theme: 'system' | 'light' | 'dark') => void;
    config: HelperLayoutConfig;
    onConfigChange: (updates: Partial<HelperLayoutConfig>) => void;
}

export function Header({ theme, onThemeChange, config, onConfigChange }: HeaderProps) {
    const { t, language, setLanguage } = useI18n();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isPresetsOpen, setIsPresetsOpen] = useState(false);
    const settingsRef = useRef<HTMLDivElement>(null);
    const presetsRef = useRef<HTMLDivElement>(null);

    const toggleLanguage = () => {
        setLanguage(language === 'zh' ? 'en' : 'zh');
    };

    const toggleTheme = () => {
        const order: ('system' | 'light' | 'dark')[] = ['system', 'light', 'dark'];
        const nextIdx = (order.indexOf(theme) + 1) % order.length;
        onThemeChange(order[nextIdx]);
    };

    // Close settings when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
                setIsSettingsOpen(false);
            }
            if (presetsRef.current && !presetsRef.current.contains(event.target as Node)) {
                setIsPresetsOpen(false);
            }
        };
        if (isSettingsOpen || isPresetsOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isSettingsOpen, isPresetsOpen]);

    const ThemeIcon = {
        system: Monitor,
        light: Sun,
        dark: Moon,
    }[theme];

    const paperSize = (() => {
        const w = Math.round((config.pageWidthMm || A4_WIDTH_MM) * 10) / 10;
        const h = Math.round((config.pageHeightMm || A4_HEIGHT_MM) * 10) / 10;
        
        if (w === Math.round(A4_WIDTH_MM * 10) / 10 && h === Math.round(A4_HEIGHT_MM * 10) / 10) return 'A4';
        if (w === Math.round(A3_WIDTH_MM * 10) / 10 && h === Math.round(A3_HEIGHT_MM * 10) / 10) return 'A3';
        if (w === Math.round(A5_WIDTH_MM * 10) / 10 && h === Math.round(A5_HEIGHT_MM * 10) / 10) return 'A5';
        if (w === Math.round(LETTER_WIDTH_MM * 10) / 10 && h === Math.round(LETTER_HEIGHT_MM * 10) / 10) return 'Letter';
        return 'Custom';
    })();

    const handlePaperSizeChange = (size: 'A4' | 'A3' | 'A5' | 'Letter' | 'Custom') => {
        const presets = {
            A4: { pageWidthMm: A4_WIDTH_MM, pageHeightMm: A4_HEIGHT_MM },
            A3: { pageWidthMm: A3_WIDTH_MM, pageHeightMm: A3_HEIGHT_MM },
            A5: { pageWidthMm: A5_WIDTH_MM, pageHeightMm: A5_HEIGHT_MM },
            Letter: { pageWidthMm: LETTER_WIDTH_MM, pageHeightMm: LETTER_HEIGHT_MM },
        };

        if (size === 'Custom') {
            const currentW = config.pageWidthMm || A4_WIDTH_MM;
            onConfigChange({ 
                pageWidthMm: Math.round(currentW * 10) / 10 + 0.1 
            });
        } else {
            onConfigChange(presets[size]);
        }
        setIsPresetsOpen(false);
    };

    return (
        <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="h-10 glass-panel border-x-0 border-t-0 rounded-none z-30 px-6 flex items-center justify-between shrink-0 shadow-sm"
        >
            <div className="flex items-center gap-3">
                <div className="bg-brand-primary text-white p-1 rounded-lg shadow-lg shadow-brand-primary/30">
                    <Printer className="w-5 h-5" />
                </div>
                <div>
                    <h1 className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-brand-primary to-brand-secondary">
                        {t('main_title')}
                    </h1>
                </div>
            </div>
            <div className="flex items-center gap-2 relative">
                <button
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className={`text-text-muted hover:text-brand-primary transition-colors p-2 rounded-full hover:bg-text-main/5 flex items-center gap-1 ${isSettingsOpen ? 'text-brand-primary bg-text-main/5' : ''}`}
                    title={t('settings')}
                >
                    <Settings className={`w-5 h-5 ${isSettingsOpen ? 'rotate-90' : ''} transition-transform duration-300`} />
                </button>

                <AnimatePresence>
                    {isSettingsOpen && (
                        <motion.div
                            ref={settingsRef}
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute right-0 top-12 w-80 shadow-2xl p-4 z-50 border border-border-subtle rounded-xl"
                            style={{ 
                                backgroundColor: 'var(--color-surface)',
                                backdropFilter: 'none', 
                                WebkitBackdropFilter: 'none' 
                            }}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-text-main flex items-center gap-2">
                                    <Settings className="w-4 h-4 text-brand-primary" />
                                    {t('settings')}
                                </h3>
                                <button
                                    onClick={() => setIsSettingsOpen(false)}
                                    className="text-text-muted hover:text-text-main p-1 rounded-full hover:bg-text-main/5"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* Paper Size Section */}
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-text-muted uppercase tracking-wider">
                                        {t('paper_size')}
                                    </label>
                                    
                                    <div className="flex flex-col gap-2">
                                        <div className="flex gap-2">
                                            {/* A4 Button with Dropdown */}
                                            <div className="relative flex-1 group" ref={presetsRef}>
                                                <div className="flex">
                                                    <button
                                                        onClick={() => handlePaperSizeChange('A4')}
                                                        className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-l-md border transition-all flex items-center justify-center gap-1 ${['A4', 'A3', 'A5', 'Letter'].includes(paperSize)
                                                            ? 'bg-brand-primary/10 border-brand-primary text-brand-primary shadow-sm'
                                                            : 'border-border-subtle text-text-muted hover:border-brand-primary/50'
                                                            }`}
                                                    >
                                                        {['A4', 'A3', 'A5', 'Letter'].includes(paperSize) ? t(`paper_type_${paperSize.toLowerCase()}` as any) : t('paper_type_a4')}
                                                    </button>
                                                    <button
                                                        onClick={() => setIsPresetsOpen(!isPresetsOpen)}
                                                        className={`px-1.5 py-1.5 border-y border-r rounded-r-md transition-all ${['A4', 'A3', 'A5', 'Letter'].includes(paperSize)
                                                            ? 'bg-brand-primary/10 border-brand-primary text-brand-primary'
                                                            : 'border-border-subtle text-text-muted hover:border-brand-primary/50'
                                                            }`}
                                                    >
                                                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isPresetsOpen ? 'rotate-180' : ''}`} />
                                                    </button>
                                                </div>

                                                <AnimatePresence>
                                                    {isPresetsOpen && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 5 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: 5 }}
                                                            className="absolute left-0 right-0 top-full mt-1 border border-border-subtle rounded-md shadow-2xl z-[100] py-1 overflow-hidden"
                                                            style={{ 
                                                                backgroundColor: 'var(--color-surface)',
                                                                backdropFilter: 'none', 
                                                                WebkitBackdropFilter: 'none' 
                                                            }}
                                                        >
                                                            {(['A4', 'A3', 'A5', 'Letter'] as const).map((size) => (
                                                                <button
                                                                    key={size}
                                                                    onClick={() => handlePaperSizeChange(size)}
                                                                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-brand-primary/10 transition-colors ${paperSize === size ? 'text-brand-primary font-bold bg-brand-primary/5' : 'text-text-main'}`}
                                                                >
                                                                    {t(`paper_type_${size.toLowerCase()}` as any)}
                                                                </button>
                                                            ))}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>

                                            {/* Custom Button */}
                                            <button
                                                onClick={() => handlePaperSizeChange('Custom')}
                                                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md border transition-all ${paperSize === 'Custom'
                                                    ? 'bg-brand-primary/10 border-brand-primary text-brand-primary shadow-sm'
                                                    : 'border-border-subtle text-text-muted hover:border-brand-primary/50'
                                                    }`}
                                            >
                                                {t('paper_type_custom')}
                                            </button>
                                        </div>
                                    </div>

                                    {paperSize === 'Custom' && (
                                        <div className="grid grid-cols-2 gap-4 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <NumberInput
                                                label={t('paper_width')}
                                                value={config.pageWidthMm || A4_WIDTH_MM}
                                                onChange={(v) => onConfigChange({ pageWidthMm: v })}
                                                min={50}
                                                max={1000}
                                            />
                                            <NumberInput
                                                label={t('paper_height')}
                                                value={config.pageHeightMm || A4_HEIGHT_MM}
                                                onChange={(v) => onConfigChange({ pageHeightMm: v })}
                                                min={50}
                                                max={1000}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-border-subtle/50 my-2"></div>
                                
                                <div className="text-[10px] text-text-muted text-center italic opacity-60">
                                    More settings coming soon...
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <button
                    onClick={toggleLanguage}
                    className="text-text-muted hover:text-brand-primary transition-colors p-2 rounded-full hover:bg-text-main/5 flex items-center gap-1"
                    title="Switch Language"
                >
                    <Globe className="w-5 h-5" />
                    <span className="text-sm font-bold uppercase">{language}</span>
                </button>
                <button
                    onClick={toggleTheme}
                    className="text-text-muted hover:text-brand-primary transition-colors p-2 rounded-full hover:bg-text-main/5 relative flex items-center justify-center"
                    title={t('theme_toggle') || `Theme: ${theme}`}
                >
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={theme}
                            initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
                            animate={{ scale: 1, opacity: 1, rotate: 0 }}
                            exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
                            transition={{ duration: 0.2 }}
                        >
                            <ThemeIcon className="w-5 h-5" />
                        </motion.div>
                    </AnimatePresence>
                </button>
            </div>
        </motion.header>
    );
}
