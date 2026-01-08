import { Printer, Globe, Sun, Moon, Monitor } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "../utils/i18n";

interface HeaderProps {
    theme: 'system' | 'light' | 'dark';
    onThemeChange: (theme: 'system' | 'light' | 'dark') => void;
}

export function Header({ theme, onThemeChange }: HeaderProps) {
    const { t, language, setLanguage } = useI18n();

    const toggleLanguage = () => {
        setLanguage(language === 'zh' ? 'en' : 'zh');
    };

    const toggleTheme = () => {
        const order: ('system' | 'light' | 'dark')[] = ['system', 'light', 'dark'];
        const nextIdx = (order.indexOf(theme) + 1) % order.length;
        onThemeChange(order[nextIdx]);
    };

    const ThemeIcon = {
        system: Monitor,
        light: Sun,
        dark: Moon,
    }[theme];

    return (
        <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="h-10 glass-panel border-x-0 border-t-0 rounded-none z-20 px-6 flex items-center justify-between shrink-0 shadow-sm"
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
            <div className="flex items-center gap-2">
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
