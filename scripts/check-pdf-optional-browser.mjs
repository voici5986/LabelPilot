// Verify the actual emitted modules, including their cold offline imports.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const dist = fileURLToPath(new URL("../dist", import.meta.url));
const assets = await readdir(path.join(dist, "assets"));
const modules = ["Html2canvas", "DomPurify", "Canvg"].map((name) => {
  const matches = assets.filter(
    (asset) => asset.startsWith(`pdfOptional${name}-`) && asset.endsWith(".js"),
  );
  assert.equal(
    matches.length,
    1,
    `Missing or ambiguous production ${name} stub`,
  );
  return `/assets/${matches[0]}`;
});
/** @type {Record<string, string>} */
const mime = {
  ".js": "text/javascript",
  ".html": "text/html",
  ".css": "text/css",
  ".webmanifest": "application/manifest+json",
};
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    const file = path.resolve(
      dist,
      `.${url.pathname === "/" ? "/index.html" : url.pathname}`,
    );
    if (!file.startsWith(`${dist}${path.sep}`)) {
      response.writeHead(403).end();
      return;
    }
    const bytes = await readFile(file);
    response
      .writeHead(200, {
        "Content-Type": mime[path.extname(file)] ?? "application/octet-stream",
      })
      .end(bytes);
  } catch {
    response.writeHead(404).end();
  }
});
/** @type {import('@playwright/test').Browser | undefined} */
let browser;
try {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(undefined);
    });
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({
    channel: process.env.CI ? "chromium" : "chrome",
  });
  const context = await browser.newContext();
  let page = await context.newPage();
  await page.goto(origin);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  });
  await page.close();
  await context.setOffline(true);
  page = await context.newPage();
  await page.goto(origin);
  const errors = await page.evaluate(async (urls) => {
    const [html, purify, svg] = await Promise.all(
      urls.map((url) => import(url)),
    );
    const calls = [
      () => html.default(),
      () => purify.default.sanitize(),
      () => svg.Canvg.fromString(),
      () => svg.default.fromString(),
    ];
    return calls.map((call) => {
      try {
        call();
        return "NO ERROR";
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    });
  }, modules);
  for (const error of errors)
    assert.match(
      error,
      /LabelPilot does not support jsPDF HTML\/SVG rendering/u,
    );
  console.log(
    "Production PDF optional renderers fail explicitly through cold offline browser imports (4 export contracts)",
  );
} finally {
  try {
    await browser?.close();
  } finally {
    if (server.listening) {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve(undefined))),
      );
    }
  }
}
