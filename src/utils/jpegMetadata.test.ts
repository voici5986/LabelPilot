import { describe, expect, it, vi } from "vitest";

import { createJpegWithMetadata } from "../test/jpegFixtures";
import { readJpegFileMetadata, readJpegMetadata } from "./jpegMetadata";

describe("JPEG metadata", () => {
  it.each([
    { orientation: undefined, lateOrientation: 6, expected: 1 },
    { orientation: 6, lateOrientation: 3, expected: 6 },
  ])(
    "freezes header orientation $expected before late APP1 $lateOrientation",
    async ({ orientation, lateOrientation, expected }) => {
      const bytes = createJpegWithMetadata({ orientation, lateOrientation });
      const metadata = { width: 80, height: 40, orientation: expected };
      expect(readJpegMetadata(new Uint8Array(bytes))).toEqual(metadata);
      expect(await readJpegFileMetadata(new Blob([bytes]))).toEqual(metadata);
    },
  );

  it.each([undefined, 1, 2, 3, 4, 5, 6, 7, 8])(
    "matches worker orientation %s",
    async (orientation) => {
      const bytes = createJpegWithMetadata({
        orientation,
        fillBeforeSof: true,
      });
      expect(await readJpegFileMetadata(new Blob([bytes]))).toEqual(
        readJpegMetadata(new Uint8Array(bytes)),
      );
    },
  );

  it("skips large marker payloads and stops before compressed image data", async () => {
    const bytes = new Uint8Array(createJpegWithMetadata({ orientation: 6 }));
    const padding = new Uint8Array(65_537);
    padding.set([0xff, 0xe2, 0xff, 0xff]);
    const file = new Blob([
      bytes.subarray(0, 2),
      ...Array<Uint8Array<ArrayBuffer>>(5).fill(padding),
      bytes.subarray(2, -2),
      new Uint8Array(1_000_000),
      bytes.subarray(-2),
    ]);
    const read = vi.spyOn(file, "slice");
    expect(await readJpegFileMetadata(file)).toEqual({
      width: 80,
      height: 40,
      orientation: 6,
    });
    expect(
      read.mock.calls.every(
        ([start = 0, end = file.size]) => end - start <= 34,
      ),
    ).toBe(true);
    const lastHeaderEnd = 2 + padding.length * 5 + bytes.length - 3;
    expect(
      read.mock.calls.every(([, end = file.size]) => end <= lastHeaderEnd),
    ).toBe(true);
  });

  it("bounds pathological tiny-marker reads and leaves metadata unknown", async () => {
    const file = new Blob([
      new Uint8Array([0xff, 0xd8]),
      ...Array<Uint8Array<ArrayBuffer>>(5000).fill(
        new Uint8Array([0xff, 0xe2, 0, 2]),
      ),
      createJpegWithMetadata({ orientation: 6 }).slice(2),
    ]);
    const read = vi.spyOn(file, "slice");
    expect(await readJpegFileMetadata(file)).toBeUndefined();
    expect(read.mock.calls.length).toBeLessThanOrEqual(4096);
  });

  it("leaves incomplete marker headers unknown", async () => {
    const bytes = new Uint8Array(createJpegWithMetadata({ orientation: 6 }));
    expect(
      await readJpegFileMetadata(new Blob([bytes.subarray(0, 12)])),
    ).toBeUndefined();
    expect(
      await readJpegFileMetadata(new Blob([bytes.subarray(0, -12)])),
    ).toBeUndefined();
  });
});

describe("JPEG marker structure", () => {
  const bytes = () => new Uint8Array(createJpegWithMetadata());
  it.each([80, 9000])("rejects a second SOF with width %s", async (width) => {
    const source = bytes();
    const frame = source.slice(6, 19);
    frame[7] = width >> 8;
    frame[8] = width & 255;
    for (const position of [19, source.length - 2]) {
      const duplicate = new Uint8Array([
        ...source.slice(0, position),
        ...frame,
        ...source.slice(position),
      ]);
      expect(readJpegMetadata(duplicate)).toBeNull();
      if (position === 19)
        expect(
          await readJpegFileMetadata(new Blob([duplicate])),
        ).toBeUndefined();
    }
  });
  it("accepts progressive scans with stuffing, restart markers and APP14", () => {
    const source = bytes();
    source[7] = 0xc2;
    const sos = source.slice(19, 29);
    sos[8] = 0;
    const progressive = new Uint8Array([
      ...source.slice(0, 19),
      ...sos,
      0x12,
      0xff,
      0x00,
      0xff,
      0xd0,
      0x34,
      0xff,
      0xee,
      0,
      7,
      65,
      100,
      111,
      98,
      101,
      ...sos,
      0x56,
      0xff,
      0xd9,
    ]);
    expect(readJpegMetadata(progressive)).toEqual({
      width: 80,
      height: 40,
      orientation: 1,
    });
  });
  it.each([
    { marker: [0xff, 0xd8] },
    { marker: [0xff, 0x02, 0, 2] },
    { marker: [0xff, 0xda, 0, 2] },
  ])("rejects illegal scan marker $marker", ({ marker }) => {
    const source = bytes();
    expect(
      readJpegMetadata(
        new Uint8Array([...source.slice(0, -2), ...marker, 0xff, 0xd9]),
      ),
    ).toBeNull();
  });
  it("rejects empty scans, missing EOI and junk between header markers", () => {
    const source = bytes();
    expect(
      readJpegMetadata(new Uint8Array([...source.slice(0, -3), 0xff, 0xd9])),
    ).toBeNull();
    expect(readJpegMetadata(source.slice(0, -1))).toBeNull();
    expect(
      readJpegMetadata(
        new Uint8Array([...source.slice(0, 2), 0x12, ...source.slice(2)]),
      ),
    ).toBeNull();
  });
  it.each([15, 23])(
    "rejects component counts inconsistent with segment length at %s",
    async (offset) => {
      const source = bytes();
      source[offset] = 2;
      expect(readJpegMetadata(source)).toBeNull();
      expect(await readJpegFileMetadata(new Blob([source]))).toBeUndefined();
    },
  );
  it("does not claim entropy integrity from a nonempty payload plus EOI", () => {
    expect(readJpegMetadata(bytes())).not.toBeNull();
  });
});
