import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Ruler, Settings } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
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
import {
  getCurrentScreenEnvironment,
  isCalibrationStale,
} from "../utils/screenCalibration";
import { NumberInput } from "./NumberInput";
import { FieldShell } from "./ui/FieldShell";
import { IconButton } from "./ui/IconButton";

const PAPER_SIZE_KEYS: Record<PaperSize, keyof Translations> = {
  A4: "paper_type_a4",
  A3: "paper_type_a3",
  A5: "paper_type_a5",
  Letter: "paper_type_letter",
  Custom: "paper_type_custom",
};

interface SettingsMenuProps {
  onOpenCalibration: () => void;
  disabled?: boolean;
}

const PANEL_FOCUSABLE_SELECTOR =
  "button, input, select, textarea, a[href], [tabindex]";

function getPanelFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(PANEL_FOCUSABLE_SELECTOR),
  ).filter((element) => {
    if (
      element.hasAttribute("disabled") ||
      element.getAttribute("aria-hidden") === "true" ||
      element.hasAttribute("hidden") ||
      element.tabIndex < 0
    ) {
      return false;
    }
    for (
      let current: HTMLElement | null = element;
      current;
      current = current.parentElement
    ) {
      if (
        current.hasAttribute("hidden") ||
        current.getAttribute("aria-hidden") === "true" ||
        (current.tagName === "FIELDSET" &&
          (current as HTMLFieldSetElement).disabled)
      ) {
        return false;
      }
    }
    return true;
  });
}

