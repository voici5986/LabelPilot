// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generatePDF } from "./pdfGenerator";
import type { HelperLayoutConfig, TextConfig } from "./layoutMath";

const config = {
  rows: 1,
  cols: 1,
  marginMm: 10,
  spacingMm: 0,
  orientation: "portrait",
  pageWidthMm: 210,
  pageHeightMm: 297,
} satisfies HelperLayoutConfig;

const textConfig = {
  prefix: "SN-",
  startNumber: 1,
  digits: 3,
  count: 1,
  showQrCode: false,
  qrSizeRatio: 0.35,
  qrContentPrefix: "",
} satisfies TextConfig;

class MockWorker {
  static instance: MockWorker;

  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();

  constructor() {
    MockWorker.instance = this;
  }
}

class MockURL extends URL {
  static createObjectURL = vi.fn(() => "blob:pdf");
  static revokeObjectURL = vi.fn();
}

beforeEach(() => {
  vi.stubGlobal("Worker", MockWorker);
  vi.stubGlobal("URL", MockURL);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("generatePDF", () => {
  it("cleans up download resources when clicking the link fails", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("download failed");
    });

    const result = generatePDF(config, [], "text", textConfig);
    MockWorker.instance.onmessage?.(
      new MessageEvent("message", {
        data: { type: "complete", data: new ArrayBuffer(0) },
      }),
    );

    await expect(result).rejects.toThrow("download failed");
    expect(document.querySelector("a")).toBeNull();
    expect(MockURL.revokeObjectURL).toHaveBeenCalledWith("blob:pdf");
    expect(MockWorker.instance.terminate).toHaveBeenCalledOnce();
  });
});
