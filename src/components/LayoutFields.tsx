import { File as FileIcon, FileMinus, Grid } from "lucide-react";
import { useState } from "react";

import { useI18n } from "../utils/i18nContext";
import {
  LAYOUT_CONFIG_LIMITS,
  normalizeLayoutConfig,
} from "../utils/layoutMath";
import type { HelperLayoutConfig } from "../utils/layoutMath";
import { NumberInput } from "./NumberInput";
import { SegmentedControl } from "./SegmentedControl";
import { InlineAlert } from "./ui/InlineAlert";

interface LayoutFieldsProps {
  config: HelperLayoutConfig;
  gridPreferences?: Pick<HelperLayoutConfig, "rows" | "cols">;
  onConfigChange: (updates: Partial<HelperLayoutConfig>) => void;
  /** 桌面控制栏显示纸张信息；移动端编辑面板省略 */
  paperSizeInfo?: string;
  /** 同名 framer-motion layoutId 不可跨组件共用，移动端面板需要独立前缀 */
  layoutIdPrefix?: string;
}

export function LayoutFields({
  config,
  gridPreferences = config,
  onConfigChange,
  paperSizeInfo,
  layoutIdPrefix = "orientation-active",
}: LayoutFieldsProps) {
  const { t } = useI18n();
  const [gridAdjustment, setGridAdjustment] = useState<{
    oldRows: number;
    oldCols: number;
    rows: number;
    cols: number;
  } | null>(null);
  const maxRows = LAYOUT_CONFIG_LIMITS.rows[config.orientation];
  const maxCols = LAYOUT_CONFIG_LIMITS.cols[config.orientation];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="group-title flex items-center gap-2">
          <Grid className="h-4 w-4" /> {t("layout_group")}
        </h2>
        {paperSizeInfo ? (
          <span className="min-w-0 truncate text-xs font-medium text-text-muted">
            {paperSizeInfo}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <NumberInput
          label={t("rows")}
          value={config.rows}
          rollbackValue={gridPreferences.rows}
          onChange={(value) => onConfigChange({ rows: value })}
          min={1}
          max={maxRows}
          isInteger
          showStepper
        />
        <NumberInput
          label={t("cols")}
          value={config.cols}
          rollbackValue={gridPreferences.cols}
          onChange={(value) => onConfigChange({ cols: value })}
          min={1}
          max={maxCols}
          isInteger
          showStepper
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <NumberInput
          label={`${t("margin")} ${t("unit_mm")}`}
          value={config.marginMm}
          onChange={(value) => onConfigChange({ marginMm: value })}
          min={LAYOUT_CONFIG_LIMITS.marginMm.min}
          max={LAYOUT_CONFIG_LIMITS.marginMm.max}
          decimalPlaces={1}
          step={1}
        />
        <NumberInput
          label={`${t("spacing")} ${t("unit_mm")}`}
          value={config.spacingMm}
          onChange={(value) => onConfigChange({ spacingMm: value })}
          min={LAYOUT_CONFIG_LIMITS.spacingMm.min}
          max={LAYOUT_CONFIG_LIMITS.spacingMm.max}
          decimalPlaces={1}
          step={1}
        />
      </div>

      <SegmentedControl
        label={t("orientation")}
        layoutId={layoutIdPrefix}
        value={config.orientation}
        onChange={(orientation) => {
          const normalized = normalizeLayoutConfig({
            ...config,
            ...gridPreferences,
            orientation,
          });
          setGridAdjustment(
            normalized.rows !== gridPreferences.rows ||
              normalized.cols !== gridPreferences.cols
              ? {
                  oldRows: config.rows,
                  oldCols: config.cols,
                  rows: normalized.rows,
                  cols: normalized.cols,
                }
              : null,
          );
          onConfigChange({ orientation });
        }}
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
      {gridAdjustment && (
        <InlineAlert tone="warning" aria-live="polite" className="text-sm">
          {t("orientation_grid_adjusted", gridAdjustment)}
        </InlineAlert>
      )}
    </div>
  );
}
