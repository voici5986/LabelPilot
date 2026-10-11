export function unsupportedPdfRendering(): never {
  throw new Error(
    "LabelPilot does not support jsPDF HTML/SVG rendering. Use text, raster images or QR codes.",
  );
}
