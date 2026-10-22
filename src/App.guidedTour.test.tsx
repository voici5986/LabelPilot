// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { ZoomControl } from "./components/ZoomControl";
import { useStore, PERSIST_STORAGE_KEY } from "./store/useStore";
import { LEGACY_QUICK_SETUP_SEEN_KEY, TOUR_SEEN_KEY } from "./utils/guidedTour";
import { I18nProvider } from "./utils/i18n";
import { DEFAULT_LAYOUT_CONFIG, DEFAULT_TEXT_CONFIG } from "./utils/layoutMath";

const generatePDF = vi.hoisted(() => vi.fn());
vi.mock("./utils/pdfGenerator", () => ({ generatePDF }));
vi.mock("./components/ReloadPrompt", () => ({ ReloadPrompt: () => null }));
vi.mock("./components/PreviewPanel", () => ({
  PreviewPanel: ({
    onStartNumbering,
    ...zoomProps
  }: ComponentProps<typeof ZoomControl> & {
    onStartNumbering: () => void;
  }) => (
    <section data-tour="preview" tabIndex={-1}>
      <button onClick={onStartNumbering}>Start numbers</button>
      <ZoomControl {...zoomProps} />
    </section>
  ),
}));
// Keep real control/sheet/guide/tour components; only the expensive paper renderer and PDF are replaced.
let mobile = false;
let mediaListeners: Set<() => void>;
function resize(nextMobile: boolean) {
  act(() => {
    mobile = nextMobile;
    mediaListeners.forEach((listener) => listener());
  });
}
function mount() {
  return render(
    <I18nProvider>
      <App />
    </I18nProvider>,
  );
}
function tour() {
  return document.querySelector<HTMLElement>("[data-tour-overlay]")!;
}
function next() {
  fireEvent.click(within(tour()).getByRole("button", { name: "Next" }));
}
async function replay() {
  fireEvent.click(screen.getByRole("button", { name: "User guide" }));
  fireEvent.click(screen.getByRole("button", { name: "Replay tour" }));
  await waitFor(() => expect(tour()).not.toBeNull());
}
beforeEach(() => {
  localStorage.clear();
  useStore.setState({
    config: { ...DEFAULT_LAYOUT_CONFIG },
    gridPreferences: {
      rows: DEFAULT_LAYOUT_CONFIG.rows,
      cols: DEFAULT_LAYOUT_CONFIG.cols,
    },
    textConfig: { ...DEFAULT_TEXT_CONFIG },
    appMode: "image",
    theme: "system",
    paperSizeMode: "A4",
    imageItems: [],
    imageUrlMap: new Map(),
    screenCalibration: null,
  });
  localStorage.clear();
  localStorage.setItem("label_printer_lang", "en");
  mobile = false;
  mediaListeners = new Set();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query === "(min-width: 1024px)" && !mobile;
    },
    media: query,
    addEventListener: (_: string, listener: () => void) => {
      if (query === "(min-width: 1024px)") mediaListeners.add(listener);
    },
    removeEventListener: (_: string, listener: () => void) =>
      mediaListeners.delete(listener),
  }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(0), 0),
  );
  vi.stubGlobal("cancelAnimationFrame", window.clearTimeout);
  generatePDF.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("App guided tour", () => {
  it("restores preview focus when auto-start captured a measurable document body", async () => {
    vi.spyOn(document.body, "getClientRects").mockReturnValue([
      { width: 1024 },
    ] as unknown as DOMRectList);
    mount();
    const preview = document.querySelector<HTMLElement>(
      '[data-tour="preview"]',
    )!;
    vi.spyOn(preview, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 800, 600),
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(tour()).getByRole("button", { name: "Next" }),
      ),
    );
    fireEvent.click(within(tour()).getByRole("button", { name: "Close tour" }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        document.querySelector('[data-tour="preview"]'),
      ),
    );
  });
  it("captures initial focus before auto-start and restores it on dismissal", async () => {
    const initial = document.createElement("button");
    initial.textContent = "Initial control";
    document.body.append(initial);
    vi.spyOn(initial, "getClientRects").mockReturnValue([
      { width: 44 },
    ] as unknown as DOMRectList);
    initial.focus();
    try {
      mount();
      await waitFor(() =>
        expect(document.activeElement).toBe(
          within(tour()).getByRole("button", { name: "Next" }),
        ),
      );
      fireEvent.click(
        within(tour()).getByRole("button", { name: "Close tour" }),
      );
      await waitFor(() => expect(document.activeElement).toBe(initial));
    } finally {
      initial.remove();
    }
  });
  it("closes a tutorial-opened mobile sheet while retaining user content and settings", async () => {
    mobile = true;
    useStore.getState().setAppMode("text");
    localStorage.removeItem(PERSIST_STORAGE_KEY);
    mount();
    next();
    await waitFor(() =>
      expect(tour()?.textContent).toContain("Create your numbers"),
    );
    const sheet = screen.getByRole("dialog", { name: "Edit" });
    const prefix = within(sheet).getByRole("textbox", { name: "Prefix" });
    fireEvent.change(prefix, { target: { value: "USER-" } });
    fireEvent.click(
      within(sheet).getByRole("button", { name: "Toggle panel size" }),
    );
    fireEvent.click(within(tour()).getByRole("button", { name: "Close tour" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Edit" })).toBeNull(),
    );
    expect(useStore.getState().textConfig.prefix).toBe("USER-");
    expect(useStore.getState().appMode).toBe("text");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(
      screen
        .getByRole("button", { name: "Toggle panel size" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });
  it("keeps an existing seen marker when replay is interrupted by Help", async () => {
    localStorage.setItem(TOUR_SEEN_KEY, "already-seen");
    mount();
    await replay();
    fireEvent.click(screen.getByRole("button", { name: "User guide" }));
    expect(tour()).toBeNull();
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBe("already-seen");
  });
  it("walks five desktop steps without changing settings or generating output, then remembers completion", () => {
    const before = useStore.getState();
    const { unmount } = mount();
    expect(
      within(tour()).getByRole("heading", { name: "Add your images" }),
    ).toBeTruthy();
    next();
    expect(tour().textContent).toContain("Arrange the sheet");
    next();
    expect(tour().textContent).toContain("Check your preview");
    next();
    expect(tour().textContent).toContain("Zoom and 1:1");
    next();
    expect(tour().textContent).toContain("Generate and print");
    fireEvent.click(within(tour()).getByRole("button", { name: "Done" }));
    expect(tour()).toBeNull();
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBe("1");
    const after = useStore.getState();
    for (const key of [
      "config",
      "textConfig",
      "appMode",
      "gridPreferences",
      "paperSizeMode",
      "imageItems",
      "theme",
      "screenCalibration",
    ] as const)
      expect(after[key]).toBe(before[key]);
    expect(generatePDF).not.toHaveBeenCalled();
    unmount();
    mount();
    expect(tour()).toBeNull();
  });
  it.each([TOUR_SEEN_KEY, PERSIST_STORAGE_KEY, LEGACY_QUICK_SETUP_SEEN_KEY])(
    "does not auto-open when %s exists, but allows replay",
    async (key) => {
      localStorage.setItem(key, "1");
      mount();
      expect(tour()).toBeNull();
      await replay();
      expect(tour().textContent).toContain("Add your images");
      fireEvent.click(within(tour()).getByRole("button", { name: "Skip" }));
      expect(tour()).toBeNull();
    },
  );
  it("keeps direct mode and text edits made during navigation", () => {
    mount();
    // CSS is not loaded in jsdom; restrict the interaction to the real desktop controls.
    const desktop = document.querySelector("aside")!;
    fireEvent.click(
      within(desktop).getByRole("button", { name: "Auto Number" }),
    );
    expect(tour().textContent).toContain("Create your numbers");
    const input = within(desktop).getByRole("textbox", { name: "Prefix" });
    fireEvent.change(input, { target: { value: "CUSTOM-" } });
    next();
    next();
    fireEvent.click(within(tour()).getByRole("button", { name: "Close tour" }));
    expect(useStore.getState().appMode).toBe("text");
    expect(useStore.getState().textConfig.prefix).toBe("CUSTOM-");
  });
  it("does not steal focus intentionally left on an existing input when closed", async () => {
    localStorage.setItem(TOUR_SEEN_KEY, "1");
    mount();
    await replay();
    const input = document.querySelector<HTMLInputElement>("aside input")!;
    input.focus();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(tour()).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(document.activeElement).toBe(input);
  });
  it("opens mobile editing steps inside the modal root and returns to preview", async () => {
    mobile = true;
    mount();
    expect(tour().textContent).toContain("Open the editor");
    next();
    await waitFor(() =>
      expect(tour()?.textContent).toContain("Add your images"),
    );
    const sheet = screen.getByRole("dialog", { name: "Edit" });
    expect(sheet.contains(tour())).toBe(true);
    expect(screen.getByTestId("edit-sheet-panel").contains(tour())).toBe(true);
    next();
    expect(tour().textContent).toContain("Arrange the sheet");
    fireEvent.click(
      within(sheet).getByRole("button", { name: "View Preview" }),
    );
    expect(tour().textContent).toContain("Check your preview");
    expect(tour().parentElement).toBe(document.body);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(tour()).toBeNull();
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBe("1");
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Edit" })).toBeNull(),
    );
  });
  it("routes the actual mobile Edit and numbering actions to content", async () => {
    mobile = true;
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    await waitFor(() =>
      expect(tour()?.textContent).toContain("Add your images"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Start numbers" }));
    expect(tour().textContent).toContain("Create your numbers");
    expect(useStore.getState().appMode).toBe("text");
  });
  it.each([false, true])(
    "restores focus after a focused sheet input exits (replay: %s)",
    async (manualReplay) => {
      mobile = true;
      useStore.getState().setAppMode("text");
      localStorage.removeItem(PERSIST_STORAGE_KEY);
      if (manualReplay) localStorage.setItem(TOUR_SEEN_KEY, "1");
      mount();
      const launcher = screen.getByRole("button", { name: "User guide" });
      if (manualReplay) {
        vi.spyOn(launcher, "getClientRects").mockReturnValue([
          { width: 44 },
        ] as unknown as DOMRectList);
        launcher.focus();
        await replay();
      }
      next();
      await waitFor(() =>
        expect(tour()?.textContent).toContain("Create your numbers"),
      );
      await waitFor(() =>
        expect(document.activeElement).toBe(
          within(tour()).getByRole("button", { name: "Next" }),
        ),
      );
      const input = within(
        screen.getByRole("dialog", { name: "Edit" }),
      ).getByRole("textbox", { name: "Prefix" });
      input.focus();
      fireEvent.keyDown(input, { key: "Escape" });
      expect(tour()).toBeNull();
      // Real motion exit retains the focused input for 180ms after open=false.
      expect(input.isConnected).toBe(true);
      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "Edit" })).toBeNull(),
      );
      await waitFor(() => expect(document.activeElement).toBe(launcher));
    },
  );
  it("preserves focus deliberately moved outside the closing sheet before restoration", async () => {
    mobile = true;
    useStore.getState().setAppMode("text");
    localStorage.removeItem(PERSIST_STORAGE_KEY);
    mount();
    next();
    await waitFor(() =>
      expect(tour()?.textContent).toContain("Create your numbers"),
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(tour()).getByRole("button", { name: "Next" }),
      ),
    );
    const input = within(
      screen.getByRole("dialog", { name: "Edit" }),
    ).getByRole("textbox", { name: "Prefix" });
    input.focus();
    fireEvent.keyDown(input, { key: "Escape" });
    const stableControl = screen.getByRole("button", { name: "Start numbers" });
    stableControl.focus();
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Edit" })).toBeNull(),
    );
    expect(document.activeElement).toBe(stableControl);
  });
  it("restores the original full mobile sheet after replay and respects a consumed input Escape", async () => {
    mobile = true;
    localStorage.setItem(TOUR_SEEN_KEY, "1");
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle panel size" }));
    expect(
      screen
        .getByRole("button", { name: "Toggle panel size" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    await replay();
    next();
    await waitFor(() =>
      expect(tour()?.textContent).toContain("Add your images"),
    );
    const sheet = screen.getByRole("dialog", { name: "Edit" });
    expect(
      within(sheet)
        .getByRole("button", { name: "Toggle panel size" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    const input = within(sheet).getByRole("spinbutton", { name: "Rows" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "7" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(tour()).not.toBeNull();
    fireEvent.keyDown(within(tour()).getByRole("button", { name: "Next" }), {
      key: "Escape",
    });
    expect(tour()).toBeNull();
    expect(screen.getByRole("dialog", { name: "Edit" })).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Toggle panel size" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
  it("restores the stable guide launcher after replay exits", async () => {
    localStorage.setItem(TOUR_SEEN_KEY, "1");
    mount();
    const launcher = screen.getByRole("button", { name: "User guide" });
    vi.spyOn(launcher, "getClientRects").mockReturnValue([
      { width: 44 },
    ] as unknown as DOMRectList);
    launcher.focus();
    await replay();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(tour()).getByRole("button", { name: "Next" }),
      ),
    );
    fireEvent.click(within(tour()).getByRole("button", { name: "Close tour" }));
    await waitFor(() => expect(document.activeElement).toBe(launcher));
  });
  it("ends the active tour before opening Help and leaves modal focus there", async () => {
    mount();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(tour()).getByRole("button", { name: "Next" }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "User guide" }));
    expect(tour()).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Close user guide" }),
      ),
    );
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBeNull();
  });
  it("interrupts the tour for explicit calibration from Settings without marking it seen", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Screen 1:1 calibration/ }),
    );
    expect(tour()).toBeNull();
    const calibration = screen.getByRole("dialog", {
      name: "Screen 1:1 Calibration",
    });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(calibration).getByRole("spinbutton"),
      ),
    );
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBeNull();
  });
  it("ends the zoom step before opening actual-size calibration and focuses its measurement input", async () => {
    mount();
    next();
    next();
    next();
    expect(tour().textContent).toContain("Zoom and 1:1");
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(tour()).getByRole("button", { name: "Next" }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "1:1 Actual Size" }));
    expect(tour()).toBeNull();
    const calibration = screen.getByRole("dialog", {
      name: "Screen 1:1 Calibration",
    });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(calibration).getByRole("spinbutton"),
      ),
    );
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBeNull();
  });
  it("keeps semantic steps across the desktop breakpoint", async () => {
    mobile = true;
    mount();
    resize(false);
    expect(tour().textContent).toContain("Add your images");
    next();
    resize(true);
    await waitFor(() =>
      expect(tour()?.textContent).toContain("Arrange the sheet"),
    );
    expect(screen.getByRole("dialog", { name: "Edit" }).contains(tour())).toBe(
      true,
    );
    resize(false);
    expect(tour().textContent).toContain("Arrange the sheet");
    expect(tour().textContent).toContain("2 / 5");
  });
  it("keeps the zoom step active when an existing calibration enables actual size", () => {
    useStore.setState({
      screenCalibration: {
        k: 1,
        referenceMm: 100,
        measuredMm: 100,
        dpr: window.devicePixelRatio || 1,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        calibratedAt: new Date().toISOString(),
      },
    });
    localStorage.removeItem(PERSIST_STORAGE_KEY);
    mount();
    next();
    next();
    next();
    const actual = screen.getByRole("button", { name: "1:1 Actual Size" });
    fireEvent.click(actual);
    expect(actual.getAttribute("aria-pressed")).toBe("true");
    expect(tour().textContent).toContain("Zoom and 1:1");
    expect(
      screen.queryByRole("dialog", { name: "Screen 1:1 Calibration" }),
    ).toBeNull();
    next();
    expect(tour().textContent).toContain("Generate and print");
  });
  it("uses the mobile preview for a desktop zoom step and preserves valid responsive navigation", async () => {
    mount();
    next();
    next();
    next();
    expect(tour().textContent).toContain("Zoom and 1:1");
    resize(true);
    expect(tour().textContent).toContain("Check your preview");
    expect(tour().textContent).toContain("4 / 5");
    resize(false);
    expect(tour().textContent).toContain("Zoom and 1:1");
    resize(true);
    next();
    expect(tour().textContent).toContain("Generate and print");
    fireEvent.click(within(tour()).getByRole("button", { name: "Back" }));
    expect(tour().textContent).toContain("Check your preview");
    fireEvent.click(within(tour()).getByRole("button", { name: "Back" }));
    await waitFor(() =>
      expect(tour()?.textContent).toContain("Arrange the sheet"),
    );
    expect(screen.getByRole("dialog", { name: "Edit" }).contains(tour())).toBe(
      true,
    );
    resize(false);
    next();
    expect(tour().textContent).toContain("Check your preview");
    next();
    expect(tour().textContent).toContain("Zoom and 1:1");
  });
  it("ends the tour for a real Generate action and keeps replay disabled while generating", async () => {
    useStore.getState().setAppMode("text");
    localStorage.removeItem(PERSIST_STORAGE_KEY);
    let resolve!: () => void;
    generatePDF.mockImplementation(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    mount();
    fireEvent.click(
      within(document.querySelector("aside")!).getByRole("button", {
        name: "Generate PDF",
      }),
    );
    expect(tour()).toBeNull();
    expect(generatePDF).toHaveBeenCalledOnce();
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "User guide" }));
    expect(
      (screen.getByRole("button", { name: "Replay tour" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    await act(async () => resolve());
  });
});
