// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStore } from "../store/useStore";
import { I18nProvider } from "../utils/i18n";
import { A4_HEIGHT_MM, A4_WIDTH_MM } from "../utils/layoutMath";
import { PreviewPanel } from "./PreviewPanel";

const defaultConfig = {
  rows: 1,
  cols: 1,
  marginMm: 10,
  spacingMm: 0,
  orientation: "portrait" as const,
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

function resetStore() {
  useStore.setState({
    config: defaultConfig,
    textConfig: defaultTextConfig,
    appMode: "text",
    theme: "system",
    imageItems: [],
    imageUrlMap: new Map(),
  });
}

function renderPanel(
  zoomMode: "fit" | "manual" | "actual" = "fit",
  onFilesSelect: (files: File[]) => void | Promise<void> = vi.fn(),
  tourActive = false,
) {
  return render(
    <I18nProvider>
      <PreviewPanel
        tourActive={tourActive}
        zoomMode={zoomMode}
        manualScale={1}
        onZoomModeChange={vi.fn()}
        onManualScaleChange={vi.fn()}
        onRequestActual={vi.fn()}
        onFilesSelect={onFilesSelect}
        onStartNumbering={vi.fn()}
      />
    </I18nProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  resetStore();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetStore();
});

describe("PreviewPanel", () => {
  it.each([false, true])(
    "hands upload focus to the surviving preview unless focus moved during admission (moved %s)",
    async (moveFocus) => {
      const frames: FrameRequestCallback[] = [];
      vi.spyOn(window, "requestAnimationFrame").mockImplementation(
        (callback) => {
          frames.push(callback);
          return frames.length;
        },
      );
      useStore.setState({ appMode: "image" });
      let finishAdmission!: () => void;
      const admission = new Promise<void>((resolve) => {
        finishAdmission = resolve;
      });
      const onFilesSelect = async (files: File[]) => {
        await admission;
        useStore.setState({
          imageItems: [{ id: "uploaded", file: files[0], count: 1 }],
        });
      };
      renderPanel("fit", onFilesSelect);
      const upload = screen.getByRole("button", { name: "上传图片" });
      upload.focus();
      fireEvent.change(screen.getByLabelText("上传图片"), {
        target: {
          files: [new File(["image"], "label.png", { type: "image/png" })],
        },
      });
      const stableControl = document.createElement("button");
      document.body.append(stableControl);
      if (moveFocus) stableControl.focus();
      await act(async () => {
        finishAdmission();
        await admission;
      });
      expect(upload.isConnected).toBe(false);
      expect(frames).toHaveLength(1);
      act(() => frames.forEach((callback) => callback(0)));
      expect(document.activeElement).toBe(
        moveFocus
          ? stableControl
          : screen.getByRole("region", { name: "纸张预览" }),
      );
      stableControl.remove();
    },
  );

  it("shows the paper and its controls during the tour instead of QuickStart", () => {
    useStore.setState({ appMode: "image" });
    renderPanel("fit", vi.fn(), true);
    expect(screen.queryByRole("button", { name: "上传图片" })).toBeNull();
    expect(screen.getByRole("slider")).toBeTruthy();
    expect(screen.getByTestId("preview-ruler")).toBeTruthy();
  });

  it.each(["manual", "actual"] as const)(
    "reveals the empty paper for intentional %s zoom",
    (mode) => {
      useStore.setState({ appMode: "image" });
      renderPanel(mode);
      expect(screen.queryByRole("button", { name: "上传图片" })).toBeNull();
      expect(screen.getByRole("slider")).toBeTruthy();
      expect(
        screen
          .getByRole("region", { name: "纸张预览" })
          .querySelector("[style*=scale]"),
      ).toBeTruthy();
    },
  );

  it("offers quick start only for an empty, valid image preview and hides preview controls", () => {
    useStore.setState({ appMode: "image" });
    renderPanel();
    expect(screen.getByRole("button", { name: "上传图片" })).toBeTruthy();
    expect(screen.queryByRole("slider")).toBeNull();
    expect(screen.queryByTestId("preview-ruler")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "制作编号标签" }));
    expect(document.activeElement).toBe(
      screen.getByRole("region", { name: "纸张预览" }),
    );

    act(() => useStore.setState({ appMode: "text" }));
    expect(screen.queryByRole("button", { name: "上传图片" })).toBeNull();
    act(() =>
      useStore.setState({
        appMode: "image",
        imageItems: [
          {
            id: "label",
            file: new File(["image"], "label.png", { type: "image/png" }),
            count: 1,
          },
        ],
      }),
    );
    expect(screen.queryByRole("button", { name: "上传图片" })).toBeNull();
    act(() =>
      useStore.setState({
        imageItems: [],
        config: { ...defaultConfig, marginMm: 200 },
      }),
    );
    expect(screen.queryByRole("button", { name: "上传图片" })).toBeNull();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("exposes the preview as an explicitly keyboard-focusable named region", () => {
    renderPanel();
    const preview = screen.getByRole("region", { name: "纸张预览" });
    expect(preview.getAttribute("tabindex")).toBe("0");
    preview.focus();
    expect(document.activeElement).toBe(preview);
  });

  it("supports next-page navigation and direct page input", () => {
    renderPanel();

    const pageInput = screen.getByRole("textbox", { name: "第 1 / 10 页" });
    expect(pageInput).toHaveProperty("value", "1");

    fireEvent.click(screen.getByTitle("下一页"));
    expect(pageInput).toHaveProperty("value", "2");

    fireEvent.change(pageInput, { target: { value: "5" } });
    fireEvent.blur(pageInput);
    expect(pageInput).toHaveProperty("value", "5");

    fireEvent.change(pageInput, { target: { value: "99" } });
    fireEvent.blur(pageInput);
    expect(pageInput).toHaveProperty("value", "10");
  });

  it("renders QR preview when QR mode is enabled", () => {
    useStore.setState({
      textConfig: {
        ...defaultTextConfig,
        showQrCode: true,
        qrContentPrefix: "https://example.test/item/",
      },
    });

    renderPanel();

    expect(document.querySelector("svg")).not.toBeNull();
    expect(screen.getByText("SN-001")).not.toBeNull();
  });

  it("announces layout errors to assistive technology", () => {
    useStore.setState({
      config: {
        ...defaultConfig,
        marginMm: 200,
      },
    });

    renderPanel();

    expect(screen.getByRole("alert").textContent).toContain("布局错误");
    act(() => useStore.getState().setConfig({ marginMm: 10 }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("SN-001")).not.toBeNull();
  });

  it("keeps the stored page index clamped when page count shrinks", () => {
    renderPanel();

    const pageInput = screen.getByRole("textbox", { name: "第 1 / 10 页" });
    fireEvent.change(pageInput, { target: { value: "10" } });
    fireEvent.blur(pageInput);

    act(() => useStore.getState().setTextConfig({ count: 2 }));
    expect(pageInput).toHaveProperty("value", "2");

    act(() => useStore.getState().setTextConfig({ count: 10 }));
    expect(pageInput).toHaveProperty("value", "2");
  });
});
