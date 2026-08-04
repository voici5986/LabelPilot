import type { PdfProgressPhase } from "./pdfProgress";

/** 生成按钮的状态机：可用 / 禁用 / 生成中 / 成功 / 失败 */
export type GenerationStatus = "idle" | "generating" | "success" | "error";

/** 生成过程在 App 中统一维护，桌面控制栏与移动端操作栏共用 */
export interface GenerationState {
  status: GenerationStatus;
  progress: number;
  phase: PdfProgressPhase;
}
