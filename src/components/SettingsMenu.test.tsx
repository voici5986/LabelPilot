// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "../store/useStore";
import { I18nProvider } from "../utils/i18n";
import { SettingsMenu } from "./SettingsMenu";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  useStore.getState().setPaperSizeMode("Custom");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useStore.getState().setPaperSizeMode("A4");
});

describe("SettingsMenu", () => {
  it("shows A4 as the preset fallback while custom paper is selected", () => {
    render(
      <I18nProvider>
        <SettingsMenu />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "全局设置" }));

    expect(screen.getAllByRole("button", { name: "自定义尺寸" })).toHaveLength(
      1,
    );
    fireEvent.click(screen.getByRole("button", { name: "A4" }));
    expect(useStore.getState().paperSizeMode).toBe("A4");
  });
});
