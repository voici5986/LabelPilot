import { useMemo } from "react";
import { calculateLabelLayout } from "../utils/layoutMath";
import type {
  HelperLayoutConfig,
  ImageItem,
  TextConfig,
} from "../utils/layoutMath";
import { getTextOutputMetrics } from "../utils/textValidation";
import { useI18n } from "../utils/i18nContext";

/**
 * 生成就绪度单一来源：布局有效 + 图片模式下至少一张图 / 文本模式下配置无错误。
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

  const canGenerate = useMemo(
    () =>
      !layout.error &&
      (appMode === "image" ? imageItems.length > 0 : !textOutputError),
    [layout, appMode, imageItems.length, textOutputError],
  );

  return { layout, textOutputMetrics, textOutputError, canGenerate };
}
