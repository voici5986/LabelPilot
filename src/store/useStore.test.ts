// @vitest-environment jsdom

import { File as BrowserFile } from "node:buffer";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createJpegWithMetadata } from "../test/jpegFixtures";
import { createCollisionPng } from "../test/pngFixtures";

afterEach(() => {
  localStorage.clear();
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe("useStore image uploads", () => {
  it("makes JPEG direction metadata available before publishing uploaded items", async () => {
    vi.stubGlobal("File", BrowserFile);
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 80, height: 40, close: vi.fn() })),
    );
    const { useStore } = await import("./useStore");
    const { getValidatedJpegOrientation } =
      await import("../utils/imageLimits");
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:jpeg"),
      revokeObjectURL: vi.fn(),
    });
    const file = new File(
      [createJpegWithMetadata({ orientation: 2 })],
      "mirror.jpg",
      { type: "image/jpg" },
    );
    const read = vi.spyOn(file, "slice");
    const publishedOrientations: (number | null | undefined)[] = [];
    const unsubscribe = useStore.subscribe((state) => {
      if (state.imageItems.length)
        publishedOrientations.push(
          getValidatedJpegOrientation(state.imageItems[0].file),
        );
    });
    await useStore.getState().addImageFiles([file]);
    expect(publishedOrientations).toEqual([2]);
    const reads = read.mock.calls.length;
    useStore
      .getState()
      .updateItemCount(useStore.getState().imageItems[0].id, 4);
    await useStore.getState().addImageFiles([file]);
    expect(read).toHaveBeenCalledTimes(reads);
    expect(createImageBitmap).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("validates direct uploads and appends with the latest default count and URL lifecycle", async () => {
    vi.stubGlobal("File", BrowserFile);
    let finishRead!: () => void;
    const readGate = new Promise<void>((resolve) => {
      finishRead = resolve;
    });
    const decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);
    const createObjectURL = vi.fn(() => "blob:upload");
    const revokeObjectURL = vi.fn();
    const { useStore } = await import("./useStore");
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    await expect(
      useStore
        .getState()
        .addImageFiles([new File(["bad"], "bad.gif", { type: "image/gif" })]),
    ).rejects.toMatchObject({ code: "image_error_type" });
    expect(decode).not.toHaveBeenCalled();
    expect(useStore.getState().imageItems).toEqual([]);
    expect(useStore.getState().imageUrlMap.size).toBe(0);
    expect(createObjectURL).not.toHaveBeenCalled();
    const file = new File([createCollisionPng("red")], "label.png", {
      type: "image/png",
    });
    const originalRead = file.arrayBuffer.bind(file);
    const read = vi.spyOn(file, "arrayBuffer").mockImplementation(async () => {
      await readGate;
      return originalRead();
    });
    const upload = useStore.getState().addImageFiles([file]);
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());
    useStore.getState().setConfig({ rows: 2, cols: 3 });
    finishRead();
    await upload;

    const [item] = useStore.getState().imageItems;
    expect(item).toMatchObject({ file, count: 6 });
    expect(item.id).toBeTruthy();
    expect(useStore.getState().imageUrlMap.get(item.id)).toBe("blob:upload");
    expect(createObjectURL).toHaveBeenCalledExactlyOnceWith(file);
    expect(read).toHaveBeenCalledOnce();

    await expect(
      useStore
        .getState()
        .addImageFiles([new File(["bad"], "bad.gif", { type: "image/gif" })]),
    ).rejects.toMatchObject({ code: "image_error_type" });
    expect(useStore.getState().imageItems).toEqual([item]);
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(decode).not.toHaveBeenCalled();

    useStore.getState().setImageItems([]);
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:upload");
  });
});

