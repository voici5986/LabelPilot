import { useId, useMemo } from "react";
import type { ChangeEvent } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { UploadCloud } from "lucide-react";
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
  onCountChange: (count: number) => void;
  onRemove: () => void;
}

/** 单个文件行：仅拖拽把手启动排序，避免触摸行/数量输入/滚动时误触发 */
function FileListItem({ item, onCountChange, onRemove }: FileListItemProps) {
  const dragControls = useDragControls();
  return (
    <Reorder.Item value={item} dragListener={false} dragControls={dragControls}>
      <ThumbnailItem
        item={item}
        onCountChange={onCountChange}
        onRemove={onRemove}
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

  const selectedFileName = useMemo(() => {
    if (imageItems.length === 0) return "";
    if (imageItems.length === 1) return imageItems[0].file.name;
    return t("files_selected", { n: imageItems.length });
  }, [imageItems, t]);

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
        <div
          className={`absolute inset-0 rounded-md border border-dashed transition-colors ${selectedFileName ? "border-brand-primary bg-brand-primary/10" : "border-brand-primary/30 bg-brand-primary/5 group-hover:border-brand-primary/60"}`}
        />
        <div className="pointer-events-none relative flex items-center gap-3 px-4 py-3">
          <div className="shrink-0 rounded-md bg-text-main/5 p-2">
            <UploadCloud
              className={`h-6 w-6 ${selectedFileName ? "text-brand-primary" : "text-brand-primary/50"}`}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="w-full truncate text-sm font-semibold text-text-main">
              {selectedFileName || t("browse_btn")}
            </p>
            {!selectedFileName && (
              <p className="text-xs text-text-muted">{t("browse_hint")}</p>
            )}
          </div>
        </div>
      </div>

      <Reorder.Group
        axis="y"
        values={imageItems}
        onReorder={onReorder}
        className="space-y-2"
      >
        {imageItems.map((item) => (
          <FileListItem
            key={item.id}
            item={item}
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
