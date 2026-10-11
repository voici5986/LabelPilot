// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import App from "./App";
import { useStore } from "./store/useStore";
import { I18nProvider } from "./utils/i18n";
import { DEFAULT_LAYOUT_CONFIG, DEFAULT_TEXT_CONFIG } from "./utils/layoutMath";

const create = vi.hoisted(() =>
  vi.fn(() => ({ modules: { size: 21, get: () => 0 } })),
);
vi.mock("qrcode", () => ({ default: { create } }));
vi.mock("./components/PreviewPanel", () => ({ PreviewPanel: () => null }));
vi.mock("./components/Header", () => ({ Header: () => null }));
vi.mock("./components/CalibrationDialog", () => ({
  CalibrationDialog: () => null,
}));
vi.mock("./components/ReloadPrompt", () => ({ ReloadPrompt: () => null }));
vi.mock("./utils/pdfGenerator", () => ({ generatePDF: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useStore.setState({
    config: DEFAULT_LAYOUT_CONFIG,
    textConfig: DEFAULT_TEXT_CONFIG,
    appMode: "image",
  });
});

it("computes QR readiness once per edit with both desktop and open mobile controls", () => {
  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: false,
    media,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  useStore.setState({
    config: { ...DEFAULT_LAYOUT_CONFIG, rows: 1, cols: 1 },
    textConfig: { ...DEFAULT_TEXT_CONFIG, showQrCode: true },
    appMode: "text",
  });
  create.mockClear();
  render(
    <I18nProvider>
      <App />
    </I18nProvider>,
  );
  expect(create).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "编辑" }));
  expect(screen.getByRole("dialog", { name: "编辑" })).toBeTruthy();
  expect(create).toHaveBeenCalledTimes(1);
  act(() => useStore.getState().setTextConfig({ prefix: "EDIT-" }));
  expect(create).toHaveBeenCalledTimes(2);
});
