import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "./appError";
import {
  IMAGE_LIMITS,
  detectImageMimeType,
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
  afterEach(() => vi.unstubAllGlobals());

  it("normalizes malformed per-image label counts", () => {
    expect(normalizeImageItemCount(Number.POSITIVE_INFINITY)).toBe(1);
    expect(normalizeImageItemCount(-10)).toBe(1);
    expect(normalizeImageItemCount(9_999)).toBe(999);
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

  it("decodes selected images before accepting them", async () => {
    const close = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 320, height: 180, close })),
    );
    const file = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      "label.png",
      { type: "image/png" },
    );

    await expect(validateImageFileContents([file])).resolves.toBeUndefined();
    expect(createImageBitmap).toHaveBeenCalledWith(file, {
      imageOrientation: "from-image",
    });
    expect(close).toHaveBeenCalledOnce();
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
