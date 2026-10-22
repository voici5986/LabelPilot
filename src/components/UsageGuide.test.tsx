// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { I18nProvider } from "../utils/i18n";
import { Header } from "./Header";
import { UsageGuide } from "./UsageGuide";

function GuideHarness({
  onRestartTour,
  isGenerating = false,
}: {
  onRestartTour?: () => void;
  isGenerating?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Header onOpenCalibration={vi.fn()} onOpenGuide={() => setOpen(true)} />
      <UsageGuide
        open={open}
        onClose={() => setOpen(false)}
        onRestartTour={onRestartTour}
        isGenerating={isGenerating}
      />
    </>
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

it.each([
  ["zh", "使用指南", "关闭使用指南", "SN-001", "实际大小 / 100%"],
  ["en", "User guide", "Close user guide", "SN-001", "Actual size / 100%"],
])(
  "opens the %s guide with focus trapping and returns focus after Escape",
  async (language, title, closeName, example, printing) => {
    localStorage.setItem("label_printer_lang", language);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(0), 0),
    );
    vi.stubGlobal("cancelAnimationFrame", window.clearTimeout);
    render(
      <I18nProvider>
        <GuideHarness />
      </I18nProvider>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    const trigger = screen.getByRole("button", { name: title });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: title });
    const close = screen.getByRole("button", { name: closeName });
    await waitFor(() => expect(document.activeElement).toBe(close));
    expect(dialog.textContent).toContain(example);
    expect(dialog.textContent).toContain(printing);
    expect(dialog.querySelectorAll("li")).toHaveLength(4);
    const body = screen.getByRole("region", { name: title });
    body.focus();
    const forward = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    body.dispatchEvent(forward);
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(body);
    fireEvent.keyDown(body, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  },
);

it.each([false, true])(
  "keeps replay after the reading region and traps focus when generating is %s",
  async (isGenerating) => {
    const onRestartTour = vi.fn();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(0), 0),
    );
    vi.stubGlobal("cancelAnimationFrame", window.clearTimeout);
    render(
      <I18nProvider>
        <GuideHarness
          onRestartTour={onRestartTour}
          isGenerating={isGenerating}
        />
      </I18nProvider>,
    );
    const trigger = screen.getByRole("button", { name: "使用指南" });
    trigger.focus();
    fireEvent.click(trigger);
    const close = screen.getByRole("button", { name: "关闭使用指南" });
    const body = screen.getByRole("region", { name: "使用指南" });
    const replay = screen.getByRole("button", { name: "重新导览" });
    await waitFor(() => expect(document.activeElement).toBe(close));
    expect(body.contains(replay)).toBe(false);
    expect(
      body.compareDocumentPosition(replay) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect((replay as HTMLButtonElement).disabled).toBe(isGenerating);
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(isGenerating ? body : replay);
    fireEvent.keyDown(document.activeElement!, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    fireEvent.click(replay);
    expect(onRestartTour).toHaveBeenCalledTimes(isGenerating ? 0 : 1);
    fireEvent.keyDown(close, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  },
);
