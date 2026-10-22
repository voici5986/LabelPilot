// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { DialogBody } from "./DialogBody";

afterEach(cleanup);

it("provides a labelled keyboard-focusable region while merging caller styles", () => {
  const ref = createRef<HTMLDivElement>();
  const onKeyDown = vi.fn();
  render(
    <>
      <h2 id="guide-heading">Printing guide</h2>
      <DialogBody
        ref={ref}
        aria-labelledby="guide-heading"
        className="max-h-80"
        onKeyDown={onKeyDown}
      >
        Print at actual size.
      </DialogBody>
    </>,
  );

  const body = screen.getByRole("region", { name: "Printing guide" });
  expect(body.getAttribute("aria-labelledby")).toBe("guide-heading");
  expect(body.tabIndex).toBe(0);
  expect(ref.current).toBe(body);
  ref.current?.focus();
  expect(document.activeElement).toBe(body);
  fireEvent.keyDown(body, { key: "PageDown" });
  expect(onKeyDown).toHaveBeenCalledOnce();
  expect(onKeyDown.mock.calls[0][0].key).toBe("PageDown");
  expect(body.classList.contains("max-h-80")).toBe(true);
  expect(body.classList.contains("overflow-y-auto")).toBe(true);
  expect(body.classList.contains("focus-visible:outline-2")).toBe(true);
  expect(body.classList.contains("focus-visible:outline-brand-primary")).toBe(
    true,
  );
});
