import { motion } from "framer-motion";
import { X } from "lucide-react";
import type { ImageItem } from "../utils/layoutMath";
import { useStore } from "../store/useStore";

interface ThumbnailItemProps {
    item: ImageItem;
    onCountChange: (count: number) => void;
    onRemove: () => void;
}

export function ThumbnailItem({ item, onCountChange, onRemove }: ThumbnailItemProps) {
    const imageUrlMap = useStore((state) => state.imageUrlMap);
    const url = imageUrlMap.get(item.id) || "";

    const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value) || 1;
        onCountChange(Math.max(1, Math.min(999, val)));
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-shrink-0 w-20 h-20 rounded-lg border border-border-subtle bg-surface shadow-sm relative group transition-all hover:border-brand-primary"
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
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                }}
                className="absolute -top-1.5 -left-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600 z-20"
            >
                <X className="w-3 h-3" />
            </button>

            {/* Count Input Overlay (Bottom Right) */}
            <div className="absolute -bottom-1 -right-1 flex items-center bg-brand-primary rounded-md shadow-sm border border-white shadow-brand-primary/20 z-10">
                <input
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
                    className="w-6 h-4 bg-transparent text-white text-[14px] font-semibold text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    onClick={(e) => e.stopPropagation()}
                />
            </div>
        </motion.div>
    );
}
