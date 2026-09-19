// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActionButton } from "./ActionButton";

describe("ActionButton", () => {
  afterEach(cleanup);

  it("keeps the action contract in one module", () => {
    render(
      <ActionButton variant="primary" disabled>
        Save
      </ActionButton>,
    );

    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveProperty("disabled", true);
    expect(button.className).toContain("enabled:hover:brightness-110");
    expect(button.className).toContain("enabled:active:brightness-95");
    expect(button.className).toContain("focus-visible:outline-2");
  });

  it("defaults to a non-submit button and forwards refs", () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <ActionButton ref={ref} weight="bold" disabledOpacity="visible">
        Save
      </ActionButton>,
    );

    const button = screen.getByRole("button", { name: "Save" });
    expect(button.getAttribute("type")).toBe("button");
    expect(ref.current).toBe(button);
    expect(button.classList.contains("font-bold")).toBe(true);
    expect(button.classList.contains("disabled:opacity-70")).toBe(true);
  });

  it("does not dispatch clicks while disabled", () => {
    const onClick = vi.fn();
    render(
      <ActionButton disabled onClick={onClick}>
        Save
      </ActionButton>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
