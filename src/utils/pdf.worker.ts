import jsPDF from "jspdf";

import { AppError, serializeAppError, type AppErrorCode } from "./appError";
import {
  validateImageDimensions,
  validateImageFiles,
  validateImageLabelCount,
  normalizeImageItemCount,
} from "./imageLimits";
import {
  calculateLabelLayout,
  resolveItemAtSlot,
  formatLabelText,
  getLabelTextFontSizeMm,
  getTextLayoutBoxes,
  normalizeLayoutConfig,
  normalizeTextConfig,
  MM_PER_PT,
  type LabelPosition,
  type TextConfig,
} from "./layoutMath";
import type { PdfProgressPhase } from "./pdfProgress";
import {
  isPdfWorkerGenerateRequest,
  type PdfWorkerImageItem,
  type PdfWorkerResponse,
} from "./pdfWorkerProtocol";
import { createQrMatrix, QR_QUIET_ZONE_MODULES } from "./qrCode";
import { validateTextOutput } from "./textValidation";

/**
 * PDF Generation Worker
 */
const ctx: Worker = self as unknown as Worker;

const PDF_TEXT_FONT_FAMILY =
  '"Segoe UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';
const RASTER_TEXT_PX_PER_MM = 300 / 25.4;
const MAX_TEXT_CANVAS_WIDTH = 2048;
const MAX_TEXT_CANVAS_HEIGHT = 1024;

function needsRasterText(text: string): boolean {
  return /[^\x20-\x7e]/u.test(text);
}

async function renderTextAsPng(
  text: string,
  widthMm: number,
  heightMm: number,
  fontSizeMm: number,
): Promise<Uint8Array> {
  if (typeof OffscreenCanvas !== "function") {
    throw new AppError("unicode_render_unsupported");
  }

  const scale = Math.min(
    RASTER_TEXT_PX_PER_MM,
    MAX_TEXT_CANVAS_WIDTH / Math.max(widthMm, 0.01),
    MAX_TEXT_CANVAS_HEIGHT / Math.max(heightMm, 0.01),
  );
  const widthPx = Math.max(1, Math.ceil(widthMm * scale));
  const heightPx = Math.max(1, Math.ceil(heightMm * scale));
  const canvas = new OffscreenCanvas(widthPx, heightPx);
  const context = canvas.getContext("2d");
  if (!context) throw new AppError("unicode_render_failed");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, widthPx, heightPx);
  context.fillStyle = "#000000";
  context.textAlign = "center";
  context.textBaseline = "middle";

  let fontSizePx = Math.max(1, Math.min(fontSizeMm * scale, heightPx * 0.8));
  context.font = `700 ${fontSizePx}px ${PDF_TEXT_FONT_FAMILY}`;

  const maxTextWidth = widthPx * 0.9;
  const measuredWidth = context.measureText(text).width;
  if (measuredWidth > maxTextWidth && measuredWidth > 0) {
    fontSizePx *= maxTextWidth / measuredWidth;
    context.font = `700 ${fontSizePx}px ${PDF_TEXT_FONT_FAMILY}`;
  }

  context.fillText(text, widthPx / 2, heightPx / 2);
  const blob = await canvas.convertToBlob({ type: "image/png" });
  if (blob.size === 0) throw new AppError("unicode_render_failed");
  return new Uint8Array(await blob.arrayBuffer());
}

