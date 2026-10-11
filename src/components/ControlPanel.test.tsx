// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import type { ComponentProps as ReadinessComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useGenerationReadiness } from "../hooks/useGenerationReadiness";
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

function ReadyControlPanel(
  props: Omit<ReadinessComponentProps<typeof ControlPanel>, "readiness">,
) {
  const { config, appMode, imageItems, textConfig } = useStore();
  const readiness = useGenerationReadiness(
    config,
    appMode,
    imageItems,
    textConfig,
  );
  return <ControlPanel readiness={readiness} {...props} />;
}

function renderControlPanel(
  props: Partial<ComponentProps<typeof ControlPanel>> = {},
) {
  return render(
    <I18nProvider>
      <ReadyControlPanel
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
    gridPreferences: { rows: defaultConfig.rows, cols: defaultConfig.cols },
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
  it("warns for 5 by 2.5 mm image cells without blocking generation", () => {
    useStore.setState({
      config: {
        ...defaultConfig,
        orientation: "portrait",
        rows: 20,
        cols: 10,
        pageWidthMm: 50,
        pageHeightMm: 50,
        marginMm: 0,
        spacingMm: 0,
      },
      imageItems: [
        {
          id: "small",
          file: new File(["image"], "small.png", { type: "image/png" }),
          count: 1,
        },
      ],
    });
    renderControlPanel();
    expect(screen.getByText(/图片单元格为 5 × 2.5 mm/).textContent).toContain(
      "最短边至少 5 mm",
    );
    expect(
      screen.getByText(/图片单元格为 5 × 2.5 mm/).closest('[role="status"]'),
    ).not.toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByRole("button", { name: "生成 PDF 文档" }),
    ).toHaveProperty("disabled", false);
  });

  it("warns about low raster text resolution without disabling generation", () => {
    useStore.setState({
      appMode: "text",
      config: { ...defaultConfig, rows: 1, cols: 1 },
      textConfig: { ...defaultTextConfig, prefix: "设备-" },
    });
    renderControlPanel();
    expect(screen.getByText(/中文\/非ASCII文本会以/).textContent).toContain(
      "300 DPI",
    );
    expect(
      screen.getByText(/中文\/非ASCII文本会以/).closest('[role="status"]'),
    ).not.toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByRole("button", { name: "生成 PDF 文档" }),
    ).toHaveProperty("disabled", false);
  });

  it.each(["image/jpeg", ""])(
    "shows the conditional processing hint for JPEG or unknown MIME %s",
    (type) => {
      useStore.getState().setImageItems([
        {
          id: "jpeg",
          file: new File(["image"], "label.jpg", { type }),
          count: 1,
        },
      ]);
      renderControlPanel();
      expect(
        screen.getByText(/需要纠正方向的 JPEG 图片可能会重新编码/).textContent,
      ).toContain("16 百万像素");
      expect(
        screen.getByRole("button", { name: "生成 PDF 文档" }),
      ).toHaveProperty("disabled", false);
      act(() =>
        useStore.getState().setImageItems([
          {
            id: "png",
            file: new File(["image"], "label.png", { type: "image/png" }),
            count: 1,
          },
        ]),
      );
      expect(
        screen.queryByText(/需要纠正方向的 JPEG 图片可能会重新编码/),
      ).toBeNull();
    },
  );

  it("announces an orientation grid clamp and clears it on a later unclamped change", () => {
    useStore.getState().setConfig({ rows: 10, cols: 20 });
    renderControlPanel();
    fireEvent.click(screen.getByRole("button", { name: "纵向" }));
    expect(useStore.getState().config).toMatchObject({
      orientation: "portrait",
      rows: 10,
      cols: 10,
    });
    const announcement = screen.getByText(/网格已从 10×20 临时调整为 10×10/);
    expect(announcement.textContent).toContain("行列偏好已保留");
    expect(announcement.getAttribute("aria-live")).toBe("polite");
    fireEvent.click(screen.getByRole("button", { name: "横向" }));
    expect(useStore.getState().config.cols).toBe(20);
    expect(screen.queryByText(/网格已从/)).toBeNull();
  });
  it("announces the actual projection when both logical dimensions are 20", () => {
    useStore.getState().setConfig({ orientation: "portrait", rows: 20 });
    useStore.getState().setConfig({ orientation: "landscape", cols: 20 });
    renderControlPanel();
    fireEvent.click(screen.getByRole("button", { name: "纵向" }));
    expect(useStore.getState().config).toMatchObject({ rows: 20, cols: 10 });
    expect(
      screen.getByText(/网格已从 10×20 临时调整为 20×10/).textContent,
    ).toContain("行列偏好已保留");
    fireEvent.click(screen.getByRole("button", { name: "横向" }));
    expect(useStore.getState().config).toMatchObject({ rows: 10, cols: 20 });
    expect(screen.getByText(/网格已从 20×10 临时调整为 10×20/)).toBeTruthy();
  });

  it.each(["blur", "Enter", "Escape", "ArrowUp", "edit", "sameValue"])(
    "preserves or explicitly edits a clamped preference through %s input events",
    (interaction) => {
      useStore.getState().setConfig({ cols: 20 });
      useStore.getState().setConfig({ orientation: "portrait" });
      renderControlPanel();
      const input = screen.getByRole("spinbutton", {
        name: "列数",
      });
      expect(input).toHaveProperty("value", "10");
      fireEvent.focus(input);
      if (interaction === "sameValue") {
        fireEvent.change(input, { target: { value: "" } });
        fireEvent.change(input, { target: { value: "10" } });
      }
      if (interaction === "Escape" || interaction === "edit") {
        fireEvent.change(input, { target: { value: "9" } });
        expect(useStore.getState().gridPreferences.cols).toBe(9);
      }
      if (interaction === "Escape") fireEvent.keyDown(input, { key: "Escape" });
      if (interaction === "ArrowUp")
        fireEvent.keyDown(input, { key: "ArrowUp" });
      if (interaction === "Enter") fireEvent.keyDown(input, { key: "Enter" });
      fireEvent.blur(input);
      expect(useStore.getState().gridPreferences.cols).toBe(
        interaction === "edit" ? 9 : interaction === "sameValue" ? 10 : 20,
      );
      fireEvent.click(screen.getByRole("button", { name: "横向" }));
      expect(input).toHaveProperty(
        "value",
        interaction === "edit"
          ? "9"
          : interaction === "sameValue"
            ? "10"
            : "20",
      );
    },
  );

  it("passes selected image files to the upload callback", () => {
    const onFilesSelect = vi.fn();
    render(
      <I18nProvider>
        <ReadyControlPanel
          onFilesSelect={onFilesSelect}
          onGeneratePdf={vi.fn()}
        />
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
        <ReadyControlPanel onFilesSelect={vi.fn()} onGeneratePdf={vi.fn()} />
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

  it("describes QR slider values as percentages", () => {
    useStore.setState({
      appMode: "text",
      textConfig: { ...defaultTextConfig, showQrCode: true, qrSizeRatio: 0.35 },
    });
    renderControlPanel();
    const slider = screen.getByRole("slider", { name: "二维码大小" });
    expect(slider.getAttribute("aria-valuetext")).toBe("35%");
    fireEvent.change(slider, { target: { value: "0.5" } });
    expect(slider.getAttribute("aria-valuetext")).toBe("50%");
  });

  it("blocks generation when image quantities exceed the aggregate label limit", () => {
    const items = Array.from({ length: 6 }, (_, index) => ({
      id: `img-${index}`,
      file: new File(["image"], `label-${index}.png`, { type: "image/png" }),
      count: 999,
    }));
    useStore.getState().setImageItems(items);

    renderControlPanel();

    expect(
      screen
        .getByText("单次最多生成 5000 个图片标签。")
        .closest('[role="alert"]')?.textContent,
    ).toContain("5000");
    expect(
      screen.getByRole("button", { name: "生成 PDF 文档" }),
    ).toHaveProperty("disabled", true);
    act(() => useStore.getState().setImageItems(items.slice(0, 5)));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByRole("button", { name: "生成 PDF 文档" }),
    ).toHaveProperty("disabled", false);
  });

  it.each([
    { prefix: "设备".repeat(32), qrContentPrefix: "", message: "预计字号仅" },
    {
      prefix: "SN-",
      qrContentPrefix: "x".repeat(512),
      message: "二维码模块仅",
    },
  ])(
    "announces the blocking text error $message and restores generation after correction",
    ({ prefix, qrContentPrefix, message }) => {
      useStore.setState({
        appMode: "text",
        config: { ...defaultConfig, rows: 3, cols: 3 },
        textConfig: {
          ...defaultTextConfig,
          prefix,
          qrContentPrefix,
          showQrCode: true,
          qrSizeRatio: 0.35,
        },
      });
      renderControlPanel();
      expect(screen.getByRole("alert").textContent).toContain(message);
      expect(
        screen.getByRole("button", { name: "生成 PDF 文档" }),
      ).toHaveProperty("disabled", true);
      act(() =>
        useStore
          .getState()
          .setTextConfig({ prefix: "SN-", qrContentPrefix: "" }),
      );
      expect(screen.queryByRole("alert")).toBeNull();
      expect(
        screen.getByRole("button", { name: "生成 PDF 文档" }),
      ).toHaveProperty("disabled", false);
    },
  );

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
