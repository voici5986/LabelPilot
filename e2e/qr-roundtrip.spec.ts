import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { resetForE2e } from "./helpers";
import { decodePdfQrColumns } from "./pdfQr";

test("downloaded worker PDF independently decodes every QR payload in label order", async ({
  page,
}, testInfo) => {
  await resetForE2e(page);
  await page.goto("/");
  await page.getByRole("button", { name: "自动编号" }).click();
  await page.getByRole("button", { name: "全局设置" }).click();
  const qrPrefix = page.getByRole("textbox", { name: "二维码内容前缀" });
  await qrPrefix.fill("https://example.test/资产?q=50% &id=");
  await expect(qrPrefix).toHaveValue("https://example.test/资产?q=50% &id=");
  await page.keyboard.press("Escape");
  await expect(qrPrefix).toHaveCount(0);

  await page
    .getByRole("group", { name: "纸张方向" })
    .getByRole("button", { name: "纵向" })
    .click();
  for (const [name, value] of [
    ["行数", "1"],
    ["列数", "2"],
    ["起始编号", "98"],
    ["编号位数", "3"],
    ["总数量", "5"],
  ]) {
    const input = page.getByRole("spinbutton", { name, exact: true });
    await input.fill(value);
    await input.blur();
    await expect(input).toHaveValue(value);
  }
  await page
    .getByRole("textbox", { name: "前缀", exact: true })
    .fill("设备% A-");
  await page.getByRole("switch", { name: "生成二维码" }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "生成 PDF 文档" }).click();
  const download = await downloadPromise;
  const pdfPath = testInfo.outputPath("qr-roundtrip.pdf");
  await download.saveAs(pdfPath);
  await testInfo.attach("downloaded QR PDF", {
    path: pdfPath,
    contentType: "application/pdf",
  });
  const decoded = await decodePdfQrColumns(
    await readFile(pdfPath),
    (pageNumber) => testInfo.outputPath(`qr-page-${pageNumber}.png`),
  );

  // Literal expectations intentionally share no production formatting or QR code.
  // This checks padding across 099/100, Unicode, spaces, and literal URL symbols.
  expect(decoded).toEqual([
    [
      "https://example.test/资产?q=50% &id=设备% A-098",
      "https://example.test/资产?q=50% &id=设备% A-099",
    ],
    [
      "https://example.test/资产?q=50% &id=设备% A-100",
      "https://example.test/资产?q=50% &id=设备% A-101",
    ],
    ["https://example.test/资产?q=50% &id=设备% A-102", null],
  ]);
});
