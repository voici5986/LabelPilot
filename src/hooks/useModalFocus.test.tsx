// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useModalFocus } from "./useModalFocus";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function TestModal({
  open = true,
  onDismiss = vi.fn(),
  preventEscape = false,
}: {
  open?: boolean;
  onDismiss?: () => void;
  preventEscape?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { handleKeyDown } = useModalFocus({
    open,
    containerRef,
    onDismiss,
  });
  return (
    <div ref={containerRef} onKeyDown={handleKeyDown} role="dialog">
      <button disabled>disabled</button>
      <div hidden>
        <button>hidden</button>
      </div>
      <button
        data-testid="first"
        onKeyDown={
          preventEscape ? (event) => event.preventDefault() : undefined
        }
      >
        first
      </button>
      <button data-testid="last">last</button>
    </div>
  );
}

describe("useModalFocus", () => {
  it("skips disabled and hidden controls when focusing and trapping", () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    const { getByRole, getByTestId } = render(<TestModal />);
    const dialog = getByRole("dialog");
    const first = getByTestId("first");
    const last = getByTestId("last");

    expect(document.activeElement).toBe(first);
    first.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(first);
  });

  it("dismisses on Escape and restores the trigger focus on close", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const onDismiss = vi.fn();
    const { rerender } = render(<TestModal onDismiss={onDismiss} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledOnce();

    rerender(<TestModal open={false} onDismiss={onDismiss} />);
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("does not dismiss when a focused control consumes Escape", () => {
    const onDismiss = vi.fn();
    const { getByTestId } = render(
      <TestModal onDismiss={onDismiss} preventEscape />,
    );

    const first = getByTestId("first");
    first.focus();
    fireEvent.keyDown(first, { key: "Escape" });

    expect(onDismiss).not.toHaveBeenCalled();
  });
});
