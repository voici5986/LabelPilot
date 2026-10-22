import { writeFile } from "node:fs/promises";

import type { Canvas, SKRSContext2D } from "@napi-rs/canvas";
import jsQR from "jsqr";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { RenderParameters } from "pdfjs-dist/types/src/display/api";

interface NativeCanvasSurface {
  canvas: Canvas;
  context: SKRSContext2D;
}

interface NativeCanvasFactory {
  create(width: number, height: number): NativeCanvasSurface;
  destroy(surface: NativeCanvasSurface): void;
}

/** Independently rasterize the downloaded PDF and scan its two column cells. */
export async function decodePdfQrColumns(
  pdf: Uint8Array,
  pageArtifactPath: (pageNumber: number) => string,
): Promise<(string | null)[][]> {
  // PDF.js transfers its input to its worker; do not detach the caller's bytes.
  const loadingTask = getDocument({ data: new Uint8Array(pdf) });
  try {
    const document = await loadingTask.promise;
    try {
      // PDF.js's Node factory uses @napi-rs/canvas, but declares itself as object.
      const factory = document.canvasFactory as NativeCanvasFactory;
      const decodedPages: (string | null)[][] = [];
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
        const page = await document.getPage(pageNumber);
        let surface: NativeCanvasSurface | undefined;
        try {
          const viewport = page.getViewport({ scale: 150 / 72 });
          surface = factory.create(
            Math.ceil(viewport.width),
            Math.ceil(viewport.height),
          );
          await page.render({
            canvas: null,
            // The renderer accepts the native context at runtime; its public
            // declarations describe browser canvas contexts only.
            canvasContext:
              surface.context as unknown as RenderParameters["canvasContext"],
            viewport,
          }).promise;
          await writeFile(
            pageArtifactPath(pageNumber),
            surface.canvas.toBuffer("image/png"),
          );
          const width = surface.canvas.width;
          const height = surface.canvas.height;
          const split = Math.floor(width / 2);
          const context = surface.context;
          decodedPages.push(
            [
              { x: 0, width: split },
              { x: split, width: width - split },
            ].map((cell) => {
              const image = context.getImageData(cell.x, 0, cell.width, height);
              return jsQR(image.data, image.width, image.height)?.data ?? null;
            }),
          );
        } finally {
          if (surface) factory.destroy(surface);
          page.cleanup();
        }
      }
      return decodedPages;
    } finally {
      await document.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }
}
