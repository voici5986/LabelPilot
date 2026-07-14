import { AppError } from "./appError";
import type { ImageItem } from "./layoutMath";

export const IMAGE_LIMITS = {
  maxFiles: 20,
  maxFileBytes: 10 * 1024 * 1024,
  maxTotalBytes: 50 * 1024 * 1024,
  maxWidth: 10_000,
  maxHeight: 10_000,
  maxPixelsPerImage: 40_000_000,
  maxTotalPixels: 160_000_000,
  maxItemCount: 999,
  maxTotalLabels: 5_000,
} as const;

export type SupportedImageMimeType = "image/png" | "image/jpeg";

const SUPPORTED_IMAGE_TYPES = new Set<SupportedImageMimeType>([
  "image/png",
  "image/jpeg",
]);

type ImageFileMetadata = Pick<File, "name" | "size" | "type">;

export function normalizeImageItemCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.min(IMAGE_LIMITS.maxItemCount, Math.max(1, Math.trunc(value)));
}

export function validateImageFiles(files: ImageFileMetadata[]): void {
  if (files.length > IMAGE_LIMITS.maxFiles) {
    throw new AppError("image_error_count", { max: IMAGE_LIMITS.maxFiles });
  }

  let totalBytes = 0;
  for (const file of files) {
    const declaredType = file.type.trim().toLowerCase();
    if (
      declaredType &&
      !SUPPORTED_IMAGE_TYPES.has(declaredType as SupportedImageMimeType)
    ) {
      throw new AppError("image_error_type", { name: file.name });
    }
    if (file.size <= 0) {
      throw new AppError("image_error_empty", { name: file.name });
    }
    if (file.size > IMAGE_LIMITS.maxFileBytes) {
      throw new AppError("image_error_file_size", {
        name: file.name,
        max: IMAGE_LIMITS.maxFileBytes / 1024 / 1024,
      });
    }
    totalBytes += file.size;
  }

  if (totalBytes > IMAGE_LIMITS.maxTotalBytes) {
    throw new AppError("image_error_total_size", {
      max: IMAGE_LIMITS.maxTotalBytes / 1024 / 1024,
    });
  }
}

export function detectImageMimeType(
  data: Uint8Array,
): SupportedImageMimeType | null {
  if (
    data.length >= 8 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47 &&
    data[4] === 0x0d &&
    data[5] === 0x0a &&
    data[6] === 0x1a &&
    data[7] === 0x0a
  ) {
    return "image/png";
  }

  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8) {
    return "image/jpeg";
  }

  return null;
}

export async function readValidatedImageFile(
  file: File,
): Promise<{ buffer: ArrayBuffer; type: SupportedImageMimeType }> {
  const buffer = await file.arrayBuffer();
  const actualType = detectImageMimeType(new Uint8Array(buffer));
  if (!actualType) {
    throw new AppError("image_error_content", { name: file.name });
  }

  const declaredType = file.type.trim().toLowerCase();
  if (declaredType && declaredType !== actualType) {
    throw new AppError("image_error_content", { name: file.name });
  }

  return { buffer, type: actualType };
}

async function decodeImageDimensions(file: File): Promise<ImageDimensions> {
  if (typeof createImageBitmap === "function") {
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      return { width: bitmap.width, height: bitmap.height };
    } catch (error) {
      throw new AppError(
        "image_error_decode",
        { name: file.name },
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      bitmap?.close();
    }
  }

  if (typeof Image === "undefined") {
    throw new AppError("image_error_decode", { name: file.name });
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<ImageDimensions>((resolve, reject) => {
      const image = new Image();
      image.onload = () =>
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () =>
        reject(new AppError("image_error_decode", { name: file.name }));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

type ImageDimensions = { width: number; height: number };

export async function validateImageFileContents(files: File[]): Promise<void> {
  let totalPixels = 0;
  for (const file of files) {
    await readValidatedImageFile(file);
    const { width, height } = await decodeImageDimensions(file);
    totalPixels = validateImageDimensions(
      file.name,
      width,
      height,
      totalPixels,
    );
  }
}

export function validateImageDimensions(
  name: string,
  width: number,
  height: number,
  totalPixelsBefore: number,
): number {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    width > IMAGE_LIMITS.maxWidth ||
    height > IMAGE_LIMITS.maxHeight
  ) {
    throw new AppError("image_error_dimensions", {
      name,
      maxWidth: IMAGE_LIMITS.maxWidth,
      maxHeight: IMAGE_LIMITS.maxHeight,
    });
  }

  const pixels = width * height;
  if (pixels > IMAGE_LIMITS.maxPixelsPerImage) {
    throw new AppError("image_error_pixel_count", { name });
  }
  const totalPixels = totalPixelsBefore + pixels;
  if (totalPixels > IMAGE_LIMITS.maxTotalPixels) {
    throw new AppError("image_error_total_pixels");
  }
  return totalPixels;
}

export function validateImageLabelCount(
  items: Pick<ImageItem, "count">[],
): void {
  const total = items.reduce((sum, item) => {
    return sum + normalizeImageItemCount(item.count);
  }, 0);

  if (total > IMAGE_LIMITS.maxTotalLabels) {
    throw new AppError("image_error_label_count", {
      max: IMAGE_LIMITS.maxTotalLabels,
    });
  }
}
