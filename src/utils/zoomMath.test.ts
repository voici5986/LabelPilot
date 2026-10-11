import { describe, expect, it } from "vitest";

import {
  computeFitScale,
  getThumbBottomPct,
  mapPctToScale,
  mapScaleToPct,
  MAX_SCALE,
  MIN_SCALE,
} from "./zoomMath";

describe("preview fit scale", () => {
  it("preserves normal portrait and landscape fit geometry", () => {
    const mmToPx = 96 / 25.4;
    for (const [width, height] of [
      [210, 297],
      [297, 210],
    ]) {
      expect(computeFitScale(800, 600, width, height)).toBeCloseTo(
        Math.min(780 / (width * mmToPx), 580 / (height * mmToPx)),
      );
    }
  });

  it.each([20, 18, 1])(
    "keeps the scale positive when a container dimension is %s px",
    (size) => {
      expect(computeFitScale(size, 600, 210, 297)).toBe(0.01);
      expect(computeFitScale(800, size, 210, 297)).toBe(0.01);
    },
  );

  it("uses a finite positive fallback for invalid dimensions", () => {
    for (const invalid of [NaN, Infinity, -Infinity, 0, -20]) {
      for (let index = 0; index < 4; index++) {
        const dimensions = [800, 600, 210, 297];
        dimensions[index] = invalid;
        expect(
          computeFitScale(...(dimensions as [number, number, number, number])),
        ).toBe(0.8);
      }
    }
    expect(computeFitScale(800, 600, 0, 297)).toBe(0.8);
    expect(computeFitScale(800, 600, 210, -1)).toBe(0.8);
    expect(computeFitScale(800, 600, Number.MIN_VALUE, Number.MIN_VALUE)).toBe(
      0.8,
    );
  });
});

describe("zoom mapping", () => {
  it("keeps the configured endpoints and the 100% midpoint", () => {
    expect(mapPctToScale(0)).toBeCloseTo(MIN_SCALE);
    expect(mapPctToScale(0.5)).toBeCloseTo(1);
    expect(mapPctToScale(1)).toBeCloseTo(MAX_SCALE);
    expect(getThumbBottomPct(1)).toBeCloseTo(50);
  });

  it("uses logarithmic ratios on each side of the midpoint", () => {
    expect(mapPctToScale(0.25)).toBeCloseTo(Math.sqrt(MIN_SCALE));
    expect(mapPctToScale(0.75)).toBeCloseTo(Math.sqrt(MAX_SCALE));
  });

  it("is monotonic across the whole slider", () => {
    const samples = Array.from({ length: 101 }, (_, index) =>
      mapPctToScale(index / 100),
    );

    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index]).toBeGreaterThanOrEqual(samples[index - 1]);
    }
  });

  it("round-trips representative slider values", () => {
    for (const pct of [0, 0.1, 0.25, 0.5, 0.6, 0.75, 0.9, 1]) {
      expect(mapScaleToPct(mapPctToScale(pct))).toBeCloseTo(pct, 10);
    }
  });

  it("clamps values outside the supported range", () => {
    expect(mapPctToScale(-1)).toBeCloseTo(MIN_SCALE);
    expect(mapPctToScale(2)).toBeCloseTo(MAX_SCALE);
    expect(mapScaleToPct(0)).toBeCloseTo(0);
    expect(mapScaleToPct(10)).toBeCloseTo(1);
  });
});
