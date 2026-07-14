import QRCode from "qrcode";

export const QR_ERROR_CORRECTION_LEVEL = "M" as const;
export const QR_QUIET_ZONE_MODULES = 4;
export const MIN_QR_MODULE_SIZE_MM = 0.25;

export interface QrMatrix {
  size: number;
  get: (row: number, column: number) => number;
}

export function createQrMatrix(value: string): QrMatrix {
  return QRCode.create(value, {
    errorCorrectionLevel: QR_ERROR_CORRECTION_LEVEL,
  }).modules;
}

export function getQrModuleSizeMm(value: string, sizeMm: number): number {
  const matrix = createQrMatrix(value);
  return sizeMm / (matrix.size + QR_QUIET_ZONE_MODULES * 2);
}
