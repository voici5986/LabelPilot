import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  getTourSteps,
  TOUR_SEEN_KEY,
  type TourStep,
} from "../src/utils/guidedTour";
import { resetForE2e } from "./helpers";

const tourCard = (page: Page) =>
  page.locator('[data-tour-overlay] [role="dialog"]');

async function assertGeometry(
  page: Page,
  card: Locator,
  mobile: boolean,
  step: TourStep,
) {
  const viewport = page.viewportSize()!;
  // The editor enters with a transform. Check its settled geometry, rather
  // than sampling a card that is still travelling up from below the screen.
  await expect
    .poll(
      async () => {
        const bounds = await card.boundingBox();
        return (
          bounds !== null &&
          bounds.x >= 0 &&
          bounds.y >= 0 &&
          bounds.x + bounds.width <= viewport.width &&
          bounds.y + bounds.height <= viewport.height
        );
      },
      { message: "The settled tour card fits inside the viewport" },
    )
    .toBe(true);
  await expect(page.locator("[data-tour-highlight]")).toBeVisible();
  await expect
    .poll(
      async () => {
        return page.evaluate((mobile) => {
          const card = document.querySelector<HTMLElement>(
            '[data-tour-overlay] [role="dialog"]',
          );
          if (!card) return ["missing card"];
          const bounds = card.getBoundingClientRect();
          const blockers = mobile
            ? '[data-testid="edit-sheet-panel"] > [role="button"], [data-testid="edit-sheet-panel"] button'
            : "aside, header, .preview-controls, [data-testid=preview-ruler]";
          return Array.from(document.querySelectorAll<HTMLElement>(blockers))
            .filter((element) => !card.contains(element))
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              const left = Math.max(rect.left, bounds.left);
              const right = Math.min(rect.right, bounds.right);
              const top = Math.max(rect.top, bounds.top);
              const bottom = Math.min(rect.bottom, bounds.bottom);
              // Scrollable sheet controls outside their clipping region are not
              // painted there. Hit testing distinguishes those from real overlap.
              return (
                right - left > 1 &&
                bottom - top > 1 &&
                document
                  .elementsFromPoint((left + right) / 2, (top + bottom) / 2)
                  .some((hit) => hit === element || element.contains(hit))
              );
            })
            .map(
              (element) =>
                element.getAttribute("aria-label") || element.tagName,
            );
        }, mobile);
      },
      { message: "The tour card leaves the real workbench controls exposed" },
    )
    .toEqual([]);
  await expect
    .poll(
      async () =>
        page.evaluate((step) => {
          const card = document
            .querySelector<HTMLElement>('[data-tour-overlay] [role="dialog"]')!
            .getBoundingClientRect();
          const visual = window.visualViewport;
          const viewport = {
            left: visual?.offsetLeft ?? 0,
            top: visual?.offsetTop ?? 0,
            right: (visual?.offsetLeft ?? 0) + (visual?.width ?? innerWidth),
            bottom: (visual?.offsetTop ?? 0) + (visual?.height ?? innerHeight),
          };
          const target = Array.from(
            document.querySelectorAll<HTMLElement>(`[data-tour="${step}"]`),
          ).find((element) => {
            const rect = element.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return false;
            for (
              let node: HTMLElement | null = element;
              node;
              node = node.parentElement
            ) {
              const style = getComputedStyle(node);
              if (
                node.hidden ||
                style.display === "none" ||
                /hidden|collapse/.test(style.visibility)
              )
                return false;
            }
            return true;
          });
          if (!target) return "missing actual target";
          const rect = target.getBoundingClientRect();
          const visible = {
            left: Math.max(rect.left, viewport.left),
            top: Math.max(rect.top, viewport.top),
            right: Math.min(rect.right, viewport.right),
            bottom: Math.min(rect.bottom, viewport.bottom),
          };
          for (
            let parent = target.parentElement;
            parent;
            parent = parent.parentElement
          ) {
            const style = getComputedStyle(parent);
            const bounds = parent.getBoundingClientRect();
            if (
              /(auto|scroll|hidden|clip)/.test(
                style.overflowX || style.overflow,
              )
            ) {
              visible.left = Math.max(visible.left, bounds.left);
              visible.right = Math.min(visible.right, bounds.right);
            }
            if (
              /(auto|scroll|hidden|clip)/.test(
                style.overflowY || style.overflow,
              )
            ) {
              visible.top = Math.max(visible.top, bounds.top);
              visible.bottom = Math.min(visible.bottom, bounds.bottom);
            }
          }
          if (visible.right <= visible.left || visible.bottom <= visible.top)
            return "target fully clipped";
          const overlaps =
            Math.min(card.right, visible.right) >
              Math.max(card.left, visible.left) &&
            Math.min(card.bottom, visible.bottom) >
              Math.max(card.top, visible.top);
          const largeOverlap =
            overlaps &&
            (visible.right - visible.left) * (visible.bottom - visible.top) >
              ((viewport.right - viewport.left) *
                (viewport.bottom - viewport.top)) /
                2;
          const arrow = document.querySelector("[data-tour-arrow]");
          if (largeOverlap)
            return arrow
              ? "large overlapping preview still has an arrow"
              : "valid";
          if (!arrow) return "ordinary target is missing its arrow";
          const from = {
            x: Number(arrow.getAttribute("x1")),
            y: Number(arrow.getAttribute("y1")),
          };
          const tip = {
            x: Number(arrow.getAttribute("x2")),
            y: Number(arrow.getAttribute("y2")),
          };
          const tolerance = 0.5;
          const onVertical =
            (Math.abs(from.x - card.left) <= tolerance ||
              Math.abs(from.x - card.right) <= tolerance) &&
            from.y >= card.top - tolerance &&
            from.y <= card.bottom + tolerance;
          const onHorizontal =
            (Math.abs(from.y - card.top) <= tolerance ||
              Math.abs(from.y - card.bottom) <= tolerance) &&
            from.x >= card.left - tolerance &&
            from.x <= card.right + tolerance;
          if (!onVertical && !onHorizontal)
            return "arrow origin is detached from the actual card boundary";
          if (
            !(
              tip.x < card.left ||
              tip.x > card.right ||
              tip.y < card.top ||
              tip.y > card.bottom
            )
          ) {
            return "arrow tip is covered by the card";
          }
          if (Math.hypot(tip.x - from.x, tip.y - from.y) < 16)
            return "ordinary arrow is too short";
          if (
            !(
              tip.x > visible.left &&
              tip.x < visible.right &&
              tip.y > visible.top &&
              tip.y < visible.bottom
            )
          ) {
            return "arrow tip lies outside actual clipped target interior";
          }
          return "valid";
        }, step),
      {
        message:
          "Large overlapping previews use only a highlight; ordinary arrows end inside the actual clipped target",
      },
    )
    .toBe("valid");
  const bounds = await card.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
}

