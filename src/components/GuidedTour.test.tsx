// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import {
  findVisibleTourTarget,
  getVisibleTourRect,
  intersectTourRects,
} from "../utils/guidedTour";
import { I18nProvider } from "../utils/i18n";
import { GuidedTour, type GuidedTourProps } from "./GuidedTour";

const disconnect = vi.fn();
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = disconnect;
    },
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 0),
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const defaults: GuidedTourProps = {
  open: true,
  steps: ["content", "layout", "preview", "zoom", "generate"],
  stepIndex: 0,
  appMode: "image",
  onNext: vi.fn(),
  onBack: vi.fn(),
  onClose: vi.fn(),
};
function tour(patch: Partial<GuidedTourProps> = {}) {
  return (
    <I18nProvider>
      <GuidedTour {...defaults} {...patch} />
    </I18nProvider>
  );
}
function target(step = "content") {
  const node = document.createElement("div");
  node.dataset.tour = step;
  node.getBoundingClientRect = () => ({
    x: 30,
    y: 80,
    left: 30,
    top: 80,
    right: 230,
    bottom: 180,
    width: 200,
    height: 100,
    toJSON() {},
  });
  document.body.append(node);
  return node;
}

it.each([
  {
    language: "en",
    title: "Zoom and 1:1",
    explanations: [
      "100% means Fit to window, not physical size",
      "first click opens calibration",
      "Ctrl+0",
      "real ruler",
      "enter its measured length and save",
      "Calibration only changes the preview",
      "PDF paper size and print scale are separate",
      "Actual Size / 100%",
    ],
  },
  {
    language: "zh",
    title: "缩放与 1:1",
    explanations: [
      "100% 表示适应窗口，不是物理实际尺寸",
      "首次点击会打开校准",
      "Ctrl+0",
      "真实尺子",
      "输入实测长度并保存",
      "校准只改变预览",
      "PDF 纸张尺寸与打印缩放需分别设置",
      "实际大小 / 100%",
    ],
  },
])(
  "explains the real 1:1 calibration workflow in $language",
  async ({ language, title, explanations }) => {
    localStorage.setItem("label_printer_lang", language);
    target("zoom");
    render(tour({ stepIndex: 3 }));
    expect(screen.getByRole("heading", { name: title })).toBeTruthy();
    const body = screen.getByRole("region", { name: title });
    for (const explanation of explanations)
      expect(body.textContent).toContain(explanation);
    expect(screen.getByRole("status").textContent).toContain("4 / 5");
    await waitFor(() =>
      expect(document.querySelector("[data-tour-arrow]")).not.toBeNull(),
    );
  },
);

it("selects a visible responsive duplicate and clips its scroll container", () => {
  const hidden = target();
  const parent = document.createElement("div");
  parent.style.display = "none";
  document.body.append(parent);
  parent.append(hidden);
  const visible = target();
  expect(findVisibleTourTarget("content")).toBe(visible);
  const clip = document.createElement("div");
  clip.style.overflowX = "hidden";
  clip.style.overflowY = "hidden";
  clip.getBoundingClientRect = () =>
    ({ left: 0, top: 100, width: 150, height: 50 }) as DOMRect;
  document.body.append(clip);
  clip.append(visible);
  expect(
    getVisibleTourRect(visible, { x: 0, y: 0, width: 360, height: 420 }),
  ).toEqual({ x: 30, y: 100, width: 120, height: 50 });
});

it("keeps missing-target navigation usable and calls each control", async () => {
  const onClose = vi.fn();
  const onNext = vi.fn();
  const onBack = vi.fn();
  render(tour({ stepIndex: 4, onClose, onNext, onBack }));
  await screen.findByText(
    "此控件暂未显示在工作区中。可以继续下一步或跳过导览。",
  );
  const dialog = screen.getByRole("dialog");
  expect(dialog.hasAttribute("aria-modal")).toBe(false);
  expect(document.querySelector("[data-tour-arrow]")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "完成" }));
  fireEvent.click(screen.getByRole("button", { name: "上一步" }));
  fireEvent.click(screen.getByRole("button", { name: "跳过" }));
  fireEvent.click(screen.getByRole("button", { name: "关闭导览" }));
  expect(onNext).toHaveBeenCalledOnce();
  expect(onBack).toHaveBeenCalledOnce();
  expect(onClose).toHaveBeenCalledTimes(2);
});

