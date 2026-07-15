import { useRegisterSW } from "virtual:pwa-register/react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, X } from "lucide-react";
import { useI18n } from "../utils/i18nContext";
import { useEffect, useRef, useState } from "react";

export function ReloadPrompt() {
  const { t } = useI18n();
  const updateIntervalRef = useRef<number | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const [updateError, setUpdateError] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const {
    offlineReady: offlineReadySW,
    needRefresh: needRefreshSW,
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      if (import.meta.env.DEV) console.log("SW Registered");
      registrationRef.current = r ?? null;
      // 自动检查更新逻辑
      if (r) {
        if (updateIntervalRef.current !== null) {
          clearInterval(updateIntervalRef.current);
        }
        updateIntervalRef.current = window.setInterval(
          () => {
            void r.update().catch((error: unknown) => {
              console.error("SW update check failed", error);
              setUpdateError(true);
            });
          },
          60 * 60 * 1000,
        ); // 每小时检查一次
      }
    },
    onRegisterError(error: unknown) {
      console.error("SW registration error", error);
      setUpdateError(true);
    },
  });

  const [offlineReady, setOfflineReady] = offlineReadySW || [false, () => {}];
  const [isNeedUpdate, setNeedUpdate] = needRefreshSW || [false, () => {}];

  const close = () => {
    setOfflineReady(false);
    setNeedUpdate(false);
    setUpdateError(false);
  };

  const applyUpdate = async () => {
    setIsUpdating(true);
    setUpdateError(false);
    try {
      if (isNeedUpdate) {
        await updateServiceWorker(true);
      } else if (registrationRef.current) {
        await registrationRef.current.update();
      }
    } catch (error) {
      console.error("SW update failed", error);
      setUpdateError(true);
    } finally {
      setIsUpdating(false);
    }
  };

  // 使用 offlineReady 状态
  useEffect(() => {
    if (offlineReady && import.meta.env.DEV) {
      console.log("App is ready to work offline");
    }
  }, [offlineReady]);

  useEffect(() => {
    return () => {
      if (updateIntervalRef.current !== null) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    };
  }, []);

  return (
    <AnimatePresence>
      {(isNeedUpdate || updateError) && (
        <motion.div
          role={updateError ? "alert" : "status"}
          aria-live={updateError ? "assertive" : "polite"}
          aria-atomic="true"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className="fixed bottom-6 right-6 z-[1000] flex min-w-[300px] flex-col gap-3 rounded-lg border border-brand-primary/20 bg-white p-4 shadow-lg dark:bg-gray-900"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-brand-primary/10 p-2 rounded-lg">
                <RefreshCw
                  className={`h-5 w-5 text-brand-primary ${isUpdating ? "animate-spin" : ""}`}
                />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-text-main">
                  {t(
                    updateError ? "pwa_update_error_title" : "pwa_update_title",
                  )}
                </h4>
                <p className="text-sm text-text-muted mt-0.5">
                  {t(updateError ? "pwa_update_error_desc" : "pwa_update_desc")}
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label={t("close")}
              onClick={close}
              className="rounded-full p-1 text-text-muted transition-colors hover:bg-text-main/5 hover:text-text-main"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => void applyUpdate()}
            disabled={isUpdating}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-brand-primary py-1.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-primary/90 disabled:cursor-wait disabled:opacity-70"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {isUpdating
              ? t("pwa_updating")
              : t(updateError ? "pwa_update_retry" : "pwa_update_btn")}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