test.beforeEach(async ({ page }) => {
  await resetForE2e(page, { skipTour: false });
});

for (const scenario of [
  { width: 1280, height: 720, colorScheme: "light" },
  { width: 1280, height: 720, colorScheme: "dark" },
  { width: 1440, height: 420, colorScheme: "light" },
] as const) {
  test(`desktop tour exposes controls and arrows at ${scenario.width}x${scenario.height} ${scenario.colorScheme}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(scenario);
    await page.emulateMedia({ colorScheme: scenario.colorScheme });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    const card = tourCard(page);
    for (let index = 0; index < 5; index++) {
      await expect(card).toBeVisible();
      await assertGeometry(page, card, false, getTourSteps(false)[index]);
      await expect(
        page.getByRole("heading", { name: "开始制作标签" }),
      ).toHaveCount(0);
      const status = card.getByRole("status");
      await expect(status).toHaveAttribute("aria-live", "polite");
      await expect(status).toHaveAttribute("aria-atomic", "true");
      await expect(status).toContainText(`${index + 1} / 5`);
      await expect(status).toContainText(
        await card.getByRole("heading").innerText(),
      );
      if (index === 2) {
        await page.screenshot({
          path: testInfo.outputPath("desktop-preview.png"),
        });
      }
      if (index === 1) {
        // A real user can change layout while the card is visible.
        const rows = page
          .getByRole("complementary")
          .getByRole("spinbutton", { name: "行数", exact: true });
        await rows.fill("4");
        await rows.press("Enter");
        await expect(rows).toHaveValue("4");
        await page.screenshot({
          path: testInfo.outputPath("desktop-layout.png"),
        });
      }
      await card
        .getByRole("button", {
          name: index === 4 ? "完成" : "下一步",
          exact: true,
        })
        .click();
    }
    await expect(card).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => document.activeElement?.getAttribute("data-tour")),
      )
      .toBe("preview");
    expect(
      await page.evaluate((key) => localStorage.getItem(key), TOUR_SEEN_KEY),
    ).toBe("1");
    await expect(
      page.getByRole("heading", { name: "开始制作标签" }),
    ).toBeVisible();
    await expect(page.getByTestId("preview-ruler")).toHaveCount(0);
    await expect(page.getByRole("slider", { name: "缩放级别" })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 360, height: 740 },
  { width: 844, height: 390 },
]) {
  test(`mobile tour stays inside the editor and leaves its controls exposed at ${viewport.width}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const card = tourCard(page);
    await card.getByRole("button", { name: "下一步", exact: true }).click();
    const panel = page.getByTestId("edit-sheet-panel");
    await expect(panel).toBeVisible();
    await expect
      .poll(() => panel.locator('[data-tour-overlay] [role="dialog"]').count())
      .toBe(1);
    await assertGeometry(page, card, true, "content");
    await page.getByRole("button", { name: "切换面板高度" }).click();
    await expect(
      page.getByRole("button", { name: "切换面板高度" }),
    ).toHaveAttribute("aria-pressed", "true");
    await assertGeometry(page, card, true, "content");
    await page.screenshot({ path: testInfo.outputPath("mobile-content.png") });
    await card.getByRole("button", { name: "下一步", exact: true }).click();
    await assertGeometry(page, card, true, "layout");
    const rows = panel.getByRole("spinbutton", { name: "行数", exact: true });
    await rows.fill("4");
    await rows.press("Enter");
    await expect(rows).toHaveValue("4");
    // The sheet's own preview action remains usable during the tour.
    await panel.getByRole("button", { name: "查看预览", exact: true }).click();
    await expect(
      card.getByRole("heading", { name: "检查纸张预览" }),
    ).toBeVisible();
    await expect(panel).toHaveCount(0);
    await assertGeometry(page, card, false, "preview");
    await page.screenshot({ path: testInfo.outputPath("mobile-preview.png") });
    await card.getByRole("button", { name: "下一步", exact: true }).click();
    await assertGeometry(page, card, false, "generate");
    await card.getByRole("button", { name: "完成", exact: true }).click();
    await expect(card).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "开始制作标签" }),
    ).toBeVisible();
  });
}

