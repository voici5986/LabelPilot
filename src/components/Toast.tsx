import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, AlertCircle, X } from "lucide-react";
import { useEffect } from "react";

export type ToastType = 'success' | 'error' | 'warning';

interface ToastProps {
    message: string;
    type: ToastType;
    isVisible: boolean;
    onClose: () => void;
}

export function Toast({ message, type, isVisible, onClose }: ToastProps) {
    // Auto close after 3 seconds
    useEffect(() => {
        if (isVisible) {
            const timer = setTimeout(() => {
                onClose();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isVisible, onClose]);

    return (
        <AnimatePresence>
            {isVisible && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                    <motion.div
                        initial={{ y: -50, opacity: 0, scale: 0.9 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: -20, opacity: 0, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border backdrop-blur-glass ${type === 'success'
                            ? 'bg-glass-surface/90 border-green-200 text-green-800'
                            : type === 'error'
                                ? 'bg-glass-surface/90 border-red-200 text-red-800'
                                : 'bg-glass-surface/90 border-amber-200 text-amber-800'
                            }`}
                    >
                        {type === 'success' ? (
                            <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                        ) : type === 'error' ? (
                            <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                        ) : (
                            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                        )}

                        <span className="text-sm font-medium">{message}</span>

                        <button
                            onClick={onClose}
                            className={`p-1 rounded-full text-slate-400 hover:text-slate-600 transition-colors ${type === 'success' ? 'hover:bg-green-100' : type === 'error' ? 'hover:bg-red-100' : 'hover:bg-amber-100'
                                }`}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
