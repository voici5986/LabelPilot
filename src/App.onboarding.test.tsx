// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import App from "./App";
import { useStore } from "./store/useStore";
import { AppError } from "./utils/appError";
import { I18nProvider } from "./utils/i18n";
import { DEFAULT_LAYOUT_CONFIG, DEFAULT_TEXT_CONFIG } from "./utils/layoutMath";
import { translations } from "./utils/translations";

const generatePDF = vi.hoisted(() => vi.fn());
const testFile = new File(["image"], "label.png", { type: "image/png" });
vi.mock("./utils/pdfGenerator", () => ({ generatePDF }));
vi.mock("./components/Header", () => ({ Header: () => null }));
vi.mock("./components/ReloadPrompt", () => ({ ReloadPrompt: () => null }));
vi.mock("./components/CalibrationDialog", () => ({
  CalibrationDialog: () => null,
}));
vi.mock("./components/MobileActionBar", () => ({
  MobileActionBar: () => null,
}));
vi.mock("./components/ControlPanel", () => ({
  ControlPanel: ({ onGeneratePdf }: { onGeneratePdf: () => void }) => (
    <button onClick={onGeneratePdf}>generate</button>
  ),
}));
vi.mock("./components/PreviewPanel", () => ({
  PreviewPanel: ({
    onFilesSelect,
    onStartNumbering,
  }: {
    onFilesSelect: (files: File[]) => void;
    onStartNumbering: () => void;
  }) => (
    <>
      <button onClick={onStartNumbering}>numbering</button>
      <button onClick={() => onFilesSelect([testFile])}>upload</button>
    </>
  ),
}));
vi.mock("./components/EditSheet", () => ({
  EditSheet: ({ open }: { open: boolean }) => (
    <output aria-label="edit open">{String(open)}</output>
  ),
}));
vi.mock("./components/Toast", () => ({
  Toast: ({ message }: { message: string }) => (
    <output aria-label="toast">{message}</output>
  ),
}));

beforeEach(() => {
  localStorage.clear();
  useStore.setState({
    config: DEFAULT_LAYOUT_CONFIG,
    textConfig: { ...DEFAULT_TEXT_CONFIG, prefix: "SAVED-" },
    appMode: "image",
    imageItems: [],
    imageUrlMap: new Map(),
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useStore.setState({
    config: DEFAULT_LAYOUT_CONFIG,
    textConfig: DEFAULT_TEXT_CONFIG,
    appMode: "image",
  });
});

function mount(desktop: boolean) {
  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: media === "(min-width: 1024px)" && desktop,
    media,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  return render(
    <I18nProvider>
      <App />
    </I18nProvider>,
  );
}

it.each([false, true])(
  "selects numbered mode and opens editing only on mobile (desktop %s)",
  (desktop) => {
    mount(desktop);
    fireEvent.click(screen.getByText("numbering"));
    expect(useStore.getState().appMode).toBe("text");
    expect(useStore.getState().textConfig.prefix).toBe("SAVED-");
    expect(screen.getByLabelText("edit open").textContent).toBe(
      String(!desktop),
    );
  },
);

it("shares upload validation errors and blocks onboarding mutations during generation", async () => {
  const addImageFiles = vi
    .spyOn(useStore.getState(), "addImageFiles")
    .mockRejectedValue(new AppError("image_error_empty"));
  let complete!: () => void;
  generatePDF.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  mount(false);
  fireEvent.click(screen.getByText("upload"));
  await waitFor(() =>
    expect(screen.getByLabelText("toast").textContent).toBe(
      translations.zh.image_error_empty,
    ),
  );
  expect(addImageFiles).toHaveBeenCalledWith([testFile]);
  fireEvent.click(screen.getByText("generate"));
  fireEvent.click(screen.getByText("upload"));
  fireEvent.click(screen.getByText("numbering"));
  expect(addImageFiles).toHaveBeenCalledTimes(1);
  expect(useStore.getState().appMode).toBe("image");
  expect(screen.getByLabelText("edit open").textContent).toBe("false");
  await act(async () => complete());
});
