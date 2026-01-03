import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { ImageItem } from "../App";

interface ThumbnailItemProps {
    item: ImageItem;
    onCountChange: (count: number) => void;
}

export function ThumbnailItem({ item, onCountChange }: ThumbnailItemProps) {
    const [url, setUrl] = useState<string>("");

    useEffect(() => {
        const u = URL.createObjectURL(item.file);
        setUrl(u);
        return () => URL.revokeObjectURL(u);
    }, [item.file]);

    const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value) || 1;
        onCountChange(Math.max(1, Math.min(999, val)));
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-shrink-0 w-20 h-20 rounded-lg border border-slate-200 bg-white shadow-sm relative group transition-all hover:border-brand-primary"
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

            {/* Count Input Overlay (Bottom Right) */}
            <div className="absolute -bottom-1 -right-1 flex items-center bg-brand-primary rounded-md shadow-sm border border-white shadow-brand-primary/20 z-10">
                <input
                    type="number"
                    min="1"
                    max="999"
                    value={item.count}
                    onChange={handleCountChange}
                    onFocus={(e) => e.target.select()}
                    className="w-6 h-4 bg-transparent text-white text-[14px] font-bold text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    onClick={(e) => e.stopPropagation()}
                />
            </div>
        </motion.div>
    );
}
