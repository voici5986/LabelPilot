import { expect, test } from "@playwright/test";

import { resetForE2e } from "./helpers";

test.beforeEach(async ({ page }) => {
  await resetForE2e(page);
});

/** 读取「纸张容器」的 CSS 宽度：style 为 mm、矩形最宽的那个 */
async function paperContainerWidth(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const divs = [...document.querySelectorAll("div")];
    let best: { w: number; style: string } | null = null;
    for (const d of divs) {
      if (!/^\d+(\.\d+)?mm$/.test(d.style.width)) continue;
      const w = d.getBoundingClientRect().width;
      if (!best || w > best.w) best = { w, style: d.style.width };
    }
    return best;
  });
}

test("calibrate from the 1:1 button, enter actual size, survive resize", async ({
  page,
}) => {
  await page.goto("/");

  const actualButton = page.getByRole("button", { name: "1:1 实际尺寸" });
  await actualButton.click();

  const dialog = page.getByRole("dialog", { name: "屏幕 1:1 校准" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/量出来是/).fill("100");
  await dialog.getByRole("button", { name: "保存并查看 1:1" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(actualButton).toHaveAttribute("aria-pressed", "true");

  // 实际尺寸模式：纸张容器 CSS 宽 = pageMm / k（k=1 时即纸张毫米数）
  const before = await paperContainerWidth(page);
  expect(before).not.toBeNull();
  expect(before!.style).toMatch(/^\d+(\.\d+)?mm$/);

  // 窗口/容器变化不应改变实际尺寸渲染倍率
  await page.setViewportSize({ width: 900, height: 700 });
  const after = await paperContainerWidth(page);
  expect(after?.w).toBeCloseTo(before!.w, 0);
});

test("slider leaves actual, reset returns to fit, calibration persists", async ({
  page,
}) => {
  await page.goto("/");

  // 经设置入口校准（不自动切 actual）
  await page.getByRole("button", { name: "全局设置" }).click();
  await page.getByRole("button", { name: /屏幕 1:1 校准/ }).click();
  const dialog = page.getByRole("dialog", { name: "屏幕 1:1 校准" });
  await dialog.getByLabel(/量出来是/).fill("100");
  await dialog.getByRole("button", { name: "保存校准" }).click();
  await expect(dialog).toHaveCount(0);

  const actualButton = page.getByRole("button", { name: "1:1 实际尺寸" });
  await expect(actualButton).toHaveAttribute("aria-pressed", "false");

  // 点 1:1 进入 actual
  await actualButton.click();
  await expect(actualButton).toHaveAttribute("aria-pressed", "true");

  // 滑杆操作退出 actual（manual）
  const slider = page.getByRole("slider", { name: "缩放级别" });
  await slider.focus();
  await page.keyboard.press("ArrowUp");
  await expect(actualButton).toHaveAttribute("aria-pressed", "false");

  // 重置回 fit
  await page.getByRole("button", { name: "适应窗口" }).click();
  await expect(actualButton).toHaveAttribute("aria-pressed", "false");

  // 刷新：校准保留，但预览从 fit 开始
  await page.reload();
  await expect(actualButton).toHaveAttribute("aria-pressed", "false");

  // 设置入口显示已校准
  await page.getByRole("button", { name: "全局设置" }).click();
  await expect(page.getByText("已校准")).toBeVisible();
});

test("keeps the preview center focused when the slider zooms in", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForTimeout(700);

  const before = await page.evaluate(() => {
    const viewport = [...document.querySelectorAll("div")].find(
      (element) =>
        typeof element.className === "string" &&
        element.className.includes("overflow-auto") &&
        element.className.includes("touch-none"),
    );
    const paper = viewport?.querySelector("div.absolute.left-0.top-0.bg-white");
    if (!viewport || !paper) throw new Error("preview viewport not found");

    const viewportRect = viewport.getBoundingClientRect();
    const paperRect = paper.getBoundingClientRect();
    const focusX = viewportRect.left + viewport.clientWidth / 2;
    const focusY = viewportRect.top + viewport.clientHeight / 2;

    return {
      focusX,
      focusY,
      paperPointX: (focusX - paperRect.left) / paperRect.width,
      paperPointY: (focusY - paperRect.top) / paperRect.height,
    };
  });

  const slider = page.getByRole("slider", { name: "缩放级别" });
  const sliderBox = await slider.boundingBox();
  expect(sliderBox).not.toBeNull();

  await page.mouse.move(sliderBox!.x + 2, sliderBox!.y + sliderBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    sliderBox!.x + 2,
    sliderBox!.y + sliderBox!.height * 0.25,
  );
  await page.mouse.up();
  await page.waitForTimeout(250);

  const after = await page.evaluate(
    ({ paperPointX, paperPointY }) => {
      const viewport = [...document.querySelectorAll("div")].find(
        (element) =>
          typeof element.className === "string" &&
          element.className.includes("overflow-auto") &&
          element.className.includes("touch-none"),
      );
      const paper = viewport?.querySelector(
        "div.absolute.left-0.top-0.bg-white",
      );
      const slider = document.querySelector('[role="slider"]');
      if (!viewport || !paper || !slider) {
        throw new Error("preview zoom elements not found");
      }

      const viewportRect = viewport.getBoundingClientRect();
      const paperRect = paper.getBoundingClientRect();
      const focusX = paperRect.left + paperRect.width * paperPointX;
      const focusY = paperRect.top + paperRect.height * paperPointY;

      return {
        scale: Number(slider.getAttribute("aria-valuenow")),
        focusX,
        focusY,
        viewportFocusX: viewportRect.left + viewport.clientWidth / 2,
        viewportFocusY: viewportRect.top + viewport.clientHeight / 2,
      };
    },
    { paperPointX: before.paperPointX, paperPointY: before.paperPointY },
  );

  expect(after.scale).toBeGreaterThan(100);
  expect(after.focusX).toBeCloseTo(after.viewportFocusX, 0);
  expect(after.focusY).toBeCloseTo(after.viewportFocusY, 0);
});

test("centers fit and preserves a panned focus through continuous zoom and actual size", async ({
  page,
}) => {
  await page.goto("/");
  const viewport = page.locator("div.touch-none.overflow-auto");
  const paper = viewport.locator("div.absolute.left-0.top-0.bg-white");
  const readFocus = () =>
    paper.evaluate((element) => {
      const viewport = element.closest(".overflow-auto")!;
      const v = viewport.getBoundingClientRect();
      const p = element.getBoundingClientRect();
      return {
        x: (v.left + viewport.clientWidth / 2 - p.left) / p.width,
        y: (v.top + viewport.clientHeight / 2 - p.top) / p.height,
      };
    });
  await expect.poll(async () => (await readFocus()).x).toBeCloseTo(0.5, 2);
  await expect.poll(async () => (await readFocus()).y).toBeCloseTo(0.5, 2);

  const slider = page.getByRole("slider", { name: "缩放级别" });
  await slider.focus();
  await page.keyboard.press("End");
  // Move the view away from the paper center before starting another gesture.
  const box = (await viewport.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 80,
    box.y + box.height / 2 + 60,
    { steps: 5 },
  );
  await page.mouse.up();
  const focus = await readFocus();
  expect(Math.abs(focus.x - 0.5)).toBeGreaterThan(0.01);

  const track = (await slider.locator(":scope > div.relative").boundingBox())!;
  await page.mouse.move(track.x + track.width / 2, track.y);
  await page.mouse.down();
  for (const progress of [0.9, 0.8, 0.7, 0.8, 0.95]) {
    await page.mouse.move(
      track.x + track.width / 2,
      track.y + track.height * (1 - progress),
      { steps: 8 },
    );
    // Check while the pointer is still held, not just after a deferred correction.
    const current = await readFocus();
    expect(current.x).toBeCloseTo(focus.x, 2);
    expect(current.y).toBeCloseTo(focus.y, 2);
  }
  await page.mouse.up();
  await page.getByRole("button", { name: "1:1 实际尺寸" }).click();
  const dialog = page.getByRole("dialog", { name: "屏幕 1:1 校准" });
  // k=0.5 keeps the actual paper larger than the viewport in both axes.
  await dialog.getByLabel(/量出来是/).fill("50");
  await dialog.getByRole("button", { name: "保存并查看 1:1" }).click();
  await expect.poll(async () => (await readFocus()).x).toBeCloseTo(focus.x, 2);
  await expect.poll(async () => (await readFocus()).y).toBeCloseTo(focus.y, 2);
  await page.getByRole("button", { name: "适应窗口" }).click();
  await expect.poll(async () => (await readFocus()).x).toBeCloseTo(0.5, 2);
  await expect.poll(async () => (await readFocus()).y).toBeCloseTo(0.5, 2);
});

test("stale environment exits actual to fit (manual scale reset) and prompts re-calibration", async ({
  page,
}) => {
  await page.goto("/");
  // 等待 baseFitScale 稳定（初始 state 为 0.8，需 ResizeObserver 收敛后再测量）
  await page.waitForTimeout(700);
  const fitWidth = await paperContainerWidth(page);
  expect(fitWidth).not.toBeNull();

  // 手动放大建立非 1 倍率，制造"残留倍率"可被检测的前提
  const slider = page.getByRole("slider", { name: "缩放级别" });
  await slider.focus();
  await page.keyboard.press("ArrowUp");
  const manualWidth = await paperContainerWidth(page);
  expect(manualWidth!.w).toBeGreaterThan(fitWidth!.w);

  // 校准并进入 actual（k=1 → 容器宽 = pageMm，大于 fit）
  await page.getByRole("button", { name: "1:1 实际尺寸" }).click();
  const dialog = page.getByRole("dialog", { name: "屏幕 1:1 校准" });
  await dialog.getByLabel(/量出来是/).fill("100");
  await dialog.getByRole("button", { name: "保存并查看 1:1" }).click();
  const actualButton = page.getByRole("button", { name: "1:1 实际尺寸" });
  await expect(actualButton).toHaveAttribute("aria-pressed", "true");
  const actualWidth = await paperContainerWidth(page);
  expect(actualWidth!.w).toBeGreaterThan(fitWidth!.w);

  // 模拟 DPR 变化：覆盖 devicePixelRatio 并触发 focus（App 在 focus 时重检环境）
  await page.evaluate(() => {
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      get: () => 1.5,
    });
    window.dispatchEvent(new Event("focus"));
  });

  // 退出 actual 并提示重校；manualScale 必须被重置，容器宽应回到初始 fit 值
  await expect(actualButton).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("显示器或浏览器缩放已变化")).toBeVisible();
  await page.waitForTimeout(700);
  const afterWidth = await paperContainerWidth(page);
  expect(afterWidth!.w).toBeCloseTo(fitWidth!.w, 0);
});
