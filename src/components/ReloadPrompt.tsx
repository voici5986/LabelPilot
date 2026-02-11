import { useRegisterSW } from 'virtual:pwa-register/react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';
import { useI18n } from '../utils/i18n';

export function ReloadPrompt() {
    const { t } = useI18n();
    const {
        offlineReady,
        needRefresh,
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r: ServiceWorkerRegistration | undefined) {
            console.log('SW Registered');
            // 自动检查更新逻辑
            if (r) {
                setInterval(() => {
                    r.update();
                }, 60 * 60 * 1000); // 每小时检查一次
            }
        },
        onRegisterError(error: unknown) {
            console.log('SW registration error', error);
        },
    });

    const [_, setOfflineReady] = offlineReady || [false, () => {}];
    const [isNeedUpdate, setNeedUpdate] = needRefresh || [false, () => {}];

    const close = () => {
        setOfflineReady(false);
        setNeedUpdate(false);
    };

    return (
        <AnimatePresence>
            {isNeedUpdate && (
                <motion.div
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 50, opacity: 0 }}
                    className="fixed bottom-6 right-6 z-[1000] p-4 rounded-xl shadow-2xl bg-white dark:bg-gray-900 border border-brand-primary/20 flex flex-col gap-3 min-w-[300px]"
                >
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-brand-primary/10 p-2 rounded-lg">
                                <RefreshCw className="w-5 h-5 text-brand-primary animate-spin-slow" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-text-main">
                                    {t('pwa_update_title') || 'Update Available'}
                                </h4>
                                <p className="text-sm text-text-muted mt-0.5">
                                    {t('pwa_update_desc') || 'A new version is available, click update to refresh.'}
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={close}
                            className="text-text-muted hover:text-text-main p-1 rounded-full hover:bg-text-main/5 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <button
                        onClick={() => updateServiceWorker(true)}
                        className="w-full py-1.5 bg-brand-primary text-white text-sm font-semibold rounded-lg hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        {t('pwa_update_btn') || 'Update Now'}
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
