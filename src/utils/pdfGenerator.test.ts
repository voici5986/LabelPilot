// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "./appError";
import type { HelperLayoutConfig, TextConfig } from "./layoutMath";
import type { ImageItem } from "./layoutMath";
import { generatePDF } from "./pdfGenerator";
import {
  PDF_WORKER_PROTOCOL_VERSION,
  type PdfWorkerGenerateRequest,
} from "./pdfWorkerProtocol";

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
  it("ignores wrong-ID progress, complete and busy errors, then downloads only the matching response", async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const diagnostic = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onProgress = vi.fn();
    const result = generatePDF(config, [], "text", textConfig, onProgress);
    const worker = MockWorker.instance;
    const request = worker.postMessage.mock
      .calls[0][0] as PdfWorkerGenerateRequest;
    expect(request.requestId.length).toBeGreaterThan(0);
    const emit = (requestId: string, type: string, data: unknown) =>
      worker.onmessage?.(
        new MessageEvent("message", {
          data: {
            protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
            requestId,
            type,
            data,
          },
        }),
      );
    emit("unrelated", "progress", { percent: 63, phase: "rendering" });
    emit("unrelated", "complete", new ArrayBuffer(8));
    emit("unrelated", "error", { code: "pdf_worker_busy", message: "busy" });
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(click).not.toHaveBeenCalled();
    expect(MockURL.createObjectURL).not.toHaveBeenCalled();
    expect(worker.terminate).not.toHaveBeenCalled();
    emit(request.requestId, "complete", new ArrayBuffer(8));
    await expect(result).resolves.toBeUndefined();
    for (let i = 0; i < 10; i++)
      emit(request.requestId, "complete", new ArrayBuffer(8));
    expect(click).toHaveBeenCalledOnce();
    expect(MockURL.createObjectURL).toHaveBeenCalledOnce();
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(diagnostic).toHaveBeenCalledTimes(3);
    expect(diagnostic).toHaveBeenNthCalledWith(
      1,
      "Ignored PDF worker response",
      {
        reason: "request_mismatch",
        expectedRequestId: request.requestId,
        receivedRequestId: "unrelated",
      },
    );
  });

  it("ignores completion delivered after abort without downloading", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const controller = new AbortController();
    const result = generatePDF(config, [], "text", textConfig, undefined, {
      signal: controller.signal,
    });
    const worker = MockWorker.instance;
    const request = worker.postMessage.mock
      .calls[0][0] as PdfWorkerGenerateRequest;
    controller.abort();
    await expect(result).rejects.toMatchObject({
      code: "generation_cancelled",
    });
    worker.onmessage?.(
      new MessageEvent("message", {
        data: {
          protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
          requestId: request.requestId,
          type: "complete",
          data: new ArrayBuffer(8),
        },
      }),
    );
    expect(click).not.toHaveBeenCalled();
    expect(MockURL.createObjectURL).not.toHaveBeenCalled();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it.each([undefined, "", "x".repeat(129), null])(
    "rejects uncorrelated or invalid response ID %s",
    async (requestId) => {
      const result = generatePDF(config, [], "text", textConfig);
      MockWorker.instance.onmessage?.(
        new MessageEvent("message", {
          data: {
            protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
            requestId,
            type: requestId === null ? "error" : "complete",
            data:
              requestId === null
                ? { message: "bad request" }
                : new ArrayBuffer(8),
          },
        }),
      );
      await expect(result).rejects.toMatchObject({
        code: "pdf_worker_protocol_error",
      });
      expect(MockURL.createObjectURL).not.toHaveBeenCalled();
    },
  );

  it("creates distinct IDs when randomUUID is unavailable", async () => {
    vi.stubGlobal("crypto", {});
    const first = generatePDF(config, [], "text", textConfig);
    const firstWorker = MockWorker.instance;
    const second = generatePDF(config, [], "text", textConfig);
    const secondWorker = MockWorker.instance;
    const firstId = (
      firstWorker.postMessage.mock.calls[0][0] as PdfWorkerGenerateRequest
    ).requestId;
    const secondId = (
      secondWorker.postMessage.mock.calls[0][0] as PdfWorkerGenerateRequest
    ).requestId;
    expect(firstId).not.toBe(secondId);
    for (const worker of [firstWorker, secondWorker])
      worker.onerror?.({ message: "stop" } as ErrorEvent);
    await expect(first).rejects.toThrow("stop");
    await expect(second).rejects.toThrow("stop");
  });

  it("preserves a current worker's typed request version error", async () => {
    const result = generatePDF(config, [], "text", textConfig);
    MockWorker.instance.onmessage?.(
      new MessageEvent("message", {
        data: {
          protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
          requestId: (
            MockWorker.instance.postMessage.mock
              .calls[0][0] as PdfWorkerGenerateRequest
          ).requestId,
          type: "error",
          data: {
            code: "pdf_worker_version_mismatch",
            message: "version mismatch",
            params: { expected: 1, received: 2 },
          },
        },
      }),
    );
    await expect(result).rejects.toMatchObject({
      code: "pdf_worker_version_mismatch",
      params: { expected: 1, received: 2 },
    });
    expect(MockWorker.instance.terminate).toHaveBeenCalledOnce();
    expect(MockURL.createObjectURL).not.toHaveBeenCalled();
  });

  it.each([
    { type: "complete", data: new ArrayBuffer(8) },
    {
      protocolVersion: 1,
      type: "progress",
      data: { percent: 63, phase: "rendering" },
    },
  ])(
    "rejects incompatible worker responses before download",
    async (message) => {
      const click = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => {});
      const onProgress = vi.fn();
      const result = generatePDF(config, [], "text", textConfig, onProgress);
      MockWorker.instance.onmessage?.(
        new MessageEvent("message", { data: message }),
      );
      await expect(result).rejects.toMatchObject({
        code: "pdf_worker_version_mismatch",
      });
      expect(MockWorker.instance.terminate).toHaveBeenCalledOnce();
      expect(MockURL.createObjectURL).not.toHaveBeenCalled();
      expect(click).not.toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledTimes(1);
    },
  );

  it("rejects an empty image queue before creating a worker or download", async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const onProgress = vi.fn();
    const error = await generatePDF(
      config,
      [],
      "image",
      textConfig,
      onProgress,
    ).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: "image_error_no_files" });
    expect(MockWorker.instance).toBeUndefined();
    expect(MockURL.createObjectURL).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
  });

  it("forwards structured worker progress", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const onProgress = vi.fn();
    const result = generatePDF(config, [], "text", textConfig, onProgress);

    MockWorker.instance.onmessage?.(
      new MessageEvent("message", {
        data: {
          protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
          requestId: (
            MockWorker.instance.postMessage.mock
              .calls[0][0] as PdfWorkerGenerateRequest
          ).requestId,
          type: "progress",
          data: { percent: 63, phase: "rendering" },
        },
      }),
    );
    MockWorker.instance.onmessage?.(
      new MessageEvent("message", {
        data: {
          protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
          requestId: (
            MockWorker.instance.postMessage.mock
              .calls[0][0] as PdfWorkerGenerateRequest
          ).requestId,
          type: "complete",
          data: new ArrayBuffer(8),
        },
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
    expect(request.data.protocolVersion).toBe(PDF_WORKER_PROTOCOL_VERSION);
    expect(request.data.imageItems).toHaveLength(2);
    expect(request.data.imageItems[0].buffer).toBe(
      request.data.imageItems[1].buffer,
    );
    expect(transfer).toHaveLength(1);

    MockWorker.instance.onmessage?.(
      new MessageEvent("message", {
        data: {
          protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
          requestId: (
            MockWorker.instance.postMessage.mock
              .calls[0][0] as PdfWorkerGenerateRequest
          ).requestId,
          type: "complete",
          data: new ArrayBuffer(8),
        },
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
        data: {
          protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
          requestId: (
            MockWorker.instance.postMessage.mock
              .calls[0][0] as PdfWorkerGenerateRequest
          ).requestId,
          type: "complete",
          data: new ArrayBuffer(0),
        },
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
