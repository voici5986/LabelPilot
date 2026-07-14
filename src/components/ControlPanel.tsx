import { UploadCloud, Grid, File as FileIcon, FileMinus } from "lucide-react";
import {
  getPaperSizeInfo,
  calculateLabelLayout,
  TEXT_CONFIG_LIMITS,
} from "../utils/layoutMath";
import { motion, Reorder, AnimatePresence } from "framer-motion";
import { useI18n } from "../utils/i18nContext";
import { NumberInput } from "./NumberInput";
import { SmartButton } from "./SmartButton";
import { ThumbnailItem } from "./ThumbnailItem";
import { SegmentedControl } from "./SegmentedControl";
import { useId, useMemo } from "react";
import { useStore } from "../store/useStore";
import { useShallow } from "zustand/shallow";
import { getTextOutputMetrics } from "../utils/textValidation";
import type { PdfProgressPhase } from "../utils/pdfProgress";

interface ControlPanelProps {
  onFilesSelect: (files: File[]) => void | Promise<void>;
  onGeneratePdf: () => void;
  onCancelPdf?: () => void;
  genStatus?: "idle" | "generating" | "success" | "error";
  genProgress?: number;
  genPhase?: PdfProgressPhase;
  maxRows?: number;
  maxCols?: number;
}

