/**
 * Core logic for calculating label positions on a page.
 * Ported from services/pdf_service.py
 */

export interface HelperLayoutConfig {
  rows: number;
  cols: number;
  marginMm: number;
  spacingMm: number;
  orientation: 'landscape' | 'portrait';
  pageWidthMm?: number; // Defaults to A4
  pageHeightMm?: number; // Defaults to A4
}

export interface ImageItem {
  id: string;
  file: File;
  count: number;
}

export interface TextConfig {
  prefix: string;
  startNumber: number;
  digits: number;
  count: number;
  showQrCode: boolean;
  qrSizeRatio: number;
  qrContentPrefix: string;
}

export interface LabelPosition {
  x: number; // mm
  y: number; // mm
  width: number; // mm
  height: number; // mm
  row: number;
  col: number;
}

export const MM_TO_PX = 3.78;
export const MM_PER_PT = 0.3527;

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const A3_WIDTH_MM = 297;
export const A3_HEIGHT_MM = 420;
export const A5_WIDTH_MM = 148;
export const A5_HEIGHT_MM = 210;
export const LETTER_WIDTH_MM = 215.9;
export const LETTER_HEIGHT_MM = 279.4;

export type PaperSize = 'A4' | 'Letter' | 'A3' | 'A5' | 'Custom';

export function resolvePageDimensions(config: Pick<HelperLayoutConfig, 'orientation' | 'pageWidthMm' | 'pageHeightMm'>): {
  pageWidth: number;
  pageHeight: number;
} {
  const baseWidth = config.pageWidthMm || A4_WIDTH_MM;
  const baseHeight = config.pageHeightMm || A4_HEIGHT_MM;
  const isLandscape = config.orientation === 'landscape';

  return {
    pageWidth: isLandscape ? Math.max(baseWidth, baseHeight) : Math.min(baseWidth, baseHeight),
    pageHeight: isLandscape ? Math.min(baseWidth, baseHeight) : Math.max(baseWidth, baseHeight)
  };
}

export function normalizePaperDimensions(width: number, height: number): { width: number; height: number } {
  return {
    width: Math.min(width, height),
    height: Math.max(width, height)
  };
}

/**
 * Returns a human-readable label for the given paper dimensions.
 */
export function getPaperSizeLabel(width: number, height: number): string {
  const w = Math.round(width * 10) / 10;
  const h = Math.round(height * 10) / 10;

  const isMatch = (dw: number, dh: number) =>
    w === Math.round(dw * 10) / 10 && h === Math.round(dh * 10) / 10;

  if (isMatch(A4_WIDTH_MM, A4_HEIGHT_MM)) return 'A4';
  if (isMatch(A3_WIDTH_MM, A3_HEIGHT_MM)) return 'A3';
  if (isMatch(A5_WIDTH_MM, A5_HEIGHT_MM)) return 'A5';
  if (isMatch(LETTER_WIDTH_MM, LETTER_HEIGHT_MM)) return 'Letter';

  return 'Custom';
}

export function getPaperSizeInfo(config: Pick<HelperLayoutConfig, 'orientation' | 'pageWidthMm' | 'pageHeightMm'>): {
  label: string;
  baseWidthMm: number;
  baseHeightMm: number;
  pageWidthMm: number;
  pageHeightMm: number;
} {
  const baseWidthMm = config.pageWidthMm || A4_WIDTH_MM;
  const baseHeightMm = config.pageHeightMm || A4_HEIGHT_MM;
  const { pageWidth, pageHeight } = resolvePageDimensions(config);
  const normalized = normalizePaperDimensions(baseWidthMm, baseHeightMm);
  const label = getPaperSizeLabel(normalized.width, normalized.height);

  return {
    label,
    baseWidthMm,
    baseHeightMm,
    pageWidthMm: pageWidth,
    pageHeightMm: pageHeight
  };
}

/**
 * Calculates the dimensions and positions of labels on a page.
 * Returns measurements in Millimeters.
 */
