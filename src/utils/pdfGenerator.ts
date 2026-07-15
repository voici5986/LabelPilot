import type { HelperLayoutConfig, ImageItem, TextConfig } from "./layoutMath";
import { formatDateForFilename } from "./format";
import { AppError, deserializeAppError } from "./appError";
import {
  readValidatedImageFile,
  validateImageFiles,
  validateImageLabelCount,
} from "./imageLimits";
import { validateTextOutput } from "./textValidation";
import type { PdfProgressUpdate } from "./pdfProgress";
import {
  isPdfWorkerResponse,
  type PdfWorkerGenerateRequest,
  type PdfWorkerImageItem,
} from "./pdfWorkerProtocol";

export const DEFAULT_PDF_TIMEOUT_MS = 120_000;

export interface GeneratePdfOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new AppError("generation_cancelled");
}

/**
 * Generates PDF using a Web Worker to avoid blocking the main thread.
 * @param config Layout configuration
 * @param imageItems List of images with their settings
 * @param onProgress Callback for generation progress (0-100)
 */
export async function generatePDF(
  config: HelperLayoutConfig,
  imageItems: ImageItem[],
  appMode: "image" | "text",
  textConfig: TextConfig,
  onProgress?: (progress: PdfProgressUpdate) => void,
  options: GeneratePdfOptions = {},
): Promise<void> {
  const { signal, timeoutMs = DEFAULT_PDF_TIMEOUT_MS } = options;
  throwIfAborted(signal);

  if (appMode === "image") {
    validateImageFiles(imageItems.map((item) => item.file));
    validateImageLabelCount(imageItems);
  } else {
    validateTextOutput(config, textConfig);
  }

  // Read sequentially to avoid a burst of simultaneous file allocations.
  const itemsWithBuffers: PdfWorkerImageItem[] = [];
  if (appMode === "image") {
    for (let index = 0; index < imageItems.length; index++) {
      const item = imageItems[index];
      throwIfAborted(signal);
      const { buffer, type } = await readValidatedImageFile(item.file);
      throwIfAborted(signal);
      itemsWithBuffers.push({
        id: item.id,
        count: item.count,
        name: item.file.name,
        type,
        buffer,
      });
      onProgress?.({
        percent: Math.round(((index + 1) / imageItems.length) * 20),
        phase: "reading",
      });
    }
  } else {
    onProgress?.({ percent: 20, phase: "preparing" });
  }

  const buffers = itemsWithBuffers.map((item) => item.buffer);

  return new Promise((resolve, reject) => {
    let worker: Worker;
    let timeoutId: number | null = null;
    let settled = false;

    const cleanup = () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      signal?.removeEventListener("abort", handleAbort);
      worker?.terminate();
    };
    const resolveOnce = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const rejectOnce = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    };
    function handleAbort() {
      rejectOnce(new AppError("generation_cancelled"));
    }

    try {
      // Vite handles the worker URL automatically.
      worker = new Worker(new URL("./pdf.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch (error) {
      rejectOnce(error);
      return;
    }

    signal?.addEventListener("abort", handleAbort, { once: true });
    timeoutId = window.setTimeout(
      () => rejectOnce(new AppError("generation_timeout")),
      Math.max(1, timeoutMs),
    );

    worker.onmessage = (event: MessageEvent<unknown>) => {
      if (settled) return;
      if (!isPdfWorkerResponse(event.data)) {
        rejectOnce(new AppError("pdf_worker_protocol_error"));
        return;
      }
      const message = event.data;

      if (message.type === "progress") {
        onProgress?.(message.data);
      } else if (message.type === "complete") {
        let url: string | null = null;
        let link: HTMLAnchorElement | null = null;

        try {
          const blob = new Blob([message.data], { type: "application/pdf" });
          url = URL.createObjectURL(blob);
          link = document.createElement("a");
          const dateStr = `label_${formatDateForFilename(new Date())}`;

          link.href = url;
          link.download = `${dateStr}.pdf`;
          document.body.appendChild(link);
          link.click();
          onProgress?.({ percent: 100, phase: "serializing" });
          resolveOnce();
        } catch (error) {
          rejectOnce(error);
        } finally {
          link?.remove();
          if (url) URL.revokeObjectURL(url);
        }
      } else {
        rejectOnce(deserializeAppError(message.data));
      }
    };

    worker.onerror = (err) => {
      rejectOnce(err.error ?? new Error(err.message || "PDF worker failed"));
    };

    try {
      // Send data to worker using Transferable Objects (zero-copy).
      const request: PdfWorkerGenerateRequest = {
        type: "generate",
        data: { config, imageItems: itemsWithBuffers, appMode, textConfig },
      };
      worker.postMessage(request, buffers);
    } catch (error) {
      rejectOnce(error);
    }
  });
}
