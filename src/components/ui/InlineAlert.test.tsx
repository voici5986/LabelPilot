// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InlineAlert } from "./InlineAlert";

describe("InlineAlert", () => {
  it("exposes alert semantics and the warning tone", () => {
    render(<InlineAlert tone="warning">Check the value</InlineAlert>);

    const alert = screen.getByRole("alert");
    expect(alert.classList.contains("text-warning")).toBe(true);
    expect(alert.textContent).toContain("Check the value");
  });
});
