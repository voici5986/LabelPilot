import { BookOpen, X } from "lucide-react";
import { useRef } from "react";

import { useModalFocus } from "../hooks/useModalFocus";
import { useI18n } from "../utils/i18nContext";
import { ActionButton } from "./ui/ActionButton";
import { DialogBody } from "./ui/DialogBody";
import { IconButton } from "./ui/IconButton";

interface UsageGuideProps {
  open: boolean;
  onClose: () => void;
  onRestartTour?: () => void;
  isGenerating?: boolean;
}

export function UsageGuide({
  open,
  onClose,
  onRestartTour,
  isGenerating = false,
}: UsageGuideProps) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { handleKeyDown } = useModalFocus({
    open,
    containerRef: panelRef,
    initialFocusRef: closeRef,
    onDismiss: onClose,
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="usage-guide-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="elevated-panel relative flex max-h-[calc(100dvh-24px)] w-full max-w-xl flex-col overflow-hidden"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle px-4 py-3">
          <BookOpen className="h-4 w-4 text-brand-primary" aria-hidden="true" />
          <h2 id="usage-guide-title" className="flex-1 text-base font-bold">
            {t("guide_title")}
          </h2>
          <IconButton
            ref={closeRef}
            onClick={onClose}
            aria-label={t("guide_close")}
            size="lg"
            expandedHitArea
          >
            <X />
          </IconButton>
        </div>
        <DialogBody
          aria-labelledby="usage-guide-title"
          className="p-4 text-sm leading-relaxed"
        >
          <p className="mb-4 text-text-muted lg:hidden">{t("guide_mobile")}</p>
          <p className="mb-4 hidden text-text-muted lg:block">
            {t("guide_desktop")}
          </p>
          <ol className="list-decimal space-y-4 pl-5 marker:font-mono marker:text-text-muted">
            {(["images", "numbers", "layout", "print"] as const).map((step) => (
              <li key={step} className="pl-1">
                <h3 className="font-semibold">{t(`guide_${step}_title`)}</h3>
                <p className="mt-1 text-text-muted">{t(`guide_${step}`)}</p>
              </li>
            ))}
          </ol>
          <p className="mt-5 border-t border-border-subtle pt-4 text-xs text-text-muted">
            {t("guide_screen")}
          </p>
        </DialogBody>
        {onRestartTour && (
          <div className="flex shrink-0 justify-end border-t border-border-subtle px-4 py-3">
            <ActionButton
              variant="secondary"
              className="min-h-11"
              disabled={isGenerating}
              onClick={onRestartTour}
            >
              {t("tour_restart")}
            </ActionButton>
          </div>
        )}
      </div>
    </div>
  );
}