function drawQrCode(
  pdf: jsPDF,
  value: string,
  x: number,
  y: number,
  sizeMm: number,
): void {
  let matrix: ReturnType<typeof createQrMatrix>;
  try {
    matrix = createQrMatrix(value);
  } catch (error) {
    throw new AppError(
      "qr_error_capacity",
      {},
      error instanceof Error ? error.message : String(error),
    );
  }
  const fullSize = matrix.size + QR_QUIET_ZONE_MODULES * 2;
  const moduleSize = sizeMm / fullSize;
  const offset = QR_QUIET_ZONE_MODULES * moduleSize;

  pdf.setFillColor(255, 255, 255);
  pdf.rect(x, y, sizeMm, sizeMm, "F");
  pdf.setFillColor(0, 0, 0);

  for (let row = 0; row < matrix.size; row++) {
    let column = 0;
    while (column < matrix.size) {
      while (column < matrix.size && !matrix.get(row, column)) column++;
      const runStart = column;
      while (column < matrix.size && matrix.get(row, column)) column++;

      if (runStart < column) {
        pdf.rect(
          x + offset + runStart * moduleSize,
          y + offset + row * moduleSize,
          (column - runStart) * moduleSize,
          moduleSize,
          "F",
        );
      }
    }
  }
}

async function drawLabelText(
  pdf: jsPDF,
  text: string,
  pos: LabelPosition,
  textConfig: TextConfig,
): Promise<void> {
  const fontSizeMm = getLabelTextFontSizeMm(text, pos, textConfig.showQrCode);
  const { textBoxTopMm, textBoxHeightMm } = getTextLayoutBoxes(
    pos,
    textConfig.showQrCode,
    textConfig.qrSizeRatio,
  );

  if (needsRasterText(text)) {
    const image = await renderTextAsPng(
      text,
      pos.width,
      textBoxHeightMm,
      fontSizeMm,
    );
    pdf.addImage(
      image,
      "PNG",
      pos.x,
      pos.y + textBoxTopMm,
      pos.width,
      textBoxHeightMm,
      undefined,
      "FAST",
    );
    return;
  }

  pdf.setFont("courier", "bold");
  const fontSizePt = fontSizeMm / MM_PER_PT;
  pdf.setFontSize(fontSizePt);
  const textWidth = pdf.getStringUnitWidth(text) * fontSizePt * MM_PER_PT;
  const textHeight = fontSizePt * MM_PER_PT;
  pdf.text(
    text,
    pos.x + (pos.width - textWidth) / 2,
    pos.y + textBoxTopMm + (textBoxHeightMm + textHeight) / 2,
    { align: "left" },
  );
}

type ImageWorkerItem = PdfWorkerImageItem;

type LoadedImage = ImageWorkerItem & {
  data: Uint8Array;
  format: "PNG" | "JPEG";
  width: number;
  height: number;
};

type PreparedImage = Pick<
  LoadedImage,
  "data" | "format" | "width" | "height"
> & {
  sourceWidth: number;
  sourceHeight: number;
};

type ImageDimensions = {
  width: number;
  height: number;
};

type JpegMetadata = ImageDimensions & {
  orientation: number;
};

const MAX_NORMALIZED_JPEG_PIXELS = 16_000_000;

function readPngDimensions(data: Uint8Array): ImageDimensions | null {
  if (
    data.length < 24 ||
    data[0] !== 0x89 ||
    data[1] !== 0x50 ||
    data[2] !== 0x4e ||
    data[3] !== 0x47
  ) {
    return null;
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
  };
}

function isJpegStartOfFrame(marker: number): boolean {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

function readExifOrientation(
  data: Uint8Array,
  payloadOffset: number,
  payloadLength: number,
): number | null {
  const payloadEnd = payloadOffset + payloadLength;
  if (
    payloadLength < 14 ||
    data[payloadOffset] !== 0x45 ||
    data[payloadOffset + 1] !== 0x78 ||
    data[payloadOffset + 2] !== 0x69 ||
    data[payloadOffset + 3] !== 0x66 ||
    data[payloadOffset + 4] !== 0x00 ||
    data[payloadOffset + 5] !== 0x00
  ) {
    return null;
  }

  const tiffOffset = payloadOffset + 6;
  const littleEndian =
    data[tiffOffset] === 0x49 && data[tiffOffset + 1] === 0x49;
  const bigEndian = data[tiffOffset] === 0x4d && data[tiffOffset + 1] === 0x4d;
  if (!littleEndian && !bigEndian) return null;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint16(tiffOffset + 2, littleEndian) !== 0x2a) return null;
  const firstIfdOffset = view.getUint32(tiffOffset + 4, littleEndian);
  const ifdOffset = tiffOffset + firstIfdOffset;
  if (ifdOffset + 2 > payloadEnd) return null;

  const entryCount = view.getUint16(ifdOffset, littleEndian);
  for (let index = 0; index < entryCount; index++) {
    const entryOffset = ifdOffset + 2 + index * 12;
    if (entryOffset + 12 > payloadEnd) return null;
    if (
      view.getUint16(entryOffset, littleEndian) === 0x0112 &&
      view.getUint16(entryOffset + 2, littleEndian) === 3 &&
      view.getUint32(entryOffset + 4, littleEndian) === 1
    ) {
      const orientation = view.getUint16(entryOffset + 8, littleEndian);
      return orientation >= 1 && orientation <= 8 ? orientation : null;
    }
  }

  return null;
}

