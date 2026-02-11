import { motion, AnimatePresence } from "framer-motion";
import { Download, CheckCircle, AlertCircle } from "lucide-react";
import { useI18n } from "../utils/i18n";

interface SmartButtonProps {
    onClick: () => void;
    disabled: boolean;
    genStatus: 'idle' | 'generating' | 'success' | 'error';
    genProgress: number;
}

export function SmartButton({ onClick, disabled, genStatus, genProgress }: SmartButtonProps) {
    const { t } = useI18n();

    return (
        <motion.button
            type="button"
            layout
            whileHover={!disabled && genStatus === 'idle' ? { scale: 1.02, boxShadow: "0 10px 25px -5px rgba(79, 70, 229, 0.4)" } : {}}
            whileTap={!disabled && genStatus === 'idle' ? { scale: 0.98 } : {}}
            initial={false}
            animate={
                (!disabled && genStatus === 'idle') || genStatus === 'success' || genStatus === 'error' ? {
                    opacity: 1,
                    scale: 1,
                    filter: "grayscale(0%)",
                    boxShadow: genStatus === 'success'
                        ? "0 10px 25px -5px rgba(34, 197, 94, 0.4)"
                        : genStatus === 'error'
                            ? "0 10px 25px -5px rgba(239, 68, 68, 0.4)"
                            : "0 4px 6px -1px rgba(79, 70, 229, 0.1), 0 2px 4px -1px rgba(79, 70, 229, 0.06)"
                } : {
                    opacity: 0.7,
                    scale: 1,
                    filter: "grayscale(100%)",
                    boxShadow: "none"
                }
            }
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={onClick}
            disabled={disabled || genStatus !== 'idle'}
            className={`w-full py-3.5 px-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 relative overflow-hidden group transition-colors duration-300
                ${genStatus === 'success'
                    ? 'bg-green-500 text-white'
                    : genStatus === 'error'
                        ? 'bg-red-500 text-white'
                        : !disabled && genStatus === 'idle'
                            ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white'
                            : genStatus === 'generating'
                                ? 'bg-text-main/5 text-text-muted border border-border-subtle'
                                : 'bg-text-main/10 text-text-muted cursor-not-allowed'}`}
        >
            {/* Progress Background */}
            {genStatus === 'generating' && (
                <motion.div
                    className="absolute inset-0 bg-brand-primary/10 origin-left"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: genProgress / 100 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                />
            )}

            <AnimatePresence mode="wait">
                {genStatus === 'generating' ? (
                    <motion.div
                        key="generating"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center gap-2 relative z-10"
                    >
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                            <Download className="w-5 h-5" />
                        </motion.div>
                        <span>{genProgress}%...</span>
                    </motion.div>
                ) : genStatus === 'success' ? (
                    <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className="flex items-center gap-2 relative z-10"
                    >
                        <CheckCircle className="w-5 h-5" />
                        <span>{t('gen_success').split('!')[0]}!</span>
                    </motion.div>
                ) : genStatus === 'error' ? (
                    <motion.div
                        key="error"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className="flex items-center gap-2 relative z-10"
                    >
                        <AlertCircle className="w-5 h-5" />
                        <span>{t('gen_failed')}</span>
                    </motion.div>
                ) : (
                    <motion.div
                        key="idle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2 relative z-10"
                    >
                        <Download className="w-5 h-5" />
                        <span>{t('generate_btn')}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.button>
    );
}
