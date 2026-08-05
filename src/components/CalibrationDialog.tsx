import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Ruler } from "lucide-react";
import { useStore } from "../store/useStore";
import { useI18n } from "../utils/i18nContext";
import {
  computeK,
  getCurrentScreenEnvironment,
  isFinitePositive,
  isReference,
  kIssue,
  verificationCssMm,
} from "../utils/screenCalibration";
import type { ScreenCalibration } from "../utils/screenCalibration";

export type CalibrationDialogSource = "zoom" | "settings";

const REFERENCE_OPTIONS = [50, 100] as const;

interface CalibrationDialogProps {
  open: boolean;
  source: CalibrationDialogSource;
  /** 已存校准与当前显示环境不符（重校场景）：显示提示且不预填旧测量值 */
  environmentMismatch?: boolean;
  onClose: () => void;
  onSaved: (calibration: ScreenCalibration) => void;
}

/** 一根固定 CSS mm 长的刻度尺：1mm 细刻度 / 5mm 中刻度 / 10mm 大刻度 + 数字 */
function drawRuler(el: HTMLDivElement | null, lengthMm: number): void {
  if (!el) return;
  el.innerHTML = "";
  const n = Math.floor(lengthMm);
  for (let i = 0; i <= n; i += 1) {
    const tick = document.createElement("div");
    if (i % 10 === 0) {
      tick.className = "tick major";
      el.appendChild(tick);
      const num = document.createElement("span");
      num.className = i === 0 ? "num first" : "num";
      num.style.left = `${i}mm`;
      num.textContent = String(i);
      el.appendChild(num);
    } else if (i % 5 === 0) {
      tick.className = "tick mid";
    } else {
      tick.className = "tick minor";
    }
    tick.style.left = `${i}mm`;
    el.appendChild(tick);
  }
  el.style.width = `${lengthMm}mm`;
}

