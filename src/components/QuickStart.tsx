import { useRef } from "react";

import { useI18n } from "../utils/i18nContext";
import { ActionButton } from "./ui/ActionButton";

interface QuickStartProps {
  onFilesSelect: (files: File[]) => void | Promise<void>;
  onStartNumbering: () => void;
}

export function QuickStart({
  onFilesSelect,
  onStartNumbering,
}: QuickStartProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="absolute inset-0 z-10 overflow-y-auto bg-surface p-5"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="mx-auto flex min-h-full max-w-sm flex-col items-start justify-center gap-4 py-3 text-left">
        <div>
          <h2 className="text-lg font-semibold text-text-main">
            {t("quick_title")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            {t("quick_steps")}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2">
          <ActionButton
            className="min-h-11"
            onClick={() => inputRef.current?.click()}
          >
            {t("quick_upload")}
          </ActionButton>
          <ActionButton
            className="min-h-11"
            variant="secondary"
            onClick={onStartNumbering}
          >
            {t("quick_numbering")}
          </ActionButton>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          multiple
          hidden
          aria-label={t("quick_upload")}
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = "";
            if (files.length) onFilesSelect(files);
          }}
        />
        <p className="text-xs leading-relaxed text-text-muted lg:hidden">
          {t("quick_mobile")}
        </p>
      </div>
    </div>
  );
}
