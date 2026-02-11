import jsPDF from "jspdf";
import { calculateLabelLayout, resolveItemAtSlot } from "./layoutMath";

/**
 * PDF Generation Worker
 */
const ctx: Worker = self as unknown as Worker;

ctx.onmessage = async (e) => {
    const { config, imageItems } = e.data;

    try {
        // 1. Calculate Layout
        const layout = calculateLabelLayout(config);
        if (layout.error) {
            throw new Error(layout.error);
        }

        // 2. Load all images
        const loadedImages = await Promise.all(imageItems.map(async (item: { buffer: ArrayBuffer; type: string; id: string }, idx: number) => {
            // Report progress for loading (0% - 30%)
            ctx.postMessage({ type: 'progress', data: Math.round(((idx + 1) / imageItems.length) * 30) });

            // Buffer is already transferred from main thread
            const arrayBuffer = item.buffer;
            const blob = new Blob([arrayBuffer], { type: item.type });
            const bitmap = await createImageBitmap(blob);

            let format: "PNG" | "JPEG" = "PNG";
            if (item.type === "image/jpeg" || item.type === "image/jpg") {
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
            format: [layout.pageWidth, layout.pageHeight],
        });

        // 4. Calculate total images to draw across all pages
        const totalCount = imageItems.reduce((acc: number, item: { count: number }) => acc + item.count, 0);
        const slotsPerPage = layout.positions.length;
        const totalPages = Math.ceil(totalCount / slotsPerPage);

        // 5. Draw Images
        for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
            if (pageIdx > 0) {
                pdf.addPage();
            }

            const startSlotIdx = pageIdx * slotsPerPage;
            
            layout.positions.forEach((pos: { x: number; y: number; width: number; height: number }, localIdx: number) => {
                const globalIdx = startSlotIdx + localIdx;
                if (globalIdx >= totalCount) return;

                // Report progress (30% to 90%)
                if (globalIdx % 5 === 0) {
                    ctx.postMessage({ type: 'progress', data: 30 + Math.round((globalIdx / totalCount) * 60) });
                }

                const img = resolveItemAtSlot(globalIdx, loadedImages);
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
        }

        ctx.postMessage({ type: 'progress', data: 95 });

        // 5. Generate Output
        const output = pdf.output('arraybuffer');
        ctx.postMessage({ type: 'complete', data: output }, [output]);

    } catch (error) {
        ctx.postMessage({ type: 'error', data: (error as Error).message });
    }
};
