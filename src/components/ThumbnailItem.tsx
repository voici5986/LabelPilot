import { motion } from "framer-motion";
import type { DragControls } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";

import { useStore } from "../store/useStore";
import { useI18n } from "../utils/i18nContext";
import { IMAGE_LIMITS, normalizeImageItemCount } from "../utils/imageLimits";
import type { ImageItem } from "../utils/layoutMath";
import { StepperButton } from "./ui/StepperButton";

interface ThumbnailItemProps {
  item: ImageItem;
  onCountChange: (count: number) => void;
  onRemove: () => void;
  onMove: (direction: "up" | "down") => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
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
 * 第一行 拖拽把手 + 40px 缩略图 + 可见文件名 + 删除；
 * 第二行 40px 高数量字段 + 上下移按钮 + 文件大小。排序按钮保持 44px 命中区，文件名优先获得宽度。
 */
export function ThumbnailItem({
  item,
  onCountChange,
  onRemove,
  onMove,
  canMoveUp,
  canMoveDown,
  dragControls,
}: ThumbnailItemProps) {
  const imageUrlMap = useStore((state) => state.imageUrlMap);
  const { t } = useI18n();
  const url = imageUrlMap.get(item.id) || "";
  const [countDraft, setCountDraft] = useState<string | null>(null);
  const displayedCount = countDraft ?? String(item.count);

  const handleCountChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.currentTarget.value;
    if (/^\d*$/.test(next)) setCountDraft(next);
  };

  const commitCountDraft = () => {
    const next = normalizeImageItemCount(Number(displayedCount));
    setCountDraft(null);
    if (next !== item.count) onCountChange(next);
  };

  const handleCountKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setCountDraft(null);
    }
  };

  const stepCount = (candidate: number) => {
    const next = normalizeImageItemCount(candidate);
    setCountDraft(null);
    if (next !== item.count) onCountChange(next);
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
          className="hit-target flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors enabled:hover:bg-danger/10 enabled:hover:text-danger enabled:active:bg-danger/10 enabled:active:text-danger"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="flex h-10 shrink-0 items-center overflow-hidden rounded-md bg-surface shadow-[inset_0_0_0_1px_var(--color-border-subtle)]">
          <StepperButton
            direction="decrement"
            aria-label={`${t("image_quantity", { name: item.file.name })}: -1`}
            onClick={() => stepCount(item.count - 1)}
            disabled={item.count <= 1}
          />
          <input
            name={`image-count-${item.id}`}
            aria-label={t("image_quantity", { name: item.file.name })}
            type="text"
            inputMode="numeric"
            value={displayedCount}
            onChange={handleCountChange}
            onBlur={commitCountDraft}
            onKeyDown={handleCountKeyDown}
            onFocus={(e) => {
              setCountDraft(String(item.count));
              e.target.select();
            }}
            className="relative h-full w-9 shrink-0 border-x border-border-subtle/40 bg-transparent text-center font-mono text-sm font-semibold text-text-main focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-primary"
          />
          <StepperButton
            direction="increment"
            aria-label={`${t("image_quantity", { name: item.file.name })}: +1`}
            onClick={() => stepCount(item.count + 1)}
            disabled={item.count >= IMAGE_LIMITS.maxItemCount}
          />
        </div>

        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            aria-label={t("move_image_up", { name: item.file.name })}
            onClick={() => onMove("up")}
            disabled={!canMoveUp}
            className="hit-target flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors enabled:hover:bg-brand-primary/10 enabled:hover:text-brand-primary enabled:active:bg-brand-primary/10 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={t("move_image_down", { name: item.file.name })}
            onClick={() => onMove("down")}
            disabled={!canMoveDown}
            className="hit-target flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors enabled:hover:bg-brand-primary/10 enabled:hover:text-brand-primary enabled:active:bg-brand-primary/10 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <span className="ml-auto min-w-0 flex-1 truncate text-right text-xs text-text-muted">
          {formatFileSize(item.file.size)}
        </span>
      </div>
    </motion.div>
  );
}
