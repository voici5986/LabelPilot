// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "../utils/i18n";
import { ControlPanel } from "./ControlPanel";
import { useStore } from "../store/useStore";
import { A4_HEIGHT_MM, A4_WIDTH_MM } from "../utils/layoutMath";

const defaultConfig = {
  rows: 2,
  cols: 2,
  marginMm: 8,
  spacingMm: 2,
  orientation: "landscape" as const,
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
const originalSetConfig = useStore.getState().setConfig;

function renderControlPanel() {
  return render(
    <I18nProvider>
      <ControlPanel onFilesSelect={vi.fn()} onGeneratePdf={vi.fn()} />
    </I18nProvider>,
  );
}

function resetStore() {
  useStore.setState({
    config: defaultConfig,
    textConfig: defaultTextConfig,
    appMode: "image",
    theme: "system",
    imageItems: [],
    imageUrlMap: new Map(),
    setConfig: originalSetConfig,
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:preview"),
    revokeObjectURL: vi.fn(),
  });
  resetStore();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetStore();
});

describe("ControlPanel", () => {
  it("passes selected image files to the upload callback", () => {
    const onFilesSelect = vi.fn();
    render(
      <I18nProvider>
        <ControlPanel onFilesSelect={onFilesSelect} onGeneratePdf={vi.fn()} />
      </I18nProvider>,
    );

    const file = new File(["image"], "label.png", { type: "image/png" });
    const input = document.querySelector('input[type="file"]');

    expect(input).toBeInstanceOf(HTMLInputElement);
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [file] },
    });

    expect(onFilesSelect).toHaveBeenCalledWith([file]);
  });

  it("updates image item quantity from the thumbnail input", () => {
    const file = new File(["image"], "label.png", { type: "image/png" });
    useStore.getState().setImageItems([{ id: "img-1", file, count: 3 }]);

    renderControlPanel();

    fireEvent.change(screen.getByDisplayValue("3"), {
      target: { value: "7" },
    });

    expect(useStore.getState().imageItems[0].count).toBe(7);
  });

  it("uses the landscape row limit before updating the store", () => {
    const setConfig = vi.fn();
    useStore.setState({ setConfig });
    render(
      <I18nProvider>
        <ControlPanel
          onFilesSelect={vi.fn()}
          onGeneratePdf={vi.fn()}
          maxRows={20}
        />
      </I18nProvider>,
    );

    fireEvent.change(screen.getByLabelText("行数"), {
      target: { value: "20" },
    });

    expect(setConfig).toHaveBeenCalledWith({ rows: 10 });
  });

  it("updates text mode fields and QR toggle state", () => {
    useStore.setState({ appMode: "text" });

    renderControlPanel();

    fireEvent.change(screen.getByDisplayValue("SN-"), {
      target: { value: "ASSET-" },
    });
    fireEvent.change(screen.getByDisplayValue("10"), {
      target: { value: "12" },
    });
    fireEvent.click(screen.getByTitle("生成二维码"));
    fireEvent.change(screen.getByRole("slider"), {
      target: { value: "0.5" },
    });

    expect(useStore.getState().textConfig).toMatchObject({
      prefix: "ASSET-",
      count: 12,
      showQrCode: true,
      qrSizeRatio: 0.5,
    });
  });

  it("clamps an oversized digit count during input", () => {
    useStore.setState({ appMode: "text" });
    renderControlPanel();

    const digitsInput = screen.getByDisplayValue("3");
    fireEvent.change(digitsInput, {
      target: { value: "999999999" },
    });

    expect(digitsInput).toHaveProperty("value", "10");
    expect(useStore.getState().textConfig.digits).toBe(10);
  });
});