describe("useStore text configuration", () => {
  it("sanitizes malformed persisted values during hydration", async () => {
    localStorage.setItem(
      "label-pilot-storage",
      JSON.stringify({
        state: {
          textConfig: {
            prefix: "资产-",
            startNumber: -50,
            digits: 999_999_999,
            count: "invalid",
            showQrCode: true,
            qrSizeRatio: 9,
            qrContentPrefix: "id:",
          },
          appMode: "text",
        },
        version: 0,
      }),
    );

    const { useStore } = await import("./useStore");

    expect(useStore.getState().textConfig).toEqual({
      prefix: "资产-",
      startNumber: 0,
      digits: 10,
      count: 10,
      showQrCode: true,
      qrSizeRatio: 0.6,
      qrContentPrefix: "id:",
    });
  });

  it("sanitizes every persisted layout field and writes a schema version", async () => {
    localStorage.setItem(
      "label-pilot-storage",
      JSON.stringify({
        state: {
          config: {
            rows: 999,
            cols: -2,
            marginMm: Number.NaN,
            spacingMm: 999,
            orientation: "sideways",
            pageWidthMm: 1,
            pageHeightMm: Number.POSITIVE_INFINITY,
          },
        },
        version: 1,
      }),
    );

    const { useStore, PERSIST_STORAGE_VERSION } = await import("./useStore");
    expect(useStore.getState().config).toEqual({
      rows: 10,
      cols: 1,
      marginMm: 10,
      spacingMm: 30,
      orientation: "landscape",
      pageWidthMm: 50,
      pageHeightMm: 297,
    });
    expect(useStore.getState().paperSizeMode).toBe("Custom");

    useStore.getState().setTheme("dark");
    expect(
      JSON.parse(localStorage.getItem("label-pilot-storage") ?? "{}").version,
    ).toBe(PERSIST_STORAGE_VERSION);
  });

  it("migrates legacy dimensions into an explicit paper mode", async () => {
    localStorage.setItem(
      "label-pilot-storage",
      JSON.stringify({
        state: {
          config: {
            rows: 3,
            cols: 3,
            marginMm: 10,
            spacingMm: 10,
            orientation: "landscape",
            pageWidthMm: 297,
            pageHeightMm: 420,
          },
        },
        version: 1,
      }),
    );

    const { useStore } = await import("./useStore");

    expect(useStore.getState().paperSizeMode).toBe("A3");
  });

  it("repairs persisted preset dimensions from the explicit mode", async () => {
    localStorage.setItem(
      "label-pilot-storage",
      JSON.stringify({
        state: {
          config: { pageWidthMm: 210, pageHeightMm: 297 },
          paperSizeMode: "A5",
        },
        version: 2,
      }),
    );

    const { useStore } = await import("./useStore");

    expect(useStore.getState()).toMatchObject({
      paperSizeMode: "A5",
      config: { pageWidthMm: 148, pageHeightMm: 210 },
    });
  });

  it("keeps custom mode across layout updates and hydration", async () => {
    const { useStore } = await import("./useStore");

    useStore.getState().setPaperSizeMode("Custom");
    useStore.getState().setConfig({ orientation: "portrait" });

    expect(useStore.getState().paperSizeMode).toBe("Custom");

    vi.resetModules();
    const { useStore: rehydratedStore } = await import("./useStore");
    expect(rehydratedStore.getState().paperSizeMode).toBe("Custom");

    rehydratedStore.getState().setPaperSizeMode("A5");
    expect(rehydratedStore.getState()).toMatchObject({
      paperSizeMode: "A5",
      config: { pageWidthMm: 148, pageHeightMm: 210 },
    });
  });

  it("offers a recovery path that removes persisted settings", async () => {
    const { resetPersistedSettings } = await import("./useStore");
    localStorage.setItem("label-pilot-storage", "broken");

    resetPersistedSettings();

    expect(localStorage.getItem("label-pilot-storage")).toBeNull();
  });

  it("sanitizes updates before publishing them to subscribers", async () => {
    const { useStore } = await import("./useStore");

    useStore.getState().setTextConfig({
      digits: Number.POSITIVE_INFINITY,
      count: -100,
      startNumber: 12.9,
    });

    expect(useStore.getState().textConfig).toMatchObject({
      digits: 3,
      count: 1,
      startNumber: 12,
    });
  });

  it("migrates screen calibration from version 2 and keeps valid data", async () => {
    localStorage.setItem(
      "label-pilot-storage",
      JSON.stringify({
        state: {
          config: { pageWidthMm: 210, pageHeightMm: 297 },
          paperSizeMode: "A4",
          screenCalibration: {
            k: 1.25,
            referenceMm: 100,
            measuredMm: 125,
            dpr: 1.25,
            screenWidth: 1536,
            screenHeight: 864,
            calibratedAt: "2026-08-05T00:00:00.000Z",
          },
        },
        version: 2,
      }),
    );

    const { useStore } = await import("./useStore");

    expect(useStore.getState().screenCalibration).toEqual({
      k: 1.25,
      referenceMm: 100,
      measuredMm: 125,
      dpr: 1.25,
      screenWidth: 1536,
      screenHeight: 864,
      calibratedAt: "2026-08-05T00:00:00.000Z",
    });
  });

  it("falls back to null for corrupted calibration during migration", async () => {
    localStorage.setItem(
      "label-pilot-storage",
      JSON.stringify({
        state: {
          config: { pageWidthMm: 210, pageHeightMm: 297 },
          paperSizeMode: "A4",
          screenCalibration: {
            k: "broken",
            referenceMm: 75,
            measuredMm: -3,
            dpr: 0,
            screenWidth: Number.POSITIVE_INFINITY,
            screenHeight: 864,
            calibratedAt: "nope",
          },
        },
        version: 2,
      }),
    );

    const { useStore } = await import("./useStore");

    expect(useStore.getState().screenCalibration).toBeNull();
  });

  it("saves and clears screen calibration", async () => {
    const { useStore } = await import("./useStore");

    const calibration = {
      k: 1.5,
      referenceMm: 50 as const,
      measuredMm: 75,
      dpr: 1,
      screenWidth: 1920,
      screenHeight: 1080,
      calibratedAt: "2026-08-05T00:00:00.000Z",
    };
    useStore.getState().setScreenCalibration(calibration);
    expect(useStore.getState().screenCalibration).toEqual(calibration);

    useStore.getState().setScreenCalibration(null);
    expect(useStore.getState().screenCalibration).toBeNull();
  });
});