test("settings popups remain exposed while a desktop tour is active", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 620 });
  await page.goto("/");
  const card = tourCard(page);
  await expect(card).toBeVisible();
  await page.getByRole("button", { name: "全局设置", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "全局设置", exact: true });
  await expect(settings).toBeVisible();
  const exposed = async () => {
    const a = await card.boundingBox();
    const b = await settings.boundingBox();
    return (
      a &&
      b &&
      (Math.min(a.x + a.width, b.x + b.width) <= Math.max(a.x, b.x) ||
        Math.min(a.y + a.height, b.y + b.height) <= Math.max(a.y, b.y))
    );
  };
  await expect.poll(exposed).toBe(true);
  await settings.getByRole("button", { name: "更多预设" }).click();
  await expect(settings.getByRole("menu")).toBeVisible();
  await expect.poll(exposed).toBe(true);
});

test("guide and calibration interruptions keep a fresh tour eligible after reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await expect(tourCard(page)).toBeVisible();
  await page.getByRole("button", { name: "使用指南", exact: true }).click();
  await expect(tourCard(page)).toHaveCount(0);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), TOUR_SEEN_KEY),
  ).toBeNull();
  await page.getByRole("button", { name: "关闭使用指南" }).click();
  await page.reload();
  const card = tourCard(page);
  await expect(card).toBeVisible();
  for (let index = 0; index < 3; index++)
    await card.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByRole("button", { name: /1:1/ }).click();
  await expect(tourCard(page)).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "屏幕 1:1 校准" }),
  ).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), TOUR_SEEN_KEY),
  ).toBeNull();
  await page.reload();
  await expect(tourCard(page)).toBeVisible();
});
