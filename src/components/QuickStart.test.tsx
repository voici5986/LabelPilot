// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { I18nProvider } from "../utils/i18n";
import { QuickStart } from "./QuickStart";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

it("opens its own multi-image input and resets it for same-file retry", () => {
  const onFilesSelect = vi.fn();
  const onStartNumbering = vi.fn();
  render(
    <I18nProvider>
      <QuickStart
        onFilesSelect={onFilesSelect}
        onStartNumbering={onStartNumbering}
      />
    </I18nProvider>,
  );
  const input = screen.getByLabelText("上传图片") as HTMLInputElement;
  const click = vi.spyOn(input, "click");
  fireEvent.click(screen.getByRole("button", { name: "上传图片" }));
  expect(click).toHaveBeenCalledOnce();
  expect(input.multiple).toBe(true);
  expect(input.accept).toBe("image/png,image/jpeg");
  const file = new File(["image"], "label.png", { type: "image/png" });
  let value = "C:\\fakepath\\label.png";
  Object.defineProperty(input, "value", {
    configurable: true,
    get: () => value,
    set: (next: string) => {
      value = next;
    },
  });
  fireEvent.change(input, { target: { files: [file] } });
  expect(input.value).toBe("");
  fireEvent.change(input, { target: { files: [file] } });
  expect(onFilesSelect.mock.calls).toEqual([[[file]], [[file]]]);
  fireEvent.change(input, { target: { files: [] } });
  expect(onFilesSelect).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "制作编号标签" }));
  expect(onStartNumbering).toHaveBeenCalledOnce();
});
