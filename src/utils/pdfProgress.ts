export type PdfProgressPhase =
  "reading" | "preparing" | "rendering" | "serializing";

export interface PdfProgressUpdate {
  percent: number;
  phase: PdfProgressPhase;
}
