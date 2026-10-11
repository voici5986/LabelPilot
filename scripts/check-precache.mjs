import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// These optional jsPDF renderers are disabled by Vite aliases. Their return
// means that unsupported HTML/SVG code has bypassed the bundle contract.
const disabledPdfChunks = /^(?:html2canvas-|purify\.es-|index\.es-).+\.js$/u;
const fontBudget = 3 * 1024 * 1024;

/** @param {string} dist */
export async function checkPrecache(dist) {
  const sw = await readFile(path.join(dist, "sw.js"), "utf8");
  const manifest = sw.match(/\.precacheAndRoute\((\[.*?\]),/su)?.[1];
  if (!manifest) throw new Error("Missing production SW precache manifest");
  const urls = new Set(
    Array.from(manifest.matchAll(/\burl:\s*"([^"]+)"/gu), (match) => match[1]),
  );
  if (!urls.has("index.html")) throw new Error("index.html is not precached");

  // Workbox's generated SW and its AMD runtime bootstrap the cache itself.
  // Validate that runtime explicitly; every other emitted JS must be cached.
  const bootstrap = new Set(["sw.js"]);
  for (const [, runtime] of sw.matchAll(
    /define\(\["\.\/(workbox-[^"/]+)"\]/gu,
  )) {
    const name = `${runtime}.js`;
    await stat(path.join(dist, name)).catch(() => {
      throw new Error(`Missing service worker runtime: ${name}`);
    });
    bootstrap.add(name);
  }
  const emitted = await readdir(dist, { recursive: true });
  for (const file of emitted.filter((name) => name.endsWith(".js"))) {
    const url = file.replaceAll(path.sep, "/");
    if (disabledPdfChunks.test(path.basename(file))) {
      throw new Error(`Disabled PDF HTML/SVG renderer emitted: ${file}`);
    }
    if (!bootstrap.has(url) && !urls.has(url)) {
      throw new Error(`Offline dependency is not precached: ${url}`);
    }
  }

  const assets = await readdir(path.join(dist, "assets"), { recursive: true });
  for (const asset of assets) {
    if (disabledPdfChunks.test(path.basename(asset))) {
      throw new Error(`Disabled PDF HTML/SVG renderer emitted: ${asset}`);
    }
  }
  const styles = (
    await Promise.all(
      assets
        .filter((asset) => asset.endsWith(".css"))
        .map((asset) => readFile(path.join(dist, "assets", asset), "utf8")),
    )
  ).join("\n");
  for (const font of ["MapleMono-Subset-", "MiSansVF_gb2312-"]) {
    const matches = assets.filter(
      (asset) => asset.startsWith(font) && asset.endsWith(".woff2"),
    );
    if (matches.length !== 1)
      throw new Error(`Missing or ambiguous font: ${font}`);
    if (!styles.includes(matches[0]))
      throw new Error(
        `Required font is not referenced by production CSS: ${matches[0]}`,
      );
    const size = (await stat(path.join(dist, "assets", matches[0]))).size;
    if (size === 0 || size > fontBudget) {
      throw new Error(
        `Font ${matches[0]} exceeds precache budget (${size} bytes)`,
      );
    }
  }
  if (!assets.some((asset) => /^pdf\.worker-.+\.js$/u.test(asset))) {
    throw new Error("Missing production PDF worker");
  }
  if (!assets.some((asset) => /^index-.+\.js$/u.test(asset))) {
    throw new Error("Missing production application entry");
  }
  // Require all emitted code and styles, including worker and dynamic-import
  // dependencies. This catches new chunk names without maintaining a list.
  for (const asset of assets) {
    if (!/\.(?:js|css|woff2)$/u.test(asset)) continue;
    const url = `assets/${asset.replaceAll(path.sep, "/")}`;
    if (!urls.has(url))
      throw new Error(`Offline dependency is not precached: ${url}`);
  }
  for (const asset of emitted.filter((name) => name.endsWith(".js"))) {
    const source = await readFile(path.join(dist, asset), "utf8");
    const imports = [
      ...source.matchAll(/\bimport\s*\(\s*["'`]([^"'`$]+)["'`]\s*\)/gu),
      ...source.matchAll(
        /\b(?:import|export)\s*(?:[^;"'`]*?\bfrom\s*)?["'`]([^"'`$]+)["'`]/gu,
      ),
    ];
    for (const [, target] of imports) {
      const file = path.resolve(dist, path.dirname(asset), target);
      if (!file.startsWith(`${path.resolve(dist)}${path.sep}`)) {
        throw new Error(`Dynamic import escapes production output: ${target}`);
      }
      await stat(file).catch(() => {
        throw new Error(`Missing dynamic import dependency: ${target}`);
      });
      const url = path.relative(dist, file).replaceAll(path.sep, "/");
      if (!urls.has(url)) {
        throw new Error(`Dynamic import dependency is not precached: ${url}`);
      }
    }
  }
  console.log(
    "Production precache verified: application, PDF worker, styles and fonts",
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await checkPrecache(fileURLToPath(new URL("../dist", import.meta.url)));
}
