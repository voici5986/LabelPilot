type ImageDimensions = {
  width: number;
  height: number;
};

export type JpegMetadata = ImageDimensions & {
  orientation: number;
};

function isJpegStartOfFrame(marker: number): boolean {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

function readExifOrientation(
  data: Uint8Array,
  payloadOffset: number,
  payloadLength: number,
): number | null {
  const payloadEnd = payloadOffset + payloadLength;
  if (
    payloadLength < 14 ||
    data[payloadOffset] !== 0x45 ||
    data[payloadOffset + 1] !== 0x78 ||
    data[payloadOffset + 2] !== 0x69 ||
    data[payloadOffset + 3] !== 0x66 ||
    data[payloadOffset + 4] !== 0x00 ||
    data[payloadOffset + 5] !== 0x00
  ) {
    return null;
  }

  const tiffOffset = payloadOffset + 6;
  const littleEndian =
    data[tiffOffset] === 0x49 && data[tiffOffset + 1] === 0x49;
  const bigEndian = data[tiffOffset] === 0x4d && data[tiffOffset + 1] === 0x4d;
  if (!littleEndian && !bigEndian) return null;

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint16(tiffOffset + 2, littleEndian) !== 0x2a) return null;
  const firstIfdOffset = view.getUint32(tiffOffset + 4, littleEndian);
  const ifdOffset = tiffOffset + firstIfdOffset;
  if (ifdOffset + 2 > payloadEnd) return null;

  const entryCount = view.getUint16(ifdOffset, littleEndian);
  for (let index = 0; index < entryCount; index++) {
    const entryOffset = ifdOffset + 2 + index * 12;
    if (entryOffset + 12 > payloadEnd) return null;
    if (
      view.getUint16(entryOffset, littleEndian) === 0x0112 &&
      view.getUint16(entryOffset + 2, littleEndian) === 3 &&
      view.getUint32(entryOffset + 4, littleEndian) === 1
    ) {
      const orientation = view.getUint16(entryOffset + 8, littleEndian);
      return orientation >= 1 && orientation <= 8 ? orientation : null;
    }
  }

  return null;
}

// Both readers use the same segment rules; the Blob reader stops at the first
// scan so pixel budgets can be checked before loading compressed image bytes.
type HeaderState = {
  metadata: JpegMetadata | null;
  orientation: number;
  components: Set<number>;
  hasScan: boolean;
};
function consumeHeaderSegment(
  state: HeaderState,
  marker: number,
  segment: Uint8Array,
): boolean {
  const length = segment.length;
  const view = new DataView(segment.buffer, segment.byteOffset, length);
  if (isJpegStartOfFrame(marker)) {
    if (state.metadata || length < 8) return false;
    const count = segment[7];
    if (!count || length !== 8 + 3 * count) return false;
    for (let index = 0; index < count; index++) {
      const id = segment[8 + 3 * index];
      if (state.components.has(id)) return false;
      state.components.add(id);
    }
    state.metadata = {
      width: view.getUint16(5),
      height: view.getUint16(3),
      orientation: state.orientation,
    };
    return state.metadata.width > 0 && state.metadata.height > 0;
  }
  if (marker === 0xda) {
    if (!state.metadata || length < 6) return false;
    const count = segment[2];
    if (!count || count > 4 || length !== 6 + 2 * count) return false;
    const ids = new Set<number>();
    for (let index = 0; index < count; index++) {
      const id = segment[3 + 2 * index];
      if (!state.components.has(id) || ids.has(id)) return false;
      ids.add(id);
    }
    // EXIF after the first SOS is not part of the image header. Keep upload
    // dimensions and Worker orientation bound to the same header metadata.
    state.hasScan = true;
  } else if (marker === 0xe1 && !state.hasScan) {
    state.orientation =
      readExifOrientation(segment, 2, length - 2) ?? state.orientation;
  }
  if (state.metadata) state.metadata.orientation = state.orientation;
  return true;
}
function isSegmentMarker(marker: number): boolean {
  return (
    isJpegStartOfFrame(marker) ||
    marker === 0xc4 ||
    marker === 0xcc ||
    (marker >= 0xda && marker <= 0xdf) ||
    (marker >= 0xe0 && marker <= 0xef) ||
    marker === 0xfe
  );
}
function newHeaderState(): HeaderState {
  return {
    metadata: null,
    orientation: 1,
    components: new Set(),
    hasScan: false,
  };
}

/** Checks marker structure, not entropy-code or decoded-pixel integrity. */
export function readJpegMetadata(data: Uint8Array): JpegMetadata | null {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;
  const state = newHeaderState();
  let offset = 2;
  let inScan = false;
  let hasScanData = false;
  let hasScan = false;
  while (offset < data.length) {
    if (data[offset] !== 0xff) {
      if (!inScan) return null;
      hasScanData = true;
      offset++;
      continue;
    }
    while (offset < data.length && data[offset] === 0xff) offset++;
    if (offset >= data.length) return null;
    const marker = data[offset++];
    if (inScan && marker === 0x00) {
      hasScanData = true;
      continue;
    }
    if (inScan && ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01))
      continue;
    if (inScan && !hasScanData) return null;
    inScan = false;
    if (marker === 0xd9) return hasScan ? state.metadata : null;
    if (!isSegmentMarker(marker) || offset + 2 > data.length) return null;
    const length = (data[offset] << 8) | data[offset + 1];
    if (length < 2 || offset + length > data.length) return null;
    if (
      !consumeHeaderSegment(
        state,
        marker,
        data.subarray(offset, offset + length),
      )
    )
      return null;
    offset += length;
    if (marker === 0xda) {
      inScan = true;
      hasScanData = false;
      hasScan = true;
    }
  }
  return null;
}

const MAX_JPEG_HEADER_READS = 4096;

/** Bounded metadata reads, skipping payloads unrelated to dimensions or EXIF. */
export async function readJpegFileMetadata(
  file: Blob,
): Promise<JpegMetadata | undefined> {
  let reads = 0;
  const read = async (start: number, length: number) => {
    if (++reads > MAX_JPEG_HEADER_READS) return undefined;
    return new Uint8Array(
      await file.slice(start, start + length).arrayBuffer(),
    );
  };
  const start = await read(0, 2);
  if (!start || start[0] !== 0xff || start[1] !== 0xd8) return undefined;
  const state = newHeaderState();
  let offset = 2;
  while (offset < file.size) {
    let header = await read(offset, 4);
    if (!header || header.length < 2 || header[0] !== 0xff) return undefined;
    while (header[1] === 0xff) {
      const fill = await read(offset, 4096);
      if (!fill) return undefined;
      let count = 0;
      while (count < fill.length && fill[count] === 0xff) count++;
      offset += count - 1;
      header = await read(offset, 4);
      if (!header || header.length < 2) return undefined;
    }
    const marker = header[1];
    offset += 2;
    if (!isSegmentMarker(marker) || header.length < 4) return undefined;
    const length = (header[2] << 8) | header[3];
    if (length < 2 || offset + length > file.size) return undefined;
    if (isJpegStartOfFrame(marker) || marker === 0xe1 || marker === 0xda) {
      const segment = await read(offset, length);
      if (!segment || !consumeHeaderSegment(state, marker, segment))
        return undefined;
    }
    if (marker === 0xda) return state.metadata ?? undefined;
    offset += length;
  }
  return undefined;
}
