import { File as FileIcon, FileMinus, Grid } from "lucide-react";
import { useI18n } from "../utils/i18nContext";
import { LAYOUT_CONFIG_LIMITS } from "../utils/layoutMath";
import type { HelperLayoutConfig } from "../utils/layoutMath";
import { NumberInput } from "./NumberInput";
import { SegmentedControl } from "./SegmentedControl";

interface LayoutFieldsProps {
  config: HelperLayoutConfig;
  onConfigChange: (updates: Partial<HelperLayoutConfig>) => void;
  maxRows?: number;
  maxCols?: number;
  /** 桌面控制栏显示纸张信息；移动端编辑面板省略 */
  paperSizeInfo?: string;
  /** 同名 framer-motion layoutId 不可跨组件共用，移动端面板需要独立前缀 */
  layoutIdPrefix?: string;
}

export function LayoutFields({
  config,
  onConfigChange,
  maxRows,
  maxCols,
  paperSizeInfo,
  layoutIdPrefix = "orientation-active",
}: LayoutFieldsProps) {
  const { t } = useI18n();
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="group-title flex items-center gap-2">
          <Grid className="h-4 w-4" /> {t("layout_group")}
        </h2>
        {paperSizeInfo ? (
          <span className="text-xs font-medium text-text-muted">
            {paperSizeInfo}
          </span>
        ) : null}
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
        layoutId={layoutIdPrefix}
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
  );
}