export function calculateLabelLayout(config: HelperLayoutConfig): {
  positions: LabelPosition[];
  labelWidth: number;
  labelHeight: number;
  pageWidth: number;
  pageHeight: number;
  error?: string;
} {
  const {
    rows,
    cols,
    marginMm,
    spacingMm,
    orientation,
    pageWidthMm,
    pageHeightMm
  } = config;

  // 1. Determine Base Page Size + Orientation
  const { pageWidth, pageHeight } = resolvePageDimensions({
    orientation,
    pageWidthMm,
    pageHeightMm
  });

  // 3. Validate Inputs
  if (rows <= 0 || cols <= 0) {
    return { positions: [], labelWidth: 0, labelHeight: 0, pageWidth, pageHeight, error: "ROWS_COLS_POSITIVE" };
  }
  if (marginMm < 0 || spacingMm < 0) {
    return { positions: [], labelWidth: 0, labelHeight: 0, pageWidth, pageHeight, error: "MARGIN_SPACING_POSITIVE" };
  }

  // 4. Calculate Usable Area
  const usableWidth = pageWidth - 2 * marginMm;
  const usableHeight = pageHeight - 2 * marginMm;

  if (usableWidth <= 0 || usableHeight <= 0) {
    return { positions: [], labelWidth: 0, labelHeight: 0, pageWidth, pageHeight, error: "MARGIN_TOO_LARGE" };
  }

  // 5. Calculate Label Dimensions
  // Total spacing width = (cols - 1) * spacing
  const totalSpacingX = (cols - 1) * spacingMm;
  const totalSpacingY = (rows - 1) * spacingMm;

  const labelWidth = (usableWidth - totalSpacingX) / cols;
  const labelHeight = (usableHeight - totalSpacingY) / rows;

  if (labelWidth <= 0 || labelHeight <= 0) {
    return { positions: [], labelWidth: 0, labelHeight: 0, pageWidth, pageHeight, error: "LABEL_TOO_SMALL" };
  }

  // 6. Calculate Positions
  // Important: PDF coordinate systems often start at Bottom-Left (like ReportLab).
  // However, most Web Canvas / SVG / jsPDF start Top-Left.
  // The Python code: y = page_height - margin - (row + 1) * label_height - row * spacing
  // This implies bottom-up coordinates for ReportLab.
  // For React (Canvas/DOM) and usually jsPDF, we want Top-Left (Y=0 at top).
  // So: y = margin + row * (labelHeight + spacing)
  // We will return Top-Left coordinates for ease of drawing in JS.

  const positions: LabelPosition[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = marginMm + c * (labelWidth + spacingMm);
      const y = marginMm + r * (labelHeight + spacingMm);

      positions.push({
        x,
        y,
        width: labelWidth,
        height: labelHeight,
        row: r,
        col: c
      });
    }
  }

  return {
    positions,
    labelWidth,
    labelHeight,
    pageWidth,
    pageHeight
  };
}

/**
 * Resolves which item should be placed in a specific grid slot based on counts.
 * This is a generic function used by both Preview and PDF generator.
 */
export function resolveItemAtSlot<T extends { count: number }>(
  idx: number,
  items: T[]
): T | null {
  if (items.length === 0) return null;

  let accumulated = 0;
  for (const item of items) {
    const start = accumulated;
    accumulated += item.count;
    if (idx >= start && idx < accumulated) {
      return item;
    }
  }

  return null;
}

/**
 * Formats the text content for a label based on the configuration.
 */
export function formatLabelText(index: number, config: TextConfig): string {
  const currentNumber = config.startNumber + index;
  const formattedNumber = String(currentNumber).padStart(config.digits, '0');
  return `${config.prefix}${formattedNumber}`;
}

export function getQrSizeMm(pos: Pick<LabelPosition, 'width' | 'height'>, qrSizeRatio: number): number {
  return Math.min(pos.width, pos.height) * qrSizeRatio;
}

export function getLabelTextFontSizeMm(
  text: string,
  pos: Pick<LabelPosition, 'width' | 'height'>,
  showQrCode: boolean
): number {
  if (text.length === 0) return 0;
  
  // Courier 字体在 PDF 中的宽高比通常约为 0.6
  // 这意味着: 字符宽度 = 字号 * 0.6
  // 例如: 10pt 的 Courier 字符宽度约为 6pt
  const FONT_ASPECT_RATIO = 0.6; 
  
  const widthFactor = showQrCode ? 0.9 : 0.8;
  const heightFactor = showQrCode ? 0.2 : 0.5;

  // 1. 根据宽度限制计算最大字号
  // 公式: 可用宽度 = 字符数 * (字号 * 宽高比)
  // 字号 = 可用宽度 / (字符数 * 宽高比)
  const maxByWidth = (pos.width * widthFactor) / (text.length * FONT_ASPECT_RATIO);
  
  // 2. 根据高度限制计算最大字号
  // 字号 = 可用高度
  const maxByHeight = pos.height * heightFactor;
  
  return Math.min(maxByWidth, maxByHeight);
}

export function getTextLayoutBoxes(
  pos: Pick<LabelPosition, 'width' | 'height'>,
  showQrCode: boolean,
  qrSizeRatio: number
): {
  qrDimMm: number;
  qrTopMm: number;
  qrLeftMm: number;
  textBoxTopMm: number;
  textBoxHeightMm: number;
} {
  if (!showQrCode) {
    return {
      qrDimMm: 0,
      qrTopMm: 0,
      qrLeftMm: 0,
      textBoxTopMm: 0,
      textBoxHeightMm: pos.height
    };
  }

  const qrDimMm = getQrSizeMm(pos, qrSizeRatio);
  const qrTopMm = pos.height * 0.1;
  const qrLeftMm = (pos.width - qrDimMm) / 2;
  const textBoxTopMm = qrTopMm + qrDimMm;
  const textBoxHeightMm = Math.max(0, pos.height - textBoxTopMm);

  return {
    qrDimMm,
    qrTopMm,
    qrLeftMm,
    textBoxTopMm,
    textBoxHeightMm
  };
}
