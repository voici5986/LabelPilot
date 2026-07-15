import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "../utils/i18nContext";

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
      className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-md border border-border-subtle bg-surface px-3 py-1.5"
    >
      <button
        type="button"
        aria-label={t("page_prev")}
        disabled={currentPage === 0}
        onClick={() => onPageChange(Math.max(0, currentPage - 1))}
        className="rounded p-1 transition-colors hover:bg-text-main/5 disabled:cursor-not-allowed disabled:opacity-30"
        title={t("page_prev")}
      >
        <ChevronLeft className="h-5 w-5 text-text-main" />
      </button>

      <div className="flex items-center justify-center gap-1.5 text-sm font-medium text-text-main">
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

      <button
        type="button"
        aria-label={t("page_next")}
        disabled={currentPage === totalPages - 1}
        onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
        className="rounded p-1 transition-colors hover:bg-text-main/5 disabled:cursor-not-allowed disabled:opacity-30"
        title={t("page_next")}
      >
        <ChevronRight className="h-5 w-5 text-text-main" />
      </button>
    </nav>
  );
}
