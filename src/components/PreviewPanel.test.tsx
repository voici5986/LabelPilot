// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStore } from "../store/useStore";
import { I18nProvider } from "../utils/i18n";
import { A4_HEIGHT_MM, A4_WIDTH_MM } from "../utils/layoutMath";
import { PreviewPanel } from "./PreviewPanel";

const defaultConfig = {
  rows: 1,
  cols: 1,
  marginMm: 10,
  spacingMm: 0,
  orientation: "portrait" as const,
  pageWidthMm: A4_WIDTH_MM,
  pageHeightMm: A4_HEIGHT_MM,
};

const defaultTextConfig = {
  prefix: "SN-",
  startNumber: 1,
  digits: 3,
  count: 10,
  showQrCode: false,
  qrSizeRatio: 0.35,
  qrContentPrefix: "",
};

function resetStore() {
  useStore.setState({
    config: defaultConfig,
    textConfig: defaultTextConfig,
    appMode: "text",
    theme: "system",
    imageItems: [],
    imageUrlMap: new Map(),
  });
}

function renderPanel() {
  return render(
    <I18nProvider>
      <PreviewPanel
        zoomMode="fit"
        manualScale={1}
        onZoomModeChange={vi.fn()}
        onManualScaleChange={vi.fn()}
        onRequestActual={vi.fn()}
      />
    </I18nProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  resetStore();
});

afterEach(() => {
  cleanup();
  resetStore();
});

describe("PreviewPanel", () => {
  it("supports next-page navigation and direct page input", () => {
    renderPanel();

    const pageInput = screen.getByRole("textbox", { name: "第 1 / 10 页" });
    expect(pageInput).toHaveProperty("value", "1");

    fireEvent.click(screen.getByTitle("下一页"));
    expect(pageInput).toHaveProperty("value", "2");

    fireEvent.change(pageInput, { target: { value: "5" } });
    fireEvent.blur(pageInput);
    expect(pageInput).toHaveProperty("value", "5");

    fireEvent.change(pageInput, { target: { value: "99" } });
    fireEvent.blur(pageInput);
    expect(pageInput).toHaveProperty("value", "10");
  });

  it("renders QR preview when QR mode is enabled", () => {
    useStore.setState({
      textConfig: {
        ...defaultTextConfig,
        showQrCode: true,
        qrContentPrefix: "https://example.test/item/",
      },
    });

    renderPanel();

    expect(document.querySelector("svg")).not.toBeNull();
    expect(screen.getByText("SN-001")).not.toBeNull();
  });

  it("keeps the stored page index clamped when page count shrinks", () => {
    renderPanel();

    const pageInput = screen.getByRole("textbox", { name: "第 1 / 10 页" });
    fireEvent.change(pageInput, { target: { value: "10" } });
    fireEvent.blur(pageInput);

    act(() => useStore.getState().setTextConfig({ count: 2 }));
    expect(pageInput).toHaveProperty("value", "2");

    act(() => useStore.getState().setTextConfig({ count: 10 }));
    expect(pageInput).toHaveProperty("value", "2");
  });
});
