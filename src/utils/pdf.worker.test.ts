import jsPDF from "jspdf";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { createJpegWithMetadata } from "../test/jpegFixtures";
import { createBudgetPng, createCollisionPng } from "../test/pngFixtures";
import { readJpegMetadata } from "./jpegMetadata";
import type { HelperLayoutConfig, TextConfig } from "./layoutMath";
import { PDF_WORKER_PROTOCOL_VERSION } from "./pdfWorkerProtocol";
import { readPngDimensions, validatePngScanlines } from "./pngMetadata";

vi.mock("./jpegMetadata", async (importOriginal) => {
  const original = await importOriginal<typeof import("./jpegMetadata")>();
  return { ...original, readJpegMetadata: vi.fn(original.readJpegMetadata) };
});

vi.mock("./pngMetadata", async (importOriginal) => {
  const original = await importOriginal<typeof import("./pngMetadata")>();
  return {
    ...original,
    readPngDimensions: vi.fn(original.readPngDimensions),
    // Budget fixtures deliberately omit real pixels; real worker tests cover decoding.
    validatePngScanlines: vi.fn(async () => {}),
  };
});

const mockJsPdfInstance = {
  addImage: vi.fn(),
  setFont: vi.fn(),
  setFontSize: vi.fn(),
  getStringUnitWidth: vi.fn(() => 1),
  text: vi.fn(),
  setFillColor: vi.fn(),
  rect: vi.fn(),
  addPage: vi.fn(),
  output: vi.fn(() => new ArrayBuffer(8)),
};

vi.mock("jspdf", () => ({
  default: vi.fn(function () {
    return mockJsPdfInstance;
  }),
}));

const createBaseConfig = (): HelperLayoutConfig => ({
  rows: 1,
  cols: 1,
  marginMm: 0,
  spacingMm: 0,
  orientation: "portrait",
});

const createTextConfig = (overrides?: Partial<TextConfig>): TextConfig => ({
  prefix: "SN-",
  startNumber: 1,
  digits: 3,
  count: 1,
  showQrCode: false,
  qrSizeRatio: 0.35,
  qrContentPrefix: "",
  ...overrides,
});

const flushAsync = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

type WorkerSelf = {
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
  onmessage?: (e: { data: unknown }) => Promise<void>;
};

const fillTextMock = vi.fn();
const drawImageMock = vi.fn();
const canvasSizes: { width: number; height: number }[] = [];

class MockOffscreenCanvas {
  width: number;
  height: number;

  constructor(width: number, height: number) {
    canvasSizes.push({ width, height });
    this.width = width;
    this.height = height;
  }

  getContext() {
    return {
      fillStyle: "",
      textAlign: "",
      textBaseline: "",
      font: "",
      fillRect: vi.fn(),
      drawImage: drawImageMock,
      measureText: vi.fn(() => ({ width: 100 })),
      fillText: fillTextMock,
    };
  }

  async convertToBlob() {
    return new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], {
      type: "image/png",
    });
  }
}

const setupWorker = async () => {
  const postMessage = vi.fn();
  (globalThis as unknown as { self: WorkerSelf }).self = { postMessage };
  await import("./pdf.worker");
  const workerSelf = (globalThis as unknown as { self: WorkerSelf }).self;
  const rawOnmessage = workerSelf.onmessage as (e: {
    data: unknown;
  }) => Promise<void>;
  return {
    postMessage,
    rawOnmessage,
    onmessage: (event: { data: unknown }) =>
      rawOnmessage({
        data: {
          type: "generate",
          requestId: "test-request",
          data: {
            protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
            ...(event.data as Record<string, unknown>),
          },
        },
      }),
  };
};

beforeEach(() => {
  vi.resetModules();
  vi.mocked(validatePngScanlines).mockClear();
  vi.mocked(readPngDimensions).mockClear();
  vi.mocked(readJpegMetadata).mockClear();
  vi.stubGlobal("createImageBitmap", undefined);
  mockJsPdfInstance.addImage.mockClear();
  mockJsPdfInstance.setFont.mockClear();
  mockJsPdfInstance.setFontSize.mockClear();
  mockJsPdfInstance.getStringUnitWidth.mockClear();
  mockJsPdfInstance.text.mockClear();
  mockJsPdfInstance.setFillColor.mockClear();
  mockJsPdfInstance.rect.mockReset();
  mockJsPdfInstance.addPage.mockClear();
  mockJsPdfInstance.output.mockClear();
  fillTextMock.mockClear();
  canvasSizes.length = 0;
  drawImageMock.mockClear();
  vi.mocked(jsPDF).mockClear();
});

