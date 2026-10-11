import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { checkPrecache } from "./check-precache.mjs";

/**
 * @param {(assets: Record<string, string>, urls: string[]) => unknown} change
 * @param {(result: Promise<void>) => Promise<unknown>} assertion
 */
async function withBuild(change, assertion) {
  const dist = await mkdtemp(path.join(os.tmpdir(), "labelpilot-precache-"));
  try {
    /** @type {Record<string, string>} */
    const assets = {
      "index-main.js": "import('./lazy-feature.js')",
      "pdf.worker-test.js": "",
      "lazy-feature.js": "export default 1",
      "index-style.css":
        "url(MapleMono-Subset-test.woff2) url(MiSansVF_gb2312-test.woff2)",
      "MapleMono-Subset-test.woff2": "font",
      "MiSansVF_gb2312-test.woff2": "font",
    };
    const urls = [
      "index.html",
      ...Object.keys(assets).map((name) => `assets/${name}`),
    ];
    change(assets, urls);
    await mkdir(path.join(dist, "assets"));
    await Promise.all(
      Object.entries(assets).map(([name, content]) =>
        writeFile(path.join(dist, "assets", name), content),
      ),
    );
    await writeFile(
      path.join(dist, "sw.js"),
      `e.precacheAndRoute([${urls.map((url) => `{url:${JSON.stringify(url)},revision:null}`).join(",")}],{});`,
    );
    await assertion(checkPrecache(dist));
  } finally {
    await rm(dist, { recursive: true, force: true });
  }
}

describe("production precache guard", () => {
  it("rejects a nonexistent static import", async () => {
    await withBuild(
      (assets) => {
        assets["pdf.worker-test.js"] =
          'import { render } from "./missing-static.js"';
      },
      async (result) =>
        expect(result).rejects.toThrow("Missing dynamic import dependency"),
    );
  });
  it("rejects an emitted worker referencing a nonexistent import", async () => {
    await withBuild(
      (assets) => {
        assets["pdf.worker-test.js"] = "import(`./missing-dependency.js`)";
      },
      async (result) =>
        expect(result).rejects.toThrow("Missing dynamic import dependency"),
    );
  });
  it("rejects a missing PDF worker", async () => {
    await withBuild(
      (assets) => {
        delete assets["pdf.worker-test.js"];
      },
      async (result) =>
        expect(result).rejects.toThrow("Missing production PDF worker"),
    );
  });
  it("rejects a required font omitted from the cache manifest", async () => {
    await withBuild(
      (_assets, urls) =>
        urls.splice(urls.indexOf("assets/MiSansVF_gb2312-test.woff2"), 1),
      async (result) =>
        expect(result).rejects.toThrow("Offline dependency is not precached"),
    );
  });
  it("accepts a complete offline build", async () => {
    await withBuild(
      () => {},
      async (result) => expect(await result).toBeUndefined(),
    );
  });
  it.each([
    "html2canvas-optional.js",
    "purify.es-optional.js",
    "index.es-optional.js",
  ])("rejects disabled renderer %s even when precached", async (name) => {
    await withBuild(
      (assets, urls) => {
        assets[name] = "";
        urls.push(`assets/${name}`);
      },
      async (result) =>
        expect(result).rejects.toThrow(
          "Disabled PDF HTML/SVG renderer emitted",
        ),
    );
  });
  it("rejects an omitted lazy dependency even when entry and worker are cached", async () => {
    await withBuild(
      (_assets, urls) => urls.splice(urls.indexOf("assets/lazy-feature.js"), 1),
      async (result) => expect(result).rejects.toThrow("lazy-feature.js"),
    );
  });
  it("rejects an oversized font rather than accepting Workbox's omitted asset", async () => {
    await withBuild(
      (assets) => {
        assets["MiSansVF_gb2312-test.woff2"] = "x".repeat(3 * 1024 * 1024 + 1);
      },
      async (result) =>
        expect(result).rejects.toThrow("exceeds precache budget"),
    );
  });
  it("rejects removal of a required font from output", async () => {
    await withBuild(
      (assets) => {
        delete assets["MapleMono-Subset-test.woff2"];
      },
      async (result) =>
        expect(result).rejects.toThrow("Missing or ambiguous font"),
    );
  });
  it("rejects output fonts no longer referenced by the app stylesheet", async () => {
    await withBuild(
      (assets) => {
        assets["index-style.css"] = "body {}";
      },
      async (result) => expect(result).rejects.toThrow("not referenced"),
    );
  });
});
