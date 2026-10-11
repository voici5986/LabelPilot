import { expect, test } from "@playwright/test";

import { createCollisionPng } from "../src/test/pngFixtures";
import { resetForE2e } from "./helpers";

test("small image cells warn without blocking valid image PDF generation", async ({
  page,
}) => {
  await resetForE2e(page);
  await page.goto("/");
  await page.getByRole("button", { name: "全局设置" }).click();
  await page.getByRole("button", { name: "自定义尺寸", exact: true }).click();
  for (const label of ["纸张宽度 (mm)", "纸张高度 (mm)"]) {
    const input = page.getByRole("spinbutton", { name: label });
    await input.fill("50");
    await expect(input).toHaveValue("50");
    await input.press("Tab");
  }
  await page.keyboard.press("Escape");
  await page
    .getByRole("group", { name: "纸张方向" })
    .getByRole("button", { name: "纵向" })
    .click();
  for (const [label, value] of [
    ["行数", "20"],
    ["列数", "10"],
    ["边距 mm", "0"],
    ["间距 mm", "0"],
  ]) {
    const input = page.getByRole("spinbutton", { name: label, exact: true });
    await input.fill(value);
    await expect(input).toHaveValue(value);
    await input.press("Tab");
  }
  await page.getByLabel("点击上传标签图片").setInputFiles({
    name: "small.png",
    mimeType: "image/png",
    buffer: Buffer.from(createCollisionPng("red")),
  });
  await expect(page.getByText("small.png", { exact: true })).toBeVisible();
  const warning = page.getByRole("status").filter({ hasText: "图片单元格为" });
  await expect(warning).toContainText("5 × 2.5 mm");
  await expect(warning).toContainText("仍可生成 PDF");
  const generate = page.getByRole("button", { name: "生成 PDF 文档" });
  await expect(generate).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await generate.click();
  const stream = await (await downloadPromise).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const pdf = Buffer.concat(chunks);
  expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(pdf.toString("latin1")).toContain("/Subtype /Image");
});

test("large Unicode labels disclose raster DPI without blocking PDF generation", async ({
  page,
}) => {
  await resetForE2e(page);
  await page.goto("/");
  await page.getByRole("button", { name: "自动编号" }).click();
  await page.getByRole("button", { name: "全局设置" }).click();
  await page.getByRole("button", { name: "自定义尺寸", exact: true }).click();
  for (const label of ["纸张宽度 (mm)", "纸张高度 (mm)"]) {
    const input = page.getByRole("spinbutton", { name: label });
    await input.fill("1000");
    await expect(input).toHaveValue("1000");
    await input.press("Tab");
  }
  await page.keyboard.press("Escape");
  for (const label of ["行数", "列数", "总数量"]) {
    const input = page.getByRole("spinbutton", { name: label, exact: true });
    await input.fill("1");
    await expect(input).toHaveValue("1");
    await input.press("Tab");
  }
  const prefix = page.getByRole("textbox", { name: "前缀", exact: true });
  await prefix.fill("设备-");
  await expect(prefix).toHaveValue("设备-");
  const warning = page.getByRole("status").filter({ hasText: /非ASCII文本/ });
  await expect(warning).toContainText("27 DPI");
  const generate = page.getByRole("button", { name: "生成 PDF 文档" });
  await expect(generate).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await generate.click();
  const stream = await (await downloadPromise).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const pdf = Buffer.concat(chunks);
  expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(pdf.toString("latin1")).toContain("/Subtype /Image");
  await prefix.fill("SN-");
  await expect(prefix).toHaveValue("SN-");
  await expect(warning).toHaveCount(0);
});
