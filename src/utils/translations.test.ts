import { describe, expect, it } from "vitest";

import { translations } from "./translations";

function placeholders(template: string): string[] {
  return [
    ...new Set(
      Array.from(template.matchAll(/\{([^{}]+)\}/g), (match) => match[1]),
    ),
  ].sort();
}

describe("translation parity", () => {
  it("keeps English and Chinese keys identical in both directions", () => {
    expect(Object.keys(translations.en).sort()).toEqual(
      Object.keys(translations.zh).sort(),
    );
  });

  it("uses the same interpolation variables in both languages", () => {
    for (const key of Object.keys(
      translations.en,
    ) as (keyof typeof translations.en)[]) {
      expect(placeholders(translations.en[key]), key).toEqual(
        placeholders(translations.zh[key]),
      );
    }
  });
});
