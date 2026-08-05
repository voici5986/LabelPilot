// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  localStorage.clear();
  vi.resetModules();
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
