import { Download, Globe, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/shallow";

import { useStore } from "../store/useStore";
import { useI18n } from "../utils/i18nContext";
import { LogoIcon } from "./LogoIcon";
import { SettingsMenu } from "./SettingsMenu";
import { IconButton } from "./ui/IconButton";

interface HeaderProps {
  onOpenCalibration: () => void;
  isGenerating?: boolean;
}

export function Header({
  onOpenCalibration,
  isGenerating = false,
}: HeaderProps) {
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
            aria-label={t("install_pwa")}
            className="group flex items-center gap-1.5 rounded-md border border-brand-primary/20 bg-brand-primary/10 px-3 py-1.5 text-brand-primary transition-colors enabled:hover:bg-brand-primary/15 enabled:active:bg-brand-primary/20"
            title={t("install_pwa")}
          >
            <Download className="h-4 w-4" />
            <span className="hidden text-sm font-semibold sm:inline">
              {t("install_btn")}
            </span>
          </button>
        )}

        <SettingsMenu
          onOpenCalibration={onOpenCalibration}
          disabled={isGenerating}
        />

        <button
          type="button"
          onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
          aria-label={t("language_toggle")}
          className="hit-target flex items-center justify-center gap-1 rounded-md p-2 text-text-muted transition-colors enabled:hover:bg-text-main/5 enabled:hover:text-brand-primary enabled:active:bg-text-main/10 [--hit-target-inset:-4px]"
          title={t("language_toggle")}
        >
          <Globe className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase">{language}</span>
        </button>

        <IconButton
          onClick={toggleTheme}
          aria-label={`${t("theme_toggle")}: ${theme}`}
          size="lg"
          tone="brand"
          expandedHitArea
          title={t("theme_toggle") || `Theme: ${theme}`}
        >
          <ThemeIcon />
        </IconButton>
      </div>
    </header>
  );
}
