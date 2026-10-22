// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef, type FormEvent } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { HeaderTextButton } from "./HeaderTextButton";

afterEach(cleanup);

it("stays a non-submit header action with working ref, click and merged feedback styles", () => {
  const ref = createRef<HTMLButtonElement>();
  const onClick = vi.fn();
  const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) =>
    event.preventDefault(),
  );
  render(
    <form onSubmit={onSubmit}>
      <HeaderTextButton ref={ref} onClick={onClick} className="ml-auto">
        User guide
      </HeaderTextButton>
    </form>,
  );

  const button = screen.getByRole("button", { name: "User guide" });
  expect(button.getAttribute("type")).toBe("button");
  expect(ref.current).toBe(button);
  ref.current?.focus();
  expect(document.activeElement).toBe(button);
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledOnce();
  expect(onSubmit).not.toHaveBeenCalled();
  expect(button.classList.contains("ml-auto")).toBe(true);
  expect(button.classList.contains("hit-target")).toBe(true);
  expect(button.classList.contains("enabled:hover:bg-text-main/5")).toBe(true);
  expect(button.classList.contains("enabled:active:bg-text-main/10")).toBe(
    true,
  );
  expect(button.classList.contains("focus-visible:outline-2")).toBe(true);
  expect(button.classList.contains("focus-visible:outline-brand-primary")).toBe(
    true,
  );
});
