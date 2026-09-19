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

  it("exposes mobile and desktop icons for the responsive layout", () => {
    render(
      <StepperButton
        aria-label="Decrease"
        direction="decrement"
        layout="responsive"
      />,
    );

    const icons = screen
      .getByRole("button", { name: "Decrease" })
      .querySelectorAll("svg");
    expect(icons).toHaveLength(2);
    expect(icons[0]?.classList.contains("lg:hidden")).toBe(true);
    expect(icons[1]?.classList.contains("lg:block")).toBe(true);
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
    expect(classes.contains("enabled:hover:bg-brand-primary/10")).toBe(true);
    expect(classes.contains("enabled:active:bg-brand-primary/10")).toBe(true);
    expect(classes.contains("focus-visible:outline-offset-[-2px]")).toBe(true);
    expect(classes.contains("disabled:cursor-not-allowed")).toBe(true);
  });
});
