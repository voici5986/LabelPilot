import type { HelperLayoutConfig } from "./layoutMath";
import type { ImageItem } from "../App";

/**
 * Generates PDF using a Web Worker to avoid blocking the main thread.
 * @param config Layout configuration
 * @param imageItems List of images with their settings
 * @param onProgress Callback for generation progress (0-100)
 */
export async function generatePDF(
    config: HelperLayoutConfig,
    imageItems: ImageItem[],
    appMode: 'image' | 'text',
    textConfig: {
        prefix: string;
        startNumber: number;
        digits: number;
        count: number;
    },
    onProgress?: (progress: number) => void
): Promise<void> {
    // Pre-read buffers and prepare for transfer
    const itemsWithBuffers = appMode === 'image' ? await Promise.all(imageItems.map(async (item) => {
        const buffer = await item.file.arrayBuffer();
        return {
            id: item.id,
            count: item.count,
            name: item.file.name,
            type: item.file.type,
            buffer
        };
    })) : [];

    const buffers = itemsWithBuffers.map(item => item.buffer);

    return new Promise((resolve, reject) => {
        // Vite handles the worker URL automatically
        const worker = new Worker(new URL('./pdf.worker.ts', import.meta.url), {
            type: 'module'
        });

        worker.onmessage = (e) => {
            const { type, data } = e.data;

            if (type === 'progress') {
                onProgress?.(data);
            } else if (type === 'complete') {
                const blob = new Blob([data], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);

                const link = document.createElement('a');
                const now = new Date();
                const YY = String(now.getFullYear()).slice(-2);
                const MM = String(now.getMonth() + 1).padStart(2, '0');
                const DD = String(now.getDate()).padStart(2, '0');
                const hh = String(now.getHours()).padStart(2, '0');
                const mm = String(now.getMinutes()).padStart(2, '0');
                const dateStr = `label_${YY}${MM}${DD}_${hh}${mm}`;

                link.href = url;
                link.download = `${dateStr}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                URL.revokeObjectURL(url);
                worker.terminate();
                resolve();
            } else if (type === 'error') {
                worker.terminate();
                reject(new Error(data));
            }
        };

        worker.onerror = (err) => {
            worker.terminate();
            reject(err);
        };

        // Send data to worker using Transferable Objects (zero-copy)
        worker.postMessage({ config, imageItems: itemsWithBuffers, appMode, textConfig }, buffers);
    });
}
