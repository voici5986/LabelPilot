import { inflateSync } from "node:zlib";

import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { createCollisionPng } from "../src/test/pngFixtures";
import { resetForE2e } from "./helpers";

async function downloadPdf(page: Page, testInfo: TestInfo, pages: number) {
  const workerPromise = page.waitForEvent("worker", {
    predicate: (worker) => /\/assets\/pdf\.worker-.*\.js$/.test(worker.url()),
  });
  const downloadPromise = page.waitForEvent("download");
  const failureAlert = page
    .getByRole("alert")
    .filter({ hasText: "生成 PDF 失败" });
  const resultPromise = Promise.race([
    Promise.all([downloadPromise, workerPromise]),
    failureAlert.waitFor({ state: "visible" }).then(async () => {
      throw new Error(await failureAlert.innerText());
    }),
  ]);
  await page.getByRole("button", { name: "生成 PDF 文档" }).click();
  const [download] = await resultPromise;
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toMatch(
    /^label_\d{6}_\d{6}_\d{3}\.pdf$/,
  );
  const chunks: Buffer[] = [];
  for await (const chunk of await download.createReadStream())
    chunks.push(Buffer.from(chunk));
  const bytes = Buffer.concat(chunks);
  expect(bytes.length).toBeGreaterThan(1_000);
  expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(bytes.subarray(-1_024).toString("ascii")).toContain("%%EOF");
  const pdf = bytes.toString("latin1");
  expect(pdf.match(/\/Type \/Page\b/g)).toHaveLength(pages);
  await download.saveAs(testInfo.outputPath("browser-smoke.pdf"));
  // Inspect streams directly: this does not require a browser's PDF viewer.
  const streams = Array.from(
    pdf.matchAll(/<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g),
    (match) => ({
      dictionary: match[1],
      bytes: match[1].includes("/FlateDecode")
        ? inflateSync(Buffer.from(match[2], "latin1"))
        : Buffer.from(match[2], "latin1"),
    }),
  );
  const content = streams
    .filter((stream) => !stream.dictionary.includes("/Subtype /Image"))
    .map((stream) => stream.bytes.toString("latin1"))
    .join("\n");
  return { pdf, streams, content };
}

async function hasWorkerOffscreenCanvas(page: Page): Promise<boolean> {
  // Probe a real module worker without replacing any production browser API.
  return page.evaluate(async () => {
    const url = URL.createObjectURL(
      new Blob(["postMessage(typeof OffscreenCanvas === 'function')"], {
        type: "text/javascript",
      }),
    );
    let worker: Worker | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      worker = new Worker(url, { type: "module" });
      return await new Promise<boolean>((resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("Module worker capability probe timed out")),
          5_000,
        );
        worker!.onmessage = (event) => {
          if (typeof event.data !== "boolean")
            reject(new Error("Invalid worker capability response"));
          else resolve(event.data);
        };
        worker!.onerror = (event) =>
          reject(
            new Error(
              `Module worker capability probe failed: ${event.message}`,
            ),
          );
      });
    } finally {
      clearTimeout(timer);
      worker?.terminate();
      URL.revokeObjectURL(url);
    }
  });
}

test.beforeEach(async ({ page }) => {
  await resetForE2e(page);
});

test("image upload previews and downloads a real worker PDF", async ({
  page,
}, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await page.getByLabel("点击上传标签图片").setInputFiles({
    name: "smoke-red.png",
    mimeType: "image/png",
    buffer: Buffer.from(createCollisionPng("red")),
  });
  await expect(page.getByText("smoke-red.png", { exact: true })).toBeVisible();
  const thumbnails = page
    .getByRole("region", { name: "纸张预览" })
    .locator("img");
  await expect(thumbnails).toHaveCount(9);
  const thumbnail = thumbnails.first();
  await expect(thumbnail).toBeVisible();
  await expect
    .poll(() =>
      thumbnail.evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBe(32);

  const { pdf, streams, content } = await downloadPdf(page, testInfo, 1);
  expect(pdf.match(/\/Subtype \/Image/g)).toHaveLength(1);
  expect(content.match(/\/I\d+ Do/g)).toEqual(Array(9).fill("/I0 Do"));
  const image = streams.find((stream) =>
    stream.dictionary.includes("/Subtype /Image"),
  );
  expect(image?.bytes.length).toBe(32 * 97);
  const bottomRow = Array.from(image!.bytes.subarray(-97));
  expect(bottomRow.shift()).toBe(1); // PNG Sub filter emitted by jsPDF.
  for (let index = 3; index < bottomRow.length; index++)
    bottomRow[index] = (bottomRow[index] + bottomRow[index - 3]) & 255;
  expect(bottomRow).toEqual(
    Array.from({ length: 32 }, () => [255, 0, 0]).flat(),
  );
  expect(pageErrors).toEqual([]);
});

test("ASCII numbering and QR download through the real worker", async ({
  page,
}, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "自动编号" }).click();
  await page.getByRole("textbox", { name: "前缀", exact: true }).fill("SN-");
  await page.getByRole("spinbutton", { name: "总数量" }).fill("10");
  await page.getByRole("switch", { name: "生成二维码" }).click();
  const { pdf, content } = await downloadPdf(page, testInfo, 2);
  expect(pdf).not.toContain("/Subtype /Image");
  expect(content).toContain("(SN-001) Tj");
  expect(content).toContain("(SN-010) Tj");
  expect(content.match(/\bre\s+f\b/g)?.length ?? 0).toBeGreaterThan(100);
  expect(pageErrors).toEqual([]);
});

test("Unicode QR uses worker raster support or reports unsupported capability and recovers", async ({
  page,
}, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  const supportsUnicode = await hasWorkerOffscreenCanvas(page);
  await page.getByRole("button", { name: "自动编号" }).click();
  await page.getByRole("textbox", { name: "前缀", exact: true }).fill("资产-");
  await page.getByRole("spinbutton", { name: "总数量" }).fill("10");
  await page.getByRole("switch", { name: "生成二维码" }).click();
  if (!supportsUnicode) {
    const downloads: string[] = [];
    page.on("download", (download) =>
      downloads.push(download.suggestedFilename()),
    );
    await page.getByRole("button", { name: "生成 PDF 文档" }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "生成 PDF 失败: 当前浏览器无法将 Unicode 文本写入 PDF。",
    );
    await expect(
      page.getByRole("button", { name: "生成 PDF 失败" }),
    ).toBeDisabled();
    const prefix = page.getByRole("textbox", { name: "前缀", exact: true });
    await expect(prefix).toBeEnabled({ timeout: 1_000 });
    await prefix.fill("SN-");
    await expect(prefix).toHaveValue("SN-");
    // The real three-second error reset must restore a usable Generate button.
    await expect(
      page.getByRole("button", { name: "生成 PDF 文档" }),
    ).toBeEnabled({ timeout: 5_000 });
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(downloads).toEqual([]);
    expect(pageErrors).toEqual([]);
    return;
  }
  const { pdf, content } = await downloadPdf(page, testInfo, 2);
  // Each Unicode label is rasterized; QR modules remain filled vector rectangles.
  expect(pdf.match(/\/Subtype \/Image/g)).toHaveLength(10);
  expect(content.match(/\/I\d+ Do/g)).toHaveLength(10);
  expect(content.match(/\bre\s+f\b/g)?.length ?? 0).toBeGreaterThan(100);
  expect(pdf).not.toContain("/SMask");
  expect(pageErrors).toEqual([]);
});
