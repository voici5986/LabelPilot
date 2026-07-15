// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../utils/i18n";
import { Toast } from "./Toast";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Toast", () => {
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
});