it("portals into the sheet, updates mode copy and only focuses on step changes", async () => {
  target();
  target("layout");
  const host = document.createElement("div");
  document.body.append(host);
  const input = document.createElement("input");
  document.body.append(input);
  const result = render(tour({ portalHost: host }));
  expect(host.contains(screen.getByRole("dialog"))).toBe(true);
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "下一步" }),
    ),
  );
  await waitFor(() =>
    expect(document.querySelector("[data-tour-highlight]")).not.toBeNull(),
  );
  input.focus();
  fireEvent.scroll(document);
  result.rerender(tour({ portalHost: host, appMode: "text" }));
  expect(screen.getByText("设置连续编号")).toBeTruthy();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  expect(document.activeElement).toBe(input);
  result.rerender(tour({ portalHost: host, stepIndex: 1 }));
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "下一步" }),
    ),
  );
  result.unmount();
  expect(disconnect).toHaveBeenCalled();
});

it("leaves underlying controls clickable and uses English text when selected", async () => {
  localStorage.setItem("label_printer_lang", "en");
  const node = target();
  const click = vi.fn();
  node.addEventListener("click", click);
  render(tour());
  await waitFor(() =>
    expect(document.querySelector("[data-tour-arrow]")).not.toBeNull(),
  );
  expect(screen.getByText("Add your images")).toBeTruthy();
  expect(
    document
      .querySelector("[data-tour-overlay]")
      ?.classList.contains("pointer-events-none"),
  ).toBe(true);
  fireEvent.click(node);
  expect(click).toHaveBeenCalledOnce();
});

it("recovers focused portal controls on host changes but preserves an active input", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const result = render(tour());
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "下一步" }),
    ),
  );
  result.rerender(tour({ portalHost: host }));
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "下一步" }),
    ),
  );
  const input = document.createElement("input");
  document.body.append(input);
  input.focus();
  result.rerender(tour());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 15));
  });
  expect(document.activeElement).toBe(input);
  const body = screen.getByRole("region", { name: "添加标签图片" });
  expect(body.tabIndex).toBe(0);
  expect(body.className).toContain("focus-visible:outline");
});

it("defers tour focus beyond the sheet's own entry frame and cancels pending focus on close", async () => {
  const close = document.createElement("button");
  document.body.append(close);
  const result = render(tour());
  requestAnimationFrame(() => close.focus());
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "下一步" }),
    ),
  );
  close.focus();
  result.rerender(tour({ stepIndex: 1 }));
  result.rerender(tour({ open: false, stepIndex: 1 }));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 15));
  });
  expect(document.activeElement).toBe(close);
});

it("sizes the actual card to a narrow visual viewport and permits footer wrapping", async () => {
  const viewport = Object.assign(new EventTarget(), {
    width: 220,
    height: 420,
    offsetLeft: 20,
    offsetTop: 40,
  });
  vi.stubGlobal("visualViewport", viewport);
  render(tour({ stepIndex: 1 }));
  const card = screen.getByRole("dialog");
  await waitFor(() => expect(card.style.width).toBe("196px"));
  expect(Number.parseFloat(card.style.left)).toBeGreaterThanOrEqual(32);
  expect(
    Number.parseFloat(card.style.left) + Number.parseFloat(card.style.width),
  ).toBeLessThanOrEqual(228);
  expect(
    screen.getByRole("button", { name: "下一步" }).parentElement?.className,
  ).toContain("flex-wrap");
  viewport.width = 800;
  act(() => {
    viewport.dispatchEvent(new Event("resize"));
  });
  await waitFor(() => expect(card.style.width).toBe("280px"));
});

