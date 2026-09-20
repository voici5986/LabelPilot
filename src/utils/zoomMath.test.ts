import { describe, expect, it } from "vitest";

import {
  getThumbBottomPct,
  mapPctToScale,
  mapScaleToPct,
  MAX_SCALE,
  MIN_SCALE,
} from "./zoomMath";

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
