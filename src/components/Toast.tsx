import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, AlertCircle, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { useI18n } from "../utils/i18nContext";
import { IconButton } from "./ui/IconButton";

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
                ? "border-success/20 text-success"
                : type === "error"
                  ? "border-danger/20 text-danger"
                  : "border-warning/20 text-warning"
            }`}
          >
            {type === "success" ? (
              <CheckCircle className="h-5 w-5 shrink-0 text-success" />
            ) : type === "error" ? (
              <XCircle className="h-5 w-5 shrink-0 text-danger" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 text-warning" />
            )}

            <span className="min-w-0 break-words text-sm font-medium">
              {message}
            </span>

            <IconButton
              aria-label={t("close")}
              onClick={onClose}
              size="compact"
              tone={
                type === "success"
                  ? "success"
                  : type === "error"
                    ? "danger"
                    : "warning"
              }
              shape="full"
              expandedHitArea
            >
              <X />
            </IconButton>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
