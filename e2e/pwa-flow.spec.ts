import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { resetForE2e } from "./helpers";

// These tests mutate one local server's service-worker revision.
test.describe.configure({ mode: "serial" });

let server: Server;
let origin: string;
let swRevision = 1;
const dist = path.resolve("dist");
const mimeTypes: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      const file = path.resolve(
        dist,
        `.${pathname === "/" ? "/index.html" : pathname}`,
      );
      if (!file.startsWith(`${dist}${path.sep}`)) {
        response.writeHead(403).end();
        return;
      }
      let bytes = await readFile(file);
      if (pathname === "/sw.js") {
        // Change only served bytes: exercise the actual production worker and
        // update lifecycle without modifying dist or reaching external hosts.
        bytes = Buffer.concat([
          bytes,
          Buffer.from(`\n// E2E revision ${swRevision}\n`),
        ]);
      }
      response.writeHead(200, {
        "Content-Type":
          mimeTypes[path.extname(file)] ?? "application/octet-stream",
      });
      response.end(bytes);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing PWA test server port");
  origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

async function openControlledApp(page: Page) {
  await resetForE2e(page);
  await page.goto(origin);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
}

test("production cache supports cold offline fonts and Unicode QR PDF worker", async ({
  page,
  context,
}, testInfo) => {
  await openControlledApp(page);
  const cached = await page.evaluate(async () => {
    const keys = await Promise.all(
      (await caches.keys()).map(async (name) =>
        (await caches.open(name)).keys(),
      ),
    );
    return keys.flat().map((request) => request.url);
  });
  expect(cached.some((url) => /MapleMono-Subset-.+\.woff2/u.test(url))).toBe(
    true,
  );
  expect(cached.some((url) => /MiSansVF_gb2312-.+\.woff2/u.test(url))).toBe(
    true,
  );
  expect(cached.some((url) => /pdf\.worker-.+\.js/u.test(url))).toBe(true);
  // No PDF generation online: the new document must load its worker cold.
  await page.close();
  await context.setOffline(true);
  const offlinePage = await context.newPage();
  await resetForE2e(offlinePage);
  const scripts: string[] = [];
  offlinePage.on("request", (request) => scripts.push(request.url()));
  await offlinePage.goto(origin);
  expect(
    await offlinePage.evaluate(() =>
      Boolean(navigator.serviceWorker.controller),
    ),
  ).toBe(true);
  const fonts = await offlinePage.evaluate(async () => {
    const loaded = await Promise.all([
      document.fonts.load('16px "MiSans"', "资产"),
      document.fonts.load('16px "MapleMono"', "Label123"),
    ]);
    return loaded.map((faces) => faces.map((face) => face.status));
  });
  expect(fonts).toEqual([["loaded"], ["loaded"]]);
  await offlinePage.getByRole("button", { name: "全局设置" }).click();
  await offlinePage.getByRole("button", { name: "自动编号" }).click();
  await offlinePage.getByRole("button", { name: "全局设置" }).click();
  await offlinePage
    .getByRole("textbox", { name: "前缀", exact: true })
    .fill("资产-");
  await offlinePage.getByRole("spinbutton", { name: "总数量" }).fill("10");
  await offlinePage.getByRole("switch", { name: "生成二维码" }).click();
  const downloadPromise = offlinePage.waitForEvent("download");
  await offlinePage.getByRole("button", { name: "生成 PDF 文档" }).click();
  const download = await downloadPromise;
  const artifact = testInfo.outputPath("offline-unicode-qr.pdf");
  await download.saveAs(artifact);
  const pdf = await readFile(artifact);
  expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(pdf.subarray(-1024).toString("ascii")).toContain("%%EOF");
  expect(
    pdf.toString("latin1").match(/\/Type \/Page\b/gu)?.length,
  ).toBeGreaterThanOrEqual(2);
  // Unicode text uses real OffscreenCanvas rasterization; QR paths and image
  // objects prove this exercised more than a download of an empty PDF shell.
  expect(pdf.toString("latin1")).toContain("/Subtype /Image");
  expect(pdf.byteLength).toBeGreaterThan(10_000);
  expect(scripts.some((url) => /pdf\.worker-.+\.js/u.test(url))).toBe(true);
});

test("changed production service worker prompts and activates through update UI", async ({
  page,
}) => {
  await openControlledApp(page);
  swRevision += 1;
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) throw new Error("Missing registration");
    await registration.update();
  });
  await expect(
    page.getByRole("status").filter({ hasText: "发现新版本" }),
  ).toBeVisible();
  expect(
    await page.evaluate(async () =>
      Boolean((await navigator.serviceWorker.getRegistration())?.waiting),
    ),
  ).toBe(true);
  const reload = page.waitForEvent("framenavigated", {
    predicate: (frame) => frame === page.mainFrame(),
  });
  await page.getByRole("button", { name: "立即更新并刷新" }).click();
  await reload;
  await expect(page.getByRole("button", { name: "全局设置" })).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "发现新版本" }),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return Boolean(
          registration?.active &&
          !registration.waiting &&
          navigator.serviceWorker.controller,
        );
      }),
    )
    .toBe(true);
});
