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
  static postMessageError: Error | null = null;

  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn(() => {
    if (MockWorker.postMessageError) throw MockWorker.postMessageError;
  });
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
  MockWorker.postMessageError = null;
  vi.stubGlobal("Worker", MockWorker);
  vi.stubGlobal("URL", MockURL);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("generatePDF", () => {
  it("forwards structured worker progress", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const onProgress = vi.fn();
    const result = generatePDF(config, [], "text", textConfig, onProgress);

    MockWorker.instance.onmessage?.(
      new MessageEvent("message", {
        data: {
          type: "progress",
          data: { percent: 63, phase: "rendering" },
        },
      }),
    );
    MockWorker.instance.onmessage?.(
      new MessageEvent("message", {
        data: { type: "complete", data: new ArrayBuffer(8) },
      }),
    );

    await expect(result).resolves.toBeUndefined();
    expect(onProgress).toHaveBeenCalledWith({
      percent: 63,
      phase: "rendering",
    });
    expect(onProgress).toHaveBeenLastCalledWith({
      percent: 100,
      phase: "serializing",
    });
  });

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

  it("terminates the worker when generation is cancelled", async () => {
    const controller = new AbortController();
    const result = generatePDF(config, [], "text", textConfig, undefined, {
      signal: controller.signal,
    });
    const rejection = expect(result).rejects.toMatchObject({
      code: "generation_cancelled",
    });

    controller.abort();

    await rejection;
    expect(MockWorker.instance.terminate).toHaveBeenCalledOnce();
  });

  it("times out and terminates an unresponsive worker", async () => {
    vi.useFakeTimers();
    const result = generatePDF(config, [], "text", textConfig, undefined, {
      timeoutMs: 25,
    });
    const rejection = expect(result).rejects.toMatchObject({
      code: "generation_timeout",
    });

    await vi.advanceTimersByTimeAsync(25);

    await rejection;
    expect(MockWorker.instance.terminate).toHaveBeenCalledOnce();
  });

  it("cleans up when posting to the worker throws", async () => {
    MockWorker.postMessageError = new Error("post failed");

    await expect(generatePDF(config, [], "text", textConfig)).rejects.toThrow(
      "post failed",
    );
    expect(MockWorker.instance.terminate).toHaveBeenCalledOnce();
  });
});
