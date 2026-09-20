/**
 * 文档链接检查：校验 Markdown 中的相对链接是否存在。
 *
 * 用法：
 *   node scripts/check-docs-links.mjs             # 仅内部链接（严格，CI 使用）
 *   node scripts/check-docs-links.mjs --external  # 附加检查外部 http(s) 链接（较慢，网络相关）
 *
 * 规则：
 * - 内部链接：目标文件（或目录）必须存在，`#片段` 只校验文件部分；失败即退出码 1。
 * - 外部链接：仅在 --external 时检查；404/410 记为失败，限流（403/429）与网络错误记为警告，
 *   避免 CI 因外部站点抖动误报。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const checkExternal = process.argv.includes("--external");
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "test-results",
  "playwright-report",
  "chrome",
]);
const LINK_PATTERN = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const EXTERNAL_TIMEOUT_MS = 10_000;
const EXTERNAL_CONCURRENCY = 4;

function collectMarkdownFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectMarkdownFiles(full, acc);
    else if (entry.name.endsWith(".md")) acc.push(full);
  }
  return acc;
}

function isExternalLink(target) {
  return /^https?:\/\//i.test(target);
}

function toRelative(filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function resolveInternalTarget(filePath, target) {
  const withoutAnchor = target.split("#")[0];
  if (!withoutAnchor) return null;
  let decoded = withoutAnchor;
  try {
    decoded = decodeURIComponent(withoutAnchor);
  } catch {
    // 保留原样，按字面路径查找
  }
  return path.resolve(path.dirname(filePath), decoded);
}

async function checkExternalUrl(url) {
  const request = async (method) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), EXTERNAL_TIMEOUT_MS);
    try {
      return await fetch(url, {
        method,
        redirect: "follow",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    let response = await request("HEAD");
    if (response.status === 405 || response.status === 501) {
      response = await request("GET");
    }
    if (response.status === 404 || response.status === 410) {
      return { ok: false, detail: `HTTP ${response.status}` };
    }
    if (response.status >= 400) {
      return {
        ok: true,
        warning: `HTTP ${response.status}（限流或防护，已忽略）`,
      };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: true,
      warning: `请求失败（${error.name}，已忽略）`,
    };
  }
}

async function main() {
  const files = collectMarkdownFiles(root);
  const internalLinks = [];
  const externalLinks = new Map();

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    for (const match of content.matchAll(LINK_PATTERN)) {
      const target = match[1];
      if (target.startsWith("#") || target.startsWith("mailto:")) continue;
      if (isExternalLink(target)) {
        if (checkExternal && !externalLinks.has(target)) {
          externalLinks.set(target, toRelative(file));
        }
        continue;
      }
      internalLinks.push({ from: file, target });
    }
  }

  const brokenInternal = [];
  for (const { from, target } of internalLinks) {
    const resolved = resolveInternalTarget(from, target);
    if (resolved && !fs.existsSync(resolved)) {
      brokenInternal.push({ from: toRelative(from), target });
    }
  }

  console.log(
    `检查了 ${files.length} 个 Markdown 文件：${internalLinks.length} 个内部链接${
      checkExternal ? `，${externalLinks.size} 个外部链接` : ""
    }。`,
  );

  if (brokenInternal.length > 0) {
    console.error("\n以下内部链接的目标不存在：");
    for (const { from, target } of brokenInternal) {
      console.error(`  - ${from} -> ${target}`);
    }
  }

  let brokenExternal = [];
  if (checkExternal && externalLinks.size > 0) {
    const entries = [...externalLinks.entries()];
    const results = [];
    for (let i = 0; i < entries.length; i += EXTERNAL_CONCURRENCY) {
      const batch = entries.slice(i, i + EXTERNAL_CONCURRENCY);
      results.push(
        ...(await Promise.all(
          batch.map(async ([url, from]) => ({
            url,
            from,
            ...(await checkExternalUrl(url)),
          })),
        )),
      );
    }
    brokenExternal = results.filter((item) => !item.ok);
    const warnings = results.filter((item) => item.warning);
    for (const item of warnings) {
      console.warn(`  警告：${item.from} -> ${item.url}：${item.warning}`);
    }
    if (brokenExternal.length > 0) {
      console.warn("\n以下外部链接返回 404/410（不阻塞退出码）：");
      for (const item of brokenExternal) {
        console.warn(`  - ${item.from} -> ${item.url}：${item.detail}`);
      }
    }
  }

  if (brokenInternal.length > 0) {
    console.error("\n内部链接检查失败。");
    process.exitCode = 1;
    return;
  }

  console.log("内部链接检查通过。");
}

await main();
