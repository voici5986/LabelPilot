export const APP_ERROR_CODES = [
  "image_error_type",
  "image_error_empty",
  "image_error_content",
  "image_error_decode",
  "image_error_normalize",
  "image_error_count",
  "image_error_file_size",
  "image_error_total_size",
  "image_error_dimensions",
  "image_error_pixel_count",
  "image_error_total_pixels",
  "image_error_label_count",
  "text_error_too_small",
  "qr_error_capacity",
  "qr_error_too_dense",
  "unicode_render_unsupported",
  "unicode_render_failed",
  "margin_too_large",
  "rows_cols_positive",
  "margin_spacing_positive",
  "label_too_small",
  "pdf_generation_failed",
  "pdf_worker_protocol_error",
  "generation_timeout",
  "generation_cancelled",
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

const KNOWN_APP_ERROR_CODES = new Set<string>(APP_ERROR_CODES);

export function isAppErrorCode(value: unknown): value is AppErrorCode {
  return typeof value === "string" && KNOWN_APP_ERROR_CODES.has(value);
}

export interface SerializedAppError {
  code?: AppErrorCode;
  message: string;
  params?: Record<string, string | number>;
}

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly params: Record<string, string | number>;

  constructor(
    code: AppErrorCode,
    params: Record<string, string | number> = {},
    message: string = code,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.params = params;
  }
}

export function serializeAppError(error: unknown): SerializedAppError {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message, params: error.params };
  }
  return {
    message: error instanceof Error ? error.message : String(error),
  };
}

export function deserializeAppError(value: unknown): Error {
  if (typeof value === "string") return new Error(value);
  if (typeof value !== "object" || value === null) {
    return new Error(String(value));
  }

  const data = value as Partial<SerializedAppError>;
  const message =
    typeof data.message === "string" ? data.message : "PDF worker failed";
  if (isAppErrorCode(data.code)) {
    return new AppError(data.code, data.params, message);
  }
  return new Error(message);
}
