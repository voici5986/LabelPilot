import { useId, useMemo } from "react";
import type { ChangeEvent } from "react";
import { Reorder } from "framer-motion";
import { File as FileIcon, FileMinus, Grid, UploadCloud } from "lucide-react";
import { useShallow } from "zustand/shallow";
import { useStore } from "../store/useStore";
import { useI18n } from "../utils/i18nContext";
import {
  calculateLabelLayout,
  getPaperSizeInfo,
  LAYOUT_CONFIG_LIMITS,
} from "../utils/layoutMath";
import type { PdfProgressPhase } from "../utils/pdfProgress";
import { getTextOutputMetrics } from "../utils/textValidation";
import { NumberInput } from "./NumberInput";
import { SegmentedControl } from "./SegmentedControl";
import { SmartButton } from "./SmartButton";
import { TextModeFields } from "./TextModeFields";
import { ThumbnailItem } from "./ThumbnailItem";

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
  maxRows,
  maxCols,
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
    paperSizeMode,
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
      paperSizeMode: state.paperSizeMode,
    })),
  );
  const { t } = useI18n();
  const fileInputId = useId();
  const orientationMaxRows = LAYOUT_CONFIG_LIMITS.rows[config.orientation];
  const orientationMaxCols = LAYOUT_CONFIG_LIMITS.cols[config.orientation];
  const effectiveMaxRows = Math.max(
    1,
    Math.min(maxRows ?? orientationMaxRows, orientationMaxRows),
  );
  const effectiveMaxCols = Math.max(
    1,
    Math.min(maxCols ?? orientationMaxCols, orientationMaxCols),
  );

  const layout = useMemo(() => calculateLabelLayout(config), [config]);
  const textOutputMetrics = useMemo(
    () => getTextOutputMetrics(config, textConfig),
    [config, textConfig],
  );
  const textOutputError = textOutputMetrics.error
    ? t(textOutputMetrics.error.code, textOutputMetrics.error.params)
    : null;

  const selectedFileName = useMemo(() => {
    if (imageItems.length === 0) return "";
    if (imageItems.length === 1) return imageItems[0].file.name;
    return t("files_selected", { n: imageItems.length });
  }, [imageItems, t]);

  const paperSizeInfo = useMemo(() => {
    const info = getPaperSizeInfo(config);
    const width = Math.round(info.pageWidthMm * 10) / 10;
    const height = Math.round(info.pageHeightMm * 10) / 10;
    const label =
      paperSizeMode === "Custom" ? t("paper_type_custom") : paperSizeMode;
    return `${label}, ${width}×${height}mm`;
  }, [config, paperSizeMode, t]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    if (!input.files?.length) return;

    try {
      await onFilesSelect(Array.from(input.files));
    } finally {
      input.value = "";
    }
  };

  return (
    <aside className="z-10 flex h-auto w-full flex-col overflow-hidden rounded-lg border border-border-subtle bg-surface lg:h-full">
      <div className="flex-1 space-y-5 p-4 scrollbar-hide lg:overflow-y-auto lg:p-5">
        <div className="space-y-4 border-b border-border-subtle/60 pb-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
              <Grid className="h-4 w-4" /> {t("layout_group")}
            </h2>
            <span className="text-xs font-medium text-text-muted">
              {paperSizeInfo}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <NumberInput
              label={t("rows")}
              value={config.rows}
              onChange={(value) => onConfigChange({ rows: value })}
              min={1}
              max={effectiveMaxRows}
              isInteger
            />
            <NumberInput
              label={t("cols")}
              value={config.cols}
              onChange={(value) => onConfigChange({ cols: value })}
              min={1}
              max={effectiveMaxCols}
              isInteger
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <NumberInput
              label={`${t("margin")} (mm)`}
              value={config.marginMm}
              onChange={(value) => onConfigChange({ marginMm: value })}
              min={0}
              max={50}
              decimalPlaces={1}
              step={1}
            />
            <NumberInput
              label={`${t("spacing")} (mm)`}
              value={config.spacingMm}
              onChange={(value) => onConfigChange({ spacingMm: value })}
              min={0}
              max={30}
              decimalPlaces={1}
              step={1}
            />
          </div>

          <SegmentedControl
            label={t("orientation")}
            layoutId="orientation-active"
            value={config.orientation}
            onChange={(orientation) => onConfigChange({ orientation })}
            options={[
              { label: t("portrait"), value: "portrait", icon: FileIcon },
              {
                label: t("landscape"),
                value: "landscape",
                icon: FileMinus,
                iconClassName: "rotate-90",
              },
            ]}
            className="mt-2"
          />
        </div>

        {appMode === "image" ? (
          <>
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                <UploadCloud className="h-4 w-4" /> {t("file_group")}
              </h2>

              <div className="group relative cursor-pointer rounded-md focus-within:ring-2 focus-within:ring-brand-primary focus-within:ring-offset-2">
                <input
                  id={fileInputId}
                  name="label-images"
                  type="file"
                  multiple
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={(event) => void handleFileChange(event)}
                  aria-label={t("browse_btn")}
                  className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                />
                <div
                  className={`absolute inset-0 rounded-md border border-dashed transition-colors ${selectedFileName ? "border-brand-primary bg-brand-primary/10" : "border-brand-primary/30 bg-brand-primary/5 group-hover:border-brand-primary/60"}`}
                />
                <div className="pointer-events-none relative flex items-center gap-3 px-4 py-3">
                  <div className="shrink-0 rounded-md bg-text-main/5 p-2">
                    <UploadCloud
                      className={`h-6 w-6 ${selectedFileName ? "text-brand-primary" : "text-brand-primary/50"}`}
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="w-full truncate text-sm font-semibold text-text-main">
                      {selectedFileName || t("browse_btn")}
                    </p>
                    {!selectedFileName && (
                      <p className="text-xs text-text-muted">
                        {t("browse_hint")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1">
              <Reorder.Group
                axis="y"
                values={imageItems}
                onReorder={onReorder}
                className="space-y-2"
              >
                {imageItems.map((item) => (
                  <Reorder.Item key={item.id} value={item} dragListener>
                    <ThumbnailItem
                      item={item}
                      onCountChange={(count) =>
                        onItemCountChange(item.id, count)
                      }
                      onRemove={() =>
                        onReorder(
                          imageItems.filter(
                            (candidate) => candidate.id !== item.id,
                          ),
                        )
                      }
                    />
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            </div>
          </>
        ) : (
          <TextModeFields
            textConfig={textConfig}
            metrics={textOutputMetrics}
            error={textOutputError}
            onChange={onTextConfigChange}
          />
        )}
      </div>

      <div className="relative overflow-hidden border-t border-border-subtle p-1">
        <SmartButton
          onClick={onGeneratePdf}
          onCancel={onCancelPdf}
          disabled={
            !!layout.error ||
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
