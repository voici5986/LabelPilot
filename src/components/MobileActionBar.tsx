import { ChevronUp, SlidersHorizontal } from "lucide-react";

import type { GenerationStatus } from "../utils/generation";
import { useI18n } from "../utils/i18nContext";
import type { PdfProgressPhase } from "../utils/pdfProgress";
import { SmartButton } from "./SmartButton";

interface MobileActionBarProps {
  onOpenEdit: () => void;
  onGenerate: () => void;
  onCancel: () => void;
  disabled: boolean;
  genStatus: GenerationStatus;
  genProgress: number;
  genPhase: PdfProgressPhase;
}

/** 移动端底部操作栏：编辑面板入口 + 生成 PDF（常驻）。仅在 <lg 渲染。 */
export function MobileActionBar({
  onOpenEdit,
  onGenerate,
  onCancel,
  disabled,
  genStatus,
  genProgress,
  genPhase,
}: MobileActionBarProps) {
  const { t } = useI18n();

  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-border-subtle bg-elevated px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 lg:hidden">
      <button
        type="button"
        onClick={onOpenEdit}
        aria-haspopup="dialog"
        className="hit-target flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3 text-sm font-semibold text-text-main transition-colors hover:border-brand-primary/50 active:bg-text-main/10"
      >
        <SlidersHorizontal className="h-4 w-4 text-brand-primary" />
        {t("edit")}
        <ChevronUp className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
      </button>

      <div className="min-w-0 flex-1">
        <SmartButton
          onClick={onGenerate}
          onCancel={onCancel}
          disabled={disabled}
          genStatus={genStatus}
          genProgress={genProgress}
          genPhase={genPhase}
        />
      </div>
    </div>
  );
}
