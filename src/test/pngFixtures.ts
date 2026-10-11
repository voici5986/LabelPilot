function uint32(value: number): number[] {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ];
}

function chunk(type: string, bytes: number[]): number[] {
  const body = [
    ...Array.from(type, (letter) => letter.charCodeAt(0)),
    ...bytes,
  ];
  let crc = 0xffffffff;
  for (const byte of body) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return [
    ...uint32(bytes.length),
    ...body,
    ...uint32((crc ^ 0xffffffff) >>> 0),
  ];
}

/** Insert a CRC-correct test chunk immediately after the fixture's IHDR. */
export function withPngChunk(
  png: Uint8Array,
  type: string,
): Uint8Array<ArrayBuffer> {
  return new Uint8Array([
    ...png.subarray(0, 33),
    ...chunk(type, []),
    ...png.subarray(33),
  ]);
}

/** Valid RGB PNGs whose first half is identical but bottom rows differ. */
export function createCollisionPng(
  bottom: "red" | "blue",
  width = 32,
  height = 32,
): Uint8Array<ArrayBuffer> {
  const raw: number[] = [];
  for (let y = 0; y < height; y++) {
    raw.push(0);
    for (let x = 0; x < width; x++)
      raw.push(
        ...(y < height * 0.65
          ? [255, 255, 255]
          : bottom === "red"
            ? [255, 0, 0]
            : [0, 0, 255]),
      );
  }
  return createScanlinePng(raw, { width, height });
}

export function createScanlinePng(
  raw: number[],
  {
    width = 32,
    height = 32,
    depth = 8,
    color = 2,
    interlace = 0,
    ancillary = false,
    interruptedIdat = false,
  }: {
    width?: number;
    height?: number;
    depth?: number;
    color?: number;
    interlace?: number;
    ancillary?: boolean;
    interruptedIdat?: boolean;
  } = {},
): Uint8Array<ArrayBuffer> {
  let a = 1,
    b = 0;
  for (const byte of raw) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  const length = raw.length;
  const compressed = [
    0x78,
    0x01,
    0x01,
    length & 255,
    length >>> 8,
    ~length & 255,
    (~length >>> 8) & 255,
    ...raw,
    ...uint32((b << 16) | a),
  ];
  const imageChunks = interruptedIdat
    ? [
        ...chunk("IDAT", []),
        ...chunk("tEXt", [65, 0, 66]),
        ...chunk("IDAT", compressed),
      ]
    : [...chunk("IDAT", []), ...chunk("IDAT", compressed)];
  return new Uint8Array([
    137,
    80,
    78,
    71,
    13,
    10,
    26,
    10,
    ...chunk("IHDR", [
      ...uint32(width),
      ...uint32(height),
      depth,
      color,
      0,
      0,
      interlace,
    ]),
    ...(ancillary ? chunk("tEXt", [65, 0, 66]) : []),
    ...imageChunks,
    ...(ancillary ? chunk("tEXt", [67, 0, 68]) : []),
    ...chunk("IEND", []),
  ]);
}

/** Structurally complete PNG header for budget tests that never decode it. */
export function createBudgetPng(width: number, height: number): ArrayBuffer {
  return new Uint8Array([
    137,
    80,
    78,
    71,
    13,
    10,
    26,
    10,
    ...chunk("IHDR", [...uint32(width), ...uint32(height), 8, 2, 0, 0, 0]),
    ...chunk("IDAT", [1]),
    ...chunk("IEND", []),
  ]).buffer;
}

/** Correct PNG chunk CRCs, but an invalid zlib stream. */
export function createCorruptPng(): Uint8Array<ArrayBuffer> {
  return new Uint8Array([
    137,
    80,
    78,
    71,
    13,
    10,
    26,
    10,
    ...chunk("IHDR", [...uint32(32), ...uint32(32), 8, 2, 0, 0, 0]),
    ...chunk("IDAT", [0x78, 0x01, 0x07, 0, 0, 0, 0]),
    ...chunk("IEND", []),
  ]);
}
