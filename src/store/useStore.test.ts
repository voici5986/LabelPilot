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
});
