export const PDF_RASTER_TARGET_DPI = 300;
export const MAX_TEXT_CANVAS_WIDTH = 2048;
export const MAX_TEXT_CANVAS_HEIGHT = 1024;

export function createRasterTextAlias(
  text: string,
  widthMm: number,
  heightMm: number,
  fontSizeMm: number,
): string {
  return JSON.stringify(["text", text, widthMm, heightMm, fontSizeMm]);
}

export function getRasterTextScale(widthMm: number, heightMm: number): number {
  return Math.min(
    PDF_RASTER_TARGET_DPI / 25.4,
    MAX_TEXT_CANVAS_WIDTH / Math.max(widthMm, 0.01),
    MAX_TEXT_CANVAS_HEIGHT / Math.max(heightMm, 0.01),
  );
}

export function getRasterTextDpi(widthMm: number, heightMm: number): number {
  return getRasterTextScale(widthMm, heightMm) * 25.4;
}

export function needsRasterText(text: string): boolean {
  return /[^\x20-\x7e]/u.test(text);
}
