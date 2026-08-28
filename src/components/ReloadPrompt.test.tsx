// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStore } from "../store/useStore";
import { I18nProvider } from "../utils/i18n";
import { ReloadPrompt } from "./ReloadPrompt";

const updateServiceWorker = vi.hoisted(() => vi.fn());

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    offlineReady: [false, vi.fn()],
    needRefresh: [true, vi.fn()],
    updateServiceWorker,
  }),
}));

describe("ReloadPrompt", () => {
  beforeEach(() => {
    updateServiceWorker.mockReset();
    updateServiceWorker.mockResolvedValue(undefined);
    localStorage.clear();
    useStore.setState({ imageItems: [], imageUrlMap: new Map() });
  });

  afterEach(() => {
    cleanup();
    useStore.setState({ imageItems: [], imageUrlMap: new Map() });
  });

  it("requires confirmation before an update reload discards selected images", async () => {
    const file = new File(["image"], "label.png", { type: "image/png" });
    useStore.setState({ imageItems: [{ id: "image-1", file, count: 1 }] });
    render(
      <I18nProvider>
        <ReloadPrompt />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "立即更新并刷新" }));

    expect(updateServiceWorker).not.toHaveBeenCalled();
    expect(screen.getByText(/1 张已选图片/)).toBeTruthy();

    act(() => {
      useStore.setState({
        imageItems: [
          {
            id: "image-1",
            file: new File(["replacement"], "replacement.png", {
              type: "image/png",
            }),
            count: 1,
          },
        ],
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "立即更新并刷新" }));
    expect(updateServiceWorker).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "仍然更新并刷新" }));
    await vi.waitFor(() =>
      expect(updateServiceWorker).toHaveBeenCalledWith(true),
    );
  });
});
