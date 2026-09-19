// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStore } from "../store/useStore";
import { I18nProvider } from "../utils/i18n";
import type { ImageItem } from "../utils/layoutMath";
import { ImageFilesSection } from "./ImageFilesSection";

function makeItem(id: string, count = 1): ImageItem {
  return {
    id,
    file: new File([id], `${id}.png`, { type: "image/png" }),
    count,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => `blob:preview`),
    revokeObjectURL: vi.fn(),
  });
  useStore.setState({ imageUrlMap: new Map() });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ImageFilesSection ordering", () => {
  it("supports keyboard-friendly up/down movement and disables edge actions", () => {
    const items = [makeItem("a"), makeItem("b")];
    const onReorder = vi.fn();

    render(
      <I18nProvider>
        <ImageFilesSection
          imageItems={items}
          onFilesSelect={vi.fn()}
          onReorder={onReorder}
          onItemCountChange={vi.fn()}
        />
      </I18nProvider>,
    );

    const firstUp = screen.getByRole("button", { name: "将 a.png 上移" });
    const firstDown = screen.getByRole("button", { name: "将 a.png 下移" });
    const lastDown = screen.getByRole("button", { name: "将 b.png 下移" });
    const firstQuantityInput = screen.getByRole("textbox", {
      name: "a.png 的数量",
    });
    const firstQuantityDecrement = screen.getByRole("button", {
      name: "a.png 的数量: -1",
    });
    const firstQuantityIncrement = screen.getByRole("button", {
      name: "a.png 的数量: +1",
    });
    const firstQuantityBox = firstQuantityInput.parentElement;
    const firstRow = screen.getByText("a.png", { exact: true }).parentElement;
    const firstMoveRow = firstUp.parentElement?.parentElement;
    expect(firstUp).toHaveProperty("disabled", true);
    expect(lastDown).toHaveProperty("disabled", true);
    expect(firstUp.classList.contains("h-8")).toBe(true);
    expect(firstUp.classList.contains("w-8")).toBe(true);
    expect(firstUp.classList.contains("hit-target")).toBe(true);
    expect(lastDown.classList.contains("h-8")).toBe(true);
    expect(lastDown.classList.contains("w-8")).toBe(true);
    expect(lastDown.classList.contains("hit-target")).toBe(true);
    expect(firstQuantityBox?.classList.contains("h-10")).toBe(true);
    expect(firstQuantityBox?.classList.contains("input-base")).toBe(false);
    expect(
      firstQuantityBox?.classList.contains(
        "shadow-[inset_0_0_0_1px_var(--color-border-subtle)]",
      ),
    ).toBe(true);
    expect(firstRow).not.toBeNull();
    expect(firstMoveRow).not.toBeNull();
    expect(firstRow?.contains(firstUp)).toBe(false);
    expect(firstMoveRow?.contains(firstUp)).toBe(true);
    expect(firstMoveRow?.contains(firstDown)).toBe(true);
    expect(firstMoveRow?.contains(lastDown)).toBe(false);
    expect(firstQuantityDecrement.classList.contains("h-10")).toBe(true);
    expect(firstQuantityIncrement.classList.contains("h-10")).toBe(true);
    expect(firstQuantityDecrement).toHaveProperty("disabled", true);
    expect(firstQuantityIncrement).toHaveProperty("disabled", false);
    expect(firstUp.parentElement?.classList.contains("gap-3")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "将 b.png 上移" }));

    expect(onReorder).toHaveBeenCalledWith([items[1], items[0]]);
  });

  it("natively disables quantity steppers at both item-count boundaries", () => {
    const onItemCountChange = vi.fn();
    render(
      <I18nProvider>
        <ImageFilesSection
          imageItems={[makeItem("min", 1), makeItem("max", 999)]}
          onFilesSelect={vi.fn()}
          onReorder={vi.fn()}
          onItemCountChange={onItemCountChange}
        />
      </I18nProvider>,
    );

    const minimumDecrement = screen.getByRole("button", {
      name: "min.png 的数量: -1",
    });
    const maximumIncrement = screen.getByRole("button", {
      name: "max.png 的数量: +1",
    });
    expect(minimumDecrement).toHaveProperty("disabled", true);
    expect(maximumIncrement).toHaveProperty("disabled", true);

    fireEvent.click(minimumDecrement);
    fireEvent.click(maximumIncrement);
    expect(onItemCountChange).not.toHaveBeenCalled();
  });

  it("keeps count normalization as a business-level defense", () => {
    const onItemCountChange = vi.fn();
    render(
      <I18nProvider>
        <ImageFilesSection
          imageItems={[makeItem("a", 5)]}
          onFilesSelect={vi.fn()}
          onReorder={vi.fn()}
          onItemCountChange={onItemCountChange}
        />
      </I18nProvider>,
    );

    const input = screen.getByRole("textbox", { name: "a.png 的数量" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "9999" } });
    fireEvent.blur(input);

    expect(onItemCountChange).toHaveBeenCalledWith("a", 999);
  });

  it("uses a compact add-more control once image cards are visible", () => {
    render(
      <I18nProvider>
        <ImageFilesSection
          imageItems={[makeItem("a"), makeItem("b")]}
          onFilesSelect={vi.fn()}
          onReorder={vi.fn()}
          onItemCountChange={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(screen.getByText("继续添加图片")).toBeTruthy();
    expect(screen.queryByText("已选择 2 张图片")).toBeNull();
    expect(screen.getByLabelText("点击上传标签图片")).toBeTruthy();
  });
});
