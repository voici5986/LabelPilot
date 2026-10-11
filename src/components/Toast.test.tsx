// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../utils/i18n";
import { Toast } from "./Toast";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Toast", () => {
  it("restarts the lifetime for a new event with the same visible message", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const content = (eventId: number) => (
      <I18nProvider>
        <Toast
          eventId={eventId}
          message="Saved"
          type="success"
          isVisible
          onClose={onClose}
        />
      </I18nProvider>
    );
    const { rerender } = render(content(1));
    vi.advanceTimersByTime(2000);
    rerender(content(2));
    vi.advanceTimersByTime(1000);
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1999);
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not restart auto-close when only the parent callback changes", () => {
    vi.useFakeTimers();
    const firstOnClose = vi.fn();
    const latestOnClose = vi.fn();
    const { rerender } = render(
      <I18nProvider>
        <Toast
          message="Saved"
          type="success"
          isVisible
          onClose={firstOnClose}
        />
      </I18nProvider>,
    );

    vi.advanceTimersByTime(2000);
    rerender(
      <I18nProvider>
        <Toast
          message="Saved"
          type="success"
          isVisible
          onClose={latestOnClose}
        />
      </I18nProvider>,
    );
    vi.advanceTimersByTime(1000);

    expect(firstOnClose).not.toHaveBeenCalled();
    expect(latestOnClose).toHaveBeenCalledOnce();
  });

  it("keeps long messages within the viewport and keeps the close button from shrinking", () => {
    render(
      <I18nProvider>
        <Toast
          message={"A very long message ".repeat(20)}
          type="warning"
          isVisible
          onClose={vi.fn()}
        />
      </I18nProvider>,
    );

    const toast = screen.getByRole("status");
    expect(toast.classList.contains("max-w-full")).toBe(true);
    const message = toast.querySelector("span");
    expect(message?.classList.contains("min-w-0")).toBe(true);
    expect(message?.classList.contains("break-words")).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "关闭" })
        .classList.contains("shrink-0"),
    ).toBe(true);
  });
});
