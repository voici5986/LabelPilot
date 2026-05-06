// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "../utils/i18n";
import { PreviewPanel } from "./PreviewPanel";
import { useStore } from "../store/useStore";
import { A4_HEIGHT_MM, A4_WIDTH_MM } from "../utils/layoutMath";

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
    render(
      <I18nProvider>
        <PreviewPanel />
      </I18nProvider>,
    );

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

    render(
      <I18nProvider>
        <PreviewPanel />
      </I18nProvider>,
    );

    expect(document.querySelector("svg")).not.toBeNull();
    expect(screen.getByText("SN-001")).not.toBeNull();
  });
});
