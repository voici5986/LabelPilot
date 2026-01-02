import { Printer, Globe, HelpCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "../utils/i18n";

export function Header() {
    const { t, language, setLanguage } = useI18n();

    const toggleLanguage = () => {
        setLanguage(language === 'zh' ? 'th' : 'zh');
    };

    return (
        <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="h-12 bg-white/80 backdrop-blur-md border-b border-white/50 z-20 px-6 flex items-center justify-between shrink-0 shadow-sm"
        >
            <div className="flex items-center gap-3">
                <div className="bg-indigo-600 text-white p-2 rounded-lg shadow-lg shadow-indigo-500/30">
                    <Printer className="w-5 h-5" />
                </div>
                <div>
                    <h1 className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500">
                        {t('main_title')}
                    </h1>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={toggleLanguage}
                    className="text-slate-500 hover:text-indigo-600 transition-colors p-2 rounded-full hover:bg-slate-100/50 flex items-center gap-1"
                    title="Switch Language"
                >
                    <Globe className="w-5 h-5" />
                    <span className="text-xs font-bold uppercase">{language}</span>
                </button>
                <button className="text-slate-500 hover:text-indigo-600 transition-colors p-2 rounded-full hover:bg-slate-100/50">
                    <HelpCircle className="w-5 h-5" />
                </button>
            </div>
        </motion.header>
    );
}
