// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StepperButton } from "./StepperButton";

afterEach(cleanup);

describe("StepperButton", () => {
  it("exposes one horizontal icon and a non-submitting button by default", () => {
    render(
      <form>
        <StepperButton aria-label="Increase" direction="increment" />
      </form>,
    );

    const button = screen.getByRole("button", { name: "Increase" });
    expect(button).toHaveProperty("type", "button");
    expect(button.querySelectorAll("svg")).toHaveLength(1);
  });

  it("uses one horizontal icon and responsive dimensions for form fields", () => {
    render(
      <StepperButton
        aria-label="Decrease"
        direction="decrement"
        variant="form"
      />,
    );

    const button = screen.getByRole("button", { name: "Decrease" });
    expect(button.querySelectorAll("svg")).toHaveLength(1);
    expect(button.classList.contains("h-10")).toBe(true);
    expect(button.classList.contains("w-10")).toBe(true);
    expect(button.classList.contains("lg:h-8")).toBe(true);
    expect(button.classList.contains("lg:w-8")).toBe(true);
  });

  it("uses native disabled behavior and does not dispatch clicks", () => {
    const onClick = vi.fn();
    render(
      <StepperButton
        aria-label="Increase"
        direction="increment"
        disabled
        onClick={onClick}
      />,
    );

    const button = screen.getByRole("button", { name: "Increase" });
    fireEvent.click(button);

    expect(button).toHaveProperty("disabled", true);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("owns the shared geometry and interaction-state contract", () => {
    render(<StepperButton aria-label="Increase" direction="increment" />);

    const classes = screen.getByRole("button", { name: "Increase" }).classList;
    expect(classes.contains("h-10")).toBe(true);
    expect(classes.contains("w-10")).toBe(true);
    expect(classes.contains("lg:h-8")).toBe(false);
    expect(classes.contains("lg:w-8")).toBe(false);
    expect(classes.contains("enabled:hover:bg-brand-primary/10")).toBe(true);
    expect(classes.contains("enabled:active:bg-brand-primary/10")).toBe(true);
    expect(classes.contains("focus-visible:outline-offset-[-2px]")).toBe(true);
    expect(classes.contains("disabled:cursor-not-allowed")).toBe(true);
  });
});
