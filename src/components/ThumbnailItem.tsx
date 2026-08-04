import { motion } from "framer-motion";
import type { DragControls } from "framer-motion";
import { GripVertical, Image as ImageIcon, X } from "lucide-react";
import type { ChangeEvent } from "react";
import { normalizeImageItemCount } from "../utils/imageLimits";
import type { ImageItem } from "../utils/layoutMath";
import { useStore } from "../store/useStore";
import { useI18n } from "../utils/i18nContext";

interface ThumbnailItemProps {
  item: ImageItem;
  onCountChange: (count: number) => void;
  onRemove: () => void;
  /** 由 Reorder.Item 提供，仅拖拽把手启动排序 */
  dragControls: DragControls;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/**
 * 多图队列列表行（双行布局）：
 * 第一行 拖拽把手 + 40px 缩略图 + 可见文件名 + 删除（44px 命中）；
 * 第二行 40px 高数量字段 + 文件大小。双行让窄屏（360px）与桌面侧栏（320px）文件名均获得足够宽度。
 */
export function ThumbnailItem({
  item,
  onCountChange,
  onRemove,
  dragControls,
}: ThumbnailItemProps) {
  const imageUrlMap = useStore((state) => state.imageUrlMap);
  const { t } = useI18n();
  const url = imageUrlMap.get(item.id) || "";

  const handleCountChange = (event: ChangeEvent<HTMLInputElement>) => {
    onCountChange(normalizeImageItemCount(Number(event.currentTarget.value)));
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="rounded-lg border border-border-subtle bg-surface p-2 transition-colors hover:border-brand-primary"
      title={item.file.name}
    >
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          aria-label={t("drag_to_reorder")}
          onPointerDown={(event) => dragControls.start(event)}
          className="hit-target flex h-8 w-8 shrink-0 touch-none cursor-grab items-center justify-center rounded-md text-text-muted/60 transition-colors hover:text-text-main"
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border-subtle bg-elevated">
          {url ? (
            <img
              src={url}
              alt=""
              className="h-full w-full object-contain"
              draggable="false"
            />
          ) : (
            <ImageIcon
              className="h-5 w-5 text-text-muted/60"
              aria-hidden="true"
            />
          )}
        </div>

        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-text-main">
          {item.file.name}
        </p>

        <button
          type="button"
          aria-label={t("remove_image", { name: item.file.name })}
          onClick={onRemove}
          className="hit-target flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-red-500/10 hover:text-red-600 active:bg-red-500/10 active:text-red-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between pl-20">
        <div className="flex h-11 shrink-0 items-center overflow-hidden rounded-md border border-border-subtle bg-elevated">
          <button
            type="button"
            aria-label={`${t("image_quantity", { name: item.file.name })}: -1`}
            onClick={() => onCountChange(Math.max(1, item.count - 1))}
            className="flex h-10 w-10 shrink-0 items-center justify-center text-text-muted transition-colors hover:bg-brand-primary/10 hover:text-brand-primary active:bg-brand-primary/10"
          >
            −
          </button>
          <input
            name={`image-count-${item.id}`}
            aria-label={t("image_quantity", { name: item.file.name })}
            type="text"
            inputMode="numeric"
            value={item.count}
            onChange={handleCountChange}
            onFocus={(e) => e.target.select()}
            className="h-10 w-9 shrink-0 border-x border-border-subtle/40 bg-transparent text-center font-mono text-sm font-semibold text-brand-primary focus:outline-none"
          />
          <button
            type="button"
            aria-label={`${t("image_quantity", { name: item.file.name })}: +1`}
            onClick={() => onCountChange(item.count + 1)}
            className="flex h-10 w-10 shrink-0 items-center justify-center text-text-muted transition-colors hover:bg-brand-primary/10 hover:text-brand-primary active:bg-brand-primary/10"
          >
            +
          </button>
        </div>
        <span className="text-xs text-text-muted">
          {formatFileSize(item.file.size)}
        </span>
      </div>
    </motion.div>
  );
}