function hasJpegEndOfImage(data: Uint8Array, startOffset: number): boolean {
  let offset = startOffset;
  while (offset < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < data.length && data[offset] === 0xff) offset += 1;
    if (offset >= data.length) return false;

    const marker = data[offset];
    offset += 1;
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9) return true;
    if (marker === 0x01 || marker === 0xd8) continue;
    if (offset + 2 > data.length) return false;

    const blockLength = (data[offset] << 8) | data[offset + 1];
    if (blockLength < 2 || offset + blockLength > data.length) return false;
    offset += blockLength;
  }
  return false;
}

function readJpegMetadata(data: Uint8Array): JpegMetadata | null {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 2;
  let dimensions: ImageDimensions | null = null;
  let orientation = 1;
  let hasCompleteScan = false;

  while (offset < data.length) {
    while (offset < data.length && data[offset] !== 0xff) offset += 1;
    while (offset < data.length && data[offset] === 0xff) offset += 1;
    if (offset >= data.length) break;

    const marker = data[offset];
    offset += 1;
    if (marker === 0x00) continue;
    if (marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 2 > data.length) return null;

    const blockLength = view.getUint16(offset);
    const segmentEnd = offset + blockLength;
    if (blockLength < 2 || segmentEnd > data.length) return null;

    if (marker === 0xda) {
      hasCompleteScan = hasJpegEndOfImage(data, segmentEnd);
      break;
    }

    if (isJpegStartOfFrame(marker)) {
      if (blockLength < 7) return null;
      dimensions = {
        height: view.getUint16(offset + 3),
        width: view.getUint16(offset + 5),
      };
    } else if (marker === 0xe1) {
      orientation =
        readExifOrientation(data, offset + 2, blockLength - 2) ?? orientation;
    }

    offset = segmentEnd;
  }

  if (
    !dimensions ||
    dimensions.width <= 0 ||
    dimensions.height <= 0 ||
    !hasCompleteScan
  ) {
    return null;
  }
  return { ...dimensions, orientation };
}

function parseImageDimensions(
  data: Uint8Array,
  type: string,
): ImageDimensions | null {
  if (type === "image/png") return readPngDimensions(data);
  if (type === "image/jpeg") return readJpegMetadata(data);
  return null;
}

function getJpegBitmapOptions(metadata: JpegMetadata): ImageBitmapOptions {
  const swapsAxes = metadata.orientation >= 5 && metadata.orientation <= 8;
  const orientedWidth = swapsAxes ? metadata.height : metadata.width;
  const orientedHeight = swapsAxes ? metadata.width : metadata.height;
  const scale = Math.min(
    1,
    Math.sqrt(MAX_NORMALIZED_JPEG_PIXELS / (orientedWidth * orientedHeight)),
  );

  return {
    imageOrientation: "from-image",
    ...(scale < 1
      ? {
          resizeWidth: Math.max(1, Math.round(orientedWidth * scale)),
          resizeHeight: Math.max(1, Math.round(orientedHeight * scale)),
          resizeQuality: "high" as const,
        }
      : {}),
  };
}

