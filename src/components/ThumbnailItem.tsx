import { motion } from "framer-motion";
import { X } from "lucide-react";
import type { ImageItem } from "../utils/layoutMath";
import { useStore } from "../store/useStore";
import { useI18n } from "../utils/i18nContext";

interface ThumbnailItemProps {
  item: ImageItem;
  onCountChange: (count: number) => void;
  onRemove: () => void;
}

export function ThumbnailItem({
  item,
  onCountChange,
  onRemove,
}: ThumbnailItemProps) {
  const imageUrlMap = useStore((state) => state.imageUrlMap);
  const { t } = useI18n();
  const url = imageUrlMap.get(item.id) || "";

  const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 1;
    onCountChange(Math.max(1, Math.min(999, val)));
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group relative h-20 w-20 flex-shrink-0 rounded-md border border-border-subtle bg-surface transition-colors hover:border-brand-primary"
      title={item.file.name}
    >
      {url && (
        <div className="w-full h-full p-1 overflow-hidden pointer-events-none">
          <img
            src={url}
            alt=""
            className="w-full h-full object-contain"
            draggable="false"
          />
        </div>
      )}

      {/* Remove Button */}
      <button
        type="button"
        aria-label={t("remove_image", { name: item.file.name })}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute -left-1.5 -top-1.5 z-20 flex items-center justify-center rounded-full bg-red-600 p-0.5 text-white opacity-0 transition-opacity hover:bg-red-700 focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <X className="w-3 h-3" />
      </button>

      {/* Count Input Overlay (Bottom Right) */}
      <div className="absolute -bottom-1 -right-1 z-10 flex items-center rounded-md border border-on-brand bg-brand-primary">
        <input
          name={`image-count-${item.id}`}
          aria-label={t("image_quantity", { name: item.file.name })}
          type="number"
          min="1"
          max="999"
          value={item.count}
          onChange={handleCountChange}
          onFocus={(e) => e.target.select()}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            const input = e.currentTarget;
            input.focus();
            input.select();
          }}
          className="w-6 h-4 bg-transparent text-on-brand text-[14px] font-semibold text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </motion.div>
  );
}
