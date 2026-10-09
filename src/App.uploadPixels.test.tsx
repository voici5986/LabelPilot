// @vitest-environment jsdom

import { File as BrowserFile } from "node:buffer";

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { useStore } from "./store/useStore";
import { I18nProvider } from "./utils/i18n";

const upload = vi.hoisted(() => ({
  select: null as null | ((files: File[]) => Promise<void>),
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
vi.mock("./components/ReloadPrompt", () => ({ ReloadPrompt: () => null }));
vi.mock("./components/Toast", () => ({
  Toast: ({ message }: { message: string }) => (
    <div data-testid="upload-error">{message}</div>
  ),
}));
vi.mock("./components/ControlPanel", () => ({
  ControlPanel: ({
    onFilesSelect,
  }: {
    onFilesSelect: (files: File[]) => Promise<void>;
  }) => {
    upload.select = onFilesSelect;
    return null;
  },
}));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const dimensions = new WeakMap<File, { width: number; height: number }>();
const gates = new Map<File, ReturnType<typeof deferred>>();
let decode: ReturnType<typeof vi.fn>;
function image(name: string, pixels = 35_000_000) {
  const file = new File(
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    name,
    { type: "image/png" },
  );
  dimensions.set(file, { width: 5_000, height: pixels / 5_000 });
  return file;
}
function mount() {
  render(
    <I18nProvider>
      <App />
    </I18nProvider>,
  );
}
async function select(files: File[]) {
  await act(async () => {
    await upload.select!(files);
  });
}

beforeEach(() => {
  localStorage.clear();
  gates.clear();
  vi.stubGlobal("File", BrowserFile);
  decode = vi.fn(async (file: File) => {
    await gates.get(file)?.promise;
    return { ...dimensions.get(file)!, close: vi.fn() };
  });
  vi.stubGlobal("createImageBitmap", decode);
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

describe("App cumulative image pixel admission", () => {
  it("rejects split 4 + 1 uploads with the same error as a combined 5 upload", async () => {
    mount();
    const files = Array.from({ length: 5 }, (_, index) =>
      image(`${index}.png`),
    );
    await select(files);
    const combinedError = screen.getByTestId("upload-error").textContent;
    expect(combinedError).not.toBe("");
    expect(useStore.getState().imageItems).toEqual([]);
    await select(files.slice(0, 4));
    const accepted = useStore.getState().imageItems;
    expect(accepted).toHaveLength(4);
    await select(files.slice(4));
    expect(useStore.getState().imageItems).toBe(accepted);
    expect(screen.getByTestId("upload-error").textContent).toBe(combinedError);
  });

  it("accepts exactly 160 million pixels across selections without decoding accepted files again", async () => {
    mount();
    const files = Array.from({ length: 4 }, (_, index) =>
      image(`${index}.png`, 40_000_000),
    );
    await select(files.slice(0, 3));
    await select(files.slice(3));
    expect(useStore.getState().imageItems.map((item) => item.file)).toEqual(
      files,
    );
    expect(decode).toHaveBeenCalledTimes(4);
  });

  it("rechecks pixels when two incoming selections finish concurrently", async () => {
    mount();
    await select(
      Array.from({ length: 3 }, (_, index) => image(`queued-${index}.png`)),
    );
    const first = image("first.png");
    const second = image("second.png");
    const firstGate = deferred();
    const secondGate = deferred();
    gates.set(first, firstGate);
    gates.set(second, secondGate);
    const firstUpload = upload.select!([first]);
    const secondUpload = upload.select!([second]);
    await act(async () => {
      firstGate.resolve();
      secondGate.resolve();
      await Promise.all([firstUpload, secondUpload]);
    });
    expect(useStore.getState().imageItems).toHaveLength(4);
    expect(useStore.getState().imageItems.at(-1)?.file).toBe(first);
    expect(screen.getByTestId("upload-error").textContent).not.toBe("");
  });

  it("rechecks the latest queue after waiting for uncached queued dimensions", async () => {
    mount();
    const queued = Array.from({ length: 3 }, (_, index) =>
      image(`queued-${index}.png`),
    );
    const first = image("first.png");
    const second = image("second.png");
    const queuedGate = deferred();
    gates.set(queued[0], queuedGate);
    const firstUpload = upload.select!([first]);
    const secondUpload = upload.select!([second]);
    act(() => {
      useStore
        .getState()
        .setImageItems(
          queued.map((file, index) => ({ id: `${index}`, file, count: 1 })),
        );
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(decode.mock.calls.some(([file]) => file === queued[0])).toBe(true);
    await act(async () => {
      queuedGate.resolve();
      await Promise.all([firstUpload, secondUpload]);
    });
    expect(useStore.getState().imageItems).toHaveLength(4);
    expect(screen.getByTestId("upload-error").textContent).not.toBe("");
  });

  it("preserves removals, reordering, count edits and the latest default count during decoding", async () => {
    mount();
    const queued = [
      image("remove.png"),
      image("keep-a.png"),
      image("keep-b.png"),
    ];
    const gate = deferred();
    gates.set(queued[0], gate);
    act(() => {
      useStore
        .getState()
        .setImageItems(
          queued.map((file, index) => ({ id: `${index}`, file, count: 1 })),
        );
    });
    const incoming = image("incoming.png");
    const pending = upload.select!([incoming]);
    await act(async () => {
      await Promise.resolve();
    });
    expect(decode.mock.calls.some(([file]) => file === queued[0])).toBe(true);
    act(() => {
      const state = useStore.getState();
      state.setImageItems([
        state.imageItems[2],
        { ...state.imageItems[1], count: 7 },
      ]);
      state.setConfig({ rows: 2, cols: 3 });
    });
    await act(async () => {
      gate.resolve();
      await pending;
    });
    expect(
      useStore
        .getState()
        .imageItems.map((item) => [item.file.name, item.count]),
    ).toEqual([
      ["keep-b.png", 1],
      ["keep-a.png", 7],
      ["incoming.png", 6],
    ]);
  });
});
