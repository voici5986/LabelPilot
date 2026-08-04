import { useMemo } from "react";
import { UploadCloud } from "lucide-react";
import { useShallow } from "zustand/shallow";
import { useStore } from "../store/useStore";
import { useI18n } from "../utils/i18nContext";
import { getPaperSizeInfo } from "../utils/layoutMath";
import type { PdfProgressPhase } from "../utils/pdfProgress";
import type { GenerationStatus } from "../utils/generation";
import { useGenerationReadiness } from "../hooks/useGenerationReadiness";
import { SegmentedControl } from "./SegmentedControl";
import { SmartButton } from "./SmartButton";
import { TextModeFields } from "./TextModeFields";
import { LayoutFields } from "./LayoutFields";
import { ImageFilesSection } from "./ImageFilesSection";

interface ControlPanelProps {
  onFilesSelect: (files: File[]) => void | Promise<void>;
  onGeneratePdf: () => void;
  onCancelPdf?: () => void;
  genStatus?: GenerationStatus;
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
    onAppModeChange,
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
      onAppModeChange: state.setAppMode,
      textConfig: state.textConfig,
      onTextConfigChange: state.setTextConfig,
      paperSizeMode: state.paperSizeMode,
    })),
  );
  const { t } = useI18n();

  const { textOutputMetrics, textOutputError, canGenerate } =
    useGenerationReadiness(config, appMode, imageItems, textConfig);

  const paperSizeInfo = useMemo(() => {
    const info = getPaperSizeInfo(config);
    const width = Math.round(info.pageWidthMm * 10) / 10;
    const height = Math.round(info.pageHeightMm * 10) / 10;
    const label =
      paperSizeMode === "Custom" ? t("paper_type_custom") : paperSizeMode;
    return `${label}, ${width}×${height}mm`;
  }, [config, paperSizeMode, t]);

  return (
    <aside className="z-10 flex h-auto w-full flex-col overflow-hidden rounded-lg border border-border-subtle bg-surface lg:h-full">
      <div className="flex-1 space-y-5 p-4 scrollbar-hide lg:overflow-y-auto lg:p-5">
        <div className="space-y-3 border-b border-border-subtle/60 pb-4">
          <h2 className="group-title">{t("app_mode")}</h2>
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

        <div className="space-y-4 border-b border-border-subtle/60 pb-4">
          <LayoutFields
            config={config}
            onConfigChange={onConfigChange}
            maxRows={maxRows}
            maxCols={maxCols}
            paperSizeInfo={paperSizeInfo}
          />
        </div>

        {appMode === "image" ? (
          <div className="space-y-3">
            <h2 className="group-title flex items-center gap-2">
              <UploadCloud className="h-4 w-4" /> {t("file_group")}
            </h2>
            <ImageFilesSection
              imageItems={imageItems}
              onFilesSelect={onFilesSelect}
              onReorder={onReorder}
              onItemCountChange={onItemCountChange}
            />
          </div>
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
          disabled={!canGenerate}
          genStatus={genStatus}
          genProgress={genProgress}
          genPhase={genPhase}
        />
      </div>
    </aside>
  );
}
