import jsPDF from "jspdf";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { HelperLayoutConfig, TextConfig } from "./layoutMath";

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

function createJpegWithMetadata({
  width = 80,
  height = 40,
  orientation,
  fillBeforeSof = false,
}: {
  width?: number;
  height?: number;
  orientation?: number;
  fillBeforeSof?: boolean;
} = {}): ArrayBuffer {
  const exif =
    orientation === undefined
      ? []
      : [
          0xff,
          0xe1,
          0x00,
          0x22,
          0x45,
          0x78,
          0x69,
          0x66,
          0x00,
          0x00,
          0x49,
          0x49,
          0x2a,
          0x00,
          0x08,
          0x00,
          0x00,
          0x00,
          0x01,
          0x00,
          0x12,
          0x01,
          0x03,
          0x00,
          0x01,
          0x00,
          0x00,
          0x00,
          orientation,
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
        ];
  return new Uint8Array([
    0xff,
    0xd8,
    ...exif,
    0xff,
    0xe0,
    0x00,
    0x02,
    ...(fillBeforeSof ? [0xff] : []),
    0xff,
    0xc0,
    0x00,
    0x0b,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x01,
    0x01,
    0x11,
    0x00,
    0xff,
    0xda,
    0x00,
    0x08,
    0x01,
    0x01,
    0x00,
    0x00,
    0x3f,
    0x00,
    0xff,
    0xd9,
  ]).buffer;
}

type WorkerSelf = {
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
  onmessage?: (e: { data: unknown }) => void;
};

const fillTextMock = vi.fn();
const drawImageMock = vi.fn();

class MockOffscreenCanvas {
  width: number;
  height: number;

  constructor(width: number, height: number) {
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
  const rawOnmessage = workerSelf.onmessage as (e: { data: unknown }) => void;
  return {
    postMessage,
    rawOnmessage,
    onmessage: (event: { data: unknown }) =>
      rawOnmessage({
        data: { type: "generate", data: event.data },
      }),
  };
};

beforeEach(() => {
  vi.resetModules();
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
  drawImageMock.mockClear();
  vi.mocked(jsPDF).mockClear();
});

describe("pdf.worker", () => {
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

    const buffer = new ArrayBuffer(4);
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

    expect(closeMock).toHaveBeenCalledTimes(1);
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
      undefined,
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
      undefined,
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
            buffer: new ArrayBuffer(4),
          },
        ],
        appMode: "image",
        textConfig: createTextConfig(),
      },
    });
    await flushAsync();

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        data: expect.objectContaining({ code: "image_error_dimensions" }),
      }),
    );
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
            buffer: new ArrayBuffer(4),
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
      type: "error",
      data: expect.objectContaining({ code: "pdf_worker_protocol_error" }),
    });
  });

  it("normalizes invalid layout values from worker messages", async () => {
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
      expect.objectContaining({ type: "complete" }),
      expect.any(Array),
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
      { align: "left" },
    );
    expect(mockJsPdfInstance.text).toHaveBeenNthCalledWith(
      3,
      "ASSET-0010",
      expect.any(Number),
      expect.any(Number),
      { align: "left" },
    );
    expect(mockJsPdfInstance.addPage).toHaveBeenCalledTimes(1);
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
      { align: "left" },
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
      undefined,
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
      type: "progress",
      data: { percent: 20, phase: "preparing" },
    });
    expect(postMessage).toHaveBeenCalledWith({
      type: "progress",
      data: { percent: 90, phase: "rendering" },
    });
    expect(postMessage).toHaveBeenCalledWith({
      type: "progress",
      data: { percent: 95, phase: "serializing" },
    });
  });

  it("rejects messages outside the worker protocol", async () => {
    const { postMessage, rawOnmessage } = await setupWorker();

    rawOnmessage({ data: { type: "unknown", data: null } });
    await flushAsync();

    expect(postMessage).toHaveBeenCalledWith({
      type: "error",
      data: expect.objectContaining({ code: "pdf_worker_protocol_error" }),
    });
  });
});
