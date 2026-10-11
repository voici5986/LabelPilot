import { AppError } from "./appError";
import { readJpegFileMetadata, readJpegMetadata } from "./jpegMetadata";
import type { ImageItem } from "./layoutMath";
import { readPngDimensions } from "./pngMetadata";

export type ImageDimensions = { width: number; height: number };

export const IMAGE_PROCESSING_LIMITS = {
  maxNormalizedJpegPixels: 16_000_000,
} as const;

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

export function normalizeImageMimeType(value: string): string {
  const normalized = value.trim().toLowerCase();
  return normalized === "image/jpg" ? "image/jpeg" : normalized;
}

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
    const declaredType = normalizeImageMimeType(file.type);
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

function validateImageSignature(
  file: Pick<File, "name" | "type">,
  data: Uint8Array,
): SupportedImageMimeType {
  const actualType = detectImageMimeType(data);
  if (!actualType) {
    throw new AppError("image_error_content", { name: file.name });
  }

  const declaredType = normalizeImageMimeType(file.type);
  if (declaredType && declaredType !== actualType) {
    throw new AppError("image_error_content", { name: file.name });
  }
  return actualType;
}

export async function readValidatedImageFile(
  file: File,
): Promise<{ buffer: ArrayBuffer; type: SupportedImageMimeType }> {
  const buffer = await file.arrayBuffer();
  const actualType = validateImageSignature(file, new Uint8Array(buffer));

  return { buffer, type: actualType };
}

// Files are immutable. Keep only successful validation results, never bitmaps
// or pending/rejected promises; removed files can be garbage collected.
const validatedDimensions = new WeakMap<File, ImageDimensions>();
const validatedJpegOrientations = new WeakMap<File, number | null>();

/** Null means PNG; undefined means unvalidated or an incomplete JPEG header. */
export function getValidatedJpegOrientation(
  file: File,
): number | null | undefined {
  return validatedJpegOrientations.get(file);
}

export async function validateImageFileContents(
  files: File[],
): Promise<Map<File, ImageDimensions>> {
  const dimensions = new Map<File, ImageDimensions>();
  const pixelBudget = createImagePixelBudget();
  for (const file of files) {
    let decoded = validatedDimensions.get(file);
    let budgetChecked = false;
    let jpegOrientation: number | null | undefined;
    if (!decoded) {
      const header = new Uint8Array(await file.slice(0, 33).arrayBuffer());
      const type = validateImageSignature(file, header);
      if (type === "image/png") {
        jpegOrientation = null;
        if (
          header.length < 33 ||
          new DataView(header.buffer).getUint32(8) !== 13 ||
          String.fromCharCode(...header.subarray(12, 16)) !== "IHDR"
        ) {
          throw new AppError("image_error_decode", { name: file.name });
        }
        const view = new DataView(header.buffer);
        // Reject the header dimensions before reading the remaining compressed
        // bytes. Upload admission never allocates or inflates PNG pixels.
        pixelBudget.add(file.name, {
          width: view.getUint32(16),
          height: view.getUint32(20),
        });
        budgetChecked = true;
        const { buffer } = await readValidatedImageFile(file);
        decoded = readPngDimensions(new Uint8Array(buffer)) ?? undefined;
        if (!decoded) {
          throw new AppError("image_error_decode", { name: file.name });
        }
        // File is immutable; a differing header indicates an invalid source.
        if (
          decoded.width !== view.getUint32(16) ||
          decoded.height !== view.getUint32(20)
        ) {
          throw new AppError("image_error_content", { name: file.name });
        }
        // Compressed-stream and CRC integrity remain the Worker's responsibility.
      } else {
        const metadata = await readJpegFileMetadata(file);
        if (!metadata)
          throw new AppError("image_error_decode", { name: file.name });
        const oriented =
          metadata.orientation >= 5
            ? { width: metadata.height, height: metadata.width }
            : { width: metadata.width, height: metadata.height };
        pixelBudget.add(file.name, oriented);
        budgetChecked = true;
        const { buffer } = await readValidatedImageFile(file);
        const complete = readJpegMetadata(new Uint8Array(buffer));
        if (!complete)
          throw new AppError("image_error_decode", { name: file.name });
        if (
          complete.width !== metadata.width ||
          complete.height !== metadata.height ||
          complete.orientation !== metadata.orientation
        ) {
          throw new AppError("image_error_content", { name: file.name });
        }
        decoded = oriented;
        jpegOrientation = metadata.orientation;
        // Marker validation does not establish entropy-code/pixel integrity.
      }
    }
    const { width, height } = decoded;
    if (!budgetChecked) pixelBudget.add(file.name, decoded);
    validatedDimensions.set(file, decoded);
    if (jpegOrientation !== undefined) {
      validatedJpegOrientations.set(file, jpegOrientation);
    }
    dimensions.set(file, { width, height });
  }
  return dimensions;
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

/** Each validation operation gets its own cumulative pixel budget. */
export function createImagePixelBudget() {
  let totalPixels = 0;
  return {
    add(name: string, { width, height }: ImageDimensions): void {
      totalPixels = validateImageDimensions(name, width, height, totalPixels);
    },
  };
}

export function validateImageLabelCount(
  items: Pick<ImageItem, "count">[],
): void {
  if (items.length === 0) throw new AppError("image_error_no_files");
  const total = getImageLabelCount(items);

  if (total > IMAGE_LIMITS.maxTotalLabels) {
    throw new AppError("image_error_label_count", {
      max: IMAGE_LIMITS.maxTotalLabels,
    });
  }
}

/** 计算图片模式下将要输出的标签总数，始终按归一化后的数量计数。 */
export function getImageLabelCount(items: Pick<ImageItem, "count">[]): number {
  return items.reduce(
    (sum, item) => sum + normalizeImageItemCount(item.count),
    0,
  );
}
