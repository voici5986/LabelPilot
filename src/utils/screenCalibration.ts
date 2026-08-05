/**
 * 屏幕 1:1 校准：数学计算、数据归一化与环境比较。
 *
 * 原理：显示固定 L（CSS mm）刻度线，用户量出其现实长度 X mm，
 * 则 k = X / L 为「1 CSS mm 对应的现实毫米数」，实际尺寸渲染倍率为 1 / k。
 */

export interface ScreenCalibration {
  k: number;
  referenceMm: 50 | 100;
  measuredMm: number;
  /** 校准时 devicePixelRatio 快照，用于检测系统缩放/换屏 */
  dpr: number;
  screenWidth: number;
  screenHeight: number;
  calibratedAt: string;
}

export const K_HARD_MIN = 0.2;
export const K_HARD_MAX = 4.0;
export const K_SOFT_MIN = 0.5;
export const K_SOFT_MAX = 2.0;

/** k = 实测现实长度 ÷ 参考线 CSS 长度 */
export function computeK(referenceMm: number, measuredMm: number): number {
  return measuredMm / referenceMm;
}

/** 实际尺寸模式的页面渲染倍率 */
export function actualScale(k: number): number {
  return 1 / k;
}

/** 50mm 验证线应渲染的 CSS 毫米宽度（其现实长度恒为 50mm） */
export function verificationCssMm(k: number): number {
  return 50 / k;
}

export function isReference(value: unknown): value is 50 | 100 {
  return value === 50 || value === 100;
}

export function isFinitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export type KIssue = "ok" | "hard-low" | "hard-high" | "soft-low" | "soft-high";

/** k 的校验分类：硬限制外禁用保存；软区间外提示复核但不阻止 */
export function kIssue(k: number): KIssue {
  if (!Number.isFinite(k) || k <= 0) return "hard-low";
  if (k < K_HARD_MIN) return "hard-low";
  if (k > K_HARD_MAX) return "hard-high";
  if (k < K_SOFT_MIN) return "soft-low";
  if (k > K_SOFT_MAX) return "soft-high";
  return "ok";
}

/** 校验持久化数据，任何字段损坏/缺失都回退为 null */
export function normalizeCalibration(raw: unknown): ScreenCalibration | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isReference(r.referenceMm)) return null;
  if (!isFinitePositive(r.k) || !isFinitePositive(r.measuredMm)) return null;
  if (
    !isFinitePositive(r.dpr) ||
    !isFinitePositive(r.screenWidth) ||
    !isFinitePositive(r.screenHeight)
  ) {
    return null;
  }
  const ts = new Date(r.calibratedAt as string);
  if (Number.isNaN(ts.getTime())) return null;
  return {
    k: r.k,
    referenceMm: r.referenceMm,
    measuredMm: r.measuredMm,
    dpr: r.dpr,
    screenWidth: r.screenWidth,
    screenHeight: r.screenHeight,
    calibratedAt: r.calibratedAt as string,
  };
}

export interface ScreenEnvironment {
  dpr: number;
  screenWidth: number;
  screenHeight: number;
}

/** 读取当前显示环境快照（App / SettingsMenu / CalibrationDialog 共用同一来源） */
export function getCurrentScreenEnvironment(): ScreenEnvironment {
  return {
    dpr: window.devicePixelRatio || 1,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
  };
}

/** 显示环境是否与校准时不同（DPR 差异或逻辑分辨率变化） */
export function isCalibrationStale(
  cal: ScreenCalibration,
  current: ScreenEnvironment,
): boolean {
  return (
    Math.abs(current.dpr - cal.dpr) > 0.05 ||
    current.screenWidth !== cal.screenWidth ||
    current.screenHeight !== cal.screenHeight
  );
}
