// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../utils/i18n";
import { useStore } from "../store/useStore";
import { CalibrationDialog } from "./CalibrationDialog";
import type { CalibrationDialogSource } from "./CalibrationDialog";

const savedCalibration = {
  k: 1.25,
  referenceMm: 100 as const,
  measuredMm: 125,
  dpr: 1.25,
  screenWidth: 1536,
  screenHeight: 864,
  calibratedAt: "2026-08-05T00:00:00.000Z",
};

beforeEach(() => {
  localStorage.clear();
  useStore.setState({ screenCalibration: null });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useStore.setState({ screenCalibration: null });
});

function renderDialog(
  overrides: {
    source?: CalibrationDialogSource;
    environmentMismatch?: boolean;
    open?: boolean;
  } = {},
) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const tree = (open: boolean) => (
    <I18nProvider>
      <CalibrationDialog
        open={open}
        source={overrides.source ?? "zoom"}
        environmentMismatch={overrides.environmentMismatch ?? false}
        onClose={onClose}
        onSaved={onSaved}
      />
    </I18nProvider>
  );
  const { rerender } = render(tree(overrides.open ?? true));
  return { onClose, onSaved, rerender, tree };
}

describe("CalibrationDialog", () => {
  it("computes k live and saves from the zoom source", () => {
    const { onSaved } = renderDialog();

    fireEvent.change(screen.getByLabelText(/量出来是/), {
      target: { value: "125" },
    });
    expect(screen.getByText("1 CSS mm = 1.250 现实 mm")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "保存并查看 1:1" }));

    expect(onSaved).toHaveBeenCalledTimes(1);
    const cal = onSaved.mock.calls[0][0] as typeof savedCalibration;
    expect(cal.k).toBeCloseTo(1.25);
    expect(cal.referenceMm).toBe(100);
    expect(cal.measuredMm).toBe(125);
  });

  it("saves from the settings source with its own label (mode switch is App's job)", () => {
    const { onSaved } = renderDialog({ source: "settings" });
    expect(screen.getByRole("button", { name: "保存校准" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "保存并查看 1:1" })).toBeNull();

    fireEvent.change(screen.getByLabelText(/量出来是/), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存校准" }));

    expect(onSaved).toHaveBeenCalledTimes(1);
    expect((onSaved.mock.calls[0][0] as typeof savedCalibration).k).toBeCloseTo(
      1,
    );
  });

  it("prefills the previous measurement on re-calibration", () => {
    useStore.setState({ screenCalibration: savedCalibration });
    renderDialog();

    expect(screen.getByLabelText(/量出来是/)).toHaveProperty("value", "125");
  });

  it("clears the prefill and shows a banner when the environment mismatches", () => {
    useStore.setState({ screenCalibration: savedCalibration });
    renderDialog({ environmentMismatch: true });

    expect(screen.getByLabelText(/量出来是/)).toHaveProperty("value", "");
    expect(screen.getByRole("alert").textContent).toContain("重新测量校准");
  });

  it("cancel via Escape preserves the previously saved calibration", () => {
    useStore.setState({ screenCalibration: savedCalibration });
    const { onClose } = renderDialog();

    fireEvent.change(screen.getByLabelText(/量出来是/), {
      target: { value: "200" },
    });
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(useStore.getState().screenCalibration).toEqual(savedCalibration);
  });

  it("disables save for out-of-range input and explains the reason", () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText(/量出来是/), {
      target: { value: "9999" },
    });

    expect(
      (
        screen.getByRole("button", {
          name: "保存并查看 1:1",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText(/超出合理范围/)).toBeTruthy();
  });

  it("focuses the measurement input when opened", () => {
    renderDialog();
    expect(document.activeElement).toBe(screen.getByLabelText(/量出来是/));
  });

  it("traps focus with Tab and Shift+Tab", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog");
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    first.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);

    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: false });
    expect(document.activeElement).toBe(first);
  });

  it("restores focus to the trigger when closed", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender, tree } = renderDialog();
    // 打开时记录焦点来源 = trigger；关闭后恢复
    rerender(tree(false));
    expect(document.activeElement).toBe(trigger);

    trigger.remove();
  });
});
