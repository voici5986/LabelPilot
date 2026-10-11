type PngMetadata = {
  width: number;
  height: number;
  depth: number;
  channels: number;
  interlace: number;
  imageData: { start: number; end: number }[];
};

const criticalChunks = new Set(["IHDR", "PLTE", "IDAT", "IEND"]);

/** Structural metadata; CRC validation remains with jsPDF's actual decoder. */
function readPngMetadata(data: Uint8Array): PngMetadata | null {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (data.length < 33 || signature.some((byte, index) => data[index] !== byte))
    return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 8;
  let metadata: PngMetadata | null = null;
  let seenImageData = false;
  let hasImageBytes = false;
  let imageDataEnded = false;
  while (offset + 12 <= data.length) {
    const length = view.getUint32(offset);
    if (length > data.length - offset - 12) return null;
    const type = String.fromCharCode(...data.subarray(offset + 4, offset + 8));
    if (
      !/^[A-Za-z]{4}$/.test(type) ||
      type[2] !== type[2].toUpperCase() ||
      (type[0] === type[0].toUpperCase() && !criticalChunks.has(type))
    )
      return null;
    if (offset === 8 && (type !== "IHDR" || length !== 13)) return null;
    if (type === "IHDR") {
      if (metadata || offset !== 8 || length !== 13) return null;
      const width = view.getUint32(offset + 8);
      const height = view.getUint32(offset + 12);
      const depth = data[offset + 16];
      const color = data[offset + 17];
      const depths: Record<number, readonly number[]> = {
        0: [1, 2, 4, 8, 16],
        2: [8, 16],
        3: [1, 2, 4, 8],
        4: [8, 16],
        6: [8, 16],
      };
      const channels: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
      if (
        width === 0 ||
        height === 0 ||
        !depths[color]?.includes(depth) ||
        data[offset + 18] !== 0 ||
        data[offset + 19] !== 0 ||
        data[offset + 20] > 1
      )
        return null;
      metadata = {
        width,
        height,
        depth,
        channels: channels[color],
        interlace: data[offset + 20],
        imageData: [],
      };
    } else if (type === "IDAT") {
      if (imageDataEnded || !metadata) return null;
      seenImageData = true;
      hasImageBytes ||= length > 0;
      metadata.imageData.push({ start: offset + 8, end: offset + 8 + length });
    } else if (type === "IEND") {
      return length === 0 && hasImageBytes && offset + 12 === data.length
        ? metadata
        : null;
    } else if (seenImageData) {
      imageDataEnded = true;
    }
    offset += length + 12;
  }
  return null;
}

export function readPngDimensions(
  data: Uint8Array,
): { width: number; height: number } | null {
  const metadata = readPngMetadata(data);
  return metadata ? { width: metadata.width, height: metadata.height } : null;
}

function scanlinePasses(
  metadata: PngMetadata,
): { rows: number; rowBytes: number }[] {
  // Adam7: x/y origin and x/y stride for each of the seven passes.
  const passes =
    metadata.interlace === 0
      ? [[0, 0, 1, 1]]
      : [
          [0, 0, 8, 8],
          [4, 0, 8, 8],
          [0, 4, 4, 8],
          [2, 0, 4, 4],
          [0, 2, 2, 4],
          [1, 0, 2, 2],
          [0, 1, 1, 2],
        ];
  return passes.flatMap(([x, y, dx, dy]) => {
    const columns = Math.max(0, Math.ceil((metadata.width - x) / dx));
    const rows = Math.max(0, Math.ceil((metadata.height - y) / dy));
    return columns && rows
      ? [
          {
            rows,
            rowBytes:
              1 + Math.ceil((columns * metadata.channels * metadata.depth) / 8),
          },
        ]
      : [];
  });
}

/** Check scanline length/filter bytes without retaining an inflated pixel buffer.
 * Call only after the source dimensions have passed the request pixel budget.
 */
export async function validatePngScanlines(
  data: Uint8Array<ArrayBuffer>,
): Promise<void> {
  const metadata = readPngMetadata(data);
  if (!metadata) throw new Error("Invalid PNG structure");
  if (typeof DecompressionStream !== "function") {
    if (typeof createImageBitmap !== "function")
      throw new Error("PNG validation unavailable");
    const bitmap = await createImageBitmap(
      new Blob([data], { type: "image/png" }),
    );
    bitmap.close();
    return;
  }
  const passes = scanlinePasses(metadata);
  const expectedBytes = passes.reduce(
    (total, pass) => total + pass.rows * pass.rowBytes,
    0,
  );
  let imageDataIndex = 0;
  let imageDataOffset = 0;
  const compressed = new ReadableStream<Uint8Array<ArrayBuffer>>({
    pull(controller) {
      while (imageDataIndex < metadata.imageData.length) {
        const part = metadata.imageData[imageDataIndex];
        const start = part.start + imageDataOffset;
        if (start === part.end) {
          imageDataIndex++;
          imageDataOffset = 0;
          continue;
        }
        // Bound expansion per transform even when a single IDAT is very large.
        const end = Math.min(start + 1024, part.end);
        imageDataOffset += end - start;
        controller.enqueue(data.subarray(start, end));
        return;
      }
      controller.close();
    },
  });
  const reader = compressed
    .pipeThrough(new DecompressionStream("deflate"))
    .getReader();
  let total = 0;
  let passIndex = 0;
  let rowsInPass = 0;
  let rowOffset = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value.length > expectedBytes - total)
        throw new Error("Excess PNG scanline data");
      total += value.length;
      let offset = 0;
      while (offset < value.length) {
        const pass = passes[passIndex];
        if (rowOffset === 0 && value[offset] > 4)
          throw new Error("Invalid PNG scanline filter");
        const length = Math.min(
          pass.rowBytes - rowOffset,
          value.length - offset,
        );
        offset += length;
        rowOffset += length;
        if (rowOffset === pass.rowBytes) {
          rowOffset = 0;
          if (++rowsInPass === pass.rows) {
            passIndex++;
            rowsInPass = 0;
          }
        }
      }
    }
    if (total !== expectedBytes) throw new Error("Truncated PNG scanline data");
  } finally {
    // Stop decompression immediately on excess data or malformed filters.
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
