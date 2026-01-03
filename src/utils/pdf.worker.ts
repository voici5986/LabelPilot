import jsPDF from "jspdf";
import { calculateLabelLayout, resolveItemAtSlot } from "./layoutMath";

/**
 * PDF Generation Worker
 */
const ctx: Worker = self as any;

ctx.onmessage = async (e) => {
    const { config, imageItems } = e.data;

    try {
        // 1. Calculate Layout
        const layout = calculateLabelLayout(config);
        if (layout.error) {
            throw new Error(layout.error);
        }

        // 2. Load all images
        const loadedImages = await Promise.all(imageItems.map(async (item: any, idx: number) => {
            // Report progress for loading (0% - 30%)
            ctx.postMessage({ type: 'progress', data: Math.round(((idx + 1) / imageItems.length) * 30) });

            const arrayBuffer = await item.file.arrayBuffer();
            const blob = new Blob([arrayBuffer], { type: item.file.type });
            const bitmap = await createImageBitmap(blob);

            let format = "PNG";
            if (item.file.type === "image/jpeg" || item.file.type === "image/jpg") {
                format = "JPEG";
            }

            const uint8Array = new Uint8Array(arrayBuffer);

            return {
                ...item,
                data: uint8Array,
                format,
                width: bitmap.width,
                height: bitmap.height
            };
        }));

        // 3. Create PDF
        const pdf = new jsPDF({
            orientation: config.orientation,
            unit: "mm",
            format: "a4",
        });

        // 4. Draw Images
        const totalPositions = layout.positions.length;
        layout.positions.forEach((pos: any, idx: number) => {
            // Report progress for drawing (30% to 90%)
            if (idx % 5 === 0) {
                ctx.postMessage({ type: 'progress', data: 30 + Math.round((idx / totalPositions) * 60) });
            }

            const img = resolveItemAtSlot(idx, loadedImages);
            if (!img) return;

            const scale = Math.min(pos.width / img.width, pos.height / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            const x = pos.x + (pos.width - w) / 2;
            const y = pos.y + (pos.height - h) / 2;

            pdf.addImage(
                img.data,
                img.format,
                x,
                y,
                w,
                h,
                undefined,
                'FAST'
            );
        });

        ctx.postMessage({ type: 'progress', data: 95 });

        // 5. Generate Output
        const output = pdf.output('arraybuffer');
        ctx.postMessage({ type: 'complete', data: output }, [output]);

    } catch (error) {
        ctx.postMessage({ type: 'error', data: (error as Error).message });
    }
};
