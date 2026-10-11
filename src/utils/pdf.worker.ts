import jsPDF from "jspdf";

import { AppError, serializeAppError, type AppErrorCode } from "./appError";
import {
  IMAGE_PROCESSING_LIMITS,
  createImagePixelBudget,
  validateImageFiles,
  validateImageLabelCount,
  normalizeImageItemCount,
  type ImageDimensions,
} from "./imageLimits";
import { readJpegMetadata, type JpegMetadata } from "./jpegMetadata";
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
  createRasterTextAlias,
  getRasterTextScale,
  needsRasterText,
} from "./pdfRendering";
import {
  isPdfWorkerRequestId,
  isPdfWorkerGenerateRequest,
  isPdfWorkerGenerateRequestShape,
  assertProtocolVersion,
  PDF_WORKER_PROTOCOL_VERSION,
  type PdfWorkerImageItem,
  type PdfWorkerResponse,
} from "./pdfWorkerProtocol";
import { readPngDimensions, validatePngScanlines } from "./pngMetadata";
import { createQrMatrix, QR_QUIET_ZONE_MODULES } from "./qrCode";
import { validateTextOutput } from "./textValidation";

/**
 * PDF Generation Worker
 */
const ctx: Worker = self as unknown as Worker;

const PDF_TEXT_FONT_FAMILY =
  '"Segoe UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';
async function renderTextAsPng(
  text: string,
  widthMm: number,
  heightMm: number,
  fontSizeMm: number,
): Promise<Uint8Array> {
  if (typeof OffscreenCanvas !== "function") {
    throw new AppError("unicode_render_unsupported");
  }

  const scale = getRasterTextScale(widthMm, heightMm);
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
      createRasterTextAlias(text, pos.width, textBoxHeightMm, fontSizeMm),
      "FAST",
    );
    return;
  }

  pdf.setFont("courier", "bold");
  const fontSizePt = fontSizeMm / MM_PER_PT;
  pdf.setFontSize(fontSizePt);
  pdf.text(
    text,
    pos.x + pos.width / 2,
    pos.y + textBoxTopMm + textBoxHeightMm / 2,
    { align: "center", baseline: "middle" },
  );
}

type ImageWorkerItem = PdfWorkerImageItem;

type LoadedImage = ImageWorkerItem & {
  alias: string;
  data: Uint8Array;
  format: "PNG" | "JPEG";
  width: number;
  height: number;
};

type PreparedImage = Pick<
  LoadedImage,
  "data" | "format" | "width" | "height"
> & {
  alias: string;
  sourceWidth: number;
  sourceHeight: number;
};

type ImageMetadata =
  | { type: "image/png"; dimensions: ImageDimensions }
  | { type: "image/jpeg"; dimensions: JpegMetadata };

function readImageMetadata(item: ImageWorkerItem): ImageMetadata {
  const data = new Uint8Array(item.buffer);
  if (item.type === "image/png") {
    const dimensions = readPngDimensions(data);
    if (dimensions) return { type: "image/png", dimensions };
  } else {
    const dimensions = readJpegMetadata(data);
    if (dimensions) return { type: "image/jpeg", dimensions };
  }
  throw new AppError("image_error_decode", { name: item.name });
}

