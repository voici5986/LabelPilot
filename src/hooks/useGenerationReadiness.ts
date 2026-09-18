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

  return {
    layout,
    textOutputMetrics,
    textOutputError,
    imageOutputError,
    canGenerate,
  };
}
