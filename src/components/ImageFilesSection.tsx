import { Reorder, useDragControls } from "framer-motion";
import { UploadCloud } from "lucide-react";
import { useId } from "react";
import type { ChangeEvent } from "react";

import { useI18n } from "../utils/i18nContext";
import type { ImageItem } from "../utils/layoutMath";
import { ThumbnailItem } from "./ThumbnailItem";

interface ImageFilesSectionProps {
  imageItems: ImageItem[];
  onFilesSelect: (files: File[]) => void;
  onReorder: (items: ImageItem[]) => void;
  onItemCountChange: (id: string, count: number) => void;
}

interface FileListItemProps {
  item: ImageItem;
  index: number;
  itemCount: number;
  onMove: (direction: "up" | "down") => void;
  onCountChange: (count: number) => void;
  onRemove: () => void;
}

/** 单个文件行：仅拖拽把手启动排序，避免触摸行/数量输入/滚动时误触发 */
function FileListItem({
  item,
  index,
  itemCount,
  onMove,
  onCountChange,
  onRemove,
}: FileListItemProps) {
  const dragControls = useDragControls();
  return (
    <Reorder.Item value={item} dragListener={false} dragControls={dragControls}>
      <ThumbnailItem
        item={item}
        onCountChange={onCountChange}
        onRemove={onRemove}
        onMove={onMove}
        canMoveUp={index > 0}
        canMoveDown={index < itemCount - 1}
        dragControls={dragControls}
      />
    </Reorder.Item>
  );
}

export function ImageFilesSection({
  imageItems,
  onFilesSelect,
  onReorder,
  onItemCountChange,
}: ImageFilesSectionProps) {
  const { t } = useI18n();
  const fileInputId = useId();
  const hasImages = imageItems.length > 0;

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    if (!input.files?.length) return;

    try {
      await onFilesSelect(Array.from(input.files));
    } finally {
      input.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div className="group relative cursor-pointer rounded-md focus-within:ring-2 focus-within:ring-brand-primary focus-within:ring-offset-2">
        <input
          id={fileInputId}
          name="label-images"
          type="file"
          multiple
          accept="image/png, image/jpeg, image/jpg"
          onChange={(event) => void handleFileChange(event)}
          aria-label={t("browse_btn")}
          className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        />
        {hasImages ? (
          <div className="pointer-events-none relative flex min-h-9 items-center justify-center gap-2 rounded-md border border-dashed border-brand-primary/30 bg-brand-primary/5 px-3 py-2 text-sm font-semibold text-brand-primary transition-colors group-hover:border-brand-primary/60 group-hover:bg-brand-primary/10">
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            <span>{t("add_more_images")}</span>
          </div>
        ) : (
          <>
            <div className="absolute inset-0 rounded-md border border-dashed border-brand-primary/30 bg-brand-primary/5 transition-colors group-hover:border-brand-primary/60" />
            <div className="pointer-events-none relative flex items-center gap-3 px-4 py-3">
              <div className="shrink-0 rounded-md bg-text-main/5 p-2">
                <UploadCloud
                  className="h-6 w-6 text-brand-primary/50"
                  aria-hidden="true"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="w-full truncate text-sm font-semibold text-text-main">
                  {t("browse_btn")}
                </p>
                <p className="text-xs text-text-muted">{t("browse_hint")}</p>
              </div>
            </div>
          </>
        )}
      </div>

      <Reorder.Group
        axis="y"
        values={imageItems}
        onReorder={onReorder}
        className="space-y-2"
      >
        {imageItems.map((item, index) => (
          <FileListItem
            key={item.id}
            item={item}
            index={index}
            itemCount={imageItems.length}
            onMove={(direction) => {
              const targetIndex = direction === "up" ? index - 1 : index + 1;
              if (targetIndex < 0 || targetIndex >= imageItems.length) return;
              const nextItems = [...imageItems];
              [nextItems[index], nextItems[targetIndex]] = [
                nextItems[targetIndex],
                nextItems[index],
              ];
              onReorder(nextItems);
            }}
            onCountChange={(count) => onItemCountChange(item.id, count)}
            onRemove={() =>
              onReorder(
                imageItems.filter((candidate) => candidate.id !== item.id),
              )
            }
          />
        ))}
      </Reorder.Group>
    </div>
  );
}
