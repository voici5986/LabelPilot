import { describe, expect, it } from "vitest";

import {
  createRasterTextAlias,
  getRasterTextDpi,
  getRasterTextScale,
  needsRasterText,
} from "./pdfRendering";

describe("raster text output density", () => {
  it("keys raster aliases by text, width, height, and font size independently", () => {
    const alias = createRasterTextAlias("中文-001", 30, 20, 5);
    expect(createRasterTextAlias("中文-001", 30, 20, 5)).toBe(alias);
    for (const changed of [
      createRasterTextAlias("中文-002", 30, 20, 5),
      createRasterTextAlias("中文-001", 31, 20, 5),
      createRasterTextAlias("中文-001", 30, 21, 5),
      createRasterTextAlias("中文-001", 30, 20, 6),
    ])
      expect(changed).not.toBe(alias);
    expect(JSON.parse(alias)).toEqual(["text", "中文-001", 30, 20, 5]);
  });
  it("uses 300 dpi until either canvas dimension reaches its cap", () => {
    expect(getRasterTextDpi(30, 20)).toBe(300);
    expect(getRasterTextScale(500, 20)).toBe(2048 / 500);
    expect(getRasterTextScale(20, 500)).toBe(1024 / 500);
  });
  it("routes non-ASCII glyphs to raster output", () => {
    expect(needsRasterText("SN-001")).toBe(false);
    expect(needsRasterText("中文-001")).toBe(true);
  });
});
