import { describe, it, expect, vi, beforeEach } from "vitest";
import type { HelperLayoutConfig, TextConfig } from "./layoutMath";

const mockJsPdfInstance = {
  addImage: vi.fn(),
  setFont: vi.fn(),
  setFontSize: vi.fn(),
  getStringUnitWidth: vi.fn(() => 1),
  text: vi.fn(),
  addPage: vi.fn(),
  output: vi.fn(() => new ArrayBuffer(8)),
};

vi.mock("jspdf", () => ({
  default: vi.fn(function () {
    return mockJsPdfInstance;
  }),
}));

const qrMock = {
  toDataURL: vi.fn(async () => "data:image/png;base64,xyz"),
};

vi.mock("qrcode", () => ({
  default: qrMock,
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
  onmessage?: (e: { data: unknown }) => void;
};

const setupWorker = async () => {
  const postMessage = vi.fn();
  (globalThis as unknown as { self: WorkerSelf }).self = { postMessage };
  await import("./pdf.worker");
  const workerSelf = (globalThis as unknown as { self: WorkerSelf }).self;
  return {
    postMessage,
    onmessage: workerSelf.onmessage as (e: { data: unknown }) => void,
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
  mockJsPdfInstance.addPage.mockClear();
  mockJsPdfInstance.output.mockClear();
  qrMock.toDataURL.mockClear();
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

  it("posts error when layout is invalid", async () => {
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
      expect.objectContaining({ type: "error" }),
    );
  });

  it("handles large text counts as a smoke test", async () => {
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
    expect(mockJsPdfInstance.text).toHaveBeenCalledTimes(1000);
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

  it("uses QR content prefix and draws QR images", async () => {
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

    expect(qrMock.toDataURL).toHaveBeenCalledWith(
      "https://example.test/item/SN-001",
      expect.objectContaining({
        errorCorrectionLevel: "M",
      }),
    );
    expect(mockJsPdfInstance.addImage).toHaveBeenCalledWith(
      "data:image/png;base64,xyz",
      "PNG",
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    );
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "complete" }),
      expect.any(Array),
    );
  });

  it("posts an error when QR generation fails", async () => {
    qrMock.toDataURL.mockRejectedValueOnce(new Error("qr boom"));
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

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        data: expect.stringContaining("QR code generation failed"),
      }),
    );
  });
});
