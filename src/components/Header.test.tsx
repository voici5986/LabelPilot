// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../utils/i18n";
import { Header } from "./Header";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

function createInstallPrompt(outcome: "accepted" | "dismissed") {
  return Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome, platform: "web" }),
  });
}

describe("Header installation", () => {
  it.each(["accepted", "dismissed"] as const)(
    "hides a consumed %s prompt and enables installation for a fresh event",
    async (outcome) => {
      render(
        <I18nProvider>
          <Header onOpenCalibration={vi.fn()} />
        </I18nProvider>,
      );
      const installName = "安装应用以获得更好体验";
      expect(screen.queryByRole("button", { name: installName })).toBeNull();

      const prompt = createInstallPrompt(outcome);
      fireEvent(window, prompt);
      expect(prompt.defaultPrevented).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: installName }));
      await waitFor(() =>
        expect(screen.queryByRole("button", { name: installName })).toBeNull(),
      );
      expect(prompt.prompt).toHaveBeenCalledTimes(1);

      const freshPrompt = createInstallPrompt("accepted");
      fireEvent(window, freshPrompt);
      fireEvent.click(screen.getByRole("button", { name: installName }));
      await waitFor(() =>
        expect(screen.queryByRole("button", { name: installName })).toBeNull(),
      );
      expect(freshPrompt.prompt).toHaveBeenCalledTimes(1);
      expect(prompt.prompt).toHaveBeenCalledTimes(1);
    },
  );
});
