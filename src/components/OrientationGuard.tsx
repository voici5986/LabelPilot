import { useState, useEffect } from "react";
import { RotateCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "../utils/i18nContext";

export function OrientationGuard() {
  const { t } = useI18n();
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      // 只在移动端或较小屏幕下检查
      const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent,
        );
      const isPortraitMode = window.innerHeight > window.innerWidth;

      // 如果是移动端且处于竖屏，或者屏幕宽度真的很窄（模拟手机竖屏）
      setIsPortrait(isMobile && isPortraitMode);
    };

    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);

    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  return (
    <AnimatePresence>
      {isPortrait && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-zinc-950 text-white p-8 text-center"
        >
          <motion.div
            animate={{ rotate: 90 }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="mb-8 p-6 rounded-full bg-brand-primary/20 text-brand-primary"
          >
            <RotateCw className="w-16 h-16" />
          </motion.div>

          <h2 className="text-2xl font-semibold mb-4">
            {t("orientation_tip_title")}
          </h2>

          <p className="text-zinc-400 max-w-xs leading-relaxed">
            {t("orientation_tip_desc")}
          </p>

          <div className="mt-12 flex gap-2">
            <div className="w-12 h-8 border-2 border-brand-primary rounded-sm opacity-50" />
            <div className="w-8 h-12 border-2 border-white/20 rounded-sm" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
