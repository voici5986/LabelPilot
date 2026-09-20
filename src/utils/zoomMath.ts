/**
 * Utility for zoom-related mathematical calculations.
 */

export const MIN_SCALE = 0.5;
export const MAX_SCALE = 3.0;
const MID_SCALE = 1.0;
const MID_PROGRESS = 0.5;

/**
 * 预览缩放三态：
 * - fit：适应预览区（重置目标），倍率 = baseFitScale
 * - manual：用户滑杆手动缩放，倍率 = baseFitScale * manualScale
 * - actual：屏幕实际尺寸，倍率 = 1 / k（不读 baseFitScale，窗口变化不破坏 1:1）
 */
export type ZoomMode = "fit" | "manual" | "actual";

/**
 * Maps a slider percentage (0 to 1) to a scale value.
 * Uses piecewise logarithmic mapping so that 1.0 (100%) is exactly at the
 * slider midpoint while both halves change by a consistent scale ratio.
 */
export function mapPctToScale(pct: number): number {
  const clampedPct = Math.max(0, Math.min(1, pct));

  // Lower half: 0% -> 50% progress maps 50% -> 100% by a ratio of 2.
  if (clampedPct <= MID_PROGRESS) {
    const progress = clampedPct / MID_PROGRESS;
    return MIN_SCALE * (MID_SCALE / MIN_SCALE) ** progress;
  }

  // Upper half: 50% -> 100% progress maps 100% -> 300% by a ratio of 3.
  const progress = (clampedPct - MID_PROGRESS) / MID_PROGRESS;
  return MID_SCALE * (MAX_SCALE / MID_SCALE) ** progress;
}

/**
 * Maps a scale value back to a slider percentage (0 to 1).
 * Inverse of mapPctToScale.
 */
export function mapScaleToPct(scale: number): number {
  if (scale <= MID_SCALE) {
    // Scale 0.5 to 1.0 maps to bottom 0% to 50% by a ratio of 2.
    const s = Math.max(MIN_SCALE, scale);
    return (
      (Math.log(s / MIN_SCALE) / Math.log(MID_SCALE / MIN_SCALE)) * MID_PROGRESS
    );
  }

  // Scale 1.0 to 3.0 maps to bottom 50% to 100% by a ratio of 3.
  const s = Math.min(MAX_SCALE, scale);
  return (
    MID_PROGRESS +
    (Math.log(s / MID_SCALE) / Math.log(MAX_SCALE / MID_SCALE)) * MID_PROGRESS
  );
}

/**
 * Calculates the percentage for the slider thumb's bottom position.
 */
export function getThumbBottomPct(scale: number): number {
  return mapScaleToPct(scale) * 100;
}