export function SettingsMenu({
  onOpenCalibration,
  disabled = false,
}: SettingsMenuProps) {
  const {
    config,
    onConfigChange,
    textConfig,
    onTextConfigChange,
    paperSizeMode,
    onPaperSizeModeChange,
    screenCalibration,
  } = useStore(
    useShallow((state) => ({
      config: state.config,
      onConfigChange: state.setConfig,
      textConfig: state.textConfig,
      onTextConfigChange: state.setTextConfig,
      paperSizeMode: state.paperSizeMode,
      onPaperSizeModeChange: state.setPaperSizeMode,
      screenCalibration: state.screenCalibration,
    })),
  );

  const calibrationStale = screenCalibration
    ? isCalibrationStale(screenCalibration, getCurrentScreenEnvironment())
    : false;

  // 先把焦点放到“全局设置”触发按钮，再打开校准对话框，
  // 对话框关闭后焦点才能正确回到触发按钮（而非 BODY）。
  const handleCalibrationClick = () => {
    triggerRef.current?.focus();
    setIsOpen(false);
    setIsPresetsOpen(false);
    onOpenCalibration();
  };
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
    if (disabled) {
      setIsOpen(false);
      setIsPresetsOpen(false);
      return;
    }
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        !triggerRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setIsPresetsOpen(false);
        requestAnimationFrame(() => {
          const activeElement = document.activeElement;
          const focusIsInsidePanel =
            !!activeElement && panelRef.current?.contains(activeElement);
          if (activeElement === document.body || focusIsInsidePanel) {
            triggerRef.current?.focus();
          }
        });
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [disabled, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleFocusOutside = (event: FocusEvent) => {
      const target = event.target as Node;
      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
      setIsPresetsOpen(false);
    };

    document.addEventListener("focusin", handleFocusOutside);
    return () => document.removeEventListener("focusin", handleFocusOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (panel) getPanelFocusableElements(panel)[0]?.focus();
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
      if (event.defaultPrevented) return;
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
    <div className="relative" onKeyDown={handlePanelKeyDown}>
      <IconButton
        ref={triggerRef}
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        aria-label={t("settings")}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="global-settings-panel"
        size="lg"
        tone="brand"
        expandedHitArea
        className={isOpen ? "bg-text-main/5 text-brand-primary" : ""}
        title={t("settings")}
      >
        <Settings className="h-5 w-5" />
      </IconButton>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="global-settings-panel"
            role="dialog"
            aria-label={t("settings")}
            ref={panelRef}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed left-2 right-2 top-12 z-50 max-h-[calc(100dvh-4rem)] overflow-y-auto rounded-lg border border-border-subtle bg-elevated p-4 shadow-lg sm:absolute sm:left-auto sm:right-0 sm:w-80"
          >
            <fieldset
              disabled={disabled}
              className="m-0 space-y-4 border-0 p-0"
            >
              <div className="space-y-3">
                <span className="group-title">{t("paper_size")}</span>

                <div className="flex gap-2">
                  <div className="group relative w-1/2" ref={presetsRef}>
                    <div className="flex h-full">
                      <button
                        type="button"
                        onClick={() => handlePaperSizeChange(selectedPreset)}
                        className={`flex flex-1 items-center justify-center gap-1 rounded-l-md border px-2 py-1.5 text-sm font-medium transition-colors ${
                          ["A4", "A3", "A5", "Letter"].includes(paperSize)
                            ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                            : "border-border-subtle text-text-muted enabled:hover:border-brand-primary/50"
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
                            : "border-border-subtle text-text-muted enabled:hover:border-brand-primary/50"
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
                          transition={{ duration: 0.14, ease: "easeOut" }}
                          className="absolute left-0 right-0 top-full z-[100] mt-1 overflow-hidden rounded-md border border-border-subtle bg-elevated py-1 shadow-md"
                        >
                          {(["A4", "A3", "A5", "Letter"] as const).map(
                            (size) => (
                              <button
                                type="button"
                                role="menuitemradio"
                                aria-checked={paperSize === size}
                                key={size}
                                onClick={() => handlePaperSizeChange(size)}
                                className={`w-full px-3 py-1.5 text-left text-sm transition-colors enabled:hover:bg-brand-primary/10 ${paperSize === size ? "bg-brand-primary/5 font-semibold text-brand-primary" : "text-text-main"}`}
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
                        : "border-border-subtle text-text-muted enabled:hover:border-brand-primary/50"
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
                <FieldShell
                  label={t("qr_content_prefix")}
                  htmlFor={qrPrefixId}
                  hintId={qrPrefixHintId}
                  hint={
                    <span className="block text-right">
                      {textConfig.qrContentPrefix.length}/
                      {TEXT_CONFIG_LIMITS.qrContentPrefix.maxLength}
                    </span>
                  }
                >
                  <input
                    id={qrPrefixId}
                    name="qr-content-prefix"
                    type="text"
                    value={textConfig.qrContentPrefix}
                    maxLength={TEXT_CONFIG_LIMITS.qrContentPrefix.maxLength}
                    aria-describedby={qrPrefixHintId}
                    onChange={(event) =>
                      onTextConfigChange({
                        qrContentPrefix: event.target.value,
                      })
                    }
                    className="input-base focus:input-base-focus w-full px-3 py-1.5 font-mono text-sm font-semibold"
                    placeholder={t("qr_content_prefix_hint")}
                  />
                </FieldShell>
              </div>

              <div className="space-y-2 border-t border-border-subtle/50 pt-3">
                <span className="group-title">{t("calib_display_group")}</span>
                <button
                  type="button"
                  onClick={handleCalibrationClick}
                  className="hidden w-full items-center justify-between gap-2 rounded-md border border-border-subtle px-3 py-2 text-left text-sm font-medium text-text-main transition-colors enabled:hover:bg-text-main/5 enabled:active:bg-text-main/10 lg:flex"
                >
                  <span className="flex items-center gap-2">
                    <Ruler className="h-4 w-4 text-brand-primary" />
                    {t("calib_item")}
                  </span>
                  <span
                    className={`shrink-0 text-xs ${calibrationStale ? "text-warning" : "text-text-muted"}`}
                  >
                    {!screenCalibration
                      ? t("calib_state_none")
                      : calibrationStale
                        ? t("calib_state_stale")
                        : `${t("calib_state_ok")} · k=${screenCalibration.k.toFixed(3)}`}
                  </span>
                </button>
              </div>
            </fieldset>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