describe("useStore grid preferences", () => {
  it.each([
    ["landscape", "portrait", "cols"],
    ["portrait", "landscape", "rows"],
  ] as const)(
    "restores %s preferences after temporary %s limits",
    async (original, temporary, dimension) => {
      const { useStore } = await import("./useStore");
      useStore.getState().setConfig({ orientation: original, [dimension]: 20 });
      useStore.getState().setConfig({ orientation: temporary });
      expect(useStore.getState().config[dimension]).toBe(10);
      expect(useStore.getState().gridPreferences[dimension]).toBe(20);
      useStore.getState().setConfig({ marginMm: 1, spacingMm: 0 });
      useStore.getState().setPaperSizeMode("A3");
      useStore.getState().setConfig({ pageWidthMm: 300 });
      useStore.getState().setConfig({ orientation: original });
      expect(useStore.getState().config[dimension]).toBe(20);
      expect(useStore.getState().paperSizeMode).toBe("Custom");
    },
  );

  it("edits one preference without overwriting the other clamped dimension", async () => {
    const { useStore } = await import("./useStore");
    useStore.getState().setConfig({ cols: 20 });
    useStore.getState().setConfig({ orientation: "portrait" });
    useStore.getState().setConfig({ rows: 20 });
    expect(useStore.getState().gridPreferences).toEqual({ rows: 20, cols: 20 });
    useStore.getState().setConfig({ orientation: "landscape" });
    expect(useStore.getState().config).toMatchObject({ rows: 10, cols: 20 });
    useStore.getState().setConfig({ cols: 7 });
    useStore.getState().setConfig({ orientation: "portrait" });
    expect(useStore.getState().config).toMatchObject({ rows: 20, cols: 7 });
    useStore.getState().setConfig({ rows: 5 });
    useStore.getState().setConfig({ orientation: "landscape" });
    expect(useStore.getState().gridPreferences).toEqual({ rows: 5, cols: 7 });
  });

  it("keeps clamped preferences across reload", async () => {
    const { useStore } = await import("./useStore");
    useStore.getState().setConfig({ cols: 20, spacingMm: 0 });
    useStore.getState().setConfig({ orientation: "portrait" });
    vi.resetModules();
    const { useStore: restored } = await import("./useStore");
    expect(restored.getState().config.cols).toBe(10);
    expect(restored.getState().gridPreferences.cols).toBe(20);
    restored.getState().setConfig({ orientation: "landscape" });
    expect(restored.getState().config.cols).toBe(20);
  });

  it.each([0, 3])(
    "initializes version %s preferences only from its effective grid",
    async (version) => {
      localStorage.setItem(
        "label-pilot-storage",
        JSON.stringify({
          version,
          state: {
            config: { orientation: "portrait", rows: 20, cols: 10 },
            gridPreferences: { rows: 20, cols: 20 },
          },
        }),
      );
      const { useStore } = await import("./useStore");
      expect(useStore.getState().gridPreferences).toEqual({
        rows: 20,
        cols: 10,
      });
      useStore.getState().setConfig({ orientation: "landscape" });
      expect(useStore.getState().config.cols).toBe(10);
    },
  );

  it.each([
    [
      { rows: -5, cols: 999 },
      { rows: 1, cols: 20 },
    ],
    [
      { rows: 3.9, cols: "20" },
      { rows: 3, cols: 7 },
    ],
    [
      { rows: null, cols: {} },
      { rows: 6, cols: 7 },
    ],
    [null, { rows: 6, cols: 7 }],
    [{ rows: 20 }, { rows: 20, cols: 7 }],
  ])(
    "cleans malformed current-version preferences %j",
    async (gridPreferences, expected) => {
      localStorage.setItem(
        "label-pilot-storage",
        JSON.stringify({
          version: 4,
          state: {
            config: { orientation: "portrait", rows: 6, cols: 7 },
            gridPreferences,
          },
        }),
      );
      const { useStore } = await import("./useStore");
      expect(useStore.getState().gridPreferences).toEqual(expected);
      expect(useStore.getState().config).toMatchObject({
        rows: expected.rows,
        cols: Math.min(10, expected.cols),
      });
    },
  );

  it("bounds explicit edits globally and ignores nonfinite values", async () => {
    const { useStore } = await import("./useStore");
    useStore.getState().setConfig({ rows: 999, cols: -2 });
    expect(useStore.getState().gridPreferences).toEqual({ rows: 20, cols: 1 });
    expect(useStore.getState().config).toMatchObject({ rows: 10, cols: 1 });
    useStore.getState().setConfig({ rows: NaN, cols: Infinity });
    expect(useStore.getState().gridPreferences).toEqual({ rows: 20, cols: 1 });
  });
});
