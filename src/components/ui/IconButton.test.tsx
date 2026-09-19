// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { IconButton } from "./IconButton";

function TestIcon() {
  return <svg data-testid="test-icon" />;
}

describe("IconButton", () => {
  it("provides a named button with safe native defaults", () => {
    const ref = createRef<HTMLButtonElement>();
    const onClick = vi.fn();

    render(
      <IconButton
        ref={ref}
        aria-label="Close preview"
        name="close-preview"
        title="Close"
        onClick={onClick}
      >
        <TestIcon />
      </IconButton>,
    );

    const button = screen.getByRole("button", { name: "Close preview" });
    fireEvent.click(button);

    expect(button.getAttribute("type")).toBe("button");
    expect(button.getAttribute("name")).toBe("close-preview");
    expect(button.getAttribute("title")).toBe("Close");
    expect(ref.current).toBe(button);
    expect(onClick).toHaveBeenCalledOnce();
    expect(
      screen
        .getByTestId("test-icon")
        .parentElement?.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("keeps disabled native buttons inert", () => {
    const onClick = vi.fn();

    render(
      <IconButton aria-label="Previous page" disabled onClick={onClick}>
        <TestIcon />
      </IconButton>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("suppresses hover styling for every tone while disabled", () => {
    const tones = [
      "default",
      "neutral",
      "brand",
      "elevated",
      "success",
      "danger",
      "warning",
    ] as const;

    render(
      <>
        {tones.map((tone) => (
          <IconButton
            key={tone}
            aria-label={`Disabled ${tone}`}
            tone={tone}
            disabled
          >
            <TestIcon />
          </IconButton>
        ))}
      </>,
    );

    for (const tone of tones) {
      const classes = screen
        .getByRole("button", { name: `Disabled ${tone}` })
        .className.split(" ");
      expect(classes.some((name) => name.startsWith("enabled:hover:"))).toBe(
        true,
      );
      expect(classes.some((name) => name.startsWith("hover:"))).toBe(false);
    }
  });

  it("maps the finite visual variants and optional expanded hit area", () => {
    render(
      <IconButton
        aria-label="Dismiss success"
        size="compact"
        tone="success"
        shape="full"
        expandedHitArea
      >
        <TestIcon />
      </IconButton>,
    );

    const button = screen.getByRole("button", { name: "Dismiss success" });
    expect(button.className).toContain("h-[22px]");
    expect(button.className).toContain("enabled:hover:bg-success/10");
    expect(
      button.className.split(" ").some((name) => name.startsWith("hover:")),
    ).toBe(false);
    expect(button.className).toContain("rounded-full");
    expect(button.className).toContain("hit-target");
    expect(button.className).toContain("[--hit-target-inset:-11px]");
  });

  it("compensates expanded hit areas for bordered tones", () => {
    render(
      <IconButton
        aria-label="Reset zoom"
        size="md"
        tone="elevated"
        expandedHitArea
      >
        <TestIcon />
      </IconButton>,
    );

    expect(
      screen.getByRole("button", { name: "Reset zoom" }).className,
    ).toContain("[--hit-target-inset:-7px]");
  });
});
