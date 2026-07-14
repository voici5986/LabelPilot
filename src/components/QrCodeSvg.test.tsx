// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QrCodeSvg } from "./QrCodeSvg";
import { createQrMatrix, QR_QUIET_ZONE_MODULES } from "../utils/qrCode";

describe("QrCodeSvg", () => {
  it("uses the shared four-module quiet zone", () => {
    const value = "SN-001";
    const { container } = render(<QrCodeSvg value={value} />);
    const expectedSize = createQrMatrix(value).size + QR_QUIET_ZONE_MODULES * 2;

    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe(
      `0 0 ${expectedSize} ${expectedSize}`,
    );
  });

  it("does not crash the preview when content exceeds QR capacity", () => {
    const { container } = render(<QrCodeSvg value={"x".repeat(5_000)} />);
    expect(container.querySelector("svg")).toBeNull();
  });
});
