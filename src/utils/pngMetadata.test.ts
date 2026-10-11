// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createCollisionPng,
  createScanlinePng,
  withPngChunk,
} from "../test/pngFixtures";
import { readPngDimensions, validatePngScanlines } from "./pngMetadata";

afterEach(() => vi.unstubAllGlobals());

describe("PNG structural metadata", () => {
  it("rejects unknown critical chunks and invalid reserved bits while allowing ancillary chunks", async () => {
    const png = createCollisionPng("red");
    expect(readPngDimensions(withPngChunk(png, "ABCD"))).toBeNull();
    expect(readPngDimensions(withPngChunk(png, "abcd"))).toBeNull();
    const ancillary = withPngChunk(png, "aBCD");
    expect(readPngDimensions(ancillary)).toEqual({ width: 32, height: 32 });
    await expect(validatePngScanlines(ancillary)).resolves.toBeUndefined();
  });
  it("reads dimensions without decoding pixels", () => {
    expect(readPngDimensions(createCollisionPng("red"))).toEqual({
      width: 32,
      height: 32,
    });
  });
  it("rejects incomplete chunks, IHDR-only files and wrong signatures", () => {
    const png = createCollisionPng("red");
    for (const length of [24, 33, png.length - 1, png.length - 12])
      expect(readPngDimensions(png.slice(0, length))).toBeNull();
    const invalid = png.slice();
    invalid[7] = 0;
    expect(readPngDimensions(invalid)).toBeNull();
    const oversized = png.slice();
    oversized[33] = 255;
    expect(readPngDimensions(oversized)).toBeNull();
  });
  it("rejects nonconsecutive IDAT even when the first IDAT is empty", () => {
    expect(
      readPngDimensions(
        createScanlinePng([0, 0], {
          width: 1,
          height: 1,
          color: 0,
          interruptedIdat: true,
        }),
      ),
    ).toBeNull();
  });
  it("checks all Adam7 passes with packed low-bit rows and ancillary chunks", async () => {
    // 9x9 grayscale at depth 1: seven passes with independent packed row widths.
    const passes = [
      [2, 2],
      [2, 1],
      [1, 3],
      [3, 2],
      [2, 5],
      [5, 4],
      [4, 9],
    ];
    const raw = passes.flatMap(([rows, columns]) =>
      Array.from({ length: rows * (1 + Math.ceil(columns / 8)) }, () => 0),
    );
    await expect(
      validatePngScanlines(
        createScanlinePng(raw, {
          width: 9,
          height: 9,
          color: 0,
          depth: 1,
          interlace: 1,
          ancillary: true,
        }),
      ),
    ).resolves.toBeUndefined();
    await expect(
      validatePngScanlines(
        createScanlinePng(raw.slice(0, -1), {
          width: 9,
          height: 9,
          color: 0,
          depth: 1,
          interlace: 1,
        }),
      ),
    ).rejects.toThrow("Truncated");
  });
  it("accepts every legal color/depth scanline size", async () => {
    for (const [color, channels, depths] of [
      [0, 1, [1, 2, 4, 8, 16]],
      [2, 3, [8, 16]],
      [3, 1, [1, 2, 4, 8]],
      [4, 2, [8, 16]],
      [6, 4, [8, 16]],
    ] as const) {
      for (const depth of depths) {
        const raw = Array.from(
          { length: 2 * (1 + Math.ceil((9 * channels * depth) / 8)) },
          () => 0,
        );
        await expect(
          validatePngScanlines(
            createScanlinePng(raw, { width: 9, height: 2, color, depth }),
          ),
        ).resolves.toBeUndefined();
      }
    }
  });
  it("cancels an overlong decoded stream at the first excessive chunk", async () => {
    const cancel = vi.fn();
    const start = vi.fn(
      (controller: ReadableStreamDefaultController<Uint8Array>) => {
        controller.enqueue(new Uint8Array([0, 0, 0, 0, 0]));
      },
    );
    vi.stubGlobal("DecompressionStream", function () {
      return {
        writable: new WritableStream(),
        readable: new ReadableStream({ start, cancel }),
      };
    });
    await expect(
      validatePngScanlines(
        createScanlinePng([0, 0, 0, 0], { width: 1, height: 1 }),
      ),
    ).rejects.toThrow("Excess");
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("feeds compressed input in bounded slices and skips empty IDAT chunks", async () => {
    const sizes: number[] = [];
    const raw = new Uint8Array(3104);
    vi.stubGlobal("DecompressionStream", function () {
      return new TransformStream<Uint8Array, Uint8Array>({
        transform(bytes) {
          sizes.push(bytes.length);
        },
        flush(controller) {
          controller.enqueue(raw);
        },
      });
    });
    await validatePngScanlines(createScanlinePng(Array.from(raw)));
    expect(sizes.length).toBeGreaterThan(1);
    expect(sizes.every((length) => length > 0 && length <= 1024)).toBe(true);
  });
  it("validates and closes a native bitmap when streaming decompression is unavailable", async () => {
    vi.stubGlobal("DecompressionStream", undefined);
    const close = vi.fn();
    const decode = vi.fn(async () => ({ close }));
    vi.stubGlobal("createImageBitmap", decode);
    await validatePngScanlines(createCollisionPng("red"));
    expect(decode).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    vi.stubGlobal("createImageBitmap", undefined);
    await expect(
      validatePngScanlines(createCollisionPng("red")),
    ).rejects.toThrow("unavailable");
  });
});