export function ControlPanel({
  onFilesSelect,
  onGeneratePdf,
  onCancelPdf,
  genStatus = "idle",
  genProgress = 0,
  genPhase = "preparing",
  maxRows = 20,
  maxCols = 20,
}: ControlPanelProps) {
  const {
    config,
    onConfigChange,
    imageItems,
    onReorder,
    onItemCountChange,
    appMode,
    textConfig,
    onTextConfigChange,
  } = useStore(
    useShallow((state) => ({
      config: state.config,
      onConfigChange: state.setConfig,
      imageItems: state.imageItems,
      onReorder: state.setImageItems,
      onItemCountChange: state.updateItemCount,
      appMode: state.appMode,
      textConfig: state.textConfig,
      onTextConfigChange: state.setTextConfig,
    })),
  );
  const { t } = useI18n();
  const fileInputId = useId();
  const textPrefixId = useId();
  const qrSizeId = useId();
  const textPrefixHintId = useId();

  const layout = useMemo(() => calculateLabelLayout(config), [config]);
  const layoutError = layout.error;
  const textOutputMetrics = useMemo(
    () => getTextOutputMetrics(config, textConfig),
    [config, textConfig],
  );
  const textOutputError = textOutputMetrics.error
    ? t(textOutputMetrics.error.code, textOutputMetrics.error.params)
    : null;

  // 局部化逻辑：计算显示的文件名或数量
  const selectedFileName = useMemo(() => {
    if (imageItems.length === 0) return "";
    if (imageItems.length === 1) return imageItems[0].file.name;
    return t("files_selected", { n: imageItems.length });
  }, [imageItems, t]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    if (input.files && input.files.length > 0) {
      try {
        await onFilesSelect(Array.from(input.files));
      } finally {
        input.value = "";
      }
    }
  };

  // Calculate current paper size info
  const paperSizeInfo = useMemo(() => {
    const info = getPaperSizeInfo(config);
    const w = Math.round(info.pageWidthMm * 10) / 10;
    const h = Math.round(info.pageHeightMm * 10) / 10;
    return `${info.label}, ${w}×${h}mm`;
  }, [config]);

  return (
    <aside className="glass-panel z-10 flex h-auto w-full flex-col overflow-hidden rounded-xl border-r-0 shadow-lg lg:h-full">
      <div className="flex-1 space-y-6 p-4 scrollbar-hide lg:overflow-y-auto lg:p-6">
        {/* 1. Grid/Layout Settings */}
        <div className="space-y-4 pb-2 border-b border-border-subtle/30">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
              <Grid className="w-4 h-4" /> {t("layout_group")}
            </h2>
            <span className="text-[13px] font-medium text-text-muted">
              {paperSizeInfo}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <NumberInput
              label={t("rows")}
              value={config.rows}
              onChange={(v) => onConfigChange({ rows: v })}
              min={1}
              max={maxRows}
              isInteger
            />
            <NumberInput
              label={t("cols")}
              value={config.cols}
              onChange={(v) => onConfigChange({ cols: v })}
              min={1}
              max={maxCols}
              isInteger
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <NumberInput
              label={`${t("margin")} (mm)`}
              value={config.marginMm}
              onChange={(v) => onConfigChange({ marginMm: v })}
              min={0}
              max={50}
              decimalPlaces={1}
              step={1}
            />
            <NumberInput
              label={`${t("spacing")} (mm)`}
              value={config.spacingMm}
              onChange={(v) => onConfigChange({ spacingMm: v })}
              min={0}
              max={30}
              decimalPlaces={1}
              step={1}
            />
          </div>

          {/* Orientation Controls (Merged here) */}
          <SegmentedControl
            label={t("orientation")}
            layoutId="orientation-active"
            value={config.orientation}
            onChange={(v) => onConfigChange({ orientation: v })}
            options={[
              { label: t("portrait"), value: "portrait", icon: FileIcon },
              { label: t("landscape"), value: "landscape", icon: FileMinus },
            ]}
            className="mt-2"
          />
        </div>

        {appMode === "image" ? (
          <>
            {/* File Selection */}
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                <UploadCloud className="w-4 h-4" /> {t("file_group")}
              </h2>

              <div className="relative group cursor-pointer rounded-lg transition-transform active:scale-[0.98] focus-within:ring-2 focus-within:ring-brand-primary focus-within:ring-offset-2">
                <input
                  id={fileInputId}
                  name="label-images"
                  type="file"
                  multiple
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={handleFileChange}
                  aria-label={t("browse_btn")}
                  className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                />
                <div
                  className={`absolute inset-0 bg-brand-primary/5 rounded-lg border-2 border-dashed transition-colors ${selectedFileName ? "border-brand-primary bg-brand-primary/10" : "border-brand-primary/20 group-hover:border-brand-primary/40"}`}
                ></div>
                <div className="relative flex flex-row items-center gap-3 py-3 px-4 pointer-events-none">
                  <div className="bg-surface p-2 rounded-full shadow-sm flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <UploadCloud
                      className={`w-6 h-6 ${selectedFileName ? "text-brand-primary" : "text-brand-primary/40"}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col items-center">
                    <p className="text-sm font-semibold text-text-main truncate w-full text-center">
                      {selectedFileName || t("browse_btn")}
                    </p>
                    {!selectedFileName && (
                      <p className="text-[12px] text-text-muted text-center">
                        {t("browse_hint")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Image List */}
            <div className="flex-1 min-h-0">
              <Reorder.Group
                axis="y"
                values={imageItems}
                onReorder={onReorder}
                className="space-y-2"
              >
                {imageItems.map((item) => (
                  <Reorder.Item key={item.id} value={item} dragListener={true}>
                    <ThumbnailItem
                      item={item}
                      onCountChange={(count) =>
                        onItemCountChange(item.id, count)
                      }
                      onRemove={() => {
                        const newItems = imageItems.filter(
                          (i) => i.id !== item.id,
                        );
                        onReorder(newItems);
                      }}
                    />
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            </div>
          </>
        ) : (
          <>
            {/* Text Numbering Config */}
            <div className="space-y-4">
              <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                <Grid className="w-4 h-4" /> {t("text_config_group")}
              </h2>

              <div className="space-y-4">
                <div className="space-y-1.5 flex-1">
                  <label
                    htmlFor={textPrefixId}
                    className="text-sm font-medium text-text-muted ml-0.5"
                  >
                    {t("text_prefix")}
                  </label>
                  <input
                    id={textPrefixId}
                    name="text-prefix"
                    type="text"
                    value={textConfig.prefix}
                    maxLength={TEXT_CONFIG_LIMITS.prefix.maxLength}
                    aria-describedby={textPrefixHintId}
                    onChange={(e) =>
                      onTextConfigChange({ prefix: e.target.value })
                    }
                    className="w-full input-base focus:input-base-focus px-3 py-1.5 text-sm font-mono font-semibold"
                    placeholder="SN-"
                  />
                  <div
                    id={textPrefixHintId}
                    className="flex justify-between gap-2 text-xs text-text-muted"
                  >
                    <span>
                      {t("estimated_font_size", {
                        size: textOutputMetrics.fontSizePt.toFixed(1),
                      })}
                    </span>
                    <span>
                      {textConfig.prefix.length}/
                      {TEXT_CONFIG_LIMITS.prefix.maxLength}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <NumberInput
                    label={t("text_start_number")}
                    value={textConfig.startNumber}
                    onChange={(val) => onTextConfigChange({ startNumber: val })}
                    min={0}
                    max={999999}
                    isInteger
                  />
                  <NumberInput
                    label={t("text_digits")}
                    value={textConfig.digits}
                    onChange={(val) => onTextConfigChange({ digits: val })}
                    min={1}
                    max={10}
                    isInteger
                  />
                </div>

                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <NumberInput
                      label={t("text_count")}
                      value={textConfig.count}
                      onChange={(val) => onTextConfigChange({ count: val })}
                      min={1}
                      max={500}
                      isInteger
                    />
                  </div>
                  <div className="flex flex-col items-center gap-1.5 pb-0.5">
                    <span className="text-sm font-medium text-text-muted whitespace-nowrap">
                      {t("qr_enable")}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={textConfig.showQrCode}
                      aria-label={t("qr_enable")}
                      onClick={() =>
                        onTextConfigChange({
                          showQrCode: !textConfig.showQrCode,
                        })
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/20 ${textConfig.showQrCode ? "bg-brand-primary" : "bg-text-main/10"}`}
                      title={t("qr_enable")}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${textConfig.showQrCode ? "translate-x-6" : "translate-x-1"}`}
                      />
                    </button>
                  </div>
                </div>

                {/* QR Code Size Slider - NO border, integrated flow */}
                <AnimatePresence initial={false}>
                  {textConfig.showQrCode && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-1.5 pb-1 space-y-2">
                        <div className="flex items-center justify-between text-sm font-medium text-text-muted">
                          <div className="flex items-center gap-2">
                            <Grid className="w-3.5 h-3.5" />
                            <span>{t("qr_size")}</span>
                          </div>
                          <span className="font-mono text-xs">
                            {Math.round(textConfig.qrSizeRatio * 100)}%
                          </span>
                        </div>
                        <input
                          id={qrSizeId}
                          name="qr-size"
                          aria-label={t("qr_size")}
                          type="range"
                          min="0.1"
                          max="0.6"
                          step="0.05"
                          value={textConfig.qrSizeRatio}
                          onChange={(e) =>
                            onTextConfigChange({
                              qrSizeRatio: parseFloat(e.target.value),
                            })
                          }
                          className="w-full h-1.5 bg-text-main/10 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {textOutputError && (
                  <p
                    role="alert"
                    className="text-sm text-red-700 dark:text-red-300"
                  >
                    {textOutputError}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Action Button */}
      <div className="p-1 border-t border-glass-border backdrop-blur-sm rounded-b-xl overflow-hidden relative">
        <SmartButton
          onClick={onGeneratePdf}
          onCancel={onCancelPdf}
          disabled={
            !!layoutError ||
            (appMode === "image" ? !selectedFileName : !!textOutputError)
          }
          genStatus={genStatus}
          genProgress={genProgress}
          genPhase={genPhase}
        />
      </div>
    </aside>
  );
}
