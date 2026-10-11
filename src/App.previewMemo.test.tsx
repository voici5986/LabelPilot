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
import { useI18n } from "./utils/i18nContext";
import { DEFAULT_LAYOUT_CONFIG, DEFAULT_TEXT_CONFIG } from "./utils/layoutMath";
import { generatePDF } from "./utils/pdfGenerator";
import type { PdfProgressUpdate } from "./utils/pdfProgress";

const qrRender = vi.hoisted(() => vi.fn());
vi.mock("./components/QrCodeSvg", () => ({
  QrCodeSvg: () => {
    qrRender();
    return null;
  },
}));
vi.mock("./components/ControlPanel", () => ({
  ControlPanel: ({ onGeneratePdf }: { onGeneratePdf: () => void }) => (
    <button onClick={onGeneratePdf}>Generate</button>
  ),
}));
vi.mock("./components/Header", () => ({ Header: () => null }));
vi.mock("./components/MobileActionBar", () => ({
  MobileActionBar: () => null,
}));
vi.mock("./components/EditSheet", () => ({ EditSheet: () => null }));
vi.mock("./components/CalibrationDialog", () => ({
  CalibrationDialog: () => null,
}));
vi.mock("./components/ReloadPrompt", () => ({ ReloadPrompt: () => null }));
vi.mock("./components/Toast", () => ({ Toast: () => null }));
vi.mock("./utils/pdfGenerator", () => ({ generatePDF: vi.fn() }));

function LanguageSwitch() {
  const { setLanguage } = useI18n();
  return <button onClick={() => setLanguage("en")}>English</button>;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  localStorage.clear();
  useStore.setState({
    config: DEFAULT_LAYOUT_CONFIG,
    textConfig: DEFAULT_TEXT_CONFIG,
    appMode: "image",
  });
});

it("isolates preview slots from generation progress while preserving store, zoom and language updates", async () => {
  localStorage.clear();
  useStore.setState({
    config: { ...DEFAULT_LAYOUT_CONFIG, rows: 1, cols: 1 },
    textConfig: { ...DEFAULT_TEXT_CONFIG, count: 1, showQrCode: true },
    appMode: "text",
  });
  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: false,
    media,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  let complete!: () => void;
  const pending = new Promise<void>((resolve) => {
    complete = resolve;
  });
  let progress!: (value: PdfProgressUpdate) => void;
  vi.mocked(generatePDF).mockImplementation(
    async (_config, _images, _mode, _text, onProgress) => {
      progress = onProgress!;
      await pending;
    },
  );
  render(
    <I18nProvider>
      <App />
      <LanguageSwitch />
    </I18nProvider>,
  );
  const initialRenders = qrRender.mock.calls.length;
  expect(initialRenders).toBeGreaterThan(0);
  fireEvent.click(screen.getByText("Generate"));
  for (const percent of [25, 50, 75]) {
    act(() => {
      progress({ percent, phase: "rendering" });
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((callback) => callback(0));
    });
  }
  expect(qrRender).toHaveBeenCalledTimes(initialRenders);
  await act(async () => {
    complete();
    await pending;
  });
  expect(qrRender).toHaveBeenCalledTimes(initialRenders);

  act(() => useStore.getState().setTextConfig({ prefix: "EDIT-" }));
  expect(screen.getByText("EDIT-001")).toBeTruthy();
  expect(qrRender.mock.calls.length).toBeGreaterThan(initialRenders);
  const beforeZoom = qrRender.mock.calls.length;
  fireEvent.keyDown(screen.getByRole("slider", { name: "缩放级别" }), {
    key: "ArrowUp",
  });
  expect(qrRender.mock.calls.length).toBeGreaterThan(beforeZoom);
  fireEvent.click(screen.getByText("English"));
  expect(screen.getByRole("region", { name: "Page preview" })).toBeTruthy();
});
