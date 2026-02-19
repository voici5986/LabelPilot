import { Globe, Sun, Moon, Monitor, Settings, ChevronDown, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "../utils/i18n";
import { useState, useRef, useEffect } from "react";
import { LogoIcon } from "./LogoIcon";
import {
    A4_WIDTH_MM, A4_HEIGHT_MM,
    A3_WIDTH_MM, A3_HEIGHT_MM,
    A5_WIDTH_MM, A5_HEIGHT_MM,
    LETTER_WIDTH_MM, LETTER_HEIGHT_MM
} from "../utils/layoutMath";
import { NumberInput } from "./NumberInput";
import { SegmentedControl } from "./SegmentedControl";
import { useStore } from "../store/useStore";

export function Header() {
    const {
        theme, setTheme: onThemeChange,
        config, setConfig: onConfigChange,
        appMode, setAppMode: onAppModeChange,
        textConfig, setTextConfig: onTextConfigChange
    } = useStore();
    const { t, language, setLanguage } = useI18n();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isPresetsOpen, setIsPresetsOpen] = useState(false);
    const [isCustomPaper, setIsCustomPaper] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [canInstall, setCanInstall] = useState(false);
    const settingsRef = useRef<HTMLDivElement>(null);
    const presetsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setCanInstall(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setCanInstall(false);
        }

        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setCanInstall(false);
        }
        setDeferredPrompt(null);
    };

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

    const derivedPaperSize = (() => {
        const w = Math.round((config.pageWidthMm || A4_WIDTH_MM) * 10) / 10;
        const h = Math.round((config.pageHeightMm || A4_HEIGHT_MM) * 10) / 10;

        if (w === Math.round(A4_WIDTH_MM * 10) / 10 && h === Math.round(A4_HEIGHT_MM * 10) / 10) return 'A4';
        if (w === Math.round(A3_WIDTH_MM * 10) / 10 && h === Math.round(A3_HEIGHT_MM * 10) / 10) return 'A3';
        if (w === Math.round(A5_WIDTH_MM * 10) / 10 && h === Math.round(A5_HEIGHT_MM * 10) / 10) return 'A5';
        if (w === Math.round(LETTER_WIDTH_MM * 10) / 10 && h === Math.round(LETTER_HEIGHT_MM * 10) / 10) return 'Letter';
        return 'Custom';
    })();
    const paperSize = isCustomPaper ? 'Custom' : derivedPaperSize;

    const handlePaperSizeChange = (size: 'A4' | 'A3' | 'A5' | 'Letter' | 'Custom') => {
        const presets = {
            A4: { pageWidthMm: A4_WIDTH_MM, pageHeightMm: A4_HEIGHT_MM },
            A3: { pageWidthMm: A3_WIDTH_MM, pageHeightMm: A3_HEIGHT_MM },
            A5: { pageWidthMm: A5_WIDTH_MM, pageHeightMm: A5_HEIGHT_MM },
            Letter: { pageWidthMm: LETTER_WIDTH_MM, pageHeightMm: LETTER_HEIGHT_MM },
        };

        if (size === 'Custom') {
            setIsCustomPaper(true);
        } else {
            onConfigChange(presets[size]);
            setIsCustomPaper(false);
        }
        setIsPresetsOpen(false);
    };

    return (
        <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="h-10 glass-panel border-x-0 border-t-0 rounded-none z-30 px-6 flex items-center justify-between shrink-0 shadow-sm"
        >
            <div className="flex items-center gap-1">
                <LogoIcon size={32} className="shrink-0" />
                <div className="labelpilot-logotype text-xl">
                    Label<span className="p-special">P</span>ilot
                </div>
            </div>
            <div className="flex items-center gap-2 relative">
                {canInstall && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={handleInstallClick}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary/10 text-brand-primary rounded-full hover:bg-brand-primary/20 transition-all border border-brand-primary/20 group"
                        title={t('install_pwa')}
                    >
                        <Download className="w-4 h-4 group-hover:bounce" />
                        <span className="text-sm font-semibold hidden sm:inline">{t('install_btn')}</span>
                    </motion.button>
                )}

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
                            <div className="space-y-4">
                                {/* App Mode Section */}
                                <div className="space-y-3">
                                    <label className="text-sm font-semibold text-text-muted uppercase tracking-wider">
                                        {t('app_mode')}
                                    </label>
                                    <SegmentedControl
                                        layoutId="app-mode-active"
                                        value={appMode}
                                        onChange={onAppModeChange}
                                        options={[
                                            { label: t('mode_image'), value: 'image' },
                                            { label: t('mode_text'), value: 'text' }
                                        ]}
                                    />
                                </div>

                                {/* Paper Size Section */}
                                <div className="space-y-3">
                                    <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">
                                        {t('paper_size')}
                                    </label>

                                    <div className="flex flex-col gap-2">
                                        <div className="flex gap-2">
                                            {/* A4 Button with Dropdown */}
                                            <div className="relative w-1/2 group" ref={presetsRef}>
                                                <div className="flex h-full">
                                                    <button
                                                        onClick={() => handlePaperSizeChange('A4')}
                                                        className={`flex-1 px-2 py-1.5 text-sm font-medium rounded-l-md border transition-all flex items-center justify-center gap-1 ${['A4', 'A3', 'A5', 'Letter'].includes(paperSize)
                                                            ? 'bg-brand-primary/10 border-brand-primary text-brand-primary shadow-sm'
                                                            : 'border-border-subtle text-text-muted hover:border-brand-primary/50'
                                                            }`}
                                                    >
                                                        {['A4', 'A3', 'A5', 'Letter'].includes(paperSize) ? t(`paper_type_${paperSize.toLowerCase()}` as any) : t('paper_type_a4')}
                                                    </button>
                                                    <button
                                                        onClick={() => setIsPresetsOpen(!isPresetsOpen)}
                                                        className={`px-1.5 py-1.5 border-y border-r rounded-r-md transition-all flex items-center justify-center ${['A4', 'A3', 'A5', 'Letter'].includes(paperSize)
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
                                                                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-brand-primary/10 transition-colors ${paperSize === size ? 'text-brand-primary font-semibold bg-brand-primary/5' : 'text-text-main'}`}
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
                                                className={`w-1/2 px-3 py-1.5 text-sm font-medium rounded-md border transition-all flex items-center justify-center ${paperSize === 'Custom'
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

                                {/* QR Prefix Section (Low Frequency) */}
                                <div className="space-y-3 pt-2 border-t border-border-subtle/50">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-text-muted uppercase tracking-wider block ml-0.5">
                                            {t('qr_content_prefix')}
                                        </label>
                                        <input
                                            type="text"
                                            value={textConfig.qrContentPrefix}
                                            onChange={(e) => onTextConfigChange({ qrContentPrefix: e.target.value })}
                                            className="w-full input-base focus:input-base-focus px-3 py-1.5 text-sm font-mono font-semibold"
                                            placeholder={t('qr_content_prefix_hint')}
                                        />
                                    </div>
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
                    <span className="text-sm font-semibold uppercase">{language}</span>
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
