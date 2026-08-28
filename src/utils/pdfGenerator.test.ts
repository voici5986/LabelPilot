// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HelperLayoutConfig, TextConfig } from "./layoutMath";
import type { ImageItem } from "./layoutMath";
import { generatePDF } from "./pdfGenerator";
import type { PdfWorkerGenerateRequest } from "./pdfWorkerProtocol";

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
  postMessage = vi.fn((_message: unknown, _transfer?: Transferable[]) => {
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
  MockWorker.instance = undefined as unknown as MockWorker;
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

  it("reads the same selected File once and transfers its buffer once", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const file = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      "label.png",
      { type: "image/png" },
    );
    const arrayBuffer = vi.spyOn(file, "arrayBuffer");
    const imageItems: ImageItem[] = [
      { id: "first", file, count: 1 },
      { id: "second", file, count: 2 },
    ];

    const result = generatePDF(config, imageItems, "image", textConfig);
    await vi.waitFor(() =>
      expect(MockWorker.instance?.postMessage).toHaveBeenCalledOnce(),
    );

    expect(arrayBuffer).toHaveBeenCalledOnce();
    const [rawRequest, transfer] =
      MockWorker.instance.postMessage.mock.calls[0];
    const request = rawRequest as PdfWorkerGenerateRequest;
    expect(request.data.imageItems).toHaveLength(2);
    expect(request.data.imageItems[0].buffer).toBe(
      request.data.imageItems[1].buffer,
    );
    expect(transfer).toHaveLength(1);

    MockWorker.instance.onmessage?.(
      new MessageEvent("message", {
        data: { type: "complete", data: new ArrayBuffer(8) },
      }),
    );
    await expect(result).resolves.toBeUndefined();
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

  it("rejects and terminates on an invalid worker response", async () => {
    const result = generatePDF(config, [], "text", textConfig);
    const rejection = expect(result).rejects.toMatchObject({
      code: "pdf_worker_protocol_error",
    });

    MockWorker.instance.onmessage?.(
      new MessageEvent("message", {
        data: { type: "unknown", data: null },
      }),
    );

    await rejection;
    expect(MockWorker.instance.terminate).toHaveBeenCalledOnce();
  });
});
