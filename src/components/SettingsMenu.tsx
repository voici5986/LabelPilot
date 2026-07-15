import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Settings } from "lucide-react";
import { useShallow } from "zustand/shallow";
import { useStore } from "../store/useStore";
import { useI18n } from "../utils/i18nContext";
import type { Translations } from "../utils/i18nContext";
import {
  A4_HEIGHT_MM,
  A4_WIDTH_MM,
  TEXT_CONFIG_LIMITS,
} from "../utils/layoutMath";
import type { PaperSize } from "../utils/layoutMath";
import { NumberInput } from "./NumberInput";
import { SegmentedControl } from "./SegmentedControl";

const PAPER_SIZE_KEYS: Record<PaperSize, keyof Translations> = {
  A4: "paper_type_a4",
  A3: "paper_type_a3",
  A5: "paper_type_a5",
  Letter: "paper_type_letter",
  Custom: "paper_type_custom",
};

export function SettingsMenu() {
  const {
    config,
    onConfigChange,
    appMode,
    onAppModeChange,
    textConfig,
    onTextConfigChange,
    paperSizeMode,
    onPaperSizeModeChange,
  } = useStore(
    useShallow((state) => ({
      config: state.config,
      onConfigChange: state.setConfig,
      appMode: state.appMode,
      onAppModeChange: state.setAppMode,
      textConfig: state.textConfig,
      onTextConfigChange: state.setTextConfig,
      paperSizeMode: state.paperSizeMode,
      onPaperSizeModeChange: state.setPaperSizeMode,
    })),
  );
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const presetsRef = useRef<HTMLDivElement>(null);
  const presetsTriggerRef = useRef<HTMLButtonElement>(null);
  const qrPrefixId = useId();
  const qrPrefixHintId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        !triggerRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setIsPresetsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    if (!isPresetsOpen) return;
    const frame = requestAnimationFrame(() => {
      presetsRef.current
        ?.querySelector<HTMLElement>('[role="menuitemradio"]')
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [isPresetsOpen]);

  const paperSize = paperSizeMode;
  const selectedPreset = paperSize === "Custom" ? "A4" : paperSize;

  const handlePaperSizeChange = (size: PaperSize) => {
    onPaperSizeModeChange(size);
    setIsPresetsOpen(false);
  };

  const handlePanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (isPresetsOpen) {
        setIsPresetsOpen(false);
        requestAnimationFrame(() => presetsTriggerRef.current?.focus());
      } else {
        setIsOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
      }
      return;
    }

    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
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

  const handlePresetMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;

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

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={t("settings")}
        aria-expanded={isOpen}
        aria-controls="global-settings-panel"
        className={`flex items-center justify-center gap-1 rounded-md p-2 text-text-muted transition-colors hover:bg-text-main/5 hover:text-brand-primary ${isOpen ? "bg-text-main/5 text-brand-primary" : ""}`}
        title={t("settings")}
      >
        <Settings className="h-5 w-5" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="global-settings-panel"
            role="dialog"
            aria-label={t("settings")}
            ref={panelRef}
            onKeyDown={handlePanelKeyDown}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.18 }}
            className="fixed left-2 right-2 top-12 z-50 rounded-lg border border-border-subtle bg-surface p-4 shadow-lg sm:absolute sm:left-auto sm:right-0 sm:w-80"
          >
            <div className="space-y-4">
              <div className="space-y-3">
                <span className="text-sm font-semibold uppercase tracking-wider text-text-muted">
                  {t("app_mode")}
                </span>
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

              <div className="space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {t("paper_size")}
                </span>

                <div className="flex gap-2">
                  <div className="group relative w-1/2" ref={presetsRef}>
                    <div className="flex h-full">
                      <button
                        type="button"
                        onClick={() => handlePaperSizeChange(selectedPreset)}
                        className={`flex flex-1 items-center justify-center gap-1 rounded-l-md border px-2 py-1.5 text-sm font-medium transition-colors ${
                          ["A4", "A3", "A5", "Letter"].includes(paperSize)
                            ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                            : "border-border-subtle text-text-muted hover:border-brand-primary/50"
                        }`}
                      >
                        {t(PAPER_SIZE_KEYS[selectedPreset])}
                      </button>
                      <button
                        ref={presetsTriggerRef}
                        type="button"
                        onClick={() => setIsPresetsOpen((open) => !open)}
                        aria-label={t("more_presets")}
                        aria-expanded={isPresetsOpen}
                        aria-controls="paper-preset-menu"
                        className={`flex items-center justify-center rounded-r-md border-y border-r px-1.5 py-1.5 transition-colors ${
                          ["A4", "A3", "A5", "Letter"].includes(paperSize)
                            ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                            : "border-border-subtle text-text-muted hover:border-brand-primary/50"
                        }`}
                      >
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${isPresetsOpen ? "rotate-180" : ""}`}
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
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 2 }}
                          transition={{ duration: 0.14 }}
                          className="absolute left-0 right-0 top-full z-[100] mt-1 overflow-hidden rounded-md border border-border-subtle bg-surface py-1 shadow-md"
                        >
                          {(["A4", "A3", "A5", "Letter"] as const).map(
                            (size) => (
                              <button
                                type="button"
                                role="menuitemradio"
                                aria-checked={paperSize === size}
                                key={size}
                                onClick={() => handlePaperSizeChange(size)}
                                className={`w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-brand-primary/10 ${paperSize === size ? "bg-brand-primary/5 font-semibold text-brand-primary" : "text-text-main"}`}
                              >
                                {t(PAPER_SIZE_KEYS[size])}
                              </button>
                            ),
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePaperSizeChange("Custom")}
                    className={`flex w-1/2 items-center justify-center rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                      paperSize === "Custom"
                        ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                        : "border-border-subtle text-text-muted hover:border-brand-primary/50"
                    }`}
                  >
                    {t("paper_type_custom")}
                  </button>
                </div>

                {paperSize === "Custom" && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <NumberInput
                      label={t("paper_width")}
                      value={config.pageWidthMm || A4_WIDTH_MM}
                      onChange={(value) =>
                        onConfigChange({ pageWidthMm: value })
                      }
                      min={50}
                      max={1000}
                    />
                    <NumberInput
                      label={t("paper_height")}
                      value={config.pageHeightMm || A4_HEIGHT_MM}
                      onChange={(value) =>
                        onConfigChange({ pageHeightMm: value })
                      }
                      min={50}
                      max={1000}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2 border-t border-border-subtle/50 pt-3">
                <label
                  htmlFor={qrPrefixId}
                  className="ml-0.5 block text-sm font-semibold uppercase tracking-wider text-text-muted"
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
                  onChange={(event) =>
                    onTextConfigChange({ qrContentPrefix: event.target.value })
                  }
                  className="input-base focus:input-base-focus w-full px-3 py-1.5 font-mono text-sm font-semibold"
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
