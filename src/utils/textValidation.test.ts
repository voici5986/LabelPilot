import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAYOUT_CONFIG,
  DEFAULT_TEXT_CONFIG,
  TEXT_CONFIG_LIMITS,
  normalizeTextConfig,
} from "./layoutMath";
import { getTextOutputMetrics } from "./textValidation";

describe("text output validation", () => {
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
