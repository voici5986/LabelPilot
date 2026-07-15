import { useId } from "react";
import { Grid } from "lucide-react";
import type { TextConfig } from "../utils/layoutMath";
import { TEXT_CONFIG_LIMITS } from "../utils/layoutMath";
import type { TextOutputMetrics } from "../utils/textValidation";
import { useI18n } from "../utils/i18nContext";
import { NumberInput } from "./NumberInput";

interface TextModeFieldsProps {
  textConfig: TextConfig;
  metrics: TextOutputMetrics;
  error: string | null;
  onChange: (updates: Partial<TextConfig>) => void;
}

export function TextModeFields({
  textConfig,
  metrics,
  error,
  onChange,
}: TextModeFieldsProps) {
  const { t } = useI18n();
  const textPrefixId = useId();
  const textPrefixHintId = useId();
  const qrSizeId = useId();

  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
        <Grid className="h-4 w-4" /> {t("text_config_group")}
      </h2>

      <div className="space-y-4">
        <div className="flex-1 space-y-1.5">
          <label
            htmlFor={textPrefixId}
            className="ml-0.5 text-sm font-medium text-text-muted"
          >
            {t("text_prefix")}
          </label>
          <input
            id={textPrefixId}
            name="text-prefix"
            type="text"
            value={textConfig.prefix}
            maxLength={TEXT_CONFIG_LIMITS.prefix.maxLength}
            aria-describedby={textPrefixHintId}
            onChange={(event) => onChange({ prefix: event.target.value })}
            className="input-base focus:input-base-focus w-full px-3 py-1.5 font-mono text-sm font-semibold"
            placeholder="SN-"
          />
          <div
            id={textPrefixHintId}
            className="flex justify-between gap-2 text-xs text-text-muted"
          >
            <span>
              {t("estimated_font_size", {
                size: metrics.fontSizePt.toFixed(1),
              })}
            </span>
            <span>
              {textConfig.prefix.length}/{TEXT_CONFIG_LIMITS.prefix.maxLength}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <NumberInput
            label={t("text_start_number")}
            value={textConfig.startNumber}
            onChange={(value) => onChange({ startNumber: value })}
            min={0}
            max={999999}
            isInteger
          />
          <NumberInput
            label={t("text_digits")}
            value={textConfig.digits}
            onChange={(value) => onChange({ digits: value })}
            min={1}
            max={10}
            isInteger
          />
        </div>

        <div className="flex items-end gap-4">
          <div className="flex-1">
            <NumberInput
              label={t("text_count")}
              value={textConfig.count}
              onChange={(value) => onChange({ count: value })}
              min={1}
              max={500}
              isInteger
            />
          </div>
          <div className="flex flex-col items-center gap-1.5 pb-0.5">
            <span className="whitespace-nowrap text-sm font-medium text-text-muted">
              {t("qr_enable")}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={textConfig.showQrCode}
              aria-label={t("qr_enable")}
              onClick={() => onChange({ showQrCode: !textConfig.showQrCode })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/20 ${textConfig.showQrCode ? "bg-brand-primary" : "bg-text-main/10"}`}
              title={t("qr_enable")}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${textConfig.showQrCode ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
          </div>
        </div>

        {textConfig.showQrCode && (
          <div className="space-y-2 py-1">
            <div className="flex items-center justify-between text-sm font-medium text-text-muted">
              <div className="flex items-center gap-2">
                <Grid className="h-3.5 w-3.5" />
                <span>{t("qr_size")}</span>
              </div>
              <span className="font-mono text-xs">
                {Math.round(textConfig.qrSizeRatio * 100)}%
              </span>
            </div>
            <input
              id={qrSizeId}
              name="qr-size"
              aria-label={t("qr_size")}
              type="range"
              min="0.1"
              max="0.6"
              step="0.05"
              value={textConfig.qrSizeRatio}
              onChange={(event) =>
                onChange({ qrSizeRatio: parseFloat(event.target.value) })
              }
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-text-main/10 accent-brand-primary"
            />
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