it("announces translated progress, title and body without making the dialog live", () => {
  const result = render(tour());
  const status = screen.getByRole("status");
  expect(status.getAttribute("aria-live")).toBe("polite");
  expect(status.getAttribute("aria-atomic")).toBe("true");
  expect(status.textContent).toContain("1 / 5");
  expect(status.textContent).toContain(screen.getByRole("heading").textContent);
  result.rerender(tour({ appMode: "text" }));
  expect(status.textContent).toContain(screen.getByRole("heading").textContent);
  expect(screen.getByRole("dialog").hasAttribute("aria-live")).toBe(false);
});
it("ignores unrelated animation style mutations while recovering hidden targets", async () => {
  const node = target();
  const measure = vi.spyOn(node, "getBoundingClientRect");
  const animated = document.createElement("div");
  document.body.append(animated);
  render(tour());
  await waitFor(() =>
    expect(document.querySelector("[data-tour-highlight]")).not.toBeNull(),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  measure.mockClear();
  await act(async () => {
    animated.style.transform = "translateX(1px)";
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(measure).not.toHaveBeenCalled();
  await act(async () => {
    node.hidden = true;
  });
  await waitFor(() =>
    expect(document.querySelector("[data-tour-highlight]")).toBeNull(),
  );
  await act(async () => {
    node.hidden = false;
  });
  await waitFor(() =>
    expect(document.querySelector("[data-tour-highlight]")).not.toBeNull(),
  );
});

it("keeps sheet card in normal flow and SVG geometry in the viewport", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  render(tour({ portalHost: host }));
  const card = screen.getByRole("dialog");
  expect(host.contains(card)).toBe(true);
  const overlay = document.querySelector("body > svg[aria-hidden]");
  expect(overlay?.parentElement).toBe(document.body);
  expect(host.contains(overlay)).toBe(false);
});

it("discovers a mounted target and observes hidden ancestors for recovery", async () => {
  render(tour());
  await waitFor(() =>
    expect(document.querySelector("[data-tour-highlight]")).toBeNull(),
  );
  const ancestor = document.createElement("div");
  document.body.append(ancestor);
  await act(async () => {
    ancestor.append(target());
  });
  await waitFor(() =>
    expect(document.querySelector("[data-tour-highlight]")).not.toBeNull(),
  );
  await act(async () => {
    ancestor.hidden = true;
  });
  await waitFor(() =>
    expect(document.querySelector("[data-tour-highlight]")).toBeNull(),
  );
  await act(async () => {
    ancestor.hidden = false;
  });
  await waitFor(() =>
    expect(document.querySelector("[data-tour-highlight]")).not.toBeNull(),
  );
});

it("moves away from a settings popup mounted after placement without observing its own dialog", async () => {
  vi.stubGlobal("innerWidth", 1200);
  vi.stubGlobal("innerHeight", 800);
  target();
  const preview = target("preview");
  preview.getBoundingClientRect = () => ({
    x: 332,
    y: 72,
    left: 332,
    top: 72,
    right: 1188,
    bottom: 776,
    width: 856,
    height: 704,
    toJSON() {},
  });
  render(tour());
  const card = screen.getByRole("dialog");
  await waitFor(() =>
    expect(Number.parseFloat(card.style.left)).toBeGreaterThan(320),
  );
  const readCard = () => ({
    x: Number.parseFloat(card.style.left),
    y: Number.parseFloat(card.style.top),
    width: Number.parseFloat(card.style.width),
    height: 240,
  });
  const initial = readCard();
  const popupBounds = { ...initial, width: 300, height: 260 };
  const popup = document.createElement("div");
  popup.id = "global-settings-panel";
  popup.setAttribute("role", "dialog");
  popup.getBoundingClientRect = () => ({
    ...popupBounds,
    left: popupBounds.x,
    top: popupBounds.y,
    right: popupBounds.x + popupBounds.width,
    bottom: popupBounds.y + popupBounds.height,
    toJSON() {},
  });
  await act(async () => {
    document.body.append(popup);
  });
  await waitFor(() =>
    expect(intersectTourRects(readCard(), popupBounds)).toBeNull(),
  );
  expect(card.hasAttribute("data-tour-card")).toBe(true);
});
