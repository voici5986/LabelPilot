// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../utils/i18n";
import { ZoomControl } from "./ZoomControl";

afterEach(cleanup);

function renderControl(zoomMode: "fit" | "manual" | "actual") {
  return render(
    <I18nProvider>
      <ZoomControl
        zoomMode={zoomMode}
        manualScale={1.5}
        onZoomModeChange={vi.fn()}
        onManualScaleChange={vi.fn()}
        onRequestActual={vi.fn()}
      />
    </I18nProvider>,
  );
}

describe("ZoomControl accessibility", () => {
  it("keeps the zoom readout visible without hover and explains its scale", () => {
    renderControl("manual");
    expect(screen.getByText("150%")).toBeTruthy();
    const slider = screen.getByRole("slider");
    const hint = document.getElementById(
      slider.getAttribute("aria-describedby")!,
    );
    expect(hint?.textContent).toContain("100% 表示适应窗口");
    fireEvent.focus(slider);
    fireEvent.blur(slider);
    expect(screen.getByText("150%")).toBeTruthy();
  });
  it("keeps both desktop actions at a 44px non-overlapping hit target", () => {
    renderControl("fit");

    const reset = screen.getByRole("button", { name: "适应窗口" });
    const actual = screen.getByRole("button", { name: "1:1 实际尺寸" });
    const actionGroup = reset.parentElement;

    expect(reset.className).toContain("[--hit-target-inset:-7px]");
    expect(actual.className).toContain("h-9");
    expect(actual.className).toContain("min-w-9");
    expect(actual.className).toContain("hit-target");
    expect(actual.className).toContain("[--hit-target-inset:-5px]");
    expect(actionGroup?.className).toContain("gap-3");
  });

  it("exposes actual size as 100% with descriptive value text", () => {
    renderControl("actual");
    const slider = screen.getByRole("slider");

    expect(slider.getAttribute("aria-valuenow")).toBe("100");
    expect(slider.getAttribute("aria-valuetext")).toBe("1:1");
    expect(slider.querySelector("div[style]")?.getAttribute("style")).toContain(
      "bottom: 50%;",
    );
  });

  it("uses the manual percentage for keyboard adjustments", () => {
    const onZoomModeChange = vi.fn();
    const onManualScaleChange = vi.fn();
    render(
      <I18nProvider>
        <ZoomControl
          zoomMode="manual"
          manualScale={1.5}
          onZoomModeChange={onZoomModeChange}
          onManualScaleChange={onManualScaleChange}
          onRequestActual={vi.fn()}
        />
      </I18nProvider>,
    );
    const slider = screen.getByRole("slider");

    expect(slider.getAttribute("aria-valuenow")).toBe("150");
    expect(slider.getAttribute("aria-valuetext")).toBe("150%");
    fireEvent.keyDown(slider, { key: "ArrowDown" });

    expect(onManualScaleChange).toHaveBeenCalledWith(1.4);
    expect(onZoomModeChange).toHaveBeenCalledWith("manual");
  });

  it("supports pointer dragging from the full hit area without drag animation", () => {
    const onZoomModeChange = vi.fn();
    const onManualScaleChange = vi.fn();
    const onInteractionChange = vi.fn();

    render(
      <I18nProvider>
        <ZoomControl
          zoomMode="manual"
          manualScale={1}
          onZoomModeChange={onZoomModeChange}
          onManualScaleChange={onManualScaleChange}
          onRequestActual={vi.fn()}
          onInteractionChange={onInteractionChange}
        />
      </I18nProvider>,
    );

    const slider = screen.getByRole("slider");
    const thumb = slider.querySelector("div[style]") as HTMLDivElement;
    const track = thumb.parentElement as HTMLDivElement;
    vi.spyOn(track, "getBoundingClientRect").mockReturnValue({
      top: 0,
      height: 100,
      bottom: 100,
      left: 0,
      right: 6,
      width: 6,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const setPointerCapture = vi.fn();
    Object.defineProperty(slider, "setPointerCapture", {
      configurable: true,
      value: setPointerCapture,
    });

    fireEvent.pointerDown(slider, {
      button: 0,
      clientY: 50,
      pointerId: 7,
      pointerType: "mouse",
    });

    expect(setPointerCapture).toHaveBeenCalledWith(7);
    expect(onInteractionChange).toHaveBeenNthCalledWith(1, true);
    expect(slider.querySelector("div[style]")?.className).toContain(
      "transition-none",
    );

    fireEvent.pointerMove(slider, {
      clientY: 0,
      pointerId: 7,
      pointerType: "mouse",
    });
    fireEvent.pointerUp(slider, {
      pointerId: 7,
      pointerType: "mouse",
    });

    expect(onManualScaleChange).toHaveBeenCalledWith(3);
    expect(onZoomModeChange).toHaveBeenCalledWith("manual");
    expect(onInteractionChange).toHaveBeenLastCalledWith(false);
  });
});
