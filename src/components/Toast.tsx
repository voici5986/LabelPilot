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
        <div className="pointer-events-none fixed left-1/2 top-6 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2">
          <motion.div
            role={type === "error" ? "alert" : "status"}
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={`pointer-events-auto flex w-max max-w-full items-start gap-3 rounded-md border bg-elevated px-4 py-3 shadow-md transition-colors duration-200 ${
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

            <span className="min-w-0 break-words text-sm font-medium">
              {message}
            </span>

            <button
              type="button"
              aria-label={t("close")}
              onClick={onClose}
              className={`shrink-0 rounded-full p-1 text-text-muted transition-colors hover:text-text-main ${
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