function getJpegBitmapOptions(metadata: JpegMetadata): ImageBitmapOptions {
  const swapsAxes = metadata.orientation >= 5 && metadata.orientation <= 8;
  const orientedWidth = swapsAxes ? metadata.height : metadata.width;
  const orientedHeight = swapsAxes ? metadata.width : metadata.height;
  const scale = Math.min(
    1,
    Math.sqrt(
      IMAGE_PROCESSING_LIMITS.maxNormalizedJpegPixels /
        (orientedWidth * orientedHeight),
    ),
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
  metadata: ImageMetadata,
  name: string,
  alias: string,
): Promise<PreparedImage> {
  const originalData = new Uint8Array(buffer);
  if (metadata.type === "image/png") {
    const dimensions = metadata.dimensions;
    try {
      await validatePngScanlines(originalData);
    } catch (error) {
      throw new AppError(
        "image_error_decode",
        { name },
        error instanceof Error ? error.message : String(error),
      );
    }
    return {
      data: originalData,
      format: "PNG",
      ...dimensions,
      alias,
      sourceWidth: dimensions.width,
      sourceHeight: dimensions.height,
    };
  }
  const jpegMetadata = metadata.dimensions;
  if (jpegMetadata.orientation === 1) {
    return {
      alias,
      data: originalData,
      format: "JPEG",
      width: jpegMetadata.width,
      height: jpegMetadata.height,
      sourceWidth: jpegMetadata.width,
      sourceHeight: jpegMetadata.height,
    };
  }

  if (typeof createImageBitmap === "function") {
    let bitmap: ImageBitmap | null = null;
    try {
      const blob = new Blob([buffer], { type: metadata.type });
      bitmap = await createImageBitmap(
        blob,
        getJpegBitmapOptions(jpegMetadata),
      );

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
        alias,
        data: new Uint8Array(await normalized.arrayBuffer()),
        format: "JPEG",
        width: bitmap.width,
        height: bitmap.height,
        sourceWidth: jpegMetadata.width,
        sourceHeight: jpegMetadata.height,
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

  throw new AppError("image_error_normalize", { name });
}

let activeRequestId: string | null = null;

function postProgress(
  requestId: string,
  percent: number,
  phase: PdfProgressPhase,
): void {
  const message: PdfWorkerResponse = {
    protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
    type: "progress",
    requestId,
    data: { percent: Math.min(100, Math.max(0, Math.round(percent))), phase },
  };
  ctx.postMessage(message);
}

ctx.onmessage = async (event: MessageEvent<unknown>) => {
  const rawRequestId =
    typeof event.data === "object" && event.data !== null
      ? (event.data as { requestId?: unknown }).requestId
      : undefined;
  const requestId = isPdfWorkerRequestId(rawRequestId) ? rawRequestId : null;
  let ownsActiveRequest = false;
  try {
    if (isPdfWorkerGenerateRequestShape(event.data)) {
      assertProtocolVersion(event.data.data.protocolVersion);
    }
    if (!isPdfWorkerGenerateRequest(event.data)) {
      throw new AppError("pdf_worker_protocol_error");
    }
    if (activeRequestId !== null) throw new AppError("pdf_worker_busy");
    activeRequestId = event.data.requestId;
    ownsActiveRequest = true;
    const ownerRequestId = event.data.requestId;
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

      const pixelBudget = createImagePixelBudget();
      const preparedCache = new Map<ArrayBuffer, Map<string, PreparedImage>>();
      let nextImageAlias = 0;
      for (let idx = 0; idx < imageItems.length; idx++) {
        const item = imageItems[idx];
        let byMime = preparedCache.get(item.buffer);
        if (!byMime) {
          byMime = new Map();
          preparedCache.set(item.buffer, byMime);
        }
        let prepared = byMime.get(item.type);
        if (prepared) {
          // Count every queue item using source dimensions, even after resizing.
          pixelBudget.add(item.name, {
            width: prepared.sourceWidth,
            height: prepared.sourceHeight,
          });
        } else {
          const metadata = readImageMetadata(item);
          // Enforce the budget before scanline validation or bitmap allocation.
          pixelBudget.add(item.name, metadata.dimensions);
          prepared = await prepareImageForPdf(
            item.buffer,
            metadata,
            item.name,
            `image-${nextImageAlias++}`,
          );
          byMime.set(item.type, prepared);
        }

        loadedImages.push({
          ...item,
          ...prepared,
        });
        postProgress(
          ownerRequestId,
          20 + ((idx + 1) / imageItems.length) * 15,
          "preparing",
        );
        await nextTick();
      }
    } else {
      postProgress(ownerRequestId, 20, "preparing");
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

          try {
            pdf.addImage(img.data, img.format, x, y, w, h, img.alias, "FAST");
          } catch (error) {
            throw new AppError(
              "image_error_decode",
              { name: img.name },
              error instanceof Error ? error.message : String(error),
            );
          }
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
            ownerRequestId,
            35 + (completedLabels / Math.max(1, totalCount)) * 55,
            "rendering",
          );
        }
      }
    }

    postProgress(ownerRequestId, 95, "serializing");

    // 5. Generate Output
    const output = pdf.output("arraybuffer");
    const message: PdfWorkerResponse = {
      protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
      type: "complete",
      requestId: ownerRequestId,
      data: output,
    };
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
      protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
      type: "error",
      requestId,
      data: serializeAppError(safeError),
    };
    ctx.postMessage(message);
  } finally {
    if (ownsActiveRequest) activeRequestId = null;
  }
};