describe("pdf.worker", () => {
  it.each([undefined, null, "", "x".repeat(129)])(
    "rejects unreadable request ID %s before decoding",
    async (requestId) => {
      const { postMessage, rawOnmessage } = await setupWorker();
      await rawOnmessage({
        data: {
          type: "generate",
          requestId,
          data: {
            protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
            config: createBaseConfig(),
            imageItems: [
              {
                id: "png",
                name: "label.png",
                count: 1,
                type: "image/png",
                buffer: createBudgetPng(32, 32),
              },
            ],
            appMode: "image",
            textConfig: createTextConfig(),
          },
        },
      });
      expect(postMessage).toHaveBeenCalledExactlyOnceWith({
        protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
        requestId: null,
        type: "error",
        data: expect.objectContaining({ code: "pdf_worker_protocol_error" }),
      });
      expect(validatePngScanlines).not.toHaveBeenCalled();
      expect(jsPDF).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    "holds the active owner through concurrent rejection and releases after failure=%s",
    async (fail) => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      vi.mocked(validatePngScanlines).mockImplementationOnce(async () => {
        await gate;
        if (fail) throw new Error("decode failed");
      });
      const { postMessage, rawOnmessage } = await setupWorker();
      const payload = {
        protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
        config: createBaseConfig(),
        appMode: "image",
        textConfig: createTextConfig(),
        imageItems: [
          {
            id: "png",
            name: "label.png",
            count: 1,
            type: "image/png",
            buffer: createBudgetPng(32, 32),
          },
        ],
      };
      const send = (requestId: string) =>
        rawOnmessage({ data: { type: "generate", requestId, data: payload } });
      const owner = send("A");
      await send("B");
      await send("C");
      for (const requestId of ["B", "C"])
        expect(postMessage).toHaveBeenCalledWith({
          protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
          requestId,
          type: "error",
          data: expect.objectContaining({ code: "pdf_worker_busy" }),
        });
      expect(jsPDF).not.toHaveBeenCalled();
      expect(vi.mocked(validatePngScanlines)).toHaveBeenCalledTimes(1);
      release();
      await owner;
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: "A",
          type: fail ? "error" : "complete",
        }),
        ...(fail ? [] : [[expect.any(ArrayBuffer)]]),
      );
      await send("D");
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: "D", type: "complete" }),
        [expect.any(ArrayBuffer)],
      );
      expect(vi.mocked(validatePngScanlines)).toHaveBeenCalledTimes(2);
    },
  );

  it.each([undefined, 1])(
    "rejects request protocol version %s before decode or rendering",
    async (protocolVersion) => {
      const decode = vi.fn();
      vi.stubGlobal("createImageBitmap", decode);
      const { postMessage, rawOnmessage } = await setupWorker();
      rawOnmessage({
        data: {
          type: "generate",
          requestId: "test-request",
          data: {
            ...(protocolVersion === undefined ? {} : { protocolVersion }),
            config: createBaseConfig(),
            imageItems: [],
            appMode: "image",
            textConfig: createTextConfig(),
          },
        },
      });
      await flushAsync();
      expect(postMessage).toHaveBeenCalledExactlyOnceWith({
        protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
        requestId: "test-request",
        type: "error",
        data: expect.objectContaining({ code: "pdf_worker_version_mismatch" }),
      });
      expect(decode).not.toHaveBeenCalled();
      expect(jsPDF).not.toHaveBeenCalled();
    },
  );

  it("keeps a large Chinese label canvas within the 2048 by 1024 budget", async () => {
    vi.stubGlobal("OffscreenCanvas", MockOffscreenCanvas);
    const { postMessage, onmessage } = await setupWorker();
    onmessage({
      data: {
        config: {
          ...createBaseConfig(),
          pageWidthMm: 1000,
          pageHeightMm: 1000,
        },
        imageItems: [],
        appMode: "text",
        textConfig: createTextConfig({ prefix: "中文-" }),
      },
    });
    await vi.waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "complete",
          protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
        }),
        expect.any(Array),
      ),
    );
    expect(canvasSizes).toHaveLength(1);
    expect(canvasSizes[0].width).toBeLessThanOrEqual(2048);
    expect(canvasSizes[0].height).toBeLessThanOrEqual(1024);
    expect(canvasSizes[0].width * canvasSizes[0].height).toBeLessThanOrEqual(
      2048 * 1024,
    );
    expect(mockJsPdfInstance.text).not.toHaveBeenCalled();
  });

  it("parses PNG dimensions and validates scanlines once per source buffer", async () => {
    const { postMessage, onmessage } = await setupWorker();
    const { validatePngScanlines } = await import("./pngMetadata");
    const buffer = createCollisionPng("red").buffer;
    onmessage({
      data: {
        config: createBaseConfig(),
        appMode: "image",
        textConfig: createTextConfig(),
        imageItems: [buffer, buffer, buffer.slice(0)].map((source) => ({
          id: "duplicate",
          count: 2,
          name: "cached.png",
          type: "image/png",
          buffer: source,
        })),
      },
    });
    await vi.waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "complete" }),
        expect.any(Array),
      ),
    );
    expect(readPngDimensions).toHaveBeenCalledTimes(2);
    expect(validatePngScanlines).toHaveBeenCalledTimes(2);
  });
  it("rejects oversized oriented JPEGs before bitmap normalization", async () => {
    const decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);
    const { postMessage, onmessage } = await setupWorker();
    onmessage({
      data: {
        config: createBaseConfig(),
        appMode: "image",
        textConfig: createTextConfig(),
        imageItems: [
          {
            id: "1",
            count: 1,
            name: "huge.jpg",
            type: "image/jpeg",
            buffer: createJpegWithMetadata({
              width: 10_001,
              height: 100,
              orientation: 6,
            }),
          },
        ],
      },
    });
    await flushAsync();
    expect(decode).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith({
      protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
      requestId: "test-request",
      type: "error",
      data: expect.objectContaining({ code: "image_error_dimensions" }),
    });
  });

  it.each(["image/png", "image/jpeg"])(
    "counts each shared %s buffer against the source pixel budget",
    async (type) => {
      const decode = vi.fn(async () => ({
        width: 40,
        height: 80,
        close: vi.fn(),
      }));
      vi.stubGlobal("createImageBitmap", decode);
      vi.stubGlobal("OffscreenCanvas", MockOffscreenCanvas);
      const { postMessage, onmessage } = await setupWorker();
      const buffer =
        type === "image/png"
          ? createBudgetPng(5_000, 7_000)
          : createJpegWithMetadata({
              width: 5_000,
              height: 7_000,
              orientation: 6,
            });
      await onmessage({
        data: {
          config: createBaseConfig(),
          appMode: "image",
          textConfig: createTextConfig(),
          imageItems: Array.from({ length: 5 }, (_, index) => ({
            id: String(index),
            count: 1,
            name: `shared-${index}`,
            type,
            buffer,
          })),
        },
      });
      expect(postMessage).toHaveBeenCalledWith({
        protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
        requestId: "test-request",
        type: "error",
        data: expect.objectContaining({
          code: "image_error_total_pixels",
        }),
      });
      expect(
        postMessage.mock.calls.filter(
          ([message]) => message.type === "progress",
        ),
      ).toHaveLength(4);
      expect(
        type === "image/png" ? readPngDimensions : readJpegMetadata,
      ).toHaveBeenCalledTimes(1);
      expect(
        type === "image/png" ? validatePngScanlines : decode,
      ).toHaveBeenCalledTimes(1);
      expect(mockJsPdfInstance.addImage).not.toHaveBeenCalled();
    },
  );

  it("parses a shared buffer independently for each declared MIME type", async () => {
    const { postMessage, onmessage } = await setupWorker();
    const buffer = createCollisionPng("red").buffer;
    await onmessage({
      data: {
        config: createBaseConfig(),
        appMode: "image",
        textConfig: createTextConfig(),
        imageItems: ["image/png", "image/jpeg"].map((type) => ({
          id: type,
          count: 1,
          name: type,
          type,
          buffer,
        })),
      },
    });
    expect(readPngDimensions).toHaveBeenCalledTimes(1);
    expect(readJpegMetadata).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({
      protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
      requestId: "test-request",
      type: "error",
      data: expect.objectContaining({ code: "image_error_decode" }),
    });
    expect(mockJsPdfInstance.addImage).not.toHaveBeenCalled();
  });

  it("caches oriented source preparation by buffer and uses distinct aliases for duplicate IDs", async () => {
    const decode = vi.fn(async () => ({
      width: 40,
      height: 80,
      close: vi.fn(),
    }));
    vi.stubGlobal("createImageBitmap", decode);
    vi.stubGlobal("OffscreenCanvas", MockOffscreenCanvas);
    const { postMessage, onmessage } = await setupWorker();
    const buffer = createJpegWithMetadata({ orientation: 6 });
    onmessage({
      data: {
        config: createBaseConfig(),
        appMode: "image",
        textConfig: createTextConfig(),
        imageItems: [buffer, buffer, buffer.slice(0)].map((source) => ({
          id: "duplicate",
          count: 1,
          name: "phone.jpg",
          type: "image/jpeg",
          buffer: source,
        })),
      },
    });
    await vi.waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "complete" }),
        expect.any(Array),
      ),
    );
    expect(readJpegMetadata).toHaveBeenCalledTimes(2);
    expect(decode).toHaveBeenCalledTimes(2);
    const aliases = mockJsPdfInstance.addImage.mock.calls.map(
      (call) => call[6],
    );
    expect(aliases[0]).toBe(aliases[1]);
    expect(aliases[2]).not.toBe(aliases[0]);
  });

  it("gives distinct Unicode labels aliases containing the complete rendering identity", async () => {
    vi.stubGlobal("OffscreenCanvas", MockOffscreenCanvas);
    const { postMessage, onmessage } = await setupWorker();
    onmessage({
      data: {
        config: createBaseConfig(),
        imageItems: [],
        appMode: "text",
        textConfig: createTextConfig({ prefix: "中文-", count: 2 }),
      },
    });
    await vi.waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "complete" }),
        expect.any(Array),
      ),
    );
    const aliases = mockJsPdfInstance.addImage.mock.calls.map((call) =>
      JSON.parse(call[6]),
    );
    expect(aliases[0][1]).toBe("中文-001");
    expect(aliases[1][1]).toBe("中文-002");
    expect(aliases[0]).toHaveLength(5);
    expect(
      aliases[0].slice(2).every((value: unknown) => typeof value === "number"),
    ).toBe(true);
  });
  it("draws repeated image labels across pages and releases bitmaps", async () => {
    const closeMock = vi.fn();
    (
      globalThis as unknown as { createImageBitmap?: unknown }
    ).createImageBitmap = vi.fn(async () => ({
      width: 100,
      height: 50,
      close: closeMock,
    }));

    const { postMessage, onmessage } = await setupWorker();

    const buffer = createCollisionPng("red").buffer;
    onmessage({
      data: {
        config: createBaseConfig(),
        imageItems: [
          { id: "1", count: 3, name: "x.png", type: "image/png", buffer },
        ],
        appMode: "image",
        textConfig: createTextConfig(),
      },
    });

    await flushAsync();
    await flushAsync();

    expect(closeMock).not.toHaveBeenCalled();
    expect(mockJsPdfInstance.addImage).toHaveBeenCalledTimes(3);
    expect(mockJsPdfInstance.addPage).toHaveBeenCalledTimes(2);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "complete" }),
      expect.any(Array),
    );
  });

  it("normalizes JPEG orientation before embedding the image", async () => {
    const closeMock = vi.fn();
    const createBitmap = vi.fn(async () => ({
      width: 50,
      height: 100,
      close: closeMock,
    }));
    vi.stubGlobal("createImageBitmap", createBitmap);
    vi.stubGlobal("OffscreenCanvas", MockOffscreenCanvas);
    const { postMessage, onmessage } = await setupWorker();

    onmessage({
      data: {
        config: createBaseConfig(),
        imageItems: [
          {
            id: "1",
            count: 1,
            name: "phone.jpg",
            type: "image/jpeg",
            buffer: createJpegWithMetadata({ orientation: 6 }),
          },
        ],
        appMode: "image",
        textConfig: createTextConfig(),
      },
    });
    await flushAsync();
    await flushAsync();

    expect(createBitmap).toHaveBeenCalledWith(expect.any(Blob), {
      imageOrientation: "from-image",
    });
    expect(drawImageMock).toHaveBeenCalledOnce();
    expect(mockJsPdfInstance.addImage).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      "JPEG",
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(String),
      "FAST",
    );
    expect(closeMock).toHaveBeenCalledOnce();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "complete" }),
      expect.any(Array),
    );
  });

  it("embeds an orientation-1 JPEG without allocating a canvas", async () => {
    const createBitmap = vi.fn();
    const createCanvas = vi.fn();
    vi.stubGlobal("createImageBitmap", createBitmap);
    vi.stubGlobal("OffscreenCanvas", createCanvas);
    const { postMessage, onmessage } = await setupWorker();
    const buffer = createJpegWithMetadata({ orientation: 1 });

    onmessage({
      data: {
        config: createBaseConfig(),
        imageItems: [
          {
            id: "1",
            count: 1,
            name: "camera.jpg",
            type: "image/jpeg",
            buffer,
          },
        ],
        appMode: "image",
        textConfig: createTextConfig(),
      },
    });
    await flushAsync();
    await flushAsync();

    expect(createBitmap).not.toHaveBeenCalled();
    expect(createCanvas).not.toHaveBeenCalled();
    expect(mockJsPdfInstance.addImage).toHaveBeenCalledWith(
      new Uint8Array(buffer),
      "JPEG",
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(String),
      "FAST",
    );
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "complete" }),
      expect.any(Array),
    );
  });

  it("reads JPEG dimensions through legal marker fill bytes", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn());
    vi.stubGlobal("OffscreenCanvas", vi.fn());
    const { postMessage, onmessage } = await setupWorker();

    onmessage({
      data: {
        config: createBaseConfig(),
        imageItems: [
          {
            id: "1",
            count: 1,
            name: "filled.jpg",
            type: "image/jpeg",
            buffer: createJpegWithMetadata({ fillBeforeSof: true }),
          },
        ],
        appMode: "image",
        textConfig: createTextConfig(),
      },
    });
    await flushAsync();
    await flushAsync();

    expect(mockJsPdfInstance.addImage).toHaveBeenCalledOnce();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "complete" }),
      expect.any(Array),
    );
  });

  it("downscales a large oriented JPEG before canvas normalization", async () => {
    const createBitmap = vi.fn(
      async (_blob: Blob, options: ImageBitmapOptions) => ({
        width: options.resizeWidth,
        height: options.resizeHeight,
        close: vi.fn(),
      }),
    );
    vi.stubGlobal("createImageBitmap", createBitmap);
    vi.stubGlobal("OffscreenCanvas", MockOffscreenCanvas);
    const { onmessage } = await setupWorker();

    onmessage({
      data: {
        config: createBaseConfig(),
        imageItems: [
          {
            id: "1",
            count: 1,
            name: "large-phone.jpg",
            type: "image/jpeg",
            buffer: createJpegWithMetadata({
              width: 8_000,
              height: 5_000,
              orientation: 6,
            }),
          },
        ],
        appMode: "image",
        textConfig: createTextConfig(),
      },
    });
    await flushAsync();
    await flushAsync();

    const options = createBitmap.mock.calls[0][1];
    expect(options).toMatchObject({
      imageOrientation: "from-image",
      resizeQuality: "high",
    });
    expect(options.resizeWidth).toBeLessThan(options.resizeHeight ?? 0);
    expect(
      (options.resizeWidth ?? 0) * (options.resizeHeight ?? 0),
    ).toBeLessThanOrEqual(16_000_000);
  });

  it("rejects a truncated JPEG before the direct-embed path", async () => {
    const createBitmap = vi.fn();
    vi.stubGlobal("createImageBitmap", createBitmap);
    const { postMessage, onmessage } = await setupWorker();
    const complete = new Uint8Array(createJpegWithMetadata());
    const truncated = complete.slice(0, -2).buffer;

    onmessage({
      data: {
        config: createBaseConfig(),
        imageItems: [
          {
            id: "1",
            count: 1,
            name: "truncated.jpg",
            type: "image/jpeg",
            buffer: truncated,
          },
        ],
        appMode: "image",
        textConfig: createTextConfig(),
      },
    });
    await flushAsync();

    expect(createBitmap).not.toHaveBeenCalled();
    expect(mockJsPdfInstance.addImage).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith({
      protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
      requestId: "test-request",
      type: "error",
      data: expect.objectContaining({ code: "image_error_decode" }),
    });
  });

  it("does not scan JPEG entropy data for fake frame markers", async () => {
    const createBitmap = vi.fn();
    vi.stubGlobal("createImageBitmap", createBitmap);
    vi.stubGlobal("OffscreenCanvas", MockOffscreenCanvas);
    const { postMessage, onmessage } = await setupWorker();
    const entropyWithFakeFrame = new Uint8Array([
      0xff, 0xd8, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
      0xff, 0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x28, 0x00, 0x50, 0x01,
      0x01, 0x11, 0x00, 0xff, 0xd9,
    ]).buffer;

    onmessage({
      data: {
        config: createBaseConfig(),
        imageItems: [
          {
            id: "1",
            count: 1,
            name: "entropy.jpg",
            type: "image/jpeg",
            buffer: entropyWithFakeFrame,
          },
        ],
        appMode: "image",
        textConfig: createTextConfig(),
      },
    });
    await flushAsync();

    expect(createBitmap).not.toHaveBeenCalled();
    expect(mockJsPdfInstance.addImage).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith({
      protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
      requestId: "test-request",
      type: "error",
      data: expect.objectContaining({ code: "image_error_decode" }),
    });
  });

  it("rejects images that exceed the decoded dimension budget", async () => {
    (
      globalThis as unknown as { createImageBitmap?: unknown }
    ).createImageBitmap = vi.fn(async () => ({
      width: 10_001,
      height: 10,
      close: vi.fn(),
    }));
    const { postMessage, onmessage } = await setupWorker();

    onmessage({
      data: {
        config: createBaseConfig(),
        imageItems: [
          {
            id: "1",
            count: 1,
            name: "huge.png",
            type: "image/png",
            buffer: createBudgetPng(10_001, 10),
          },
        ],
        appMode: "image",
        textConfig: createTextConfig(),
      },
    });
    await flushAsync();

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
        requestId: "test-request",
        type: "error",
        data: expect.objectContaining({ code: "image_error_dimensions" }),
      }),
    );
  });

  it("rejects cumulative pixels at the fifth image and starts the next request with a fresh budget", async () => {
    const close = vi.fn();
    const decode = vi.fn(async () => ({ width: 5_000, height: 7_000, close }));
    vi.stubGlobal("createImageBitmap", decode);
    const { postMessage, onmessage } = await setupWorker();
    const imageItems = Array.from({ length: 5 }, (_, index) => ({
      id: String(index),
      count: 1,
      name: `label-${index}.png`,
      type: "image/png",
      buffer: createBudgetPng(5_000, 7_000),
    }));
    const data = {
      config: createBaseConfig(),
      imageItems,
      appMode: "image",
      textConfig: createTextConfig(),
    };
    onmessage({ data });
    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith({
        protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
        requestId: "test-request",
        type: "error",
        data: expect.objectContaining({ code: "image_error_total_pixels" }),
      });
    });
    expect(decode).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(mockJsPdfInstance.addImage).not.toHaveBeenCalled();
    expect(readPngDimensions).toHaveBeenCalledTimes(5);
    expect(validatePngScanlines).toHaveBeenCalledTimes(4);
    expect(
      postMessage.mock.calls.filter(
        ([message]) =>
          message.type === "progress" && message.data.phase === "preparing",
      ),
    ).toHaveLength(4);

    postMessage.mockClear();
    onmessage({ data: { ...data, imageItems: imageItems.slice(0, 4) } });
    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "complete" }),
        expect.any(Array),
      );
    });
    expect(decode).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(mockJsPdfInstance.addImage).toHaveBeenCalledTimes(4);
  });

  it("rejects non-finite image counts before PDF loops", async () => {
    (
      globalThis as unknown as { createImageBitmap?: unknown }
    ).createImageBitmap = vi.fn(async () => ({
      width: 100,
      height: 50,
      close: vi.fn(),
    }));
    const { postMessage, onmessage } = await setupWorker();

    onmessage({
      data: {
        config: createBaseConfig(),
        imageItems: [
          {
            id: "1",
            count: Number.POSITIVE_INFINITY,
            name: "label.png",
            type: "image/png",
            buffer: createCollisionPng("red").buffer,
          },
        ],
        appMode: "image",
        textConfig: createTextConfig(),
      },
    });
    await flushAsync();
    await flushAsync();

    expect(mockJsPdfInstance.addImage).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith({
      protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
      requestId: "test-request",
      type: "error",
      data: expect.objectContaining({ code: "pdf_worker_protocol_error" }),
    });
  });

  it("rejects empty image generation after normalizing layout values", async () => {
    (
      globalThis as unknown as { createImageBitmap?: unknown }
    ).createImageBitmap = vi.fn();
    const { postMessage, onmessage } = await setupWorker();

    onmessage({
      data: {
        config: { ...createBaseConfig(), rows: 0 },
        imageItems: [],
        appMode: "image",
        textConfig: createTextConfig(),
      },
    });

    await flushAsync();

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
        requestId: "test-request",
        type: "error",
        data: expect.objectContaining({ code: "image_error_no_files" }),
      }),
    );
  });

  it("clamps unsafe text counts before entering PDF loops", async () => {
    (
      globalThis as unknown as { createImageBitmap?: unknown }
    ).createImageBitmap = vi.fn();
    const { postMessage, onmessage } = await setupWorker();

    onmessage({
      data: {
        config: createBaseConfig(),
        imageItems: [],
        appMode: "text",
        textConfig: createTextConfig({ count: 1000, showQrCode: false }),
      },
    });

    await flushAsync();
    await flushAsync();

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "complete" }),
      expect.any(Array),
    );
    expect(mockJsPdfInstance.text).toHaveBeenCalledTimes(500);
  });

  it("writes sequential text labels in text mode", async () => {
    const { postMessage, onmessage } = await setupWorker();

    onmessage({
      data: {
        config: { ...createBaseConfig(), cols: 2 },
        imageItems: [],
        appMode: "text",
        textConfig: createTextConfig({
          prefix: "ASSET-",
          startNumber: 8,
          digits: 4,
          count: 3,
        }),
      },
    });

    await flushAsync();
    await flushAsync();

    expect(mockJsPdfInstance.text).toHaveBeenNthCalledWith(
      1,
      "ASSET-0008",
      expect.any(Number),
      expect.any(Number),
      { align: "center", baseline: "middle" },
    );
    expect(mockJsPdfInstance.text).toHaveBeenNthCalledWith(
      3,
      "ASSET-0010",
      expect.any(Number),
      expect.any(Number),
      { align: "center", baseline: "middle" },
    );
    expect(mockJsPdfInstance.addPage).toHaveBeenCalledTimes(1);
    expect(mockJsPdfInstance.setFont).toHaveBeenCalledWith("courier", "bold");
    expect(mockJsPdfInstance.addImage).not.toHaveBeenCalled();
    expect(
      postMessage.mock.calls.every(
        ([message]) => message.protocolVersion === PDF_WORKER_PROTOCOL_VERSION,
      ),
    ).toBe(true);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "complete" }),
      expect.any(Array),
    );
  });

  it("draws QR modules without relying on DOM canvas APIs", async () => {
    const { postMessage, onmessage } = await setupWorker();

    onmessage({
      data: {
        config: createBaseConfig(),
        imageItems: [],
        appMode: "text",
        textConfig: createTextConfig({
          count: 1,
          showQrCode: true,
          qrContentPrefix: "https://example.test/item/",
        }),
      },
    });

    await flushAsync();
    await flushAsync();

    expect(mockJsPdfInstance.setFillColor).toHaveBeenCalledWith(0, 0, 0);
    expect(mockJsPdfInstance.rect).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      "F",
    );
    expect(mockJsPdfInstance.addImage).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "complete" }),
      expect.any(Array),
    );
    expect(jsPDF).toHaveBeenCalledWith(
      expect.objectContaining({ compress: true }),
    );
  });

  it("does not misclassify PDF drawing failures as QR capacity errors", async () => {
    mockJsPdfInstance.rect.mockImplementationOnce(() => {
      throw new Error("rect drawing failed");
    });
    const { postMessage, onmessage } = await setupWorker();

    onmessage({
      data: {
        config: createBaseConfig(),
        imageItems: [],
        appMode: "text",
        textConfig: createTextConfig({ showQrCode: true }),
      },
    });

    await flushAsync();
    await flushAsync();

    expect(postMessage).toHaveBeenCalledWith({
      protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
      requestId: "test-request",
      type: "error",
      data: expect.objectContaining({
        code: "pdf_generation_failed",
        message: "rect drawing failed",
      }),
    });
  });

  it("caps oversized QR prefixes at the worker boundary", async () => {
    const { postMessage, onmessage } = await setupWorker();

    onmessage({
      data: {
        config: createBaseConfig(),
        imageItems: [],
        appMode: "text",
        textConfig: createTextConfig({
          showQrCode: true,
          qrContentPrefix: "x".repeat(5_000),
        }),
      },
    });

    await flushAsync();
    await flushAsync();

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "complete" }),
      expect.any(Array),
    );
  });

  it("clamps an oversized digit count before formatting", async () => {
    const { postMessage, onmessage } = await setupWorker();

    onmessage({
      data: {
        config: createBaseConfig(),
        imageItems: [],
        appMode: "text",
        textConfig: createTextConfig({ digits: 999_999_999 }),
      },
    });

    await flushAsync();
    await flushAsync();

    expect(mockJsPdfInstance.text).toHaveBeenCalledWith(
      "SN-0000000001",
      expect.any(Number),
      expect.any(Number),
      { align: "center", baseline: "middle" },
    );
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "complete" }),
      expect.any(Array),
    );
  });

  it("rasterizes Unicode text instead of passing it to Courier", async () => {
    vi.stubGlobal("OffscreenCanvas", MockOffscreenCanvas);
    const { postMessage, onmessage } = await setupWorker();

    onmessage({
      data: {
        config: createBaseConfig(),
        imageItems: [],
        appMode: "text",
        textConfig: createTextConfig({ prefix: "中文-" }),
      },
    });

    await flushAsync();
    await flushAsync();

    expect(fillTextMock).toHaveBeenCalledWith(
      "中文-001",
      expect.any(Number),
      expect.any(Number),
    );
    expect(mockJsPdfInstance.addImage).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      "PNG",
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(String),
      "FAST",
    );
    expect(mockJsPdfInstance.text).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "complete" }),
      expect.any(Array),
    );
  });

  it("reports actual work phases with structured progress", async () => {
    const { postMessage, onmessage } = await setupWorker();

    onmessage({
      data: {
        config: createBaseConfig(),
        imageItems: [],
        appMode: "text",
        textConfig: createTextConfig({ count: 2 }),
      },
    });
    await flushAsync();
    await flushAsync();

    expect(postMessage).toHaveBeenCalledWith({
      protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
      requestId: "test-request",
      type: "progress",
      data: { percent: 20, phase: "preparing" },
    });
    expect(postMessage).toHaveBeenCalledWith({
      protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
      requestId: "test-request",
      type: "progress",
      data: { percent: 90, phase: "rendering" },
    });
    expect(postMessage).toHaveBeenCalledWith({
      protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
      requestId: "test-request",
      type: "progress",
      data: { percent: 95, phase: "serializing" },
    });
  });

  it("rejects messages outside the worker protocol", async () => {
    const { postMessage, rawOnmessage } = await setupWorker();

    rawOnmessage({ data: { type: "unknown", data: null } });
    await flushAsync();

    expect(postMessage).toHaveBeenCalledWith({
      protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
      requestId: null,
      type: "error",
      data: expect.objectContaining({ code: "pdf_worker_protocol_error" }),
    });
  });
});
