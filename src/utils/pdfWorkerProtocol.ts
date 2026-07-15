import { isAppErrorCode, type SerializedAppError } from "./appError";
import type { SupportedImageMimeType } from "./imageLimits";
import type { HelperLayoutConfig, TextConfig } from "./layoutMath";
import type { PdfProgressUpdate } from "./pdfProgress";

export interface PdfWorkerImageItem {
  id: string;
  count: number;
  name: string;
  type: SupportedImageMimeType;
  buffer: ArrayBuffer;
}

export interface PdfWorkerGeneratePayload {
  config: HelperLayoutConfig;
  imageItems: PdfWorkerImageItem[];
  appMode: "image" | "text";
  textConfig: TextConfig;
}

export interface PdfWorkerGenerateRequest {
  type: "generate";
  data: PdfWorkerGeneratePayload;
}

export type PdfWorkerResponse =
  | { type: "progress"; data: PdfProgressUpdate }
  | { type: "complete"; data: ArrayBuffer }
  | { type: "error"; data: SerializedAppError };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isLayoutConfig(value: unknown): value is HelperLayoutConfig {
  if (!isRecord(value)) return false;
  return (
    isFiniteNumber(value.rows) &&
    isFiniteNumber(value.cols) &&
    isFiniteNumber(value.marginMm) &&
    isFiniteNumber(value.spacingMm) &&
    (value.orientation === "portrait" || value.orientation === "landscape") &&
    (value.pageWidthMm === undefined || isFiniteNumber(value.pageWidthMm)) &&
    (value.pageHeightMm === undefined || isFiniteNumber(value.pageHeightMm))
  );
}

function isTextConfig(value: unknown): value is TextConfig {
  if (!isRecord(value)) return false;
  return (
    typeof value.prefix === "string" &&
    isFiniteNumber(value.startNumber) &&
    isFiniteNumber(value.digits) &&
    isFiniteNumber(value.count) &&
    typeof value.showQrCode === "boolean" &&
    isFiniteNumber(value.qrSizeRatio) &&
    typeof value.qrContentPrefix === "string"
  );
}

function isImageItem(value: unknown): value is PdfWorkerImageItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    isFiniteNumber(value.count) &&
    typeof value.name === "string" &&
    (value.type === "image/png" || value.type === "image/jpeg") &&
    value.buffer instanceof ArrayBuffer
  );
}

function isProgressUpdate(value: unknown): value is PdfProgressUpdate {
  if (!isRecord(value) || !isFiniteNumber(value.percent)) return false;
  return ["reading", "preparing", "rendering", "serializing"].includes(
    String(value.phase),
  );
}

function isSerializedError(value: unknown): value is SerializedAppError {
  if (!isRecord(value) || typeof value.message !== "string") return false;
  if (value.code !== undefined && !isAppErrorCode(value.code)) return false;
  if (value.params === undefined) return true;
  if (!isRecord(value.params)) return false;
  return Object.values(value.params).every(
    (entry) => typeof entry === "string" || isFiniteNumber(entry),
  );
}

export function isPdfWorkerGenerateRequest(
  value: unknown,
): value is PdfWorkerGenerateRequest {
  if (!isRecord(value) || value.type !== "generate" || !isRecord(value.data)) {
    return false;
  }
  const data = value.data;
  return (
    isLayoutConfig(data.config) &&
    Array.isArray(data.imageItems) &&
    data.imageItems.every(isImageItem) &&
    (data.appMode === "image" || data.appMode === "text") &&
    isTextConfig(data.textConfig)
  );
}

export function isPdfWorkerResponse(
  value: unknown,
): value is PdfWorkerResponse {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  if (value.type === "progress") return isProgressUpdate(value.data);
  if (value.type === "complete") return value.data instanceof ArrayBuffer;
  if (value.type === "error") return isSerializedError(value.data);
  return false;
}
