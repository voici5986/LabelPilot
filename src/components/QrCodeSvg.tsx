import { useMemo } from "react";
import { createQrMatrix, QR_QUIET_ZONE_MODULES } from "../utils/qrCode";

interface QrCodeSvgProps {
  value: string;
  className?: string;
}

export function QrCodeSvg({ value, className }: QrCodeSvgProps) {
  const qr = useMemo(() => {
    try {
      const matrix = createQrMatrix(value);
      const segments: string[] = [];

      for (let row = 0; row < matrix.size; row++) {
        let column = 0;
        while (column < matrix.size) {
          while (column < matrix.size && !matrix.get(row, column)) column++;
          const start = column;
          while (column < matrix.size && matrix.get(row, column)) column++;
          if (start < column) {
            const x = start + QR_QUIET_ZONE_MODULES;
            const y = row + QR_QUIET_ZONE_MODULES;
            segments.push(`M${x} ${y}h${column - start}v1H${x}z`);
          }
        }
      }

      return {
        path: segments.join(""),
        viewBoxSize: matrix.size + QR_QUIET_ZONE_MODULES * 2,
      };
    } catch {
      return null;
    }
  }, [value]);

  if (!qr) return null;
  const { path, viewBoxSize } = qr;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
    >
      <rect width={viewBoxSize} height={viewBoxSize} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
