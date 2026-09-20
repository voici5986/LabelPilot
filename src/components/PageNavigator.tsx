import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { useI18n } from "../utils/i18nContext";
import { IconButton } from "./ui/IconButton";

interface PageNavigatorProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PageNavigator({
  currentPage,
  totalPages,
  onPageChange,
}: PageNavigatorProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<string | null>(null);
  const displayValue = draft ?? String(currentPage + 1);

  const commitDraft = () => {
    const parsed = parseInt(displayValue || "1", 10);
    const next = Math.min(
      totalPages,
      Math.max(1, Number.isNaN(parsed) ? 1 : parsed),
    );
    setDraft(null);
    onPageChange(next - 1);
  };

  return (
    <nav
      aria-label={t("page_of", {
        current: currentPage + 1,
        total: totalPages,
      })}
      className="preview-controls absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-md border border-border-subtle bg-elevated px-3 py-1.5"
    >
      <IconButton
        aria-label={t("page_prev")}
        disabled={currentPage === 0}
        onClick={() => onPageChange(Math.max(0, currentPage - 1))}
        size="lg"
        tone="default"
        shape="sm"
        expandedHitArea
        title={t("page_prev")}
      >
        <ChevronLeft />
      </IconButton>

      <div className="flex items-center justify-center gap-1.5 font-mono text-sm font-medium tabular-nums text-text-main">
        <input
          name="page-number"
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={(event) =>
            setDraft(event.target.value.replace(/[^\d]/g, ""))
          }
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="input-base focus:input-base-focus w-10 px-1 py-0.5 text-center text-sm"
          aria-label={t("page_of", {
            current: currentPage + 1,
            total: totalPages,
          })}
        />
        <span>/ {totalPages}</span>
      </div>

      <IconButton
        aria-label={t("page_next")}
        disabled={currentPage === totalPages - 1}
        onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
        size="lg"
        tone="default"
        shape="sm"
        expandedHitArea
        title={t("page_next")}
      >
        <ChevronRight />
      </IconButton>
    </nav>
  );
}
