import { useMemo } from "react";

import { useI18n } from "../utils/i18nContext";
import { getImageLabelCount, IMAGE_LIMITS } from "../utils/imageLimits";
import { calculateLabelLayout } from "../utils/layoutMath";
import type {
  HelperLayoutConfig,
  ImageItem,
  TextConfig,
} from "../utils/layoutMath";
import { getTextOutputMetrics } from "../utils/textValidation";

// UI guidance only; this is not an output admission limit.
export const RECOMMENDED_IMAGE_CELL_MIN_MM = 5;
export type GenerationReadiness = ReturnType<typeof useGenerationReadiness>;

/**
 * 生成就绪度单一来源：布局有效 + 图片模式下至少一张图且不超过累计标签上限 /
 * 文本模式下配置无错误。
 * 桌面控制栏与移动端操作栏/编辑面板共用，避免判定逻辑多处重复。
 */
export function useGenerationReadiness(
  config: HelperLayoutConfig,
  appMode: "image" | "text",
  imageItems: ImageItem[],
  textConfig: TextConfig,
) {
  const { t } = useI18n();
  const layout = useMemo(() => calculateLabelLayout(config), [config]);
  const textOutputMetrics = useMemo(
    () => getTextOutputMetrics(config, textConfig),
    [config, textConfig],
  );
  const textOutputError = textOutputMetrics.error
    ? t(textOutputMetrics.error.code, textOutputMetrics.error.params)
    : null;
  const imageOutputError =
    appMode === "image" &&
    getImageLabelCount(imageItems) > IMAGE_LIMITS.maxTotalLabels
      ? t("image_error_label_count", { max: IMAGE_LIMITS.maxTotalLabels })
      : null;

  const canGenerate = useMemo(
    () =>
      !layout.error &&
      (appMode === "image"
        ? imageItems.length > 0 && !imageOutputError
        : !textOutputError),
    [layout, appMode, imageItems.length, imageOutputError, textOutputError],
  );

  const imageCellWarning =
    appMode === "image" &&
    imageItems.length > 0 &&
    !layout.error &&
    Math.min(layout.labelWidth, layout.labelHeight) <
      RECOMMENDED_IMAGE_CELL_MIN_MM
      ? t("image_cell_warning", {
          width: Number(layout.labelWidth.toFixed(2)),
          height: Number(layout.labelHeight.toFixed(2)),
          min: RECOMMENDED_IMAGE_CELL_MIN_MM,
        })
      : null;

  return {
    imageCellWarning,
    layout,
    textOutputMetrics,
    textOutputError,
    imageOutputError,
    canGenerate,
  };
}
