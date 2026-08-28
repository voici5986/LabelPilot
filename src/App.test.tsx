// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { I18nProvider } from "./utils/i18n";

const generatePDF = vi.hoisted(() => vi.fn());

vi.mock("./utils/pdfGenerator", () => ({ generatePDF }));
vi.mock("./components/Header", () => ({ Header: () => null }));
vi.mock("./components/PreviewPanel", () => ({ PreviewPanel: () => null }));
vi.mock("./components/MobileActionBar", () => ({
  MobileActionBar: () => null,
}));
vi.mock("./components/EditSheet", () => ({ EditSheet: () => null }));
vi.mock("./components/CalibrationDialog", () => ({
  CalibrationDialog: () => null,
}));
vi.mock("./components/Toast", () => ({ Toast: () => null }));
vi.mock("./components/ReloadPrompt", () => ({ ReloadPrompt: () => null }));
vi.mock("./components/ControlPanel", () => ({
  ControlPanel: ({
    onGeneratePdf,
    genStatus,
  }: {
    onGeneratePdf: () => void;
    genStatus: string;
  }) => (
    <>
      <output aria-label="generation status">{genStatus}</output>
      <button type="button" onClick={onGeneratePdf}>
        generate
      </button>
    </>
  ),
}));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("App PDF generation state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    generatePDF.mockReset();
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not let a previous success timer reset a new generation", async () => {
    const first = deferred();
    const second = deferred();
    generatePDF
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    render(
      <I18nProvider>
        <App />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "generate" }));
    expect(screen.getByLabelText("generation status").textContent).toBe(
      "generating",
    );

    await act(async () => first.resolve());
    expect(screen.getByLabelText("generation status").textContent).toBe(
      "success",
    );

    fireEvent.click(screen.getByRole("button", { name: "generate" }));
    expect(screen.getByLabelText("generation status").textContent).toBe(
      "generating",
    );

    await act(async () => vi.advanceTimersByTimeAsync(2_500));
    expect(screen.getByLabelText("generation status").textContent).toBe(
      "generating",
    );

    await act(async () => second.resolve());
  });
});
