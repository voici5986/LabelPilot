import { inflateSync } from "node:zlib";

import { expect, test } from "@playwright/test";

import { createCollisionPng, createScanlinePng } from "../src/test/pngFixtures";
import {
  calculateLabelLayout,
  DEFAULT_LAYOUT_CONFIG,
  DEFAULT_TEXT_CONFIG,
  formatLabelText,
  getLabelTextFontSizeMm,
  MM_PER_PT,
} from "../src/utils/layoutMath";
import { PDF_WORKER_PROTOCOL_VERSION } from "../src/utils/pdfWorkerProtocol";
import { resetForE2e } from "./helpers";

test("real browser worker preserves both PNGs with colliding implicit aliases", async ({
  page,
}) => {
  await resetForE2e(page);
  await page.goto("/");
  let workerUrl = "";
  page.on("request", (request) => {
    if (/\/assets\/pdf\.worker-.*\.js$/.test(request.url()))
      workerUrl = request.url();
  });
  await page.getByLabel("点击上传标签图片").setInputFiles(
    ["red", "blue"].map((color) => ({
      name: `${color}.png`,
      mimeType: "image/png",
      buffer: Buffer.from(createCollisionPng(color as "red" | "blue")),
    })),
  );
  await expect(page.getByText("red.png", { exact: true })).toBeVisible();
  await expect(page.getByText("blue.png", { exact: true })).toBeVisible();
  await page
    .getByRole("textbox", { name: "red.png 的数量", exact: true })
    .fill("3");
  await page
    .getByRole("textbox", { name: "blue.png 的数量", exact: true })
    .fill("2");
  await page
    .getByRole("textbox", { name: "blue.png 的数量", exact: true })
    .blur();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "生成 PDF 文档" }).click();
  const download = await downloadPromise;
  const chunks: Buffer[] = [];
  for await (const chunk of await download.createReadStream())
    chunks.push(Buffer.from(chunk));
  const pdf = Buffer.concat(chunks).toString("latin1");
  expect(pdf.match(/\/Subtype \/Image/g)).toHaveLength(2);
  expect(pdf).not.toContain("/SMask");
  const draws = Array.from(
    pdf.matchAll(/<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g),
  ).flatMap((match) => {
    const content = match[1].includes("/FlateDecode")
      ? inflateSync(Buffer.from(match[2], "latin1")).toString("latin1")
      : match[2];
    return Array.from(content.matchAll(/\/(I\d+) Do/g), (draw) => draw[1]);
  });
  expect(draws).toEqual(["I0", "I0", "I0", "I1", "I1"]);
  const rows = Array.from(
    pdf.matchAll(/<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g),
  )
    .map((match) =>
      match[1].includes("/FlateDecode")
        ? inflateSync(Buffer.from(match[2], "latin1"))
        : Buffer.from(match[2], "latin1"),
    )
    .filter((stream) => stream.length === 32 * 97)
    .map((stream) => {
      const row = Array.from(stream.subarray(-97));
      expect(row.shift()).toBe(1);
      for (let index = 3; index < row.length; index++)
        row[index] = (row[index] + row[index - 3]) & 255;
      return row;
    });
  expect(rows).toContainEqual(
    Array.from({ length: 32 }, () => [255, 0, 0]).flat(),
  );
  expect(rows).toContainEqual(
    Array.from({ length: 32 }, () => [0, 0, 255]).flat(),
  );
  // Bypass upload admission deliberately: the worker is its own trust boundary.
  expect(workerUrl).not.toBe("");
  const invalidFilter = Array.from({ length: 3104 }, () => 0);
  invalidFilter[97] = 5;
  const shortProbe = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAGUlEQVR4nO3BAQ0AAADCoPdP7WYOoAAAAG4MHwABtJynVgAAAABJRU5ErkJggg==",
    "base64",
  );
  for (const png of [
    shortProbe,
    createScanlinePng(Array.from({ length: 3105 }, () => 0)),
    createScanlinePng(invalidFilter),
  ]) {
    const result = await page.evaluate(
      async ({ url, bytes, config, textConfig, protocolVersion }) => {
        const worker = new Worker(url, { type: "module" });
        try {
          return await new Promise((resolve, reject) => {
            worker.onerror = () => reject(new Error("Worker failed"));
            worker.onmessage = (event) => {
              if (event.data.type !== "progress") resolve(event.data);
            };
            const buffer = new Uint8Array(bytes).buffer;
            worker.postMessage(
              {
                type: "generate",
                requestId: "raw-browser-request",
                data: {
                  protocolVersion,
                  config,
                  textConfig,
                  appMode: "image",
                  imageItems: [
                    {
                      id: "untrusted",
                      count: 1,
                      name: "bad-scanlines.png",
                      type: "image/png",
                      buffer,
                    },
                  ],
                },
              },
              [buffer],
            );
          });
        } finally {
          worker.terminate();
        }
      },
      {
        url: workerUrl,
        bytes: Array.from(png),
        config: DEFAULT_LAYOUT_CONFIG,
        textConfig: DEFAULT_TEXT_CONFIG,
        protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
      },
    );
    expect(result).toMatchObject({
      requestId: "raw-browser-request",
      protocolVersion: PDF_WORKER_PROTOCOL_VERSION,
      type: "error",
      data: {
        code: "image_error_decode",
        params: { name: "bad-scanlines.png" },
      },
    });
  }
});

test("browser bundled jsPDF centers ASCII text using its middle baseline", async ({
  page,
}) => {
  await resetForE2e(page);
  await page.goto("/");
  await page.getByRole("button", { name: "全局设置" }).click();
  await page.getByRole("button", { name: "自动编号" }).click();
  await page.getByRole("button", { name: "全局设置" }).click();
  await page.getByRole("spinbutton", { name: "总数量" }).fill("1");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "生成 PDF 文档" }).click();
  const chunks: Buffer[] = [];
  for await (const chunk of await (await downloadPromise).createReadStream())
    chunks.push(Buffer.from(chunk));
  const pdf = Buffer.concat(chunks).toString("latin1");
  const text = formatLabelText(0, DEFAULT_TEXT_CONFIG);
  const content = Array.from(
    pdf.matchAll(/<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g),
  )
    .map((match) =>
      match[1].includes("/FlateDecode")
        ? inflateSync(Buffer.from(match[2], "latin1")).toString("latin1")
        : match[2],
    )
    .find((stream) => stream.includes(`(${text}) Tj`))!;
  const layout = calculateLabelLayout(DEFAULT_LAYOUT_CONFIG);
  const pos = layout.positions[0];
  const fontSize = getLabelTextFontSizeMm(text, pos, false) / MM_PER_PT;
  const x =
    (pos.x + pos.width / 2) / MM_PER_PT - (text.length * 0.6 * fontSize) / 2;
  // Installed browser jsPDF defaults to lineHeightFactor=1.15.
  const y =
    (layout.pageHeight - pos.y - pos.height / 2) / MM_PER_PT -
    (0.5 - (1.15 - 1)) * fontSize;
  const position = content.match(/([\d.]+) ([\d.]+) Td/)!;
  expect(Number(position[1])).toBeCloseTo(x, 8);
  expect(Number(position[2])).toBeCloseTo(y, 8);
});
