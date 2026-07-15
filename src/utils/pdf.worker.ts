import jsPDF from "jspdf";
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
import { AppError, serializeAppError, type AppErrorCode } from "./appError";
import {
  validateImageDimensions,
  validateImageFiles,
  validateImageLabelCount,
  normalizeImageItemCount,
} from "./imageLimits";
import { createQrMatrix, QR_QUIET_ZONE_MODULES } from "./qrCode";
import { validateTextOutput } from "./textValidation";
import type { PdfProgressPhase } from "./pdfProgress";
import {
  isPdfWorkerGenerateRequest,
  type PdfWorkerImageItem,
  type PdfWorkerResponse,
} from "./pdfWorkerProtocol";

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
  const matrix = createQrMatrix(value);
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

type ImageDimensions = {
  width: number;
  height: number;
};

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

function readJpegDimensions(data: Uint8Array): ImageDimensions | null {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 2;

  while (offset + 4 <= data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = data[offset + 1];
    const blockLength = view.getUint16(offset + 2);
    if (blockLength < 2 || offset + 2 + blockLength > data.length) return null;

    if (isJpegStartOfFrame(marker)) {
      return {
        height: view.getUint16(offset + 5),
        width: view.getUint16(offset + 7),
      };
    }

    offset += 2 + blockLength;
  }

  return null;
}

function parseImageDimensions(
  data: Uint8Array,
  type: string,
): ImageDimensions | null {
  if (type === "image/png") return readPngDimensions(data);
  if (type === "image/jpeg" || type === "image/jpg") {
    return readJpegDimensions(data);
  }
  return null;
}

async function prepareImageForPdf(
  buffer: ArrayBuffer,
  type: string,
  name: string,
): Promise<Pick<LoadedImage, "data" | "format" | "width" | "height">> {
  const originalData = new Uint8Array(buffer);
  const parsed = parseImageDimensions(new Uint8Array(buffer), type);

  if (typeof createImageBitmap === "function") {
    let bitmap: ImageBitmap | null = null;
    try {
      const blob = new Blob([buffer], { type });
      bitmap = await createImageBitmap(blob, {
        imageOrientation: "from-image",
      });

      if (type !== "image/jpeg") {
        return {
          data: originalData,
          format: "PNG",
          width: bitmap.width,
          height: bitmap.height,
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
  if (parsed) {
    return {
      data: originalData,
      format: "PNG",
      width: parsed.width,
      height: parsed.height,
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
          prepared.width,
          prepared.height,
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

            try {
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
            } catch {
              throw new AppError("qr_error_capacity");
            }

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
