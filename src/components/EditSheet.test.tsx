// @vitest-environment jsdom

import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ComponentProps as ReadinessComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useGenerationReadiness } from "../hooks/useGenerationReadiness";
import { useStore } from "../store/useStore";
import { I18nProvider } from "../utils/i18n";
import type { ImageItem } from "../utils/layoutMath";
import {
  DEFAULT_LAYOUT_CONFIG,
  DEFAULT_TEXT_CONFIG,
} from "../utils/layoutMath";
import { EditSheet } from "./EditSheet";

function ReadyEditSheet(
  props: Omit<ReadinessComponentProps<typeof EditSheet>, "readiness">,
) {
  const { config, appMode, imageItems, textConfig } = useStore();
  const readiness = useGenerationReadiness(
    config,
    appMode,
    imageItems,
    textConfig,
  );
  return <EditSheet readiness={readiness} {...props} />;
}

function makeItems(): ImageItem[] {
  return Array.from({ length: 6 }, (_, index) => ({
    id: `img-${index}`,
    file: new File(["image"], `label-${index}.png`, { type: "image/png" }),
    count: 999,
  }));
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  useStore.setState({
    config: DEFAULT_LAYOUT_CONFIG,
    gridPreferences: {
      rows: DEFAULT_LAYOUT_CONFIG.rows,
      cols: DEFAULT_LAYOUT_CONFIG.cols,
    },
    textConfig: DEFAULT_TEXT_CONFIG,
    appMode: "image",
    imageItems: makeItems(),
    imageUrlMap: new Map(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useStore.setState({ imageItems: [], imageUrlMap: new Map() });
});

describe("EditSheet image output errors", () => {
  it("keeps the small image cell recommendation visible when collapsed", () => {
    useStore.setState({
      config: {
        ...DEFAULT_LAYOUT_CONFIG,
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
    render(
      <I18nProvider>
        <ReadyEditSheet
          open
          full={false}
          onClose={vi.fn()}
          onToggleFull={vi.fn()}
          onFilesSelect={vi.fn()}
        />
      </I18nProvider>,
    );
    const warning = screen.getByText(/图片单元格为 5 × 2.5 mm/);
    expect(warning.textContent).toContain("最短边至少 5 mm");
    expect(warning.closest('[role="status"]')).not.toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^标签图片$/ }));
    expect(warning.closest(".hidden")).toBeNull();
  });

  it("keeps the JPEG processing hint visible when the queue is collapsed", () => {
    useStore.setState({
      imageItems: [
        {
          id: "jpeg",
          file: new File(["image"], "label.jpg", { type: "image/jpeg" }),
          count: 1,
        },
      ],
    });
    render(
      <I18nProvider>
        <ReadyEditSheet
          open
          full={false}
          onClose={vi.fn()}
          onToggleFull={vi.fn()}
          onFilesSelect={vi.fn()}
        />
      </I18nProvider>,
    );
    const hint = screen.getByText(/需要纠正方向的 JPEG 图片可能会重新编码/);
    expect(hint.closest('[role="status"]')).not.toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^标签图片$/ }));
    expect(hint.closest(".hidden")).toBeNull();
  });

  it("shows raster quality warnings alongside blocking text errors", () => {
    useStore.setState({
      appMode: "text",
      config: { ...DEFAULT_LAYOUT_CONFIG, rows: 1, cols: 2 },
      textConfig: {
        ...DEFAULT_TEXT_CONFIG,
        prefix: "设备".repeat(32),
        showQrCode: true,
        qrSizeRatio: 0.6,
      },
    });
    render(
      <I18nProvider>
        <ReadyEditSheet
          open
          full={false}
          onClose={vi.fn()}
          onToggleFull={vi.fn()}
          onFilesSelect={vi.fn()}
        />
      </I18nProvider>,
    );
    expect(screen.getByRole("status").textContent).toContain(
      "中文/非ASCII文本会以",
    );
    expect(screen.getByRole("alert").textContent).toContain("预计字号仅");
    act(() => useStore.getState().setTextConfig({ prefix: "设备-" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain(
      "中文/非ASCII文本会以",
    );
  });
  it("exposes the current panel size on the keyboard toggle", () => {
    const onToggleFull = vi.fn();
    const content = (full: boolean) => (
      <I18nProvider>
        <ReadyEditSheet
          open
          full={full}
          onClose={vi.fn()}
          onToggleFull={onToggleFull}
          onFilesSelect={vi.fn()}
        />
      </I18nProvider>
    );
    const { rerender } = render(content(false));
    const toggle = screen.getByRole("button", { name: "切换面板高度" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.keyDown(toggle, { key: " " });
    expect(onToggleFull).toHaveBeenCalledOnce();
    rerender(content(true));
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps the aggregate limit error visible when the file group is collapsed", () => {
    render(
      <I18nProvider>
        <ReadyEditSheet
          open
          full={false}
          onClose={vi.fn()}
          onToggleFull={vi.fn()}
          onFilesSelect={vi.fn()}
        />
      </I18nProvider>,
    );

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("5000");
    expect(alert.closest(".hidden")).toBeNull();

    const filesToggle = screen.getByRole("button", {
      name: /^标签图片$/,
    });
    fireEvent.click(filesToggle);

    expect(filesToggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("alert")).toBe(alert);
    expect(alert.closest(".hidden")).toBeNull();
    expect(alert.textContent).toContain("5000");
    act(() => useStore.getState().setImageItems(makeItems().slice(0, 5)));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("consumes Escape in the quantity field without closing the sheet", () => {
    const onClose = vi.fn();
    render(
      <I18nProvider>
        <ReadyEditSheet
          open
          full={false}
          onClose={onClose}
          onToggleFull={vi.fn()}
          onFilesSelect={vi.fn()}
        />
      </I18nProvider>,
    );

    const input = screen.getByRole("textbox", {
      name: "label-0.png 的数量",
    });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "12" } });
    const event = createEvent.keyDown(input, { key: "Escape", bubbles: true });
    fireEvent(input, event);

    expect(event.defaultPrevented).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "编辑" })).not.toBeNull();
  });
});
