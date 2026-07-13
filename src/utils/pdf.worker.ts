import jsPDF from "jspdf";
import pdfTextFontUrl from "../assets/fonts/MiSansVF_gb2312.woff2?url";
import {
  calculateLabelLayout,
  resolveItemAtSlot,
  formatLabelText,
  getLabelTextFontSizeMm,
  getTextLayoutBoxes,
  normalizeTextConfig,
  MM_PER_PT,
  type LabelPosition,
  type TextConfig,
} from "./layoutMath";
import QRCode from "qrcode";

/**
 * PDF Generation Worker
 */
const ctx: Worker = self as unknown as Worker;

const QR_QUIET_ZONE_MODULES = 4;
const PDF_TEXT_FONT_FAMILY = "LabelPilotPdfText";
const RASTER_TEXT_PX_PER_MM = 300 / 25.4;
const MAX_TEXT_CANVAS_WIDTH = 2048;
const MAX_TEXT_CANVAS_HEIGHT = 1024;

type WorkerFontSet = {
  add: (font: FontFace) => void;
};

let unicodeFontFamilyPromise: Promise<string> | null = null;

function needsRasterText(text: string): boolean {
  return /[^\x20-\x7e]/u.test(text);
}

async function getUnicodeFontFamily(): Promise<string> {
  const workerScope = self as unknown as { fonts?: WorkerFontSet };
  if (typeof FontFace !== "function" || !workerScope.fonts) {
    return "sans-serif";
  }

  unicodeFontFamilyPromise ??= (async () => {
    const response = await fetch(pdfTextFontUrl);
    if (!response.ok) {
      throw new Error(`Unicode font request failed (${response.status})`);
    }

    const fontFace = new FontFace(
      PDF_TEXT_FONT_FAMILY,
      await response.arrayBuffer(),
      { weight: "100 900" },
    );
    await fontFace.load();
    workerScope.fonts?.add(fontFace);
    return `"${PDF_TEXT_FONT_FAMILY}", sans-serif`;
  })();

  return unicodeFontFamilyPromise;
}

async function renderTextAsPng(
  text: string,
  widthMm: number,
  heightMm: number,
  fontSizeMm: number,
): Promise<Uint8Array> {
  if (typeof OffscreenCanvas !== "function") {
    throw new Error("This browser cannot render Unicode text in PDF files");
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
  if (!context) throw new Error("Unable to create a PDF text canvas");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, widthPx, heightPx);
  context.fillStyle = "#000000";
  context.textAlign = "center";
  context.textBaseline = "middle";

  const fontFamily = await getUnicodeFontFamily();
  let fontSizePx = Math.max(1, Math.min(fontSizeMm * scale, heightPx * 0.8));
  context.font = `700 ${fontSizePx}px ${fontFamily}`;

  const maxTextWidth = widthPx * 0.9;
  const measuredWidth = context.measureText(text).width;
  if (measuredWidth > maxTextWidth && measuredWidth > 0) {
    fontSizePx *= maxTextWidth / measuredWidth;
    context.font = `700 ${fontSizePx}px ${fontFamily}`;
  }

  context.fillText(text, widthPx / 2, heightPx / 2);
  const blob = await canvas.convertToBlob({ type: "image/png" });
  if (blob.size === 0) throw new Error("Unicode text rendering was empty");
  return new Uint8Array(await blob.arrayBuffer());
}

function drawQrCode(
  pdf: jsPDF,
  value: string,
  x: number,
  y: number,
  sizeMm: number,
): void {
  const matrix = QRCode.create(value, {
    errorCorrectionLevel: "M",
  }).modules;
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

type ImageWorkerItem = {
  buffer: ArrayBuffer;
  type: string;
  id: string;
  count: number;
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

async function getImageDimensions(
  buffer: ArrayBuffer,
  type: string,
): Promise<ImageDimensions> {
  if (typeof createImageBitmap === "function") {
    let bitmap: ImageBitmap | null = null;
    try {
      const blob = new Blob([buffer], { type });
      bitmap = await createImageBitmap(blob);
      return {
        width: bitmap.width,
        height: bitmap.height,
      };
    } catch (error) {
      const parsed = parseImageDimensions(new Uint8Array(buffer), type);
      if (parsed) return parsed;
      throw error instanceof Error
        ? error
        : new Error("Failed to read image dimensions");
    } finally {
      bitmap?.close();
    }
  }

  const parsed = parseImageDimensions(new Uint8Array(buffer), type);
  if (parsed) return parsed;
  throw new Error("Unsupported image format");
}

ctx.onmessage = async (e) => {
  const { config, imageItems, appMode, textConfig: unsafeTextConfig } = e.data;
  const textConfig = normalizeTextConfig(unsafeTextConfig);

  try {
    const nextTick = () =>
      new Promise<void>((resolve) => setTimeout(resolve, 0));
    let qrBatchCount = 0;
    // 1. Calculate Layout
    const layout = calculateLabelLayout(config);
    if (layout.error) {
      throw new Error(layout.error);
    }

    // 2. Load all images (only if in image mode)
    const loadedImages =
      appMode === "image"
        ? await Promise.all(
            imageItems.map(async (item: ImageWorkerItem, idx: number) => {
              // Report progress for loading (0% - 30%)
              ctx.postMessage({
                type: "progress",
                data: Math.round(((idx + 1) / imageItems.length) * 30),
              });

              const arrayBuffer = item.buffer;

              let format: "PNG" | "JPEG" = "PNG";
              if (item.type === "image/jpeg" || item.type === "image/jpg") {
                format = "JPEG";
              }

              const uint8Array = new Uint8Array(arrayBuffer);
              const { width, height } = await getImageDimensions(
                arrayBuffer,
                item.type,
              );

              return {
                ...item,
                data: uint8Array,
                format,
                width,
                height,
              };
            }),
          )
        : [];

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

        // Report progress (30% to 90%)
        if (globalIdx % 5 === 0) {
          ctx.postMessage({
            type: "progress",
            data: 30 + Math.round((globalIdx / totalCount) * 60),
          });
        }

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
            } catch (qrErr) {
              const detail =
                qrErr instanceof Error ? qrErr.message : String(qrErr);
              throw new Error(`QR code generation failed: ${detail}`, {
                cause: qrErr,
              });
            }

            await drawLabelText(pdf, text, pos, textConfig);
            if (qrBatchCount % 50 === 0) await nextTick();
          } else {
            await drawLabelText(pdf, text, pos, textConfig);
          }
        }
      }
    }

    ctx.postMessage({ type: "progress", data: 95 });

    // 5. Generate Output
    const output = pdf.output("arraybuffer");
    ctx.postMessage({ type: "complete", data: output }, [output]);
  } catch (error) {
    ctx.postMessage({ type: "error", data: (error as Error).message });
  }
};
