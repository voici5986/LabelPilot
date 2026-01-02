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

export interface LabelPosition {
  x: number; // mm
  y: number; // mm
  width: number; // mm
  height: number; // mm
  row: number;
  col: number;
}

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

/**
 * Calculates the dimensions and positions of labels on an A4 page.
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
  } = config;

  // 1. Determine Page Size
  const pageWidth = orientation === 'landscape' ? A4_HEIGHT_MM : A4_WIDTH_MM;
  const pageHeight = orientation === 'landscape' ? A4_WIDTH_MM : A4_HEIGHT_MM;

  // 2. Validate Inputs
  if (rows <= 0 || cols <= 0) {
    return { positions: [], labelWidth: 0, labelHeight: 0, pageWidth, pageHeight, error: "ROWS_COLS_POSITIVE" };
  }
  if (marginMm < 0 || spacingMm < 0) {
    return { positions: [], labelWidth: 0, labelHeight: 0, pageWidth, pageHeight, error: "MARGIN_SPACING_POSITIVE" };
  }

  // 3. Calculate Usable Area
  const usableWidth = pageWidth - 2 * marginMm;
  const usableHeight = pageHeight - 2 * marginMm;

  if (usableWidth <= 0 || usableHeight <= 0) {
     return { positions: [], labelWidth: 0, labelHeight: 0, pageWidth, pageHeight, error: "MARGIN_TOO_LARGE" };
  }

  // 4. Calculate Label Dimensions
  // Total spacing width = (cols - 1) * spacing
  const totalSpacingX = (cols - 1) * spacingMm;
  const totalSpacingY = (rows - 1) * spacingMm;

  const labelWidth = (usableWidth - totalSpacingX) / cols;
  const labelHeight = (usableHeight - totalSpacingY) / rows;

  if (labelWidth <= 0 || labelHeight <= 0) {
    return { positions: [], labelWidth: 0, labelHeight: 0, pageWidth, pageHeight, error: "LABEL_TOO_SMALL" };
  }

  // 5. Calculate Positions
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
