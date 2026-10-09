import { pathToFileURL } from "node:url";

import {
  expect,
  test,
  type Download,
  type Page,
  type TestInfo,
} from "@playwright/test";

import { resetForE2e } from "./helpers";

async function expectValidPdf(
  download: Download,
  page: Page,
  artifactPath: string,
  minimumPages = 1,
): Promise<Buffer> {
  expect(download.suggestedFilename()).toMatch(
    /^label_\d{6}_\d{6}_\d{3}\.pdf$/,
  );
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const pdf = Buffer.concat(chunks);

  expect(pdf.byteLength).toBeGreaterThan(1_000);
  expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(pdf.subarray(-1_024).toString("ascii")).toContain("%%EOF");
  expect(
    pdf.toString("latin1").match(/\/Type \/Page\b/g)?.length ?? 0,
  ).toBeGreaterThanOrEqual(minimumPages);

  await download.saveAs(artifactPath);
  const renderPage = await page.context().newPage();
  await renderPage.goto(pathToFileURL(artifactPath).href);
  await expect
    .poll(async () => (await renderPage.screenshot()).byteLength, {
      timeout: 10_000,
    })
    .toBeGreaterThan(8_000);
  await renderPage.close();
  return pdf;
}

function withExifOrientation(jpeg: Buffer, orientation: number): Buffer {
  const exif = Buffer.from([
    0xff,
    0xe1,
    0x00,
    0x22,
    0x45,
    0x78,
    0x69,
    0x66,
    0x00,
    0x00,
    0x49,
    0x49,
    0x2a,
    0x00,
    0x08,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    0x12,
    0x01,
    0x03,
    0x00,
    0x01,
    0x00,
    0x00,
    0x00,
    orientation,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
  ]);
  return Buffer.concat([jpeg.subarray(0, 2), exif, jpeg.subarray(2)]);
}

async function switchToTextMode(page: Page): Promise<void> {
  await page.getByRole("button", { name: "全局设置" }).click();
  await page.getByRole("button", { name: "自动编号" }).click();
  await page.getByRole("button", { name: "全局设置" }).click();
}

test.beforeEach(async ({ page }) => {
  await resetForE2e(page);
});

