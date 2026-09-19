// @vitest-environment jsdom

import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStore } from "../store/useStore";
import { I18nProvider } from "../utils/i18n";
import type { ImageItem } from "../utils/layoutMath";
import { EditSheet } from "./EditSheet";

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
  it("keeps the aggregate limit error visible when the file group is collapsed", () => {
    render(
      <I18nProvider>
        <EditSheet
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
  });

  it("consumes Escape in the quantity field without closing the sheet", () => {
    const onClose = vi.fn();
    render(
      <I18nProvider>
        <EditSheet
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
