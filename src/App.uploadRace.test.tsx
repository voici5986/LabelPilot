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
import { useStore } from "./store/useStore";
import { I18nProvider } from "./utils/i18n";

const validateImageFiles = vi.hoisted(() => vi.fn());
const validateImageFileContents = vi.hoisted(() => vi.fn());

vi.mock("./utils/imageLimits", () => ({
  IMAGE_LIMITS: { maxTotalLabels: 5_000 },
  getImageLabelCount: (items: Array<{ count: number }>) =>
    items.reduce((sum, item) => {
      const count = Number.isFinite(item.count) ? Math.trunc(item.count) : 1;
      return sum + Math.min(999, Math.max(1, count));
    }, 0),
  validateImageFiles,
  validateImageFileContents,
}));
vi.mock("./utils/pdfGenerator", () => ({ generatePDF: vi.fn() }));
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
    onFilesSelect,
  }: {
    onFilesSelect: (files: File[]) => void | Promise<void>;
  }) => (
    <>
      <button
        type="button"
        onClick={() =>
          void onFilesSelect([new File(["a"], "a.png", { type: "image/png" })])
        }
      >
        add-a
      </button>
      <button
        type="button"
        onClick={() =>
          void onFilesSelect([new File(["b"], "b.png", { type: "image/png" })])
        }
      >
        add-b
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

beforeEach(() => {
  localStorage.clear();
  validateImageFiles.mockReset();
  validateImageFileContents.mockReset();
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:preview"),
    revokeObjectURL: vi.fn(),
  });
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
  useStore.setState({ imageItems: [], imageUrlMap: new Map() });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useStore.setState({ imageItems: [], imageUrlMap: new Map() });
});

describe("App image upload concurrency", () => {
  it("appends both selections when validation resolves concurrently", async () => {
    const first = deferred();
    const second = deferred();
    validateImageFileContents
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    render(
      <I18nProvider>
        <App />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "add-a" }));
    fireEvent.click(screen.getByRole("button", { name: "add-b" }));

    await act(async () => first.resolve());
    await act(async () => second.resolve());

    expect(
      useStore.getState().imageItems.map((item) => item.file.name),
    ).toEqual(["a.png", "b.png"]);
  });
});
