import { describe, expect, it } from "vitest";

import {
  actualScale,
  computeK,
  isCalibrationStale,
  isFinitePositive,
  isReference,
  kIssue,
  normalizeCalibration,
  verificationCssMm,
} from "./screenCalibration";

describe("screenCalibration math", () => {
  it("computes k = measured / reference", () => {
    expect(computeK(100, 125)).toBe(1.25);
    expect(computeK(50, 100)).toBe(2);
  });

  it("computes actual scale = 1 / k", () => {
    expect(actualScale(1.25)).toBeCloseTo(0.8);
    expect(actualScale(2)).toBe(0.5);
  });

  it("renders the 50mm verification line at 50 / k CSS mm", () => {
    expect(verificationCssMm(1)).toBe(50);
    expect(verificationCssMm(1.25)).toBeCloseTo(40);
    expect(verificationCssMm(0.5)).toBe(100);
  });
});

describe("validation", () => {
  it("accepts only 50 or 100 as reference", () => {
    expect(isReference(50)).toBe(true);
    expect(isReference(100)).toBe(true);
    expect(isReference(75)).toBe(false);
    expect(isReference(null)).toBe(false);
  });

  it("rejects non-finite and non-positive numbers", () => {
    expect(isFinitePositive(3)).toBe(true);
    expect(isFinitePositive(0)).toBe(false);
    expect(isFinitePositive(-1)).toBe(false);
    expect(isFinitePositive(Number.NaN)).toBe(false);
    expect(isFinitePositive(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isFinitePositive("3")).toBe(false);
  });

  it("classifies k into hard / soft / ok ranges", () => {
    expect(kIssue(1)).toBe("ok");
    expect(kIssue(0.2)).toBe("soft-low");
    expect(kIssue(0.19)).toBe("hard-low");
    expect(kIssue(2.0)).toBe("ok");
    expect(kIssue(2.01)).toBe("soft-high");
    expect(kIssue(4.01)).toBe("hard-high");
    expect(kIssue(Number.NaN)).toBe("hard-low");
    expect(kIssue(-1)).toBe("hard-low");
  });
});

describe("normalizeCalibration", () => {
  const valid = {
    k: 1.25,
    referenceMm: 100,
    measuredMm: 125,
    dpr: 1.25,
    screenWidth: 1920,
    screenHeight: 1080,
    calibratedAt: "2026-08-05T00:00:00.000Z",
  };

  it("accepts a valid record", () => {
    expect(normalizeCalibration(valid)).toEqual(valid);
  });

  it.each([
    ["non-object", null],
    ["bad reference", { ...valid, referenceMm: 75 }],
    ["bad k", { ...valid, k: Number.NaN }],
    ["bad measured", { ...valid, measuredMm: -5 }],
    ["bad dpr", { ...valid, dpr: 0 }],
    ["bad width", { ...valid, screenWidth: Number.POSITIVE_INFINITY }],
    ["bad date", { ...valid, calibratedAt: "not-a-date" }],
  ])("rejects %s", (_name, raw) => {
    expect(normalizeCalibration(raw)).toBeNull();
  });
});

describe("isCalibrationStale", () => {
  const cal = {
    k: 1,
    referenceMm: 100 as const,
    measuredMm: 100,
    dpr: 1.25,
    screenWidth: 1536,
    screenHeight: 864,
    calibratedAt: "2026-08-05T00:00:00.000Z",
  };

  it("is fresh when environment matches", () => {
    expect(
      isCalibrationStale(cal, {
        dpr: 1.25,
        screenWidth: 1536,
        screenHeight: 864,
      }),
    ).toBe(false);
  });

  it("detects DPR drift beyond 0.05", () => {
    expect(
      isCalibrationStale(cal, {
        dpr: 1.3,
        screenWidth: 1536,
        screenHeight: 864,
      }),
    ).toBe(true);
    expect(
      isCalibrationStale(cal, {
        dpr: 1.26,
        screenWidth: 1536,
        screenHeight: 864,
      }),
    ).toBe(false);
  });

  it("detects logical resolution changes", () => {
    expect(
      isCalibrationStale(cal, {
        dpr: 1.25,
        screenWidth: 1920,
        screenHeight: 1080,
      }),
    ).toBe(true);
  });
});
