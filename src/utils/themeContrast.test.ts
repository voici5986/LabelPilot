import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const css = readFileSync(
  fileURLToPath(new URL("../index.css", import.meta.url)),
  "utf8",
);

function colorToken(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"));
  if (!match) throw new Error(`Missing color token: ${name}`);
  return match[1];
}

function luminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/../g)!
    .map((value) => parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4),
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

describe("theme contrast tokens", () => {
  it.each([
    ["brand-primary-light", "on-brand-light"],
    ["brand-primary-dark", "on-brand-dark"],
  ])("keeps %s and %s at WCAG AA", (background, foreground) => {
    expect(
      contrast(colorToken(background), colorToken(foreground)),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["danger-light", "#fafafa"],
    ["warning-light", "#fafafa"],
    ["success-light", "#fafafa"],
    ["danger-dark", "#18181b"],
    ["warning-dark", "#18181b"],
    ["success-dark", "#18181b"],
  ])(
    "keeps semantic %s readable on its theme surface",
    (foreground, background) => {
      expect(
        contrast(colorToken(foreground), background),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each([
    ["success-surface", "on-status"],
    ["danger-surface", "on-status"],
  ])("keeps %s and %s at WCAG AA", (background, foreground) => {
    expect(
      contrast(colorToken(background), colorToken(foreground)),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["tooltip-bg-light", "tooltip-text-light"],
    ["tooltip-bg-dark", "tooltip-text-dark"],
  ])("keeps %s and %s at WCAG AA", (background, foreground) => {
    expect(
      contrast(colorToken(background), colorToken(foreground)),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("uses theme-aware tokens for calibration ruler ticks", () => {
    expect(css).toContain("--calibration-ruler-tick: #18181b;");
    expect(css).toContain(
      "--calibration-ruler-minor-tick: rgb(24 24 27 / 45%);",
    );
    expect(css).toContain("--calibration-ruler-tick: #f4f4f5;");
    expect(css).toContain(
      "--calibration-ruler-minor-tick: rgb(244 244 245 / 65%);",
    );
    expect(css).toContain("background: var(--calibration-ruler-tick);");
    expect(css).toContain("background: var(--calibration-ruler-minor-tick);");
    expect(css).not.toMatch(/\.cal-ruler \.tick\.minor\s*\{[^}]*opacity:/s);
  });
});
