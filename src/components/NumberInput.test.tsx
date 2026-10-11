// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render as renderWithOptions,
  screen,
} from "@testing-library/react";
import { useState, type ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../utils/i18n";
import { NumberInput } from "./NumberInput";

afterEach(cleanup);
const render = (ui: React.ReactNode) =>
  renderWithOptions(ui, { wrapper: I18nProvider });

function ControlledNumberInput({
  onChange,
  initialValue = 300,
  ...props
}: {
  onChange: (value: number) => void;
  initialValue?: number;
} & Partial<Omit<ComponentProps<typeof NumberInput>, "value" | "onChange">>) {
  const [value, setValue] = useState(initialValue);
  return (
    <>
      <NumberInput
        label="Custom width"
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
        min={50}
        max={1000}
        {...props}
      />
      <output aria-label="Committed width">{value}</output>
    </>
  );
}

describe("NumberInput", () => {
  it.each(["Enter", "blur"])(
    "does not publish an untouched field on %s",
    (commit) => {
      const onChange = vi.fn();
      render(<ControlledNumberInput onChange={onChange} />);
      const input = screen.getByLabelText("Custom width");
      fireEvent.focus(input);
      if (commit === "Enter") fireEvent.keyDown(input, { key: "Enter" });
      fireEvent.blur(input);
      expect(onChange).not.toHaveBeenCalled();
      expect(input).toHaveProperty("value", "300");
    },
  );

  it("reports the raw draft and boundaries without advertising the old committed value", () => {
    const { container } = render(<ControlledNumberInput onChange={vi.fn()} />);
    const input = screen.getByRole("spinbutton", { name: "Custom width" });
    expect(input.getAttribute("aria-valuemin")).toBe("50");
    expect(input.getAttribute("aria-valuemax")).toBe("1000");
    expect(input.getAttribute("aria-valuenow")).toBe("300");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "2" } });
    expect(input.getAttribute("aria-valuenow")).toBe("2");
    expect(input.getAttribute("aria-valuetext")).toBe("Custom width: 2");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe(
      "",
    );
    fireEvent.change(input, { target: { value: "" } });
    expect(input.hasAttribute("aria-valuenow")).toBe(false);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.getAttribute("aria-valuenow")).toBe("300");
    expect(input.hasAttribute("aria-invalid")).toBe(false);
  });

  it.each(["Enter", "blur"])(
    "announces a localized clamp only after %s commits",
    (commit) => {
      const { container } = render(
        <ControlledNumberInput onChange={vi.fn()} label="纸张宽度 (mm)" />,
      );
      const input = screen.getByRole("spinbutton", { name: "纸张宽度 (mm)" });
      const announcement = container.querySelector('[aria-live="polite"]');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "210" } });
      expect(announcement?.textContent).toBe("");
      expect(input.getAttribute("aria-valuetext")).toContain("mm");
      fireEvent.change(input, { target: { value: "2" } });
      expect(announcement?.textContent).toBe("");
      if (commit === "Enter") fireEvent.keyDown(input, { key: "Enter" });
      else fireEvent.blur(input);
      expect(input.getAttribute("aria-valuenow")).toBe("50");
      expect(input.hasAttribute("aria-invalid")).toBe(false);
      expect(announcement?.textContent).toBe(
        "纸张宽度 (mm) 已调整为 50，以保持在允许范围内。",
      );
      fireEvent.change(input, { target: { value: "80" } });
      expect(announcement?.textContent).toBe("");
      fireEvent.keyDown(input, { key: "Enter" });
      expect(announcement?.textContent).toBe("");
    },
  );

  it("uses a plain left-aligned input without stepper space by default", () => {
    render(<ControlledNumberInput onChange={vi.fn()} />);
    const input = screen.getByLabelText("Custom width");
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(input.classList.contains("text-left")).toBe(true);
    expect(input.classList.contains("px-3")).toBe(true);
  });

  it.each([
    ["210", "ArrowUp", 211],
    ["2", "ArrowUp", 50],
    ["1001", "ArrowDown", 1000],
    ["", "ArrowDown", 299],
  ] as const)(
    "adjusts draft %s with %s to %s and prevents default scrolling",
    (draft, key, expected) => {
      const onChange = vi.fn();
      render(<ControlledNumberInput onChange={onChange} />);
      const input = screen.getByLabelText("Custom width");
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: draft } });
      expect(fireEvent.keyDown(input, { key })).toBe(false);
      expect(input).toHaveProperty("value", String(expected));
      expect(screen.getByLabelText("Committed width").textContent).toBe(
        String(expected),
      );
      expect(onChange).toHaveBeenLastCalledWith(expected);
      fireEvent.keyDown(input, { key: "Escape" });
      expect(input).toHaveProperty("value", "300");
      expect(onChange).toHaveBeenLastCalledWith(300);
    },
  );

  it("normalizes decimal arrow adjustments and preserves Escape until Enter commits", () => {
    const onChange = vi.fn();
    render(
      <ControlledNumberInput
        onChange={onChange}
        initialValue={10.2}
        min={0}
        max={50}
        decimalPlaces={1}
        step={1}
      />,
    );
    const input = screen.getByLabelText("Custom width");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "0.1" } });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveProperty("value", "1.1");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveProperty("value", "0.1");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveProperty("value", "10.2");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveProperty("value", "11.2");
    expect(onChange).toHaveBeenLastCalledWith(11.2);
  });

  it("uses decimal precision as the default arrow step", () => {
    render(
      <ControlledNumberInput
        onChange={vi.fn()}
        initialValue={0.2}
        min={0}
        max={50}
        decimalPlaces={1}
      />,
    );
    const input = screen.getByLabelText("Custom width");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveProperty("value", "0.3");
  });

  it("uses the current committed value as the baseline after Enter on an empty draft", () => {
    render(<ControlledNumberInput onChange={vi.fn()} />);
    const input = screen.getByLabelText("Custom width");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "80" } });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input).toHaveProperty("value", "80");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveProperty("value", "80");
  });

  it.each([
    [50, "ArrowDown"],
    [1000, "ArrowUp"],
  ] as const)("keeps %s at its boundary on %s", (initialValue, key) => {
    const onChange = vi.fn();
    render(
      <ControlledNumberInput initialValue={initialValue} onChange={onChange} />,
    );
    const input = screen.getByLabelText("Custom width");
    fireEvent.focus(input);
    expect(fireEvent.keyDown(input, { key })).toBe(false);
    expect(input).toHaveProperty("value", String(initialValue));
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each(["Enter", "blur"])(
    "preserves each typed character when replacing custom width with 210 before %s",
    (commit) => {
      const onChange = vi.fn();
      render(<ControlledNumberInput onChange={onChange} />);
      const input = screen.getByLabelText("Custom width") as HTMLInputElement;
      fireEvent.focus(input);
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(3);

      for (const digit of "210") {
        const next =
          input.value.slice(0, input.selectionStart ?? 0) +
          digit +
          input.value.slice(input.selectionEnd ?? 0);
        fireEvent.change(input, { target: { value: next } });
        input.setSelectionRange(next.length, next.length);
        expect(input.value).toBe("210".slice(0, next.length));
      }
      expect(onChange.mock.calls).toEqual([[210]]);
      expect(screen.getByLabelText("Committed width").textContent).toBe("210");

      if (commit === "Enter") fireEvent.keyDown(input, { key: "Enter" });
      else fireEvent.blur(input);
      expect(input.value).toBe("210");
      expect(onChange).toHaveBeenLastCalledWith(210);
      expect(screen.getByLabelText("Committed width").textContent).toBe("210");
    },
  );

  it.each([
    ["2", 50, "Enter"],
    ["1001", 1000, "blur"],
  ] as const)(
    "keeps out-of-range draft %s until it is clamped to %s on %s",
    (draft, expected, commit) => {
      const onChange = vi.fn();
      render(<ControlledNumberInput onChange={onChange} />);
      const input = screen.getByLabelText("Custom width") as HTMLInputElement;
      fireEvent.focus(input);
      for (let length = 1; length <= draft.length; length++) {
        fireEvent.change(input, { target: { value: draft.slice(0, length) } });
        expect(input.value).toBe(draft.slice(0, length));
      }
      expect(onChange.mock.calls).toEqual(draft === "2" ? [] : [[100]]);
      if (commit === "Enter") fireEvent.keyDown(input, { key: "Enter" });
      else fireEvent.blur(input);
      expect(input.value).toBe(String(expected));
      expect(screen.getByLabelText("Committed width").textContent).toBe(
        String(expected),
      );
      expect(onChange).toHaveBeenLastCalledWith(expected);
    },
  );

  it("publishes valid live updates while Escape restores the editing baseline", () => {
    const onChange = vi.fn();
    render(<ControlledNumberInput onChange={onChange} />);
    const input = screen.getByLabelText("Custom width");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "80" } });
    expect(screen.getByLabelText("Committed width").textContent).toBe("80");
    expect(onChange).toHaveBeenLastCalledWith(80);
    fireEvent.change(input, { target: { value: "8" } });
    expect(input).toHaveProperty("value", "8");
    expect(onChange).toHaveBeenCalledTimes(1);

    expect(fireEvent.keyDown(input, { key: "Escape" })).toBe(false);
    expect(input).toHaveProperty("value", "300");
    expect(screen.getByLabelText("Committed width").textContent).toBe("300");
    expect(onChange).toHaveBeenLastCalledWith(300);
  });

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

  it("commits a draft with Enter", () => {
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
    fireEvent.change(input, { target: { value: "12" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenLastCalledWith(12);
  });

  it("restores the value from before editing with Escape", () => {
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
    fireEvent.change(input, { target: { value: "12" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onChange).toHaveBeenLastCalledWith(5);
    expect(input).toHaveProperty("value", "5");
  });

  it("uses the last Enter commit as the next Escape baseline", () => {
    const onChange = vi.fn();
    const { rerender } = render(
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
    fireEvent.change(input, { target: { value: "12" } });
    fireEvent.keyDown(input, { key: "Enter" });
    rerender(
      <NumberInput
        label="Rows"
        value={12}
        onChange={onChange}
        min={1}
        max={20}
        isInteger
      />,
    );
    fireEvent.change(input, { target: { value: "13" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onChange).toHaveBeenLastCalledWith(12);
  });

  it("disables the increment stepper when already at max", () => {
    const onChange = vi.fn();
    render(
      <NumberInput
        label="Rows"
        value={20}
        showStepper
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
        showStepper
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
        showStepper
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

  it("links horizontal minus/input/plus actions to the centered number field", () => {
    render(
      <NumberInput
        label="Rows"
        value={10}
        showStepper
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
    expect(increment.querySelectorAll("svg")).toHaveLength(1);
    expect(decrement.querySelectorAll("svg")).toHaveLength(1);
    expect(Array.from(input.parentElement!.children)).toEqual([
      decrement,
      input,
      increment,
    ]);
    expect(input.classList.contains("text-center")).toBe(true);
  });
});
