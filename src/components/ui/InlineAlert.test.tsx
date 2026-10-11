// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { InlineAlert } from "./InlineAlert";

afterEach(cleanup);

describe("InlineAlert", () => {
  it("honors an explicit caller role", () => {
    render(<InlineAlert role="alert">One-off error</InlineAlert>);
    expect(screen.getByRole("alert").textContent).toBe("One-off error");
  });
  it("exposes polite status semantics and the warning tone", () => {
    render(<InlineAlert tone="warning">Check the value</InlineAlert>);

    const alert = screen.getByRole("status");
    expect(alert.classList.contains("text-warning")).toBe(true);
    expect(alert.textContent).toContain("Check the value");
  });
});
