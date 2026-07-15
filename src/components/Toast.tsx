import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, AlertCircle, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useI18n } from "../utils/i18nContext";

export type ToastType = "success" | "error" | "warning";

interface ToastProps {
  message: string;
  type: ToastType;
  isVisible: boolean;
  onClose: () => void;
}

export function Toast({ message, type, isVisible, onClose }: ToastProps) {
  const { t } = useI18n();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Auto close after 3 seconds
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onCloseRef.current();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, message]);

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <motion.div
            role={type === "error" ? "alert" : "status"}
            initial={{ y: -50, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`pointer-events-auto flex items-center gap-3 rounded-md border bg-surface px-4 py-3 shadow-md transition-colors duration-200 ${
              type === "success"
                ? "border-green-500/20 text-green-700 dark:text-green-300"
                : type === "error"
                  ? "border-red-500/20 text-red-700 dark:text-red-300"
                  : "border-amber-500/20 text-amber-800 dark:text-amber-300"
            }`}
          >
            {type === "success" ? (
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
            ) : type === "error" ? (
              <XCircle className="w-5 h-5 text-red-500 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            )}

            <span className="text-sm font-medium">{message}</span>

            <button
              type="button"
              aria-label={t("close")}
              onClick={onClose}
              className={`rounded-full p-1 text-text-muted transition-colors hover:text-text-main ${
                type === "success"
                  ? "hover:bg-green-500/10"
                  : type === "error"
                    ? "hover:bg-red-500/10"
                    : "hover:bg-amber-500/10"
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
