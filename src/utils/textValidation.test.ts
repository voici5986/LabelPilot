import { describe, expect, it } from "vitest";

import {
  DEFAULT_LAYOUT_CONFIG,
  DEFAULT_TEXT_CONFIG,
  TEXT_CONFIG_LIMITS,
  normalizeTextConfig,
} from "./layoutMath";
import { calculateLabelLayout, getTextLayoutBoxes } from "./layoutMath";
import { getRasterTextDpi } from "./pdfRendering";
import { getTextOutputMetrics } from "./textValidation";

describe("text output validation", () => {
  it("reports the PDF raster resolution for non-ASCII labels without blocking", () => {
    const config = { ...DEFAULT_LAYOUT_CONFIG, rows: 1, cols: 1 };
    const position = calculateLabelLayout(config).positions[0];
    const metrics = getTextOutputMetrics(config, {
      ...DEFAULT_TEXT_CONFIG,
      prefix: "设备-",
    });
    expect(metrics.rasterDpi).toBe(
      getRasterTextDpi(position.width, position.height),
    );
    expect(metrics.rasterDpi).toBeLessThan(300);
    expect(metrics.error).toBeNull();
    expect(
      getTextOutputMetrics(config, DEFAULT_TEXT_CONFIG).rasterDpi,
    ).toBeUndefined();
  });

  it("uses the actual QR text box and keeps raster metrics alongside blocking errors", () => {
    const config = { ...DEFAULT_LAYOUT_CONFIG, rows: 1, cols: 2 };
    const textConfig = {
      ...DEFAULT_TEXT_CONFIG,
      prefix: "设备".repeat(32),
      showQrCode: true,
      qrSizeRatio: 0.6,
    };
    const position = calculateLabelLayout(config).positions[0];
    const metrics = getTextOutputMetrics(config, textConfig);
    expect(metrics.rasterDpi).toBe(
      getRasterTextDpi(
        position.width,
        getTextLayoutBoxes(position, true, 0.6).textBoxHeightMm,
      ),
    );
    expect(metrics.error).not.toBeNull();
  });
  it("accepts the default printable layout", () => {
    expect(
      getTextOutputMetrics(DEFAULT_LAYOUT_CONFIG, DEFAULT_TEXT_CONFIG).error,
    ).toBeNull();
  });

  it("limits persisted text lengths", () => {
    const normalized = normalizeTextConfig({
      ...DEFAULT_TEXT_CONFIG,
      prefix: "A".repeat(1_000),
      qrContentPrefix: "B".repeat(2_000),
    });

    expect(normalized.prefix).toHaveLength(TEXT_CONFIG_LIMITS.prefix.maxLength);
    expect(normalized.qrContentPrefix).toHaveLength(
      TEXT_CONFIG_LIMITS.qrContentPrefix.maxLength,
    );
  });

  it("blocks labels whose estimated text is unreadably small", () => {
    const metrics = getTextOutputMetrics(
      {
        ...DEFAULT_LAYOUT_CONFIG,
        rows: 20,
        cols: 10,
        marginMm: 0,
        spacingMm: 0,
      },
      {
        ...DEFAULT_TEXT_CONFIG,
        prefix: "A".repeat(TEXT_CONFIG_LIMITS.prefix.maxLength),
      },
    );

    expect(metrics.error?.code).toBe("text_error_too_small");
  });

  it("blocks QR output when physical modules would be too dense", () => {
    const metrics = getTextOutputMetrics(DEFAULT_LAYOUT_CONFIG, {
      ...DEFAULT_TEXT_CONFIG,
      showQrCode: true,
      qrContentPrefix: "x".repeat(TEXT_CONFIG_LIMITS.qrContentPrefix.maxLength),
    });

    expect(metrics.error?.code).toBe("qr_error_too_dense");
  });
});
