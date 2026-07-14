import {
  Globe,
  Sun,
  Moon,
  Monitor,
  Settings,
  ChevronDown,
  Download,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "../utils/i18nContext";
import type { Translations } from "../utils/i18nContext";
import { useState, useRef, useEffect, useId } from "react";
import { LogoIcon } from "./LogoIcon";
import {
  A4_WIDTH_MM,
  A4_HEIGHT_MM,
  A3_WIDTH_MM,
  A3_HEIGHT_MM,
  A5_WIDTH_MM,
  A5_HEIGHT_MM,
  LETTER_WIDTH_MM,
  LETTER_HEIGHT_MM,
  getPaperSizeInfo,
  TEXT_CONFIG_LIMITS,
} from "../utils/layoutMath";
import { NumberInput } from "./NumberInput";
import { SegmentedControl } from "./SegmentedControl";
import { useStore } from "../store/useStore";
import { useShallow } from "zustand/shallow";

const PAPER_SIZE_KEYS: Record<string, keyof Translations> = {
  A4: "paper_type_a4",
  A3: "paper_type_a3",
  A5: "paper_type_a5",
  Letter: "paper_type_letter",
  Custom: "paper_type_custom",
};

export function Header() {
  const {
    theme,
    onThemeChange,
    config,
    onConfigChange,
    appMode,
    onAppModeChange,
    textConfig,
    onTextConfigChange,
  } = useStore(
    useShallow((state) => ({
      theme: state.theme,
      onThemeChange: state.setTheme,
      config: state.config,
      onConfigChange: state.setConfig,
      appMode: state.appMode,
      onAppModeChange: state.setAppMode,
      textConfig: state.textConfig,
      onTextConfigChange: state.setTextConfig,
    })),
  );
  const { t, language, setLanguage } = useI18n();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const [isCustomPaper, setIsCustomPaper] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const presetsRef = useRef<HTMLDivElement>(null);
  const presetsTriggerRef = useRef<HTMLButtonElement>(null);
  const qrPrefixId = useId();
  const qrPrefixHintId = useId();

  // Initialize paper size state based on config
  useEffect(() => {
    const info = getPaperSizeInfo(config);
    setIsCustomPaper(info.label === "Custom");
  }, [config]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setCanInstall(false);
    }

    return () =>
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    // @ts-expect-error - prompt() is not standard yet
    deferredPrompt.prompt();
    // @ts-expect-error - userChoice is not standard yet
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setCanInstall(false);
    }
    setDeferredPrompt(null);
  };

  const toggleLanguage = () => {
    setLanguage(language === "zh" ? "en" : "zh");
  };

  const toggleTheme = () => {
    const order: ("system" | "light" | "dark")[] = ["system", "light", "dark"];
    const nextIdx = (order.indexOf(theme) + 1) % order.length;
    onThemeChange(order[nextIdx]);
  };

  // Close settings when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(event.target as Node) &&
        !settingsTriggerRef.current?.contains(event.target as Node)
      ) {
        setIsSettingsOpen(false);
      }
      if (
        presetsRef.current &&
        !presetsRef.current.contains(event.target as Node)
      ) {
        setIsPresetsOpen(false);
      }
    };
    if (isSettingsOpen || isPresetsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSettingsOpen, isPresetsOpen]);

  useEffect(() => {
    if (!isSettingsOpen) return;
    const frame = requestAnimationFrame(() => {
      settingsRef.current
        ?.querySelector<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [isSettingsOpen]);

  useEffect(() => {
    if (!isPresetsOpen) return;
    const frame = requestAnimationFrame(() => {
      presetsRef.current
        ?.querySelector<HTMLElement>('[role="menuitemradio"]')
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [isPresetsOpen]);

  const handleSettingsKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (isPresetsOpen) {
        setIsPresetsOpen(false);
        requestAnimationFrame(() => presetsTriggerRef.current?.focus());
      } else {
        setIsSettingsOpen(false);
        requestAnimationFrame(() => settingsTriggerRef.current?.focus());
      }
      return;
    }

    if (event.key !== "Tab" || !settingsRef.current) return;
    const focusable = Array.from(
      settingsRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handlePresetMenuKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      return;
    }
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        '[role="menuitemradio"]',
      ),
    );
    if (items.length === 0) return;
    event.preventDefault();
    const current = Math.max(
      0,
      items.indexOf(document.activeElement as HTMLElement),
    );
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : event.key === "ArrowDown"
            ? (current + 1) % items.length
            : (current - 1 + items.length) % items.length;
    items[next].focus();
  };

  const ThemeIcon = {
    system: Monitor,
    light: Sun,
    dark: Moon,
  }[theme];

  const paperSizeInfo = getPaperSizeInfo(config);
  const paperSize = isCustomPaper ? "Custom" : paperSizeInfo.label;

  const handlePaperSizeChange = (
    size: "A4" | "A3" | "A5" | "Letter" | "Custom",
  ) => {
    const presets = {
      A4: { pageWidthMm: A4_WIDTH_MM, pageHeightMm: A4_HEIGHT_MM },
      A3: { pageWidthMm: A3_WIDTH_MM, pageHeightMm: A3_HEIGHT_MM },
      A5: { pageWidthMm: A5_WIDTH_MM, pageHeightMm: A5_HEIGHT_MM },
      Letter: { pageWidthMm: LETTER_WIDTH_MM, pageHeightMm: LETTER_HEIGHT_MM },
    };

    if (size === "Custom") {
      setIsCustomPaper(true);
    } else {
      onConfigChange(presets[size]);
      setIsCustomPaper(false);
    }
    setIsPresetsOpen(false);
  };

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="glass-panel z-30 flex h-10 shrink-0 items-center justify-between rounded-none border-x-0 border-t-0 px-2 shadow-sm sm:px-6"
    >
      <div className="flex items-center gap-1">
        <LogoIcon size={32} className="shrink-0" />
        <div className="labelpilot-logotype hidden text-xl sm:flex">
          Label<span className="p-special">P</span>ilot
        </div>
      </div>
      <div className="flex items-center gap-2 relative">
        {canInstall && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 rounded-full border border-brand-primary/20 bg-brand-primary/10 px-3 py-1.5 text-brand-primary transition-all hover:bg-brand-primary/20 group"
            title={t("install_pwa")}
          >
            <Download className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
            <span className="text-sm font-semibold hidden sm:inline">
              {t("install_btn")}
            </span>
          </motion.button>
        )}

        <button
          ref={settingsTriggerRef}
          type="button"
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          aria-label={t("settings")}
          aria-expanded={isSettingsOpen}
          aria-controls="global-settings-panel"
          className={`flex items-center justify-center gap-1 rounded-full p-2 text-text-muted transition-colors hover:bg-text-main/5 hover:text-brand-primary ${isSettingsOpen ? "text-brand-primary bg-text-main/5" : ""}`}
          title={t("settings")}
        >
          <Settings
            className={`w-5 h-5 ${isSettingsOpen ? "rotate-90" : ""} transition-transform duration-300`}
          />
        </button>

        <AnimatePresence>
          {isSettingsOpen && (
            <motion.div
              id="global-settings-panel"
              role="dialog"
              aria-label={t("settings")}
              ref={settingsRef}
              onKeyDown={handleSettingsKeyDown}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="fixed left-2 right-2 top-12 z-50 rounded-xl border border-border-subtle p-4 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:w-80"
              style={{
                backgroundColor: "var(--color-surface)",
                backdropFilter: "none",
                WebkitBackdropFilter: "none",
              }}
            >
              <div className="space-y-4">
                {/* App Mode Section */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-text-muted uppercase tracking-wider">
                    {t("app_mode")}
                  </label>
                  <SegmentedControl
                    label={t("app_mode")}
                    layoutId="app-mode-active"
                    value={appMode}
                    onChange={onAppModeChange}
                    options={[
                      { label: t("mode_image"), value: "image" },
                      { label: t("mode_text"), value: "text" },
                    ]}
                  />
                </div>

                {/* Paper Size Section */}
                <div className="space-y-3">
                  <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">
                    {t("paper_size")}
                  </label>

                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      {/* A4 Button with Dropdown */}
                      <div className="relative w-1/2 group" ref={presetsRef}>
                        <div className="flex h-full">
                          <button
                            type="button"
                            onClick={() => handlePaperSizeChange("A4")}
                            className={`flex flex-1 items-center justify-center gap-1 rounded-l-md border px-2 py-1.5 text-sm font-medium transition-all ${
                              ["A4", "A3", "A5", "Letter"].includes(paperSize)
                                ? "bg-brand-primary/10 border-brand-primary text-brand-primary shadow-sm"
                                : "border-border-subtle text-text-muted hover:border-brand-primary/50"
                            }`}
                          >
                            {t(PAPER_SIZE_KEYS[paperSize] || "paper_type_a4")}
                          </button>
                          <button
                            ref={presetsTriggerRef}
                            type="button"
                            onClick={() => setIsPresetsOpen(!isPresetsOpen)}
                            aria-label={t("more_presets")}
                            aria-expanded={isPresetsOpen}
                            aria-controls="paper-preset-menu"
                            className={`flex items-center justify-center rounded-r-md border-y border-r px-1.5 py-1.5 transition-all ${
                              ["A4", "A3", "A5", "Letter"].includes(paperSize)
                                ? "bg-brand-primary/10 border-brand-primary text-brand-primary"
                                : "border-border-subtle text-text-muted hover:border-brand-primary/50"
                            }`}
                          >
                            <ChevronDown
                              className={`w-3.5 h-3.5 transition-transform ${isPresetsOpen ? "rotate-180" : ""}`}
                            />
                          </button>
                        </div>

                        <AnimatePresence>
                          {isPresetsOpen && (
                            <motion.div
                              id="paper-preset-menu"
                              role="menu"
                              aria-label={t("more_presets")}
                              onKeyDown={handlePresetMenuKeyDown}
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 5 }}
                              className="absolute left-0 right-0 top-full mt-1 border border-border-subtle rounded-md shadow-2xl z-[100] py-1 overflow-hidden"
                              style={{
                                backgroundColor: "var(--color-surface)",
                                backdropFilter: "none",
                                WebkitBackdropFilter: "none",
                              }}
                            >
                              {(["A4", "A3", "A5", "Letter"] as const).map(
                                (size) => (
                                  <button
                                    type="button"
                                    role="menuitemradio"
                                    aria-checked={paperSize === size}
                                    key={size}
                                    onClick={() => handlePaperSizeChange(size)}
                                    className={`w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-brand-primary/10 ${paperSize === size ? "text-brand-primary font-semibold bg-brand-primary/5" : "text-text-main"}`}
                                  >
                                    {t(PAPER_SIZE_KEYS[size])}
                                  </button>
                                ),
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Custom Button */}
                      <button
                        type="button"
                        onClick={() => handlePaperSizeChange("Custom")}
                        className={`flex w-1/2 items-center justify-center rounded-md border px-3 py-1.5 text-sm font-medium transition-all ${
                          paperSize === "Custom"
                            ? "bg-brand-primary/10 border-brand-primary text-brand-primary shadow-sm"
                            : "border-border-subtle text-text-muted hover:border-brand-primary/50"
                        }`}
                      >
                        {t("paper_type_custom")}
                      </button>
                    </div>
                  </div>

                  {paperSize === "Custom" && (
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <NumberInput
                        label={t("paper_width")}
                        value={config.pageWidthMm || A4_WIDTH_MM}
                        onChange={(v) => onConfigChange({ pageWidthMm: v })}
                        min={50}
                        max={1000}
                      />
                      <NumberInput
                        label={t("paper_height")}
                        value={config.pageHeightMm || A4_HEIGHT_MM}
                        onChange={(v) => onConfigChange({ pageHeightMm: v })}
                        min={50}
                        max={1000}
                      />
                    </div>
                  )}
                </div>

                {/* QR Prefix Section (Low Frequency) */}
                <div className="space-y-3 pt-2 border-t border-border-subtle/50">
                  <div className="space-y-2">
                    <label
                      htmlFor={qrPrefixId}
                      className="text-sm font-semibold text-text-muted uppercase tracking-wider block ml-0.5"
                    >
                      {t("qr_content_prefix")}
                    </label>
                    <input
                      id={qrPrefixId}
                      name="qr-content-prefix"
                      type="text"
                      value={textConfig.qrContentPrefix}
                      maxLength={TEXT_CONFIG_LIMITS.qrContentPrefix.maxLength}
                      aria-describedby={qrPrefixHintId}
                      onChange={(e) =>
                        onTextConfigChange({ qrContentPrefix: e.target.value })
                      }
                      className="w-full input-base focus:input-base-focus px-3 py-1.5 text-sm font-mono font-semibold"
                      placeholder={t("qr_content_prefix_hint")}
                    />
                    <p
                      id={qrPrefixHintId}
                      className="text-right text-xs text-text-muted"
                    >
                      {textConfig.qrContentPrefix.length}/
                      {TEXT_CONFIG_LIMITS.qrContentPrefix.maxLength}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={toggleLanguage}
          aria-label={t("language_toggle")}
          className="flex items-center justify-center gap-1 rounded-full p-2 text-text-muted transition-colors hover:bg-text-main/5 hover:text-brand-primary"
          title="Switch Language"
        >
          <Globe className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase">{language}</span>
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`${t("theme_toggle")}: ${theme}`}
          className="relative flex items-center justify-center rounded-full p-2 text-text-muted transition-colors hover:bg-text-main/5 hover:text-brand-primary"
          title={t("theme_toggle") || `Theme: ${theme}`}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={theme}
              initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
              transition={{ duration: 0.2 }}
            >
              <ThemeIcon className="w-5 h-5" />
            </motion.div>
          </AnimatePresence>
        </button>
      </div>
    </motion.header>
  );
}
