// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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
        <SettingsMenu onOpenCalibration={vi.fn()} />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "全局设置" }));

    expect(screen.getAllByRole("button", { name: "自定义尺寸" })).toHaveLength(
      1,
    );
    fireEvent.click(screen.getByRole("button", { name: "A4" }));
    expect(useStore.getState().paperSizeMode).toBe("A4");
  });

  it("opens the calibration flow from the display group and closes the menu", async () => {
    const onOpenCalibration = vi.fn();
    render(
      <I18nProvider>
        <SettingsMenu onOpenCalibration={onOpenCalibration} />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "全局设置" }));
    fireEvent.click(screen.getByRole("button", { name: /屏幕 1:1 校准/ }));

    expect(onOpenCalibration).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "全局设置" })).toBeNull(),
    );
  });

  it("closes via Escape while focus is still on the trigger before the pending focus rAF runs", async () => {
    // 模拟真实浏览器：rAF 回调排队但不立即执行，打开菜单后焦点仍停留在触发按钮上。
    const pendingFrames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      pendingFrames.push(callback);
      return pendingFrames.length;
    });

    render(
      <I18nProvider>
        <SettingsMenu onOpenCalibration={vi.fn()} />
      </I18nProvider>,
    );

    const settingsButton = screen.getByRole("button", { name: "全局设置" });
    fireEvent.click(settingsButton);
    expect(screen.getByRole("dialog", { name: "全局设置" })).toBeTruthy();

    // 焦点尚未进入面板（rAF 未执行），Escape 应仍能关闭菜单。
    fireEvent.keyDown(settingsButton, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "全局设置" })).toBeNull(),
    );

    // 排队的焦点回调执行后，焦点应回到触发按钮。
    for (const frame of pendingFrames.splice(0)) frame(0);
    expect(document.activeElement).toBe(settingsButton);
  });
});
