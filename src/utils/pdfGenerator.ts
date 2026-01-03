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
    onProgress?: (progress: number) => void
): Promise<void> {
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
                const dateStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "");
                link.href = url;
                link.download = `labelpilot_${dateStr}.pdf`;
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

        // Send data to worker (Files are transferable, but here we just pass the objects)
        worker.postMessage({ config, imageItems });
    });
}
