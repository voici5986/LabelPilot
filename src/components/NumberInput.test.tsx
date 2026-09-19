// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NumberInput } from "./NumberInput";

afterEach(cleanup);

describe("NumberInput", () => {
  it("reverts an empty draft on blur instead of writing the minimum", () => {
    const onChange = vi.fn();
    render(
      <NumberInput
        label="Rows"
        value={5}
        onChange={onChange}
        min={1}
        max={20}
        isInteger
      />,
    );

    const input = screen.getByLabelText("Rows");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    expect(input).toHaveProperty("value", "5");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables the increment stepper when already at max", () => {
    const onChange = vi.fn();
    render(
      <NumberInput
        label="Rows"
        value={20}
        onChange={onChange}
        min={1}
        max={20}
        isInteger
      />,
    );

    const increment = screen.getByLabelText("Rows: +1") as HTMLButtonElement;
    expect(increment.disabled).toBe(true);
    expect(
      (screen.getByLabelText("Rows: -1") as HTMLButtonElement).disabled,
    ).toBe(false);

    fireEvent.click(increment);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables the decrement stepper when already at min", () => {
    const onChange = vi.fn();
    render(
      <NumberInput
        label="Rows"
        value={1}
        onChange={onChange}
        min={1}
        max={20}
        isInteger
      />,
    );

    expect(
      (screen.getByLabelText("Rows: -1") as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByLabelText("Rows: +1") as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("keeps both steppers enabled within bounds", () => {
    const onChange = vi.fn();
    render(
      <NumberInput
        label="Rows"
        value={10}
        onChange={onChange}
        min={1}
        max={20}
        isInteger
      />,
    );

    expect(
      (screen.getByLabelText("Rows: +1") as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(
      (screen.getByLabelText("Rows: -1") as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("links both responsive stepper actions to the number field", () => {
    render(
      <NumberInput
        label="Rows"
        value={10}
        onChange={vi.fn()}
        min={1}
        max={20}
        isInteger
      />,
    );

    const input = screen.getByLabelText("Rows");
    const increment = screen.getByRole("button", { name: "Rows: +1" });
    const decrement = screen.getByRole("button", { name: "Rows: -1" });

    expect(increment.getAttribute("aria-controls")).toBe(input.id);
    expect(decrement.getAttribute("aria-controls")).toBe(input.id);
    expect(increment.querySelectorAll("svg")).toHaveLength(2);
    expect(decrement.querySelectorAll("svg")).toHaveLength(2);
  });
});
