// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { useStore } from "./store/useStore";
import { AppError } from "./utils/appError";
import { I18nProvider } from "./utils/i18n";

const generatePDF = vi.hoisted(() => vi.fn());

vi.mock("./utils/pdfGenerator", () => ({ generatePDF }));
// Keep real controls and Toast; exit animation scheduling is outside this state test.
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./components/Header", () => ({ Header: () => null }));
vi.mock("./components/PreviewPanel", () => ({ PreviewPanel: () => null }));
vi.mock("./components/MobileActionBar", () => ({
  MobileActionBar: () => null,
}));
vi.mock("./components/EditSheet", () => ({ EditSheet: () => null }));
vi.mock("./components/CalibrationDialog", () => ({
  CalibrationDialog: () => null,
}));
vi.mock("./components/ReloadPrompt", () => ({ ReloadPrompt: () => null }));

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe("App visible PDF failure recovery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    generatePDF.mockReset();
    useStore.setState({ ...useStore.getInitialState(), appMode: "text" });
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  afterEach(() => {
    cleanup();
    useStore.setState(useStore.getInitialState(), true);
    localStorage.clear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("localizes a typed failure, unlocks editing, and restores generation after the error feedback", async () => {
    const first = deferred();
    const retry = deferred();
    generatePDF
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(retry.promise);
    render(
      <I18nProvider>
        <App />
      </I18nProvider>,
    );

    const prefix = screen.getByRole("textbox", { name: "前缀" });
    fireEvent.click(screen.getByRole("button", { name: "生成 PDF 文档" }));
    expect(prefix.matches(":disabled")).toBe(true);

    await act(async () =>
      first.reject(
        new AppError("generation_timeout", {}, "raw worker timeout"),
      ),
    );
    expect(screen.getByRole("alert").textContent).toBe(
      "生成 PDF 失败: 生成 PDF 超时，请减少标签数量后重试。",
    );
    expect(prefix.matches(":disabled")).toBe(false);
    expect(
      screen.getByRole("button", { name: "生成 PDF 失败" }),
    ).toHaveProperty("disabled", true);
    fireEvent.change(prefix, { target: { value: "RETRY-" } });
    expect(useStore.getState().textConfig.prefix).toBe("RETRY-");

    await act(async () => vi.advanceTimersByTimeAsync(2999));
    expect(
      screen.getByRole("button", { name: "生成 PDF 失败" }),
    ).toHaveProperty("disabled", true);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(screen.queryByRole("alert")).toBeNull();
    const generate = screen.getByRole("button", { name: "生成 PDF 文档" });
    expect(generate).toHaveProperty("disabled", false);

    fireEvent.click(generate);
    expect(generatePDF).toHaveBeenCalledTimes(2);
    expect(generatePDF.mock.calls[1][3]).toMatchObject({ prefix: "RETRY-" });
    expect(prefix.matches(":disabled")).toBe(true);
    await act(async () => retry.resolve());
    expect(screen.getByRole("button", { name: "PDF 已生成" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(prefix.matches(":disabled")).toBe(false);
    expect(screen.getByRole("status").textContent).toBe(
      "PDF 已生成！正在开始下载...",
    );
  });
});
