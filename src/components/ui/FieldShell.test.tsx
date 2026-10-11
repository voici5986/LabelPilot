// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FieldShell } from "./FieldShell";

afterEach(cleanup);

describe("FieldShell", () => {
  it("associates the label and hint with one field", () => {
    render(
      <FieldShell
        label="Width"
        htmlFor="width"
        hint="Use millimeters"
        hintId="width-hint"
      >
        <input id="width" aria-describedby="width-hint" />
      </FieldShell>,
    );

    expect(screen.getByLabelText("Width").getAttribute("id")).toBe("width");
    expect(screen.getByText("Use millimeters").getAttribute("id")).toBe(
      "width-hint",
    );
  });
});