export function CalibrationDialog({
  open,
  source,
  environmentMismatch,
  onClose,
  onSaved,
}: CalibrationDialogProps) {
  const { t } = useI18n();
  // 草稿在挂载时按当前校准值初始化；父组件通过 key 递增强制重挂载来刷新预填。
  // 环境不匹配（重校场景）时不预填旧测量值，避免旧 k 配上新环境被误认为有效。
  const previousCalibration = useStore((state) => state.screenCalibration);
  const hasPrevious = !environmentMismatch && previousCalibration !== null;
  const [referenceMm, setReferenceMm] = useState<50 | 100>(
    hasPrevious ? previousCalibration.referenceMm : 100,
  );
  const [measuredMm, setMeasuredMm] = useState(
    hasPrevious ? String(previousCalibration.measuredMm) : "",
  );
  const rulerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // 打开时：记录焦点来源并聚焦输入框
  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // 关闭后恢复焦点
  useEffect(() => {
    if (open) return;
    previousFocusRef.current?.focus();
    previousFocusRef.current = null;
  }, [open]);

  // Escape 关闭（按取消处理）
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Tab 焦点环回
  const handlePanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // 刻度尺渲染（每次打开/切参考线后）
  useEffect(() => {
    if (open) drawRuler(rulerRef.current, referenceMm);
  }, [open, referenceMm]);

  // 输入派生值
  const derived = useMemo(() => {
    const measured = parseFloat(measuredMm);
    if (!isFinitePositive(measured)) {
      return { k: null, issue: "ok" as const, measured: null };
    }
    const k = computeK(referenceMm, measured);
    return { k, issue: kIssue(k), measured };
  }, [measuredMm, referenceMm]);

  const measuredNum = derived.measured;
  const issue = derived.issue;
  const hardInvalid = issue === "hard-low" || issue === "hard-high";
  const k = derived.k;

  const handleSave = () => {
    if (measuredNum === null || k === null || hardInvalid) return;
    const env = getCurrentScreenEnvironment();
    const calibration: ScreenCalibration = {
      k,
      referenceMm,
      measuredMm: measuredNum,
      dpr: env.dpr,
      screenWidth: env.screenWidth,
      screenHeight: env.screenHeight,
      calibratedAt: new Date().toISOString(),
    };
    onSaved(calibration);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 hidden items-center justify-center p-4 lg:flex">
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("calib_title")}
            onKeyDown={handlePanelKeyDown}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="elevated-panel relative flex max-h-[calc(100dvh-48px)] w-full max-w-[680px] flex-col overflow-hidden"
          >
            <div className="flex items-center gap-2 border-b border-border-subtle/60 px-5 py-4">
              <Ruler
                className="h-4 w-4 text-brand-primary"
                aria-hidden="true"
              />
              <h2 className="text-base font-bold text-text-main">
                {t("calib_title")}
              </h2>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {environmentMismatch && (
                <p
                  role="alert"
                  className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300"
                >
                  {t("calib_stale_banner")}
                </p>
              )}
              <p className="text-sm leading-relaxed text-text-muted">
                {t("calib_env_note")}
              </p>

              <div className="mt-4 space-y-2">
                <h3 className="group-title">{t("calib_reference_label")}</h3>
                <div className="flex gap-2">
                  {REFERENCE_OPTIONS.map((mm) => (
                    <button
                      key={mm}
                      type="button"
                      aria-pressed={referenceMm === mm}
                      onClick={() => {
                        if (isReference(mm)) setReferenceMm(mm);
                      }}
                      className={`flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${
                        referenceMm === mm
                          ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                          : "border-border-subtle text-text-muted hover:border-brand-primary/50"
                      }`}
                    >
                      {mm}mm
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <h3 className="group-title">{t("calib_reference_label")}</h3>
                <div className="overflow-x-auto">
                  <div
                    ref={rulerRef}
                    className="cal-ruler relative h-14 min-w-full"
                  />
                </div>
              </div>

              <div className="mt-5">
                <label
                  htmlFor="calib-measured"
                  className="mb-1 block text-sm font-medium tracking-wider text-text-muted"
                >
                  {t("calib_measure_label", { length: referenceMm })}
                </label>
                <input
                  id="calib-measured"
                  ref={inputRef}
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="1"
                  value={measuredMm}
                  onChange={(event) => setMeasuredMm(event.target.value)}
                  aria-invalid={hardInvalid}
                  aria-describedby={
                    hardInvalid
                      ? "calib-issue"
                      : derived.issue !== "ok"
                        ? "calib-soft"
                        : undefined
                  }
                  className="input-base focus:input-base-focus w-full px-3 py-2 font-mono text-sm font-semibold text-text-main"
                  placeholder={String(referenceMm)}
                />
                <p className="mt-1 text-xs text-text-muted">
                  {t("calib_input_hint", { length: referenceMm })}
                </p>
              </div>

              {measuredNum !== null && k !== null ? (
                <div className="mt-4 space-y-3">
                  <p className="text-sm font-medium text-text-main">
                    {t("calib_result_k", { k: k.toFixed(3) })}
                  </p>

                  <div>
                    <p className="mb-1 text-xs font-medium text-text-muted">
                      {t("calib_verify_label")}
                    </p>
                    <div className="flex items-center gap-0">
                      <div className="h-4 w-px bg-text-main" />
                      <div
                        className="h-1 bg-brand-primary"
                        style={{ width: `${verificationCssMm(k)}mm` }}
                      />
                      <div className="h-4 w-px bg-text-main" />
                    </div>
                    <p className="mt-1 text-xs text-text-muted">
                      {t("calib_verify_hint")}
                    </p>
                  </div>

                  {issue !== "ok" && (
                    <p
                      id={hardInvalid ? "calib-issue" : "calib-soft"}
                      className={`text-sm ${hardInvalid ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"}`}
                    >
                      {hardInvalid
                        ? t("calib_hard_error", { min: "0.2", max: "4.0" })
                        : t("calib_soft_warn", { k: k.toFixed(3) })}
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border-subtle/60 px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
              <p className="mr-auto hidden text-xs text-text-muted sm:block">
                {t("calib_notice")}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm font-semibold text-text-muted transition-colors hover:bg-text-main/5 hover:text-text-main"
              >
                {t("calib_cancel")}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={measuredNum === null || k === null || hardInvalid}
                className="rounded-md bg-brand-primary px-4 py-2 text-sm font-bold text-on-brand transition-[background-color] hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {source === "zoom" ? t("calib_save_actual") : t("calib_save")}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
