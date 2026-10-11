// @vitest-environment node
import { inflateSync } from "node:zlib";

import jsPDF from "jspdf";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createCollisionPng,
  createCorruptPng,
  createScanlinePng,
  withPngChunk,
} from "../test/pngFixtures";
import {
  DEFAULT_TEXT_CONFIG,
  MM_PER_PT,
  getLabelTextFontSizeMm,
  type HelperLayoutConfig,
  type TextConfig,
} from "./layoutMath";
import {
  PDF_WORKER_PROTOCOL_VERSION,
  type PdfWorkerResponse,
} from "./pdfWorkerProtocol";

async function runWorker(
  imageItems: unknown[],
  appMode = "image",
  config: Partial<HelperLayoutConfig> = {},
  textConfig: Partial<TextConfig> = {},
) {
  vi.resetModules();
  const messages: PdfWorkerResponse[] = [];
  const worker = {
    postMessage: (message: PdfWorkerResponse) => messages.push(message),
    onmessage: undefined as
      | ((event: { data: unknown }) => Promise<void>)
      | undefined,
  };
  vi.stubGlobal("self", worker);
  await import("./pdf.worker");
  await worker.onmessage!({
    data: {
      type: "generate",
      requestId: "real-request",
      data: {
        protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
        config: {
          rows: 1,
          cols: 2,
          marginMm: 0,
          spacingMm: 0,
          orientation: "portrait",
          pageWidthMm: 100,
          pageHeightMm: 100,
          ...config,
        },
        textConfig: {
          ...DEFAULT_TEXT_CONFIG,
          prefix: "A",
          count: 1,
          digits: 1,
          ...textConfig,
        },
        imageItems,
        appMode,
      },
    },
  });
  expect(messages.length).toBeGreaterThan(0);
  for (const message of messages) {
    expect(message.requestId).toBe("real-request");
    expect(message.protocolVersion).toBe(PDF_WORKER_PROTOCOL_VERSION);
  }
  return messages.at(-1)!;
}

function streams(buffer: ArrayBuffer): string[] {
  const body = Buffer.from(buffer).toString("latin1");
  return Array.from(
    body.matchAll(/<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g),
    (match) => {
      const data = Buffer.from(match[2], "latin1");
      return match[1].includes("/FlateDecode")
        ? inflateSync(data).toString("latin1")
        : match[2];
    },
  );
}

function pdfOutput(result: PdfWorkerResponse): string {
  expect(result.type).toBe("complete");
  if (result.type !== "complete")
    throw new Error("Expected complete worker output");
  return Buffer.from(result.data).toString("latin1");
}

function imageDraws(result: PdfWorkerResponse): string[] {
  pdfOutput(result);
  if (result.type !== "complete")
    throw new Error("Expected complete worker output");
  return streams(result.data).flatMap((stream) =>
    Array.from(stream.matchAll(/\/(I\d+) Do/g), (match) => match[1]),
  );
}

function sourceItem(buffer: ArrayBuffer, count: number, id = "duplicate") {
  return { id, count, name: `${id}.png`, type: "image/png", buffer };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("createImageBitmap", vi.fn());
});

