import { afterEach, describe, expect, it, vi } from "vitest";

import { createJpegWithMetadata } from "../test/jpegFixtures";
import {
  createBudgetPng,
  createCollisionPng,
  createCorruptPng,
} from "../test/pngFixtures";
import { AppError } from "./appError";
import {
  IMAGE_LIMITS,
  createImagePixelBudget,
  detectImageMimeType,
  getImageLabelCount,
  getValidatedJpegOrientation,
  normalizeImageItemCount,
  readValidatedImageFile,
  validateImageFileContents,
  validateImageDimensions,
  validateImageFiles,
  validateImageLabelCount,
} from "./imageLimits";

const image = (
  overrides: Partial<Pick<File, "name" | "size" | "type">> = {},
) => ({
  name: "label.png",
  size: 1_024,
  type: "image/png",
  ...overrides,
});

function expectCode(action: () => void, code: AppError["code"]): void {
  try {
    action();
    throw new Error("Expected validation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
  }
}

describe("image resource limits", () => {
  it.each([
    {
      orientation: undefined,
      lateOrientation: 6,
      expected: 1,
      width: 80,
      height: 40,
    },
    { orientation: 6, lateOrientation: 3, expected: 6, width: 40, height: 80 },
  ])(
    "admits late APP1 $lateOrientation using header orientation $expected without decoding",
    async ({ orientation, lateOrientation, expected, width, height }) => {
      const bitmap = vi.fn();
      const image = vi.fn();
      vi.stubGlobal("createImageBitmap", bitmap);
      vi.stubGlobal("Image", image);
      const file = new File(
        [createJpegWithMetadata({ orientation, lateOrientation })],
        "late.jpg",
        { type: "image/jpeg" },
      );
      expect((await validateImageFileContents([file])).get(file)).toEqual({
        width,
        height,
      });
      expect(getValidatedJpegOrientation(file)).toBe(expected);
      expect(bitmap).not.toHaveBeenCalled();
      expect(image).not.toHaveBeenCalled();
    },
  );

  afterEach(() => vi.unstubAllGlobals());

  it("normalizes malformed per-image label counts", () => {
    expect(normalizeImageItemCount(Number.POSITIVE_INFINITY)).toBe(1);
    expect(normalizeImageItemCount(-10)).toBe(1);
    expect(normalizeImageItemCount(9_999)).toBe(999);
  });

  it("sums normalized image label counts for readiness checks", () => {
    expect(getImageLabelCount([{ count: 2 }, { count: 9999 }])).toBe(1001);
  });

  it("rejects excessive file count and bytes", () => {
    expectCode(
      () =>
        validateImageFiles(
          Array.from({ length: IMAGE_LIMITS.maxFiles + 1 }, () => image()),
        ),
      "image_error_count",
    );
    expectCode(
      () =>
        validateImageFiles([image({ size: IMAGE_LIMITS.maxFileBytes + 1 })]),
      "image_error_file_size",
    );
  });

  it("rejects empty files but permits an empty declared MIME type", () => {
    expectCode(
      () => validateImageFiles([image({ size: 0 })]),
      "image_error_empty",
    );
    expect(() => validateImageFiles([image({ type: "" })])).not.toThrow();
  });

  it("detects PNG/JPEG signatures and rejects type mismatches", async () => {
    const pngHeader = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(detectImageMimeType(pngHeader)).toBe("image/png");
    expect(detectImageMimeType(new Uint8Array([0xff, 0xd8, 0xff]))).toBe(
      "image/jpeg",
    );
    expect(detectImageMimeType(new Uint8Array([1, 2, 3]))).toBeNull();

    const mimeLessFile = new File([pngHeader], "label.bin", { type: "" });
    await expect(readValidatedImageFile(mimeLessFile)).resolves.toMatchObject({
      type: "image/png",
    });

    const mismatchedFile = new File([pngHeader], "label.jpg", {
      type: "image/jpeg",
    });
    await expect(readValidatedImageFile(mismatchedFile)).rejects.toMatchObject({
      code: "image_error_content",
    });
  });

  it("accepts the image/jpg alias and returns the canonical JPEG type", async () => {
    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff]);
    const file = new File([jpegHeader], "label.jpg", { type: "image/jpg" });

    expect(() => validateImageFiles([file])).not.toThrow();
    await expect(readValidatedImageFile(file)).resolves.toMatchObject({
      type: "image/jpeg",
    });

    const mismatchedFile = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      "label.jpg",
      { type: "image/jpg" },
    );
    await expect(readValidatedImageFile(mismatchedFile)).rejects.toMatchObject({
      code: "image_error_content",
    });
  });

  it("admits JPEGs using compressed metadata without native pixel allocation", async () => {
    const bitmap = vi.fn();
    const image = vi.fn();
    vi.stubGlobal("createImageBitmap", bitmap);
    vi.stubGlobal("Image", image);
    const file = new File(
      [createJpegWithMetadata({ width: 320, height: 180 })],
      "label.jpg",
      { type: "image/jpeg" },
    );
    const fullRead = vi.spyOn(file, "arrayBuffer");
    const dimensions = await validateImageFileContents([file]);
    dimensions.get(file)!.width = 10_001;
    expect((await validateImageFileContents([file])).get(file)).toEqual({
      width: 320,
      height: 180,
    });
    expect(fullRead).toHaveBeenCalledOnce();
    expect(bitmap).not.toHaveBeenCalled();
    expect(image).not.toHaveBeenCalled();
  });

  it.each([undefined, 1, 2, 3, 4, 5, 6, 7, 8])(
    "caches successfully validated JPEG orientation %s without rereading on edits",
    async (orientation) => {
      vi.stubGlobal(
        "createImageBitmap",
        vi.fn(async () => ({ width: 80, height: 40, close: vi.fn() })),
      );
      const file = new File(
        [createJpegWithMetadata({ orientation })],
        "photo.bin",
        { type: "" },
      );
      const read = vi.spyOn(file, "slice");
      expect(getValidatedJpegOrientation(file)).toBeUndefined();
      await validateImageFileContents([file]);
      expect(getValidatedJpegOrientation(file)).toBe(orientation ?? 1);
      const reads = read.mock.calls.length;
      await validateImageFileContents([file]);
      expect(read).toHaveBeenCalledTimes(reads);
      expect(createImageBitmap).not.toHaveBeenCalled();
    },
  );

  it("does not cache JPEG orientation after failed admission", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 10_001, height: 1, close: vi.fn() })),
    );
    const file = new File(
      [createJpegWithMetadata({ orientation: 6, width: 10_001 })],
      "bad.jpg",
      { type: "image/jpeg" },
    );
    await expect(validateImageFileContents([file])).rejects.toMatchObject({
      code: "image_error_dimensions",
    });
    expect(getValidatedJpegOrientation(file)).toBeUndefined();
  });

  it("retries malformed JPEG structure instead of caching failures", async () => {
    const bytes = new Uint8Array(createJpegWithMetadata());
    const file = new File([bytes.slice(0, -1)], "retry.jpg", {
      type: "image/jpeg",
    });
    const read = vi.spyOn(file, "arrayBuffer");
    for (let attempt = 0; attempt < 2; attempt++) {
      await expect(validateImageFileContents([file])).rejects.toMatchObject({
        code: "image_error_decode",
      });
      expect(getValidatedJpegOrientation(file)).toBeUndefined();
    }
    expect(read).toHaveBeenCalledTimes(2);
  });

  it.each([5, 6, 7, 8])(
    "swaps JPEG upload dimensions for EXIF %s",
    async (orientation) => {
      const file = new File(
        [createJpegWithMetadata({ width: 80, height: 40, orientation })],
        "rotated.jpg",
        { type: "image/jpeg" },
      );
      expect((await validateImageFileContents([file])).get(file)).toEqual({
        width: 40,
        height: 80,
      });
    },
  );

  it("rejects JPEG header budgets before a full read and pixel allocation", async () => {
    const bitmap = vi.fn();
    const image = vi.fn();
    vi.stubGlobal("createImageBitmap", bitmap);
    vi.stubGlobal("Image", image);
    const file = new File(
      [createJpegWithMetadata({ width: 10_000, height: 5_000 })],
      "huge.jpg",
      { type: "image/jpeg" },
    );
    const read = vi.spyOn(file, "arrayBuffer");
    for (let attempt = 0; attempt < 2; attempt++)
      await expect(validateImageFileContents([file])).rejects.toMatchObject({
        code: "image_error_pixel_count",
      });
    expect(read).not.toHaveBeenCalled();
    expect(getValidatedJpegOrientation(file)).toBeUndefined();
    expect(bitmap).not.toHaveBeenCalled();
    expect(image).not.toHaveBeenCalled();
  });

  it("counts cached JPEGs and retries a JPEG rejected by cumulative budget", async () => {
    const queued = new File(
      [createJpegWithMetadata({ width: 5_000, height: 8_000 })],
      "queued.jpg",
      { type: "image/jpeg" },
    );
    const incoming = new File(
      [createJpegWithMetadata({ width: 1, height: 1 })],
      "incoming.jpg",
      { type: "image/jpeg" },
    );
    const read = vi.spyOn(incoming, "arrayBuffer");
    await expect(
      validateImageFileContents(Array(4).fill(queued)),
    ).resolves.toEqual(new Map([[queued, { width: 5_000, height: 8_000 }]]));
    await expect(
      validateImageFileContents([...Array<File>(4).fill(queued), incoming]),
    ).rejects.toMatchObject({ code: "image_error_total_pixels" });
    expect(read).not.toHaveBeenCalled();
    expect(getValidatedJpegOrientation(incoming)).toBeUndefined();
    await validateImageFileContents([incoming]);
    expect(read).toHaveBeenCalledOnce();
  });

  it("admits valid PNGs using compressed metadata without native decode or inflation", async () => {
    const bitmap = vi.fn();
    const image = vi.fn();
    const inflate = vi.fn();
    vi.stubGlobal("createImageBitmap", bitmap);
    vi.stubGlobal("Image", image);
    vi.stubGlobal("DecompressionStream", inflate);
    const file = new File([createCollisionPng("red")], "valid.png", {
      type: "image/png",
    });
    const read = vi.spyOn(file, "arrayBuffer");
    const dimensions = await validateImageFileContents([file]);
    expect(dimensions.get(file)).toEqual({ width: 32, height: 32 });
    dimensions.get(file)!.width = 10_001;
    expect((await validateImageFileContents([file])).get(file)).toEqual({
      width: 32,
      height: 32,
    });
    expect(read).toHaveBeenCalledOnce();
    expect(bitmap).not.toHaveBeenCalled();
    expect(image).not.toHaveBeenCalled();
    expect(inflate).not.toHaveBeenCalled();
  });

  it("counts cached PNG metadata again at the exact 160 million pixel boundary", async () => {
    const bitmap = vi.fn();
    vi.stubGlobal("createImageBitmap", bitmap);
    const file = new File([createBudgetPng(5_000, 8_000)], "cached.png", {
      type: "image/png",
    });
    const read = vi.spyOn(file, "arrayBuffer");
    await expect(
      validateImageFileContents(Array(4).fill(file)),
    ).resolves.toEqual(new Map([[file, { width: 5_000, height: 8_000 }]]));
    await expect(
      validateImageFileContents(Array(5).fill(file)),
    ).rejects.toMatchObject({ code: "image_error_total_pixels" });
    expect(read).toHaveBeenCalledOnce();
    expect(bitmap).not.toHaveBeenCalled();
  });

  it("rejects PNG header budgets before reading the complete file and never caches failures", async () => {
    const file = new File([createBudgetPng(10_000, 5_000)], "huge.png", {
      type: "image/png",
    });
    const read = vi.spyOn(file, "arrayBuffer");
    const headerRead = vi.spyOn(file, "slice");
    for (let attempt = 0; attempt < 2; attempt++) {
      await expect(validateImageFileContents([file])).rejects.toMatchObject({
        code: "image_error_pixel_count",
      });
    }
    expect(read).not.toHaveBeenCalled();
    expect(headerRead).toHaveBeenCalledTimes(2);
  });

  it("does not cache a PNG rejected by the cumulative budget", async () => {
    const queued = new File([createBudgetPng(5_000, 8_000)], "queued.png", {
      type: "image/png",
    });
    const incoming = new File([createBudgetPng(1, 1)], "incoming.png", {
      type: "image/png",
    });
    const read = vi.spyOn(incoming, "arrayBuffer");
    const headerRead = vi.spyOn(incoming, "slice");
    await expect(
      validateImageFileContents([...Array<File>(4).fill(queued), incoming]),
    ).rejects.toMatchObject({ code: "image_error_total_pixels" });
    expect(read).not.toHaveBeenCalled();
    await expect(validateImageFileContents([incoming])).resolves.toEqual(
      new Map([[incoming, { width: 1, height: 1 }]]),
    );
    expect(headerRead).toHaveBeenCalledTimes(2);
    expect(read).toHaveBeenCalledOnce();
  });

  it("rejects truncated PNGs, invalid IHDRs and mismatched MIME before decoding", async () => {
    const bitmap = vi.fn();
    vi.stubGlobal("createImageBitmap", bitmap);
    const bytes = new Uint8Array(createBudgetPng(32, 32));
    const badHeader = bytes.slice();
    badHeader[12] = 65;
    const files = [
      new File([bytes.slice(0, 8)], "signature.png", { type: "image/png" }),
      new File([bytes.slice(0, -1)], "truncated.png", { type: "image/png" }),
      new File([badHeader], "header.png", { type: "image/png" }),
    ];
    for (const file of files) {
      const headerRead = vi.spyOn(file, "slice");
      for (let attempt = 0; attempt < 2; attempt++) {
        await expect(validateImageFileContents([file])).rejects.toMatchObject({
          code: "image_error_decode",
        });
      }
      expect(headerRead).toHaveBeenCalledTimes(2);
    }
    const mismatch = new File([bytes], "mismatch.jpg", { type: "image/jpeg" });
    const read = vi.spyOn(mismatch, "arrayBuffer");
    await expect(validateImageFileContents([mismatch])).rejects.toMatchObject({
      code: "image_error_content",
    });
    expect(read).not.toHaveBeenCalled();
    expect(bitmap).not.toHaveBeenCalled();
  });

  it("defers damaged PNG compressed-stream integrity to Worker processing", async () => {
    const file = new File([createCorruptPng()], "damaged.png", {
      type: "image/png",
    });
    await expect(validateImageFileContents([file])).resolves.toEqual(
      new Map([[file, { width: 32, height: 32 }]]),
    );
  });

  it("rejects oversized image dimensions and cumulative pixels", () => {
    expectCode(
      () =>
        validateImageDimensions("huge.png", IMAGE_LIMITS.maxWidth + 1, 1, 0),
      "image_error_dimensions",
    );
    expectCode(
      () =>
        validateImageDimensions("label.png", 1, 1, IMAGE_LIMITS.maxTotalPixels),
      "image_error_total_pixels",
    );
  });

  it("keeps pixel budgets independent and accepts the exact total boundary", () => {
    const full = createImagePixelBudget();
    const separate = createImagePixelBudget();
    const size = { width: 5_000, height: 8_000 };
    for (let index = 0; index < 4; index++) full.add("label.png", size);

    expectCode(
      () => full.add("extra.png", { width: 1, height: 1 }),
      "image_error_total_pixels",
    );
    expect(() => separate.add("label.png", size)).not.toThrow();
  });

  it("rejects invalid images without consuming the remaining pixel budget", () => {
    const budget = createImagePixelBudget();
    expectCode(
      () => budget.add("wide.png", { width: 10_001, height: 1 }),
      "image_error_dimensions",
    );
    expectCode(
      () => budget.add("huge.png", { width: 10_000, height: 5_000 }),
      "image_error_pixel_count",
    );
    for (let index = 0; index < 3; index++) {
      budget.add("label.png", { width: 5_000, height: 8_000 });
    }
    budget.add("almost-full.png", { width: 5_000, height: 7_999 });
    expectCode(
      () => budget.add("extra.png", { width: 5_001, height: 1 }),
      "image_error_total_pixels",
    );
    expect(() =>
      budget.add("boundary.png", { width: 5_000, height: 1 }),
    ).not.toThrow();
  });

  it("rejects excessive output label count", () => {
    expectCode(
      () =>
        validateImageLabelCount(
          Array.from(
            { length: Math.ceil(IMAGE_LIMITS.maxTotalLabels / 999) },
            () => ({ count: 999 }),
          ),
        ),
      "image_error_label_count",
    );
  });
});