test("preview controls dim for a primary mouse with secondary touch", async ({
  browser,
}, testInfo) => {
  // Blink's real device settings preserve a fine primary pointer while adding
  // coarse secondary input; touch emulation alone changes the primary pointer.
  const hybridBrowser = await browser.browserType().launch({
    channel: testInfo.project.use.channel,
    args: [
      "--blink-settings=availablePointerTypes=6,primaryPointerType=4,availableHoverTypes=2,primaryHoverType=2",
    ],
  });
  try {
    const context = await hybridBrowser.newContext({
      baseURL: testInfo.project.use.baseURL,
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();
    await resetForE2e(page);
    await page.goto("/");
    const pointerMedia = () =>
      page.evaluate(() => ({
        hover: matchMedia("(hover: hover)").matches,
        fine: matchMedia("(pointer: fine)").matches,
        coarse: matchMedia("(any-pointer: coarse)").matches,
      }));
    expect(await pointerMedia()).toEqual({
      hover: true,
      fine: true,
      coarse: true,
    });

    await switchToTextMode(page);
    const quantity = page.getByRole("textbox", { name: "总数量" });
    await quantity.fill("10");
    await expect(quantity).toHaveValue("10");
    await quantity.press("Tab");
    const zoom = page.locator(".preview-controls").filter({
      has: page.getByRole("slider", { name: "缩放级别" }),
    });
    const navigator = page.locator("nav.preview-controls");
    await expect(zoom).toBeVisible();
    await expect(navigator).toBeVisible();
    const moveAway = async () => {
      await quantity.focus();
      await page.mouse.move(640, 20);
    };
    await moveAway();
    await expect(zoom).toHaveCSS("opacity", "0.6");
    await expect(navigator).toHaveCSS("opacity", "0.6");
    await expect(navigator.getByRole("button", { name: "上一页" })).toHaveCSS(
      "opacity",
      "0.5",
    );

    for (const controls of [zoom, navigator]) {
      await controls.hover();
      await expect(controls).toHaveCSS("opacity", "1");
      await moveAway();
      await expect(controls).toHaveCSS("opacity", "0.6");
      await controls
        .locator("button:enabled, input, [role='slider']")
        .first()
        .focus();
      await expect(controls).toHaveCSS("opacity", "1");
      await moveAway();
      await expect(controls).toHaveCSS("opacity", "0.6");
    }

    const slider = page.getByRole("slider", { name: "缩放级别" });
    const sliderBox = await slider.boundingBox();
    expect(sliderBox).not.toBeNull();
    await page.mouse.move(
      sliderBox!.x + sliderBox!.width / 2,
      sliderBox!.y + sliderBox!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(640, 20);
    await expect(zoom).toHaveAttribute("data-interacting", "true");
    await expect(zoom).toHaveCSS("opacity", "1");
    await page.mouse.up();
    await expect(zoom).toHaveAttribute("data-interacting", "false");
    await moveAway();
    await expect(zoom).toHaveCSS("opacity", "0.6");

    const session = await context.newCDPSession(page);
    await session.send("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 10,
    });
    expect(await pointerMedia()).toEqual({
      hover: false,
      fine: false,
      coarse: true,
    });
    await expect(zoom).toHaveCSS("opacity", "1");
    await expect(navigator).toHaveCSS("opacity", "1");
  } finally {
    await hybridBrowser.close();
  }
});

test("portrait layout, theme, PWA, and accessible names remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await page.getByRole("button", { name: "切换语言" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("button", { name: "Switch language" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const themeButton = page.getByRole("button", { name: /切换主题模式/ });
  await themeButton.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await themeButton.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await themeButton.click();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  // 移动端：上传框与排版字段位于合并编辑面板中，需打开后可见（作用域限定）
  const editButton = page.getByRole("button", { name: "编辑" });
  await editButton.click();
  const editDialog = page.getByRole("dialog", { name: "编辑" });
  await expect(editDialog).toBeVisible();
  await expect(editDialog.getByLabel("点击上传标签图片")).toBeVisible();
  await expect(page.getByText("请旋转屏幕")).toHaveCount(0);
  await expect(
    editDialog.getByRole("group", { name: "纸张方向" }),
  ).toBeVisible();
  const stepButton = editDialog.getByRole("button", { name: "行数: +1" });
  await expect(stepButton).toBeVisible();
  const rowsInput = editDialog.getByRole("textbox", {
    name: "行数",
    exact: true,
  });
  await rowsInput.fill("3");
  await expect(rowsInput).toHaveValue("3");
  await rowsInput.press("ArrowUp");
  await expect(rowsInput).toHaveValue("4");
  await rowsInput.press("ArrowDown");
  await expect(rowsInput).toHaveValue("3");
  await rowsInput.press("Tab");
  await expect(rowsInput).toHaveValue("3");
  // 关闭编辑面板回到预览
  await editDialog.getByRole("button", { name: "查看预览" }).click();
  await expect(editDialog).toHaveCount(0);
  await expect(page.getByRole("slider", { name: "缩放级别" })).toBeVisible();

  const settingsButton = page.getByRole("button", { name: "全局设置" });
  await settingsButton.click();
  await expect(page.getByRole("dialog", { name: "全局设置" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "全局设置" })).toHaveCount(0);
  await expect(settingsButton).toBeFocused();

  const unnamedControls = await page
    .locator("button, input, [role='switch'], [role='slider']")
    .evaluateAll(
      (elements) =>
        elements.filter((element) => {
          const control = element as HTMLInputElement;
          const labels = control.labels ? Array.from(control.labels) : [];
          return !(
            element.getAttribute("aria-label")?.trim() ||
            element.getAttribute("title")?.trim() ||
            element.textContent?.trim() ||
            labels.some((label) => label.textContent?.trim())
          );
        }).length,
    );
  expect(unnamedControls).toBe(0);

  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  expect(await manifest.json()).toMatchObject({
    name: "LabelPilot",
    lang: "zh-CN",
  });

  await page.setViewportSize({ width: 844, height: 390 });
  await expect
    .poll(() =>
      page
        .locator("main")
        .evaluate((element) => getComputedStyle(element).flexDirection),
    )
    .toBe("column");

  await page.emulateMedia({ reducedMotion: "reduce" });
  const transitionDuration = await settingsButton.evaluate((element) =>
    parseFloat(getComputedStyle(element).transitionDuration),
  );
  expect(transitionDuration).toBeLessThanOrEqual(0.001);
});

test("custom paper mode survives layout updates and reloads", async ({
  page,
}) => {
  await page.goto("/");

  const settingsButton = page.getByRole("button", { name: "全局设置" });
  await settingsButton.click();
  await page.getByRole("button", { name: "自定义尺寸", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "纸张宽度 (mm)" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText(/^自定义尺寸,/)).toBeVisible();

  await page
    .getByRole("group", { name: "纸张方向" })
    .getByRole("button", { name: "纵向" })
    .click();
  await settingsButton.click();
  await expect(
    page.getByRole("textbox", { name: "纸张宽度 (mm)" }),
  ).toBeVisible();

  await page.reload();
  await settingsButton.click();
  await expect(
    page.getByRole("textbox", { name: "纸张宽度 (mm)" }),
  ).toBeVisible();
});

test("real worker generates image PDF and rejects unsupported input", async ({
  page,
}, testInfo: TestInfo) => {
  await page.goto("/");
  const fileInput = page.getByLabel("点击上传标签图片");

  await fileInput.setInputFiles({
    name: "bad.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByText(/bad\.txt 不是受支持/)).toBeVisible();
  await page.getByRole("alert").getByRole("button", { name: "关闭" }).click();

  const fakePng = {
    name: "bad.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  };
  await fileInput.setInputFiles(fakePng);
  await expect(page.getByText(/bad\.png 不包含有效/)).toBeVisible();
  await page.getByRole("alert").getByRole("button", { name: "关闭" }).click();
  await fileInput.setInputFiles(fakePng);
  await expect(page.getByText(/bad\.png 不包含有效/)).toBeVisible();
  await page.getByRole("alert").getByRole("button", { name: "关闭" }).click();

  await fileInput.setInputFiles({
    name: "label.png",
    mimeType: "",
    buffer: await page.screenshot(),
  });
  const downloadPromise = page.waitForEvent("download", { timeout: 20_000 });
  await page.getByRole("button", { name: "生成 PDF 文档" }).click();
  await expectValidPdf(
    await downloadPromise,
    page,
    testInfo.outputPath("image-labels.pdf"),
  );
});

test("JPEG EXIF orientation is normalized before PDF embedding", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const jpegBase64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 80;
    canvas.height = 40;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#ef4444";
    context.fillRect(0, 0, 40, 40);
    context.fillStyle = "#2563eb";
    context.fillRect(40, 0, 40, 40);
    return canvas.toDataURL("image/jpeg", 0.95).split(",")[1];
  });
  const orientedJpeg = withExifOrientation(
    Buffer.from(jpegBase64, "base64"),
    6,
  );

  await page.getByLabel("点击上传标签图片").setInputFiles({
    name: "oriented.jpg",
    mimeType: "image/jpeg",
    buffer: orientedJpeg,
  });
  await expect
    .poll(() =>
      page
        .locator("img")
        .last()
        .evaluate((image: HTMLImageElement) => ({
          width: image.naturalWidth,
          height: image.naturalHeight,
        })),
    )
    .toMatchObject({ width: 40, height: 80 });

  const downloadPromise = page.waitForEvent("download", { timeout: 20_000 });
  await page.getByRole("button", { name: "生成 PDF 文档" }).click();
  const pdf = await expectValidPdf(
    await downloadPromise,
    page,
    testInfo.outputPath("oriented-image.pdf"),
  );
  const dimensions = Array.from(
    pdf.toString("latin1").matchAll(/\/Width (\d+)\s+\/Height (\d+)/g),
    (match) => ({ width: Number(match[1]), height: Number(match[2]) }),
  );
  expect(dimensions).toContainEqual({ width: 40, height: 80 });
});

test("real worker generates multi-page Unicode and QR PDF", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await switchToTextMode(page);
  await page.getByRole("textbox", { name: "前缀", exact: true }).fill("资产-");
  await page.getByRole("textbox", { name: "总数量" }).fill("10");
  await page.getByRole("switch", { name: "生成二维码" }).click();

  await page.getByRole("button", { name: "全局设置" }).click();
  const qrPrefix = page.getByRole("textbox", { name: "二维码内容前缀" });
  await qrPrefix.fill("x".repeat(700));
  await expect(qrPrefix).toHaveValue("x".repeat(512));
  await page.getByRole("button", { name: "全局设置" }).click();
  await expect(page.getByRole("alert")).toContainText("二维码模块仅");
  await expect(
    page.getByRole("button", { name: "生成 PDF 文档" }),
  ).toBeDisabled();

  await page.getByRole("button", { name: "全局设置" }).click();
  await qrPrefix.fill("");
  // 先确认清空本身生效，失败时才能区分“输入未生效”与“QR 校验异常”。
  await expect(qrPrefix).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alert")).toHaveCount(0);

  const downloadPromise = page.waitForEvent("download", { timeout: 20_000 });
  await page.getByRole("button", { name: "生成 PDF 文档" }).click();
  await expectValidPdf(
    await downloadPromise,
    page,
    testInfo.outputPath("unicode-qr-labels.pdf"),
    2,
  );
});

test("generation can be cancelled without a download", async ({ page }) => {
  await page.goto("/");
  await switchToTextMode(page);
  await page
    .getByRole("textbox", { name: "前缀", exact: true })
    .fill("取消测试-");
  await page.getByRole("textbox", { name: "总数量" }).fill("500");
  await page.getByRole("switch", { name: "生成二维码" }).click();

  await page.getByRole("button", { name: "生成 PDF 文档" }).click();
  await page.getByRole("button", { name: /取消生成/ }).click();
  await expect(page.getByText("已取消生成 PDF")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "生成 PDF 文档" }),
  ).toBeEnabled();
});
