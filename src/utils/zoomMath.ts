/**
 * Utility for zoom-related mathematical calculations.
 */

export const MIN_SCALE = 0.5;
export const MAX_SCALE = 3.0;

/**
 * Maps a slider percentage (0 to 1) to a scale value.
 * Uses a non-linear mapping where 1.0 (100%) is exactly at 0.5 (50%).
 */
export function mapPctToScale(pct: number): number {
  const clampedPct = Math.max(0, Math.min(1, pct));

  // Lower half: 0% -> 50% progress maps to 50% -> 100% scale (0.5 -> 1.0)
  if (clampedPct <= 0.5) {
    return 0.5 + (clampedPct / 0.5) * 0.5;
  }

  // Upper half: 50% -> 100% progress maps to 100% -> 300% scale (1.0 -> 3.0)
  return 1.0 + ((clampedPct - 0.5) / 0.5) * 2.0;
}

/**
 * Maps a scale value back to a slider percentage (0 to 1).
 * Inverse of mapPctToScale.
 */
export function mapScaleToPct(scale: number): number {
  if (scale <= 1.0) {
    // Scale 0.5 to 1.0 maps to bottom 0% to 50%
    const s = Math.max(0.5, scale);
    return ((s - 0.5) / 0.5) * 0.5;
  }

  // Scale 1.0 to 3.0 maps to bottom 50% to 100%
  const s = Math.min(MAX_SCALE, scale);
  return 0.5 + ((s - 1.0) / 2.0) * 0.5;
}

/**
 * Calculates the percentage for the slider thumb's bottom position.
 */
export function getThumbBottomPct(scale: number): number {
  return mapScaleToPct(scale) * 100;
}
