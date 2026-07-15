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
});