describe("actual jsPDF worker output", () => {
  it("rejects unknown critical chunks without rejecting unknown ancillary chunks", async () => {
    for (const type of ["ABCD", "abcd", "aBCD"]) {
      const png = withPngChunk(createCollisionPng("red"), type);
      const result = await runWorker([
        {
          id: "chunk",
          count: 1,
          name: "chunk.png",
          type: "image/png",
          buffer: png.buffer,
        },
      ]);
      if (type === "aBCD") expect(result.type).toBe("complete");
      else
        expect(result).toMatchObject({
          type: "error",
          data: { code: "image_error_decode", params: { name: "chunk.png" } },
        });
    }
  });
  it("keeps distinct PNG bottom rows despite the library's implicit alias collision", async () => {
    const red = createCollisionPng("red"),
      blue = createCollisionPng("blue");
    expect(red.slice(0, red.length / 2)).toEqual(
      blue.slice(0, blue.length / 2),
    );
    const implicit = new jsPDF();
    implicit.addImage(red, "PNG", 0, 0, 10, 10);
    implicit.addImage(blue, "PNG", 10, 0, 10, 10);
    expect((implicit.output().match(/\/Subtype \/Image/g) ?? []).length).toBe(
      1,
    );
    const result = await runWorker(
      [red, blue].map((png) => ({
        id: "duplicate",
        count: 1,
        name: "color.png",
        type: "image/png",
        buffer: png.buffer,
      })),
    );
    expect(result.type).toBe("complete");
    if (result.type !== "complete")
      throw new Error("Expected complete worker output");
    const decoded = streams(result.data);
    const bottomRows = decoded
      .filter((stream) => stream.length === 32 * 97)
      .map((stream) => {
        const row = Array.from(stream.slice(-97), (byte) => byte.charCodeAt(0));
        expect(row.shift()).toBe(1); // jsPDF FAST uses PNG Sub prediction.
        for (let index = 3; index < row.length; index++)
          row[index] = (row[index] + row[index - 3]) & 255;
        return row;
      });
    expect(bottomRows).toContainEqual(
      Array.from({ length: 32 }, () => [255, 0, 0]).flat(),
    );
    expect(bottomRows).toContainEqual(
      Array.from({ length: 32 }, () => [0, 0, 255]).flat(),
    );
    expect(
      (
        Buffer.from(result.data)
          .toString("latin1")
          .match(/\/Subtype \/Image/g) ?? []
      ).length,
    ).toBe(2);
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it("reuses the same prepared source across labels and queue entries", async () => {
    const buffer = createCollisionPng("red").buffer;
    const result = await runWorker(
      ["one", "two"].map((id) => ({
        id,
        count: 2,
        name: "same.png",
        type: "image/png",
        buffer,
      })),
    );
    expect(result.type).toBe("complete");
    if (result.type !== "complete")
      throw new Error("Expected complete worker output");
    expect(
      (
        Buffer.from(result.data)
          .toString("latin1")
          .match(/\/Subtype \/Image/g) ?? []
      ).length,
    ).toBe(1);
    expect(imageDraws(result)).toEqual(["I0", "I0", "I0", "I0"]);
  });

  it("embeds two sources once and draws all 3 + 2 copies across three pages", async () => {
    const red = createCollisionPng("red").buffer;
    const blue = createCollisionPng("blue").buffer;
    const result = await runWorker([
      sourceItem(red, 2),
      sourceItem(red, 1),
      sourceItem(blue, 1),
      sourceItem(blue, 1),
    ]);
    const pdf = pdfOutput(result);
    expect(pdf.match(/\/Subtype \/Image/g)).toHaveLength(2);
    expect(pdf.match(/\/Type \/Page\b/g)).toHaveLength(3);
    expect(imageDraws(result)).toEqual(["I0", "I0", "I0", "I1", "I1"]);
  });

  it("retains each queue count on cache hits before resolving a third source", async () => {
    const red = createCollisionPng("red").buffer;
    const blue = createCollisionPng("blue").buffer;
    const third = createCollisionPng("red", 16, 16).buffer;
    const result = await runWorker([
      sourceItem(red, 1),
      sourceItem(red, 3),
      sourceItem(blue, 2),
      sourceItem(third, 1),
    ]);
    expect(pdfOutput(result).match(/\/Subtype \/Image/g)).toHaveLength(3);
    expect(imageDraws(result)).toEqual([
      "I0",
      "I0",
      "I0",
      "I0",
      "I1",
      "I1",
      "I2",
    ]);
  });

  it("keeps source pixels while fitting the same source to different reachable paper grids", async () => {
    const buffer = createCollisionPng("red", 32, 16).buffer;
    for (const [config, widthMm, heightMm] of [
      [{ pageWidthMm: 100, pageHeightMm: 100 }, 50, 25],
      [
        {
          pageWidthMm: 160,
          pageHeightMm: 80,
          cols: 1,
          orientation: "landscape",
        },
        160,
        80,
      ],
    ] as const) {
      const result = await runWorker([sourceItem(buffer, 1)], "image", config);
      const pdf = pdfOutput(result);
      expect(pdf).toMatch(/\/Width 32\s+\/Height 16/);
      expect(pdf.match(/\/Subtype \/Image/g)).toHaveLength(1);
      if (result.type !== "complete")
        throw new Error("Expected complete worker output");
      const content = streams(result.data).find((stream) =>
        stream.includes("/I0 Do"),
      )!;
      const matrix = content.match(
        /([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm\s*\/I0 Do/,
      )!;
      expect(Number(matrix[1])).toBeCloseTo(widthMm / MM_PER_PT, 8);
      expect(Number(matrix[2])).toBeCloseTo(heightMm / MM_PER_PT, 8);
      expect(Number(matrix[3])).toBeCloseTo(0, 8);
      expect(Number(matrix[4])).toBeCloseTo(
        (config.pageHeightMm - heightMm) / 2 / MM_PER_PT,
        8,
      );
      expect(imageDraws(result)).toEqual(["I0"]);
    }
  });

  it("embeds distinct Unicode raster results with real jsPDF despite colliding PNG prefixes", async () => {
    const rendered: string[] = [];
    // A deterministic canvas fixture supplies different real PNG pixels for each
    // label. Browser E2E separately exercises native canvas glyph rendering.
    vi.stubGlobal(
      "OffscreenCanvas",
      class {
        text = "";
        getContext() {
          return {
            fillRect: () => {},
            measureText: () => ({ width: 10 }),
            fillText: (text: string) => {
              this.text = text;
              rendered.push(text);
            },
          };
        }
        async convertToBlob() {
          return new Blob(
            [createCollisionPng(this.text.endsWith("1") ? "red" : "blue")],
            { type: "image/png" },
          );
        }
      },
    );
    try {
      const result = await runWorker(
        [],
        "text",
        {},
        { prefix: "中文-", count: 2 },
      );
      expect(rendered).toEqual(["中文-1", "中文-2"]);
      expect(pdfOutput(result).match(/\/Subtype \/Image/g)).toHaveLength(2);
      expect(imageDraws(result)).toEqual(["I0", "I1"]);
    } finally {
      vi.stubGlobal("OffscreenCanvas", undefined);
    }
  });

  it("counts cached queue entries against the source admission bound", async () => {
    const buffer = createCollisionPng("red").buffer;
    const result = await runWorker(
      Array.from({ length: 21 }, () => sourceItem(buffer, 1)),
    );
    expect(result).toMatchObject({
      type: "error",
      data: { code: "image_error_count", params: { max: 20 } },
    });
  });

  it("maps the real decoder's corrupt PNG rejection to the source filename", async () => {
    const png = createCollisionPng("red");
    png[50] ^= 255; // IDAT mutation with stale CRC, structurally complete.
    const result = await runWorker([
      {
        id: "one",
        count: 1,
        name: "corrupt.png",
        type: "image/png",
        buffer: png.buffer,
      },
    ]);
    expect(result).toMatchObject({
      type: "error",
      data: { code: "image_error_decode", params: { name: "corrupt.png" } },
    });
  });

  it("rejects invalid compressed PNG data even with correct chunk CRCs", async () => {
    const result = await runWorker([
      {
        id: "broken",
        count: 1,
        name: "broken-zlib.png",
        type: "image/png",
        buffer: createCorruptPng().buffer,
      },
    ]);
    expect(result).toMatchObject({
      type: "error",
      data: { code: "image_error_decode", params: { name: "broken-zlib.png" } },
    });
  });

  it("rejects PNGs whose complete zlib data does not contain exact scanlines", async () => {
    const shortProbe = new Uint8Array(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAGUlEQVR4nO3BAQ0AAADCoPdP7WYOoAAAAG4MHwABtJynVgAAAABJRU5ErkJggg==",
        "base64",
      ),
    );
    // Installed jsPDF accepts this short stream, filling the missing pixel data.
    expect(() =>
      new jsPDF().addImage(shortProbe, "PNG", 0, 0, 10, 10),
    ).not.toThrow();
    const invalidFilter = Array.from({ length: 3104 }, () => 0);
    invalidFilter[97] = 5;
    for (const png of [
      shortProbe,
      createScanlinePng(Array.from({ length: 3103 }, () => 0)),
      createScanlinePng(Array.from({ length: 3105 }, () => 0)),
      createScanlinePng(invalidFilter),
    ]) {
      const result = await runWorker([
        {
          id: "bad",
          count: 1,
          name: "bad-scanlines.png",
          type: "image/png",
          buffer: png.buffer,
        },
      ]);
      expect(result).toMatchObject({
        type: "error",
        data: {
          code: "image_error_decode",
          params: { name: "bad-scanlines.png" },
        },
      });
    }
  });

  it("preserves valid low-bit grayscale and Adam7 PNG output", async () => {
    const lowBit = createScanlinePng(
      Array.from({ length: 9 }, () => 0),
      { width: 9, height: 3, depth: 1, color: 0, ancillary: true },
    );
    // 1x1 Adam7 has only its first pass; empty passes have no filter byte.
    const interlaced = createScanlinePng([0, 255, 0, 0], {
      width: 1,
      height: 1,
      interlace: 1,
    });
    const result = await runWorker(
      [lowBit, interlaced].map((png) => ({
        id: "valid",
        count: 1,
        name: "valid.png",
        type: "image/png",
        buffer: png.buffer,
      })),
    );
    expect(result.type).toBe("complete");
  });

  it("writes the actual Courier text stream at the box center with middle baseline", async () => {
    const result = await runWorker([], "text");
    expect(result.type).toBe("complete");
    if (result.type !== "complete")
      throw new Error("Expected complete worker output");
    const content = streams(result.data).find((stream) =>
      stream.includes("(A1) Tj"),
    )!;
    const fontSize =
      getLabelTextFontSizeMm("A1", { width: 50, height: 100 }, false) /
      MM_PER_PT;
    const baselineOffset = 0.5 - (new jsPDF().getLineHeightFactor() - 1);
    const x = 25 / MM_PER_PT - 0.6 * fontSize;
    const y = 100 / MM_PER_PT - (50 / MM_PER_PT + baselineOffset * fontSize);
    const match = content.match(/([\d.]+) ([\d.]+) Td/)!;
    expect(Number(match[1])).toBeCloseTo(x, 8);
    expect(Number(match[2])).toBeCloseTo(y, 8);
  });
});
