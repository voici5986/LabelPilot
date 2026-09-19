// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FieldShell } from "./FieldShell";

describe("FieldShell", () => {
  it("associates the label, hint, and error with one field", () => {
    render(
      <FieldShell
        label="Width"
        htmlFor="width"
        hint="Use millimeters"
        hintId="width-hint"
        error="Width is invalid"
        errorId="width-error"
      >
        <input id="width" aria-describedby="width-hint width-error" />
      </FieldShell>,
    );

    expect(screen.getByLabelText("Width").getAttribute("id")).toBe("width");
    expect(screen.getByText("Use millimeters").getAttribute("id")).toBe(
      "width-hint",
    );
    expect(screen.getByRole("alert").getAttribute("id")).toBe("width-error");
  });
});
