import { Download, Globe, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/shallow";
import { useStore } from "../store/useStore";
import { useI18n } from "../utils/i18nContext";
import { LogoIcon } from "./LogoIcon";
import { SettingsMenu } from "./SettingsMenu";

export function Header() {
  const { theme, onThemeChange } = useStore(
    useShallow((state) => ({
      theme: state.theme,
      onThemeChange: state.setTheme,
    })),
  );
  const { t, language, setLanguage } = useI18n();
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () =>
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setCanInstall(false);
    setDeferredPrompt(null);
  };

  const toggleTheme = () => {
    const order = ["system", "light", "dark"] as const;
    onThemeChange(order[(order.indexOf(theme) + 1) % order.length]);
  };

  const ThemeIcon = {
    system: Monitor,
    light: Sun,
    dark: Moon,
  }[theme];

  return (
    <header className="z-30 flex h-10 shrink-0 items-center justify-between border-b border-border-subtle bg-surface px-2 sm:px-6">
      <div className="flex items-center gap-1">
        <LogoIcon size={32} className="shrink-0" />
        <div className="labelpilot-logotype hidden text-xl sm:flex">
          Label<span className="p-special">P</span>ilot
        </div>
      </div>

      <div className="relative flex items-center gap-2">
        {canInstall && (
          <button
            type="button"
            onClick={() => void handleInstallClick()}
            className="group flex items-center gap-1.5 rounded-md border border-brand-primary/20 bg-brand-primary/10 px-3 py-1.5 text-brand-primary transition-colors hover:bg-brand-primary/15"
            title={t("install_pwa")}
          >
            <Download className="h-4 w-4" />
            <span className="hidden text-sm font-semibold sm:inline">
              {t("install_btn")}
            </span>
          </button>
        )}

        <SettingsMenu />

        <button
          type="button"
          onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
          aria-label={t("language_toggle")}
          className="flex items-center justify-center gap-1 rounded-md p-2 text-text-muted transition-colors hover:bg-text-main/5 hover:text-brand-primary"
          title={t("language_toggle")}
        >
          <Globe className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase">{language}</span>
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`${t("theme_toggle")}: ${theme}`}
          className="flex items-center justify-center rounded-md p-2 text-text-muted transition-colors hover:bg-text-main/5 hover:text-brand-primary"
          title={t("theme_toggle") || `Theme: ${theme}`}
        >
          <ThemeIcon className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
