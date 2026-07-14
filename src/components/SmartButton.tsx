import { motion, AnimatePresence } from "framer-motion";
import { Download, CheckCircle, AlertCircle, X } from "lucide-react";
import { useI18n } from "../utils/i18nContext";
import type { Translations } from "../utils/i18nContext";
import type { PdfProgressPhase } from "../utils/pdfProgress";

interface SmartButtonProps {
  onClick: () => void;
  onCancel?: () => void;
  disabled: boolean;
  genStatus: "idle" | "generating" | "success" | "error";
  genProgress: number;
  genPhase: PdfProgressPhase;
}

export function SmartButton({
  onClick,
  onCancel,
  disabled,
  genStatus,
  genProgress,
  genPhase,
}: SmartButtonProps) {
  const { t } = useI18n();
  const phaseKeys: Record<PdfProgressPhase, keyof Translations> = {
    reading: "pdf_phase_reading",
    preparing: "pdf_phase_preparing",
    rendering: "pdf_phase_rendering",
    serializing: "pdf_phase_serializing",
  };
  const phaseText = t(phaseKeys[genPhase]);
  const progressText =
    genPhase === "serializing" ? phaseText : `${phaseText} ${genProgress}%`;

  return (
    <>
      <motion.button
        type="button"
        layout
        whileHover={
          !disabled && genStatus === "idle"
            ? { filter: "brightness(1.08)" }
            : {}
        }
        whileTap={
          !disabled && genStatus === "idle"
            ? { filter: "brightness(0.92)" }
            : {}
        }
        initial={false}
        animate={
          (!disabled && genStatus === "idle") ||
          genStatus === "success" ||
          genStatus === "error"
            ? {
                opacity: 1,
                filter: "grayscale(0%)",
              }
            : {
                opacity: 0.7,
                filter: "grayscale(100%)",
              }
        }
        transition={{ duration: 0.2 }}
        onClick={genStatus === "generating" ? onCancel : onClick}
        disabled={genStatus === "idle" ? disabled : genStatus !== "generating"}
        className={`w-full py-3 px-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 relative overflow-hidden group transition-all duration-200
                ${
                  genStatus === "success"
                    ? "bg-green-700 text-white shadow-sm"
                    : genStatus === "error"
                      ? "bg-red-600 text-white shadow-sm"
                      : !disabled && genStatus === "idle"
                        ? "bg-brand-primary text-on-brand shadow-[0_1px_2px_rgba(0,0,0,0.1)] active:shadow-none"
                        : genStatus === "generating"
                          ? "bg-text-main/5 text-text-muted border border-border-subtle"
                          : "bg-text-main/10 text-text-muted cursor-not-allowed"
                }`}
      >
        {/* Progress Background */}
        {genStatus === "generating" && (
          <motion.div
            className="absolute inset-0 bg-brand-primary/10 origin-left"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: genProgress / 100 }}
            transition={{ type: "spring", bounce: 0, duration: 0.5 }}
          />
        )}

        <AnimatePresence mode="wait">
          {genStatus === "generating" ? (
            <motion.div
              key="generating"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 relative z-10"
            >
              <X className="w-5 h-5" />
              <span>
                {t("cancel_generation")} · {progressText}
              </span>
            </motion.div>
          ) : genStatus === "success" ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="flex items-center gap-2 relative z-10"
            >
              <CheckCircle className="w-5 h-5" />
              <span>{t("gen_success_short")}</span>
            </motion.div>
          ) : genStatus === "error" ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="flex items-center gap-2 relative z-10"
            >
              <AlertCircle className="w-5 h-5" />
              <span>{t("gen_failed")}</span>
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
              <span>{t("generate_btn")}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {genStatus === "generating"
          ? progressText
          : genStatus === "success"
            ? t("gen_success")
            : ""}
      </span>
    </>
  );
}
