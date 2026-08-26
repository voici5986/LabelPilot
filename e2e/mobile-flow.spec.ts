import { expect, test } from "@playwright/test";

import { resetForE2e } from "./helpers";

/** 固定 1×1 PNG fixture，避免依赖运行时页面截图生成上传图 */
const LABEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.beforeEach(async ({ page }) => {
  await resetForE2e(page);
});

test("mobile shell: full preview + action bar, desktop panel hidden", async ({
  page,
}) => {
  await page.goto("/");
  const mobileViewport = page.viewportSize();

  // 桌面控制面板在移动端隐藏，内容移入编辑面板
  await expect(page.getByRole("complementary")).toHaveCount(0);

  // 底部操作栏：编辑 + 生成常驻
  await expect(page.getByRole("button", { name: "编辑" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "生成 PDF 文档" }),
  ).toBeVisible();

  // 全屏预览可用
  const zoomSlider = page.getByRole("slider", { name: "缩放级别" });
  await expect(zoomSlider).toBeVisible();
  const zoomSliderBox = await zoomSlider.boundingBox();
  expect(zoomSliderBox?.width).toBeGreaterThanOrEqual(40);
  await expect(page.getByText("50mm")).toBeVisible();

  // 跨入桌面断点时重置移动端 Sheet，缩回后不应恢复旧面板
  await page.getByRole("button", { name: "编辑" }).click();
  await expect(page.getByRole("dialog", { name: "编辑" })).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.locator('[role="dialog"][aria-label="编辑"]')).toHaveCount(
    0,
  );
  if (mobileViewport) await page.setViewportSize(mobileViewport);
  await expect(page.getByRole("dialog", { name: "编辑" })).toHaveCount(0);
});

test("edit sheet: open, size toggle, files collapse, upload enables generate", async ({
  page,
}) => {
  await page.goto("/");

  const editButton = page.getByRole("button", { name: "编辑" });
  await editButton.click();
  const dialog = page.getByRole("dialog", { name: "编辑" });
  await expect(dialog).toBeVisible();

  // 面板内容：标签类型 / 标签图片 / 排版设置（作用域限定，避免命中隐藏的桌面面板）
  await expect(dialog.getByRole("group", { name: "标签类型" })).toBeVisible();
  await expect(dialog.getByLabel("点击上传标签图片")).toBeVisible();
  await expect(dialog.getByRole("group", { name: "纸张方向" })).toBeVisible();

  // 移动端 NumberInput 使用独立的 40×40 横向加减按钮
  for (const name of ["行数: -1", "行数: +1"]) {
    const box = await dialog.getByRole("button", { name }).boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(40);
    expect(box?.height).toBeGreaterThanOrEqual(40);
  }

  // 默认档位：面板高度约为视口 62%（62dvh），全屏为 100%
  const sheetHeightRatio = async () => {
    const height = await dialog.evaluate(
      (element) => element.getBoundingClientRect().height,
    );
    const viewport = await page.evaluate(() => window.innerHeight);
    return height / viewport;
  };
  await expect.poll(sheetHeightRatio).toBeGreaterThan(0.55);
  await page.getByRole("button", { name: "切换面板高度" }).click();
  await expect.poll(sheetHeightRatio).toBeGreaterThan(0.95);
  await page.getByRole("button", { name: "切换面板高度" }).click();
  await expect.poll(sheetHeightRatio).toBeLessThan(0.9);

  // 标签图片分组可折叠（exact 避免命中上传框 input）
  const filesToggle = dialog.getByRole("button", {
    name: "标签图片",
    exact: true,
  });
  await expect(filesToggle).toHaveAttribute("aria-expanded", "true");
  await filesToggle.click();
  await expect(filesToggle).toHaveAttribute("aria-expanded", "false");
  await expect(dialog.getByLabel("点击上传标签图片")).toBeHidden();
  await filesToggle.click();
  await expect(dialog.getByLabel("点击上传标签图片")).toBeVisible();

  // 上传前生成禁用
  const generateButton = page.getByRole("button", { name: "生成 PDF 文档" });
  await expect(generateButton).toBeDisabled();

  // 上传后文件名可见、生成启用
  await dialog.getByLabel("点击上传标签图片").setInputFiles({
    name: "label.png",
    mimeType: "image/png",
    buffer: LABEL_PNG,
  });
  await expect(dialog.locator("li", { hasText: "label.png" })).toBeVisible();
  await expect(generateButton).toBeEnabled();
  for (const name of ["label.png 的数量: -1", "label.png 的数量: +1"]) {
    const button = dialog.getByRole("button", { name });
    await expect(button).toHaveCSS("width", "40px");
    await expect(button).toHaveCSS("height", "40px");
  }

  // 查看预览收起面板
  await dialog.getByRole("button", { name: "查看预览" }).click();
  await expect(dialog).toHaveCount(0);
});

test("edit sheet switches to auto-number mode fields", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "编辑" }).click();
  const dialog = page.getByRole("dialog", { name: "编辑" });

  await dialog.getByRole("button", { name: "自动编号" }).click();
  await expect(
    dialog.getByRole("textbox", { name: "前缀", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("switch", { name: "生成二维码" }),
  ).toBeVisible();
  // 排版设置仍可用
  await expect(dialog.getByRole("group", { name: "纸张方向" })).toBeVisible();
});

test("calibration entry points stay hidden on mobile, slider still usable", async ({
  page,
}) => {
  await page.goto("/");

  // 1:1 按钮（仅桌面断点显示）
  await expect(page.getByRole("button", { name: "1:1 实际尺寸" })).toHaveCount(
    0,
  );

  // 设置中的校准条目与校准对话框均不可见
  await page.getByRole("button", { name: "全局设置" }).click();
  await expect(page.getByRole("button", { name: /屏幕 1:1 校准/ })).toHaveCount(
    0,
  );
  await expect(page.getByRole("dialog", { name: "屏幕 1:1 校准" })).toHaveCount(
    0,
  );
  await page.keyboard.press("Escape");

  // 缩放滑杆仍可用
  await expect(page.getByRole("slider", { name: "缩放级别" })).toBeVisible();
});
