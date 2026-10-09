// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStore } from "../store/useStore";
import { I18nProvider } from "../utils/i18n";
import { A4_HEIGHT_MM, A4_WIDTH_MM } from "../utils/layoutMath";
import { ControlPanel } from "./ControlPanel";

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

function renderControlPanel(
  props: Partial<ComponentProps<typeof ControlPanel>> = {},
) {
  return render(
    <I18nProvider>
      <ControlPanel
        onFilesSelect={vi.fn()}
        onGeneratePdf={vi.fn()}
        {...props}
      />
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

  it("keeps an editable image quantity draft until blur", () => {
    const file = new File(["image"], "label.png", { type: "image/png" });
    useStore.getState().setImageItems([{ id: "img-1", file, count: 3 }]);

    renderControlPanel();

    const input = screen.getByDisplayValue("3");
    fireEvent.change(input, { target: { value: "" } });

    expect(input).toHaveProperty("value", "");
    expect(useStore.getState().imageItems[0].count).toBe(3);

    fireEvent.change(input, { target: { value: "9" } });
    expect(input).toHaveProperty("value", "9");
    expect(useStore.getState().imageItems[0].count).toBe(3);

    fireEvent.blur(input);

    expect(useStore.getState().imageItems[0].count).toBe(9);
  });

  it.each(["blur", "Enter"])(
    "restores an empty image quantity draft on %s without updating the count",
    (commit) => {
      const file = new File(["image"], "label.png", { type: "image/png" });
      useStore.getState().setImageItems([{ id: "img-1", file, count: 9 }]);
      const updateCount = vi.spyOn(useStore.getState(), "updateItemCount");
      renderControlPanel();
      const input = screen.getByRole("textbox", { name: "label.png 的数量" });
      // Real focus lets Enter exercise the input's native blur handler.
      act(() => input.focus());
      fireEvent.change(input, { target: { value: "" } });
      expect(input).toHaveProperty("value", "");

      if (commit === "Enter") fireEvent.keyDown(input, { key: "Enter" });
      else fireEvent.blur(input);

      expect(input).toHaveProperty("value", "9");
      expect(useStore.getState().imageItems[0].count).toBe(9);
      expect(updateCount).not.toHaveBeenCalled();
      updateCount.mockRestore();
    },
  );

  it.each([
    ["0", 1],
    ["1000", 999],
  ])("clamps a nonempty image quantity draft %s to %s", (draft, expected) => {
    const file = new File(["image"], "label.png", { type: "image/png" });
    useStore.getState().setImageItems([{ id: "img-1", file, count: 9 }]);
    renderControlPanel();
    const input = screen.getByRole("textbox", { name: "label.png 的数量" });
    fireEvent.change(input, { target: { value: draft } });
    expect(useStore.getState().imageItems[0].count).toBe(9);

    fireEvent.blur(input);

    expect(input).toHaveProperty("value", String(expected));
    expect(useStore.getState().imageItems[0].count).toBe(expected);
  });

  it("keeps an oversized row draft and applies the landscape limit on blur", () => {
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

    const rowsInput = screen.getByLabelText("行数");
    fireEvent.focus(rowsInput);
    fireEvent.change(rowsInput, {
      target: { value: "20" },
    });

    expect(rowsInput).toHaveProperty("value", "20");
    expect(setConfig).not.toHaveBeenCalled();
    expect(useStore.getState().config.rows).toBe(2);

    fireEvent.blur(rowsInput);
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

  it("keeps an oversized digit draft and clamps the count on blur", () => {
    useStore.setState({ appMode: "text" });
    renderControlPanel();

    const digitsInput = screen.getByDisplayValue("3");
    fireEvent.focus(digitsInput);
    fireEvent.change(digitsInput, {
      target: { value: "999999999" },
    });

    expect(digitsInput).toHaveProperty("value", "999999999");
    expect(useStore.getState().textConfig.digits).toBe(3);

    fireEvent.blur(digitsInput);
    expect(digitsInput).toHaveProperty("value", "10");
    expect(useStore.getState().textConfig.digits).toBe(10);
  });

  it("blocks generation when image quantities exceed the aggregate label limit", () => {
    const items = Array.from({ length: 6 }, (_, index) => ({
      id: `img-${index}`,
      file: new File(["image"], `label-${index}.png`, { type: "image/png" }),
      count: 999,
    }));
    useStore.getState().setImageItems(items);

    renderControlPanel();

    expect(screen.getByRole("alert").textContent).toContain("5000");
    expect(
      screen.getByRole("button", { name: "生成 PDF 文档" }),
    ).toHaveProperty("disabled", true);
  });

  it("disables all PDF input controls while generation is running", () => {
    renderControlPanel({ isGenerating: true });

    expect(screen.getByLabelText("行数").matches(":disabled")).toBe(true);
    expect(screen.getByLabelText("点击上传标签图片").matches(":disabled")).toBe(
      true,
    );
    expect(
      screen.getByRole("button", { name: "图片模式" }).matches(":disabled"),
    ).toBe(true);
  });

  it("keeps the cancel action enabled while inputs are locked", () => {
    const onCancelPdf = vi.fn();
    renderControlPanel({
      isGenerating: true,
      genStatus: "generating",
      onCancelPdf,
    });

    expect(
      screen.getByRole("button", { name: /取消生成/ }).getAttribute("disabled"),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /取消生成/ }));
    expect(onCancelPdf).toHaveBeenCalledOnce();
  });

  it("keeps the desktop settings area in a flex scroll chain", () => {
    renderControlPanel();

    const fieldset = document.querySelector("aside > fieldset");
    const scrollPanel = fieldset?.firstElementChild;

    expect(fieldset?.classList.contains("flex")).toBe(true);
    expect(fieldset?.classList.contains("flex-col")).toBe(true);
    expect(scrollPanel?.classList.contains("min-h-0")).toBe(true);
    expect(scrollPanel?.classList.contains("flex-1")).toBe(true);
    expect(scrollPanel?.classList.contains("lg:overflow-y-auto")).toBe(true);
  });
});
