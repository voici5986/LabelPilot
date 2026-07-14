import { AppError } from "./appError";
import {
  calculateLabelLayout,
  formatLabelText,
  getLabelTextFontSizeMm,
  getQrSizeMm,
  MM_PER_PT,
  normalizeLayoutConfig,
  normalizeTextConfig,
  type HelperLayoutConfig,
  type TextConfig,
} from "./layoutMath";
import { getQrModuleSizeMm, MIN_QR_MODULE_SIZE_MM } from "./qrCode";

export const MIN_LABEL_FONT_SIZE_MM = 2.1;

export interface TextOutputMetrics {
  fontSizePt: number;
  qrModuleSizeMm: number | null;
  error: AppError | null;
}

export function getTextOutputMetrics(
  config: HelperLayoutConfig,
  textConfig: TextConfig,
): TextOutputMetrics {
  const safeConfig = normalizeLayoutConfig(config);
  const safeTextConfig = normalizeTextConfig(textConfig);
  const layout = calculateLabelLayout(safeConfig);
  const position = layout.positions[0];

  if (!position || layout.error) {
    return { fontSizePt: 0, qrModuleSizeMm: null, error: null };
  }

  const lastText = formatLabelText(safeTextConfig.count - 1, safeTextConfig);
  const fontSizeMm = getLabelTextFontSizeMm(
    lastText,
    position,
    safeTextConfig.showQrCode,
  );
  const fontSizePt = fontSizeMm / MM_PER_PT;

  if (fontSizeMm < MIN_LABEL_FONT_SIZE_MM) {
    return {
      fontSizePt,
      qrModuleSizeMm: null,
      error: new AppError("text_error_too_small", {
        size: fontSizePt.toFixed(1),
        min: (MIN_LABEL_FONT_SIZE_MM / MM_PER_PT).toFixed(1),
      }),
    };
  }

  if (!safeTextConfig.showQrCode) {
    return { fontSizePt, qrModuleSizeMm: null, error: null };
  }

  const qrValue = `${safeTextConfig.qrContentPrefix}${lastText}`;
  let qrModuleSizeMm: number;
  try {
    qrModuleSizeMm = getQrModuleSizeMm(
      qrValue,
      getQrSizeMm(position, safeTextConfig.qrSizeRatio),
    );
  } catch {
    return {
      fontSizePt,
      qrModuleSizeMm: null,
      error: new AppError("qr_error_capacity"),
    };
  }

  if (qrModuleSizeMm < MIN_QR_MODULE_SIZE_MM) {
    return {
      fontSizePt,
      qrModuleSizeMm,
      error: new AppError("qr_error_too_dense", {
        size: qrModuleSizeMm.toFixed(2),
        min: MIN_QR_MODULE_SIZE_MM.toFixed(2),
      }),
    };
  }

  return { fontSizePt, qrModuleSizeMm, error: null };
}

export function validateTextOutput(
  config: HelperLayoutConfig,
  textConfig: TextConfig,
): void {
  const { error } = getTextOutputMetrics(config, textConfig);
  if (error) throw error;
}