async function prepareImageForPdf(
  buffer: ArrayBuffer,
  type: string,
  name: string,
): Promise<PreparedImage> {
  const originalData = new Uint8Array(buffer);
  const jpegMetadata =
    type === "image/jpeg" ? readJpegMetadata(originalData) : null;

  if (type === "image/jpeg") {
    if (!jpegMetadata) throw new AppError("image_error_decode", { name });
    if (jpegMetadata.orientation === 1) {
      return {
        data: originalData,
        format: "JPEG",
        width: jpegMetadata.width,
        height: jpegMetadata.height,
        sourceWidth: jpegMetadata.width,
        sourceHeight: jpegMetadata.height,
      };
    }
  }

  if (typeof createImageBitmap === "function") {
    let bitmap: ImageBitmap | null = null;
    try {
      const blob = new Blob([buffer], { type });
      bitmap = await createImageBitmap(
        blob,
        jpegMetadata
          ? getJpegBitmapOptions(jpegMetadata)
          : { imageOrientation: "from-image" },
      );

      if (type !== "image/jpeg") {
        return {
          data: originalData,
          format: "PNG",
          width: bitmap.width,
          height: bitmap.height,
          sourceWidth: bitmap.width,
          sourceHeight: bitmap.height,
        };
      }

      if (typeof OffscreenCanvas !== "function") {
        throw new AppError("image_error_normalize", { name });
      }

      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d");
      if (!context) throw new AppError("image_error_normalize", { name });
      context.drawImage(bitmap, 0, 0);
      const normalized = await canvas.convertToBlob({
        type: "image/jpeg",
        quality: 0.92,
      });
      if (normalized.size === 0) {
        throw new AppError("image_error_normalize", { name });
      }

      return {
        data: new Uint8Array(await normalized.arrayBuffer()),
        format: "JPEG",
        width: bitmap.width,
        height: bitmap.height,
        sourceWidth: jpegMetadata?.width ?? bitmap.width,
        sourceHeight: jpegMetadata?.height ?? bitmap.height,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "image_error_decode",
        { name },
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      bitmap?.close();
    }
  }

  if (type === "image/jpeg") {
    throw new AppError("image_error_normalize", { name });
  }
  const parsed = parseImageDimensions(originalData, type);
  if (parsed) {
    return {
      data: originalData,
      format: "PNG",
      width: parsed.width,
      height: parsed.height,
      sourceWidth: parsed.width,
      sourceHeight: parsed.height,
    };
  }

  throw new AppError("image_error_decode", { name });
}

function postProgress(percent: number, phase: PdfProgressPhase): void {
  const message: PdfWorkerResponse = {
    type: "progress",
    data: { percent: Math.min(100, Math.max(0, Math.round(percent))), phase },
  };
  ctx.postMessage(message);
}

ctx.onmessage = async (event: MessageEvent<unknown>) => {
  try {
    if (!isPdfWorkerGenerateRequest(event.data)) {
      throw new AppError("pdf_worker_protocol_error");
    }
    const payload = event.data.data;
    const config = normalizeLayoutConfig(payload.config);
    const textConfig = normalizeTextConfig(payload.textConfig);
    const appMode = payload.appMode;
    const imageItems: ImageWorkerItem[] = payload.imageItems.map((item) => ({
      ...item,
      count: normalizeImageItemCount(item.count),
    }));

    const nextTick = () =>
      new Promise<void>((resolve) => setTimeout(resolve, 0));
    let qrBatchCount = 0;
    // 1. Calculate Layout
    const layout = calculateLabelLayout(config);
    if (layout.error) {
      throw new AppError(layout.error.toLowerCase() as AppErrorCode);
    }
    if (appMode === "text") validateTextOutput(config, textConfig);

    // 2. Load all images (only if in image mode)
    const loadedImages: LoadedImage[] = [];
    if (appMode === "image") {
      validateImageFiles(
        imageItems.map((item) => ({
          name: item.name,
          type: item.type,
          size: item.buffer.byteLength,
        })),
      );
      validateImageLabelCount(imageItems);

      let totalPixels = 0;
      for (let idx = 0; idx < imageItems.length; idx++) {
        const item = imageItems[idx];
        const prepared = await prepareImageForPdf(
          item.buffer,
          item.type,
          item.name,
        );
        totalPixels = validateImageDimensions(
          item.name,
          prepared.sourceWidth,
          prepared.sourceHeight,
          totalPixels,
        );

        loadedImages.push({
          ...item,
          ...prepared,
        });
        postProgress(20 + ((idx + 1) / imageItems.length) * 15, "preparing");
        await nextTick();
      }
    } else {
      postProgress(20, "preparing");
    }

    // 3. Create PDF
    const pdf = new jsPDF({
      orientation: config.orientation,
      unit: "mm",
      format: [layout.pageWidth, layout.pageHeight],
      compress: true,
    });

    // 4. Calculate total labels
    const totalCount =
      appMode === "image"
        ? imageItems.reduce(
            (acc: number, item: { count: number }) => acc + item.count,
            0,
          )
        : textConfig.count;

    const slotsPerPage = layout.positions.length;
    const totalPages = Math.ceil(totalCount / slotsPerPage);
    let completedLabels = 0;

    // 5. Draw Content
    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      if (pageIdx > 0) {
        pdf.addPage();
      }

      const startSlotIdx = pageIdx * slotsPerPage;

      for (let localIdx = 0; localIdx < layout.positions.length; localIdx++) {
        const pos = layout.positions[localIdx];
        const globalIdx = startSlotIdx + localIdx;
        if (globalIdx >= totalCount) continue;

        if (appMode === "image") {
          const img = resolveItemAtSlot(globalIdx, loadedImages);
          if (!img) continue;

          const scale = Math.min(
            pos.width / img.width,
            pos.height / img.height,
          );
          const w = img.width * scale;
          const h = img.height * scale;
          const x = pos.x + (pos.width - w) / 2;
          const y = pos.y + (pos.height - h) / 2;

          pdf.addImage(img.data, img.format, x, y, w, h, undefined, "FAST");
        } else {
          // 文本模式 (可选带二维码)
          const text = formatLabelText(globalIdx, textConfig);

          if (textConfig.showQrCode) {
            // 二维码内容
            const qrValue = `${textConfig.qrContentPrefix}${text}`;

            qrBatchCount += 1;

            // Shared layout metrics with preview
            const { qrDimMm, qrTopMm, qrLeftMm } = getTextLayoutBoxes(
              pos,
              true,
              textConfig.qrSizeRatio,
            );
            const qrX = pos.x + qrLeftMm;
            const qrY = pos.y + qrTopMm;

            drawQrCode(pdf, qrValue, qrX, qrY, qrDimMm);

            await drawLabelText(pdf, text, pos, textConfig);
            if (qrBatchCount % 50 === 0) await nextTick();
          } else {
            await drawLabelText(pdf, text, pos, textConfig);
          }
        }

        completedLabels += 1;
        if (completedLabels % 5 === 0 || completedLabels === totalCount) {
          postProgress(
            35 + (completedLabels / Math.max(1, totalCount)) * 55,
            "rendering",
          );
        }
      }
    }

    postProgress(95, "serializing");

    // 5. Generate Output
    const output = pdf.output("arraybuffer");
    const message: PdfWorkerResponse = { type: "complete", data: output };
    ctx.postMessage(message, [output]);
  } catch (error) {
    const safeError =
      error instanceof AppError
        ? error
        : new AppError(
            "pdf_generation_failed",
            {},
            error instanceof Error ? error.message : String(error),
          );
    const message: PdfWorkerResponse = {
      type: "error",
      data: serializeAppError(safeError),
    };
    ctx.postMessage(message);
  }
};
